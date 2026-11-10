const {it,afterEach,mock} = require('node:test');
const assert = require('node:assert/strict');
const narrative = require('../services/itineraryNarrativeService');
const llm = require('../services/llmclient');
const {narrativeFor} = require('./helpers/narrative');
const {storedItinerary} = require('../services/itineraryStorageService');
const {buildOutline} = require('../services/tripOutlineService');
const {buildSchedule,validateAndEnrich} = require('../services/countryItineraryService');
const {buildDailyPlan} = require('../services/dailyPlanService');
const catalog = require('../services/planningDataService');
const areas = require('../services/stayAreaService');
const SLOTS = ['morning','afternoon','evening'];
afterEach(()=>{mock.restoreAll();narrative.clearNarrativeCache();});

function fixture() {
  const quiz={travelAlterEgo:'Historian',seeAllOrDeeply:'deeply',budgetLevel:'$$',privateEmail:'private@example.test'};
  const outline=buildOutline({countryId:'country-pt',numberOfDays:4,startDate:'2027-06-05',quiz});
  const schedule=buildSchedule(outline,outline.startDate),stop=outline.stops[0],base=catalog.baseById.get(stop.destinationId);
  const discovered=[{stopId:stop.stopId,candidatePlaces:Array.from({length:12},(_,i)=>({
    placeId:`v-${i}`,name:`Museum ${i}`,types:['museum'],category:'attractions',stopId:stop.stopId,
    lat:base.lat+i/10000,lng:base.lng,address:'Private provider street',
  }))}];
  const itinerary=validateAndEnrich(buildDailyPlan({outline,schedule,discovered,quiz}),outline,schedule,discovered,quiz);
  itinerary.startDate=outline.startDate;
  return {itinerary,quiz,discovered};
}

it('requests only text mapped to known IDs and preserves canonical data through saving',async()=>{
  const f=fixture(),before=structuredClone(f.itinerary);
  mock.method(llm,'generateStructured',async request=>{
    const payload=JSON.parse(request.prompt);
    assert.ok(!request.prompt.includes('private@example.test'));assert.ok(!request.prompt.includes('Private provider street'));
    assert.ok(!payload.plan && !payload.schedule);assert.equal(request.operation,'itinerary');
    assert.ok(request.maxOutputTokens>128&&request.maxOutputTokens<16384);
    const data=narrativeFor(payload);assert.equal(request.validateResponse(data),true);
    return {data,model:'model-a',diagnostics:[]};
  });
  const result=await narrative.writeNarrative(f);
  assert.equal(result.model,'model-a');assert.equal(f.itinerary.narrativeSource,'gemini');
  assert.equal(f.itinerary.narrativeCacheHit,false);
  for(let i=0;i<f.itinerary.days.length;i++)for(const slot of SLOTS){
    assert.deepEqual(f.itinerary.days[i][slot].map(p=>[p.placeId,p.address,p.lat,p.lng]),before.days[i][slot].map(p=>[p.placeId,p.address,p.lat,p.lng]));
  }
  const saved=storedItinerary(f.itinerary);
  assert.deepEqual(saved.narrativeDiagnostics,f.itinerary.narrativeDiagnostics);
  assert.ok(saved.days.flatMap(day=>SLOTS.flatMap(slot=>day[slot])).every(p=>p.descriptionSource==='gemini' && !p.address));
  assert.ok(saved.stays.every(stay=>stay.stayAreaSource==='reviewed_catalog' && stay.stayAreaProvenance.sourceUrl));
});

it('keeps validated fields from the best partial response when the second model fails',async()=>{
  const f=fixture();
  mock.method(llm,'generateStructured',async request=>{
    const data=narrativeFor(JSON.parse(request.prompt));
    data.activityDescriptions[0].description='Go inside and enjoy free admission for $10.';
    data.activityDescriptions.push({placeId:'invented',description:'An invented venue.'});
    assert.equal(request.validateResponse(data),false);
    const feedback=request.onInvalidResponse({data,model:'model-a'});
    assert.deepEqual(feedback.repair.placeIds,[data.activityDescriptions[0].placeId]);
    assert.equal(feedback.acceptedText.activityDescriptions.length,JSON.parse(request.prompt).places.length-1);
    assert.ok(!JSON.stringify(feedback).includes('Go inside'));
    assert.ok(!JSON.stringify(feedback).includes('invented'));
    throw Object.assign(new Error('Private upstream details'),{statusCode:503,diagnostics:[{model:'model-b',reason:'provider_unavailable',status:503}]});
  });
  await narrative.writeNarrative(f);
  assert.equal(f.itinerary.narrativeSource,'partial');
  assert.equal(f.itinerary.narrativeDiagnostics.unknownIds,1);
  const activities=f.itinerary.days.flatMap(day=>SLOTS.flatMap(slot=>day[slot]));
  assert.equal(activities.filter(p=>p.descriptionSource==='deterministic_fallback').length,1);
  assert.ok(!JSON.stringify(f.itinerary).includes('Private upstream'));assert.ok(!JSON.stringify(f.itinerary).includes('free admission'));
});

it('removes ambiguous duplicate IDs and rejects unsupported access, time and dietary claims',()=>{
  const f=fixture(),payload=narrative.buildNarrativePayload(f),data=narrativeFor(payload);
  const id=data.activityDescriptions[0].placeId;
  data.activityDescriptions.push({...data.activityDescriptions[0],description:'Different text for the same venue.'});
  const result=narrative.inspectNarrative(data,payload);
  assert.equal(result.complete,false);assert.equal(result.activityDescriptions.has(id),false);assert.equal(result.duplicates,1);
  for(const claim of ['Enjoy the interior.','Walk for 15 minutes.','This is gluten-free.','Visit at 09:00.','The cost is €12.','Savor creative food crafted with seasonal ingredients.','Enjoy gourmet vegetarian dishes.','Discover sweeping viewpoints from this hilltop landmark.','Sample vegan bites here.']){
    const changed=narrativeFor(payload);changed.activityDescriptions[0].description=claim;
    assert.equal(narrative.inspectNarrative(changed,payload).activityDescriptions.has(id),false);
  }
});

it('caches only fully valid generated text and invalidates for changed preferences, dates, or venue facts',async()=>{
  let calls=0;
  mock.method(llm,'generateStructured',async request=>{calls++;return {data:narrativeFor(JSON.parse(request.prompt)),model:'model-a'};});
  await narrative.writeNarrative(fixture());const again=fixture();await narrative.writeNarrative(again);
  assert.equal(calls,1);assert.equal(again.itinerary.narrativeCacheHit,true);
  const preference=fixture();preference.quiz.travelAlterEgo='Explorer';await narrative.writeNarrative(preference);
  const changed=fixture();changed.discovered[0].candidatePlaces.forEach(p=>p.name+=' changed');await narrative.writeNarrative(changed);
  const date=fixture();date.itinerary.startDate='2027-06-06';await narrative.writeNarrative(date);
  assert.equal(calls,4);
});

it('expires cached narratives without caching outages or partial responses',async()=>{
  let now=1000,calls=0,unavailable=false;mock.method(Date,'now',()=>now);
  mock.method(llm,'generateStructured',async request=>{calls++;if(unavailable)throw Object.assign(new Error('offline'),{statusCode:503});return {data:narrativeFor(JSON.parse(request.prompt)),model:'model-a'};});
  await narrative.writeNarrative(fixture());now+=3600001;await narrative.writeNarrative(fixture());assert.equal(calls,2);
  narrative.clearNarrativeCache();
  unavailable=true;
  for(let i=0;i<2;i++){const f=fixture();await narrative.writeNarrative(f);assert.equal(f.itinerary.narrativeSource,'deterministic_fallback');}
  assert.equal(calls,4);
});

it('has sourced accommodation search areas for every enabled base without requesting a provider',()=>{
  mock.method(global,'fetch',()=>assert.fail('Catalog areas must not need live calls'));
  for(const base of catalog.bases){
    const choices=areas.catalogAreas(base.destinationId);
    assert.ok(choices.length,base.destinationId);
    for(const area of choices){assert.match(area.sourceUrl,/^https:\/\//);assert.equal(area.reviewedOn,'2026-10-31');assert.ok(area.name.trim());}
    const stay=areas.stayForStop({...base,name:'City',stopId:'stop-1',nights:3},{});
    assert.ok(stay.recommendedStayArea);assert.equal(stay.stayAreaSource,'reviewed_catalog');
    assert.ok(!/ranks well|straight-line proximity/.test(stay.stayAreaRationale));
  }
});

it('prefers live neighborhood evidence while storing only a sourced editorial replacement',()=>{
  const grouped={attractions:[{placeId:'provider',neighborhood:'Provider-only neighborhood',lat:1,lng:1}]};
  const stay=areas.stayForStop({destinationId:'paris-fr',stopId:'stop-1',name:'Paris',nights:3},grouped);
  assert.equal(stay.recommendedStayArea,'Provider-only neighborhood');assert.equal(stay.stayAreaSource,'google_places');
  const saved=areas.storedStay(stay);assert.equal(saved.recommendedStayArea,'Le Marais');
  assert.ok(!JSON.stringify(saved).includes('Provider-only neighborhood'));
});

it('generates and stores a complete itinerary after malformed provider JSON using the actual SDK and two bounded wire requests',async()=>{
  const f=fixture(),discovery=require('../services/stopDiscoveryService');let calls=0;
  const previous=process.env.GEMINI_API_KEY;process.env.GEMINI_API_KEY='mock-only';
  mock.method(discovery,'discoverStops',async()=>f.discovered);mock.method(console,'warn',()=>{});
  mock.method(global,'fetch',async(_url,init)=>{
    calls++;const body=JSON.parse(init.body);
    assert.ok(body.generationConfig.responseJsonSchema.properties.activityDescriptions);
    const prompt=body.contents[0].parts[0].text.split('\nValidation feedback')[0];
    const data=narrativeFor(JSON.parse(prompt));
    return new Response(JSON.stringify({candidates:[{content:{role:'model',parts:[{text:calls===1?'malformed':JSON.stringify(data)}]},finishReason:'STOP'}]}),{status:200,headers:{'Content-Type':'application/json'}});
  });
  try{
    const {itinerary}=await require('../services/countryItineraryService').generateCountryItinerary({outline:f.itinerary.outline,quiz:f.quiz,startDate:f.itinerary.startDate});
    assert.equal(calls,2);assert.equal(itinerary.narrativeSource,'gemini');
    assert.equal(itinerary.narrativeDiagnostics.attempts[0].reason,'invalid_response');
    assert.equal(itinerary.days.length,4);assert.equal(storedItinerary(itinerary).narrativeSource,'gemini');
  }finally{if(previous===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=previous;}
});

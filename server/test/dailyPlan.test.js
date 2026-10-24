const {describe,it,afterEach,mock}=require('node:test');
const assert=require('node:assert/strict');
const {buildDailyPlan}=require('../services/dailyPlanService');
const {buildOutline,supportedBases}=require('../services/tripOutlineService');
const {buildSchedule,validateAndEnrich,generateCountryItinerary}=require('../services/countryItineraryService');
const {minimumNights}=require('../config/tripPolicy');
const catalog=require('../services/planningDataService');
const discovery=require('../services/stopDiscoveryService');
const llm=require('../services/llmclient');
const {distanceKm}=require('../services/placeGroupingService');
const {storedItinerary}=require('../services/itineraryStorageService');
const {updateTripItinerary}=require('../models/tripModel');
const {docClient}=require('../db/dynamo');
const slots=['morning','afternoon','evening'];
const weekdays=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
afterEach(()=>mock.restoreAll());

function fixture(countryId='country-pl',days=7,quiz={seeAllOrDeeply:'seeAll',travelAlterEgo:'Foodie'}) {
 const outline=buildOutline({countryId,numberOfDays:days,startDate:'2027-06-05',quiz});
 const schedule=buildSchedule(outline,outline.startDate);
 const locations=[...outline.stops.map(stop=>({...stop,locationId:stop.stopId})),...outline.excursions.map(excursion=>({...excursion,locationId:`excursion:${excursion.stopId}:${excursion.destinationId}`}))];
 const discovered=locations.map(location=>{
  const base=catalog.baseById.get(location.destinationId)||catalog.excursions.find(item=>item.destinationId===location.destinationId);
  return {stopId:location.stopId,locationId:location.locationId,candidatePlaces:Array.from({length:36},(_,index)=>({
   placeId:`${location.locationId}-${index}`,name:`Provider venue ${index}`,stopId:location.stopId,locationId:location.locationId,
   category:index%3===0?'food':'attractions',types:index%3===0?['vegetarian_restaurant']:['museum'],rating:4+(index%5)/10,
   lat:base.lat+Math.floor(index/12)*0.05,lng:base.lng+(index%4)*0.001,
   address:'Provider-only address',neighborhood:'Provider-only district',
   openingHours:weekdays.map(day=>`${day}: ${index%3===0?'11:00 AM – 11:00 PM':'9:00 AM – 5:00 PM'}`),
  }))};
 });
 return {outline,schedule,discovered,quiz};
}

function identity(days) {
 return days.map(day=>({day:day.day,stopId:day.stopId,...Object.fromEntries(slots.map(slot=>[slot,day[slot].map(activity=>activity.placeId)]))}));
}

describe('Backend-owned daily scheduling',()=>{
 it('builds useful full days with food, valid hours, travel windows and no repeated venues',()=>{
  const f=fixture(),plan=buildDailyPlan(f);
  const itinerary=validateAndEnrich(plan,f.outline,f.schedule,f.discovered,f.quiz);
  const seen=new Set();
  for(const day of itinerary.days){
   const selected=slots.flatMap(slot=>day[slot]);
   for(const activity of selected){assert.ok(!seen.has(activity.placeId));seen.add(activity.placeId);}
   if(day.type==='full'){
    assert.equal(selected.length,4);
    assert.ok(selected.some(activity=>activity.category==='food'));
    assert.ok(selected.some(activity=>activity.category==='attractions'));
   }else assert.ok(selected.length<=1);
   for(const a of selected)for(const b of selected)assert.ok(distanceKm(a,b)<=8);
  }
  assert.deepEqual(buildDailyPlan(f),plan,'The same assessment and candidates yield the same plan');
 });
 it('reserves scarce days before optional activities and reassigns earlier choices when needed',()=>{
  const f=fixture('country-ie',5,{}),stop=f.outline.stops[0],base=catalog.baseById.get(stop.destinationId);
  const open={A:['Sunday','Monday','Tuesday'],B:['Sunday'],C:['Monday','Tuesday']};
  f.discovered=[{stopId:stop.stopId,locationId:stop.stopId,candidatePlaces:['A','B','C'].map((placeId,index)=>({
   placeId,name:placeId,stopId:stop.stopId,locationId:stop.stopId,category:'attractions',rating:5-index/10,lat:base.lat,lng:base.lng,
   openingHours:weekdays.map(day=>`${day}: ${open[placeId].includes(day)?'9:00 AM – 5:00 PM':'Closed'}`),
  }))}];
  const plan=buildDailyPlan(f);
  assert.deepEqual(plan.days.slice(1,4).map(day=>slots.flatMap(slot=>day[slot]).map(activity=>activity.placeId)),[['B'],['C'],['A']]);
  validateAndEnrich(plan,f.outline,f.schedule,f.discovered,{});
 });
 it('never puts opposite-edge venues together just because both are near the seed',()=>{
  const f=fixture('country-pt',1,{}),stop=f.outline.stops[0],base=catalog.baseById.get(stop.destinationId);
  f.discovered=[{stopId:stop.stopId,locationId:stop.stopId,candidatePlaces:[0,0.06,-0.06].map((delta,index)=>({
   placeId:`edge-${index}`,name:'Test venue',stopId:stop.stopId,locationId:stop.stopId,category:'attractions',lat:base.lat,lng:base.lng+delta,
  }))}];
  const places=f.discovered[0].candidatePlaces;
  assert.ok(distanceKm(places[0],places[1])<8);assert.ok(distanceKm(places[0],places[2])<8);
  assert.ok(distanceKm(places[1],places[2])>8);
  const plan=buildDailyPlan(f),selected=slots.flatMap(slot=>plan.days[0][slot]);
  assert.equal(selected.length,2);
  validateAndEnrich(plan,f.outline,f.schedule,f.discovered,{});
 });
 it('reports genuine data shortages before calling Gemini instead of fabricating activities',async()=>{
  const f=fixture();f.discovered[0].candidatePlaces=f.discovered[0].candidatePlaces.slice(0,1);
  mock.method(discovery,'discoverStops',async()=>f.discovered);
  mock.method(llm,'generateStructured',()=>assert.fail('No narrative request for an infeasible plan'));
  await assert.rejects(generateCountryItinerary({...f,startDate:f.outline.startDate}),error=>error.code==='INSUFFICIENT_VENUES'&&error.statusCode===422);
 });
 it('preserves invariants across enabled countries, trip duration tiers, pace and excursions',()=>{
  let checked=0;
  for(const country of catalog.countries.filter(country=>country.planningAvailable)){
   for(const days of [1,2,5,7,10,16,21])for(const pace of ['seeAll','deeply']){
    const quiz={seeAllOrDeeply:pace,travelAlterEgo:'Foodie'};
    if(!supportedBases(country.countryCode,quiz).some(base=>minimumNights(base,days)<=days-1))continue;
    const f=fixture(country.id,days,quiz),plan=buildDailyPlan(f);
    const itinerary=validateAndEnrich(plan,f.outline,f.schedule,f.discovered,quiz);
    assert.equal(itinerary.days.length,days);checked++;
    if(pace==='deeply')for(const day of itinerary.days)assert.ok(slots.flatMap(slot=>day[slot]).length<=3);
   }
  }
  assert.ok(checked>=700,`Expected broad coverage, checked ${checked} plans`);
 });
});

describe('Narrative failures cannot change the fixed itinerary',()=>{
 const mutations={
  'empty sightseeing day':data=>{for(const slot of slots)data.days[1][slot]=[];},
  'overpacked day':data=>{data.days[1].morning.push({placeId:'extra-1',activityDescription:'Extra'},{placeId:'extra-2',activityDescription:'Extra'});},
  'invented venue':data=>{slots.flatMap(slot=>data.days[1][slot])[0].placeId='invented';},
  'duplicate venue':data=>{slots.flatMap(slot=>data.days[1][slot])[0].placeId=slots.flatMap(slot=>data.days[2][slot])[0].placeId;},
  'wrong base':data=>{data.days[1].stopId='another-base';},
  'missing day':data=>{data.days.pop();},
  'reserved travel window':data=>{data.days[0].morning=data.days[0].evening;data.days[0].evening=[];},
 };
 for(const [name,mutate] of Object.entries(mutations))it(`returns the valid plan when Gemini supplies ${name}`,async()=>{
  const f=fixture(),fixed=buildDailyPlan(f);let calls=0;
  mock.method(discovery,'discoverStops',async()=>f.discovered);
  mock.method(llm,'generateStructured',async request=>{
   calls++;assert.equal(request.maxAttempts,2);
   const data=JSON.parse(request.prompt).plan;mutate(data);return {data,model:'untrusted'};
  });
  const {itinerary,model}=await generateCountryItinerary({...f,startDate:f.outline.startDate});
  assert.equal(calls,1);assert.equal(model,null);assert.equal(itinerary.narrativeSource,'deterministic_fallback');
  assert.deepEqual(identity(itinerary.days),identity(fixed.days));
  validateAndEnrich(itinerary,f.outline,f.schedule,f.discovered,f.quiz);
 });
 for(const statusCode of [429,502,503,504])it(`preserves a usable trip during a narrative HTTP ${statusCode}`,async()=>{
  const f=fixture();mock.method(discovery,'discoverStops',async()=>f.discovered);
  mock.method(llm,'generateStructured',async()=>{throw Object.assign(new Error('Private provider message'),{statusCode});});
  const {itinerary,model}=await generateCountryItinerary({...f,startDate:f.outline.startDate});
  assert.equal(model,null);assert.equal(itinerary.narrativeSource,'deterministic_fallback');
  assert.ok(!JSON.stringify(itinerary).includes('Private provider message'));
  assert.equal(itinerary.days.length,7);
 });
 it('uses valid Gemini copy without letting it alter activities or canonical venue facts',async()=>{
  const f=fixture(),fixed=buildDailyPlan(f);mock.method(discovery,'discoverStops',async()=>f.discovered);
  mock.method(llm,'generateStructured',async request=>{
   const payload=JSON.parse(request.prompt),data=payload.plan;
   assert.ok(!request.prompt.includes('Provider-only address'));
   data.tripTitle='A culinary journey through Poland';
   for(const day of data.days){day.theme='Local discoveries';for(const activity of slots.flatMap(slot=>day[slot]))activity.activityDescription='A suggested stop tailored to your interests.';}
   return {data,model:'verified-copy'};
  });
  const {itinerary,model}=await generateCountryItinerary({...f,startDate:f.outline.startDate});
  assert.equal(model,'verified-copy');assert.equal(itinerary.narrativeSource,'gemini');
  assert.deepEqual(identity(itinerary.days),identity(fixed.days));
  const stored=storedItinerary(itinerary);
  assert.equal(stored.narrativeSource,'gemini');assert.equal(stored.schedulerVersion,'2026-10-23.1');
  assert.ok(!JSON.stringify(stored).includes('Provider-only address'));
 });
 it('clears the previous model attribution when updating a draft with standard copy',async()=>{
  const f=fixture(),itinerary=validateAndEnrich(buildDailyPlan(f),f.outline,f.schedule,f.discovered,f.quiz);
  itinerary.narrativeSource='deterministic_fallback';
  mock.method(docClient,'send',async command=>{
   assert.match(command.input.UpdateExpression,/generatedBy = :model/);
   assert.equal(command.input.ExpressionAttributeValues[':model'],null);
   assert.equal(command.input.ExpressionAttributeValues[':itinerary'].narrativeSource,'deterministic_fallback');
   return {Attributes:{tripId:'draft',generatedBy:null}};
  });
  await updateTripItinerary('owner','draft',itinerary,null);
 });
});

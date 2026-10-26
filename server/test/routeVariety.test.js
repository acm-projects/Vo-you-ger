const {describe,it,afterEach,mock}=require('node:test');
const assert=require('node:assert/strict');
const {buildOutline,validateOutline,countryCandidates}=require('../services/tripOutlineService');
const {rankCountries}=require('../services/countryScoringService');
const {recommendCountries}=require('../services/countryRecommendationService');
const catalog=require('../services/planningDataService');
const visa=require('../services/visaService');
const llm=require('../services/llmclient');
const {buildExplanationRequest}=require('../prompts/countryExplanationPrompt');
afterEach(()=>mock.restoreAll());
const profile={startDate:'2027-06-05',seeAllOrDeeply:'seeAll',travelAlterEgo:'Explorer',budgetLevel:'$$$',visaWillingness:true,walkAmount:'a bit'};
const quizFor=(days,overrides={})=>({...profile,minNights:days-1,maxNights:days-1,...overrides});

describe('Duration and pace determine required route coverage',()=>{
 it('allows a single-base country through six days and excludes it at seven for variety seekers',()=>{
  for(const days of [1,2,4,5,6]){
   const quiz=quizFor(days),outline=buildOutline({countryId:'country-ee',quiz});
   assert.equal(outline.stops.length,1);
   assert.equal(outline.numberOfDays,days);
   assert.equal(countryCandidates(quiz,new Set(['EE'])).length,1);
  }
  for(const days of [7,8,14,21]){
   const quiz=quizFor(days);
   assert.throws(()=>buildOutline({countryId:'country-ee',quiz}),error=>error.code==='NO_FEASIBLE_ROUTE'&&error.statusCode===422);
   assert.deepEqual(countryCandidates(quiz,new Set(['EE'])),[]);
  }
 });
 it('prefers two feasible bases for five and six days while respecting short-trip minima',()=>{
  for(const days of [4,5,6]){
   const outline=buildOutline({countryId:'country-pt',quiz:quizFor(days)});
   assert.equal(outline.stops.length,days===4?1:2);
   assert.equal(outline.stops.reduce((sum,stop)=>sum+stop.nights,0),days-1);
  }
 });
 it('keeps relaxed trips in one base through seven days and uses exactly two from eight days',()=>{
  for(const days of [4,5,6,7,8,10,14,21]){
   const quiz=quizFor(days,{seeAllOrDeeply:'Experience deeply'});
   const outline=buildOutline({countryId:'country-fr',quiz});
   assert.equal(outline.stops.length,days<=7?1:2);
   assert.equal(outline.transfers.length,days<=7?0:1);
   assert.equal(outline.stops.reduce((sum,stop)=>sum+stop.nights,0),days-1);
   if(days>=14)assert.ok(outline.stops.every(stop=>stop.nights>=6),'Long relaxed trips retain substantial stays');
   validateOutline(outline,quiz);
  }
  assert.equal(buildOutline({countryId:'country-ee',quiz:quizFor(7,{seeAllOrDeeply:'deeply'})}).stops.length,1);
  assert.throws(()=>buildOutline({countryId:'country-ee',quiz:quizFor(8,{seeAllOrDeeply:'deeply'})}),error=>error.code==='NO_FEASIBLE_ROUTE');
 });
 it('requires actual allowed connections, not just a country with multiple catalog bases',()=>{
  const quiz=quizFor(14,{intercityTransportModes:['ferry']});
  assert.ok(catalog.basesByCountry.get('PT').length>1);
  assert.throws(()=>buildOutline({countryId:'country-pt',quiz}),error=>error.code==='NO_FEASIBLE_ROUTE');
  assert.deepEqual(rankCountries(quiz,new Set(['PT'])),[]);
  // Short trips can still use the same country without a base change.
  assert.equal(rankCountries(quizFor(6,{intercityTransportModes:['ferry']}),new Set(['PT'])).length,1);
 });
 it('does not treat a supported day excursion as a second overnight base',()=>{
  const connections=catalog.connections;
  try{
   catalog.connections=connections.filter(edge=>edge.from!=='lisbon-pt'&&edge.to!=='lisbon-pt');
   const quiz=quizFor(14);
   assert.ok(catalog.excursions.some(excursion=>excursion.fromDestinationId==='lisbon-pt'));
   assert.throws(()=>buildOutline({countryId:'country-pt',quiz}),error=>error.code==='NO_FEASIBLE_ROUTE');
  }finally{catalog.connections=connections;}
 });
 it('independently rejects an outline below the new minimum or above the relaxed maximum',()=>{
  const oldSingle=buildOutline({countryId:'country-ee',numberOfDays:14,quiz:{}});
  for(const pace of ['seeAll','deeply'])assert.throws(()=>validateOutline(oldSingle,quizFor(14,{seeAllOrDeeply:pace})));
  const three=buildOutline({countryId:'country-jp',quiz:quizFor(14)});
  assert.equal(three.stops.length,3);
  assert.throws(()=>validateOutline(three,quizFor(14,{seeAllOrDeeply:'deeply'})));
 });
 it('filters infeasible countries and continues ranking other eligible countries',()=>{
  const quiz=quizFor(14),ranked=rankCountries(quiz,new Set(['EE','LV','PT','JP','FR']));
  assert.deepEqual(new Set(ranked.map(country=>country.countryCode)),new Set(['PT','JP','FR']));
  assert.ok(ranked.every(country=>country.suggestedRoute.bases.length>=2));
  const request=buildExplanationRequest(ranked.slice(0,3),quiz);
  assert.ok(request.jsonSchema && request.zodSchema);
  assert.ok(!request.prompt.includes('country-ee'),'Gemini can explain only qualifying countries');
 });
 it('never pads a restricted pool with single-base countries or invokes Gemini for insufficient choices',async()=>{
  mock.method(global,'fetch',()=>assert.fail('No network in this test'));
  mock.method(visa,'getVisaFreeCountries',async()=>new Set(['EE','LV','TZ','PT','JP']));
  mock.method(llm,'generateStructured',()=>assert.fail('Insufficient choices must fail before an AI request'));
  await assert.rejects(recommendCountries({nationalities:['US']},quizFor(14,{visaWillingness:false})),error=>error.code==='INSUFFICIENT_COUNTRIES'&&error.statusCode===422);
 });
 it('allows bases above the preferred budget while retaining reviewed risk exclusions',()=>{
  const quiz=quizFor(14,{budgetLevel:'$'});
  const outline=buildOutline({countryId:'country-pt',quiz});
  assert.equal(outline.stops.length,2);
  validateOutline(outline,quiz);
  assert.throws(()=>buildOutline({countryId:'country-dk',quiz:quizFor(14,{highRiskDestWillingness:false})}),error=>error.code==='NO_FEASIBLE_ROUTE');
 });
});

describe('Eight-country curated route expansion',()=>{
 const countryBases={CZ:3,DK:3,SE:3,IE:3,HU:3,SI:3,KR:3,MA:2};
 for(const [code,count] of Object.entries(countryBases))it(`${code} offers ${count} grounded bases and connected long-trip options`,()=>{
  const bases=catalog.basesByCountry.get(code);
  assert.equal(bases.length,count);
  for(const base of bases){
   const record=catalog.destinationById.get(base.destinationId);
   assert.equal(record.provenance.geography.status,'verified_gazetteer');
   assert.equal(base.lat,record.coordinates.lat);assert.equal(base.lng,record.coordinates.lng);
   if(base.reviewedOn==='2026-10-25'){
    assert.equal(base.reviewStatus,'reviewed');
    assert.ok(record.provenance.travelReview.sourceUrls.length>=2);
    assert.equal(record.provenance.safety.status,'country_advisory_snapshot');
    assert.ok(record.provenance.budget.limitation);
   }
  }
  for(const pace of ['seeAll','deeply']){
   const quiz=quizFor(14,{seeAllOrDeeply:pace});
   const outline=buildOutline({countryId:`country-${code.toLowerCase()}`,quiz});
   assert.ok(outline.stops.length>=2);
   assert.ok(outline.stops.length<=(pace==='deeply'?2:3));
   assert.ok(outline.stops.every(stop=>stop.countryCode===code));
   assert.equal(outline.stops.reduce((sum,stop)=>sum+stop.nights,0),13);
   validateOutline(outline,quiz);
  }
 });
 it('returns three multi-base recommendations across long-trip lengths and personas',()=>{
  for(const days of [7,8,10,14,21])for(const travelAlterEgo of ['Explorer','Historian','Foodie']){
   const top=rankCountries(quizFor(days,{travelAlterEgo})).slice(0,3);
   assert.equal(top.length,3);
   assert.equal(new Set(top.map(country=>country.countryCode)).size,3);
   assert.ok(top.every(country=>country.suggestedRoute.bases.length>=2));
  }
 });
});

describe('Budget coverage and additional planning countries',()=>{
 for(const [code,count,budget] of [['PL',4,'$'],['RO',3,'$'],['BG',3,'$'],['LT',3,'$$']]) {
  it(`${code} has reviewed bases and feasible regional routes within its planning tier`,()=>{
   const bases=catalog.basesByCountry.get(code);
   assert.equal(bases.length,count);
   if(budget==='$')assert.ok(bases.filter(base=>catalog.destinationById.get(base.destinationId).budget==='$').length>=2);
   for(const base of bases.filter(base=>base.reviewStatus==='reviewed')) {
    const record=catalog.destinationById.get(base.destinationId);
    assert.equal(record.provenance.geography.status,'verified_gazetteer');
    assert.ok(record.provenance.travelReview.sourceUrls.length>=2);
    assert.equal(record.provenance.safety.advisoryLevel,1);
   }
   for(const days of [3,5,7,8,14,21])for(const seeAllOrDeeply of ['seeAll','deeply']) {
    const quiz=quizFor(days,{budgetLevel:budget,highRiskDestWillingness:false,seeAllOrDeeply});
    const outline=buildOutline({countryId:`country-${code.toLowerCase()}`,quiz});
    validateOutline(outline,quiz);
    assert.equal(outline.numberOfNights,days-1);
    if(days>=8)assert.ok(outline.stops.length>=2);
   }
  });
 }
 it('explains exactly three eligible budget countries through the structured recommendation flow',async()=>{
  mock.method(global,'fetch',()=>assert.fail('No network in this test'));
  const quiz=quizFor(14,{budgetLevel:'$',highRiskDestWillingness:false});
  const selected=rankCountries(quiz).slice(0,3);
  const expected=new Set(selected.map(country=>country.id));
  mock.method(llm,'generateStructured',async request=>{
   for(const id of expected)assert.ok(request.prompt.includes(id));
   return {model:'test-structured-model',data:{explanations:selected.map(country=>({
    countryId:country.id,reason:`Explore ${country.name} using its supported regional route and a pace suited to your preferences.`,
    highlights:country.suggestedRoute.bases,
   }))}};
  });
  const result=await recommendCountries({},quiz);
  assert.equal(result.recommendations.length,3);
  assert.deepEqual(new Set(result.recommendations.map(country=>country.destinationId)),expected);
  assert.equal(result.selectionMetadata.explanationSource,'gemini');
  assert.equal(result.selectionMetadata.explanationFallbackReason,null);
 });
});

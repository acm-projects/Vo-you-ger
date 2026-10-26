const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const {scoreDestination}=require('../services/destinationScoringService');
const {countryCandidates,buildOutline,validateOutline}=require('../services/tripOutlineService');
const {buildExplanationRequest}=require('../prompts/countryExplanationPrompt');
const {rankCountries}=require('../services/countryScoringService');
const catalog=require('../services/planningDataService');

describe('Budget influences fit without excluding feasible trips',()=>{
 it('rewards matching budgets and distinguishes a modest from a larger tier difference',()=>{
  const base={tags:['food'],safety:1};
  const points=budget=>scoreDestination({...base,budget},{budgetLevel:'$'}).parts.budget;
  assert.ok(points('$')>points('$$'));
  assert.ok(points('$$')>points('$$$'));
  assert.equal(scoreDestination({...base,budget:'$'},{budgetLevel:'$$'}).parts.budget,points('$'));
 });
 it('allows a stronger overall interest match to outweigh the budget preference',()=>{
  const quiz={travelAlterEgo:'The Foodie',budgetLevel:'$'};
  const cheap={tags:['mountains'],budget:'$',safety:1};
  const expensive={tags:['food','coffee','seafood','wine','craft-beer'],budget:'$$$',safety:1};
  assert.ok(scoreDestination(expensive,quiz).score>scoreDestination(cheap,quiz).score);
 });
 it('keeps the same eligible country pool across all budget tiers',()=>{
  for(const days of [3,7,14,21])for(const seeAllOrDeeply of ['seeAll','deeply'])for(const highRiskDestWillingness of [false,true]) {
   const quiz={minNights:days-1,maxNights:days-1,seeAllOrDeeply,highRiskDestWillingness};
   const codes=budgetLevel=>new Set(countryCandidates({...quiz,budgetLevel}).map(country=>country.countryCode));
   assert.deepEqual(codes('$'),codes('$$'));
   assert.deepEqual(codes('$'),codes('$$$'));
  }
 });
 it('allows and validates an excursion above the budget preference',()=>{
  const quiz={minNights:6,maxNights:6,seeAllOrDeeply:'deeply',travelAlterEgo:'The Foodie',budgetLevel:'$'};
  const outline=buildOutline({countryId:'country-pt',quiz});
  const excursion=outline.excursions.find(item=>item.destinationId==='sintra-pt');
  assert.ok(excursion);
  assert.notEqual(catalog.destinationById.get(excursion.destinationId).budget,'$');
  validateOutline(outline,quiz);
 });
 it('tells structured explanations to treat budget as a preference without promising affordability',()=>{
  const quiz={budgetLevel:'$',minNights:6,maxNights:6};
  const request=buildExplanationRequest(rankCountries(quiz).slice(0,3),quiz);
  assert.equal(JSON.parse(request.prompt).quiz.budgetLevel,'$');
  assert.ok(request.jsonSchema && request.zodSchema);
  assert.match(request.systemPrompt,/Budget is a ranking preference/);
  assert.match(request.systemPrompt,/Do not claim a route fits the requested budget/);
 });
});

describe('Risk willingness expands eligibility without excluding low-risk trips',()=>{
 it('retains every low-risk candidate when the traveler is open to higher-risk destinations',()=>{
  const quiz={minNights:3,maxNights:3,seeAllOrDeeply:'seeAll',budgetLevel:'$'};
  const lowRisk=countryCandidates({...quiz,highRiskDestWillingness:false});
  const broader=countryCandidates({...quiz,highRiskDestWillingness:true});
  const broaderCodes=new Set(broader.map(country=>country.countryCode));
  for(const country of lowRisk)assert.ok(broaderCodes.has(country.countryCode));
  assert.ok(broader.length>lowRisk.length);
  assert.ok(broaderCodes.has('PT'));
  assert.ok(broaderCodes.has('AR'));
  assert.ok(!lowRisk.some(country=>country.countryCode==='AR'));
 });
 it('does not award extra suitability points merely for higher risk',()=>{
  const base={tags:['food'],budget:'$$'};
  const quiz={highRiskDestWillingness:true};
  assert.ok(scoreDestination({...base,safety:1},quiz).score>scoreDestination({...base,safety:4},quiz).score);
 });
});

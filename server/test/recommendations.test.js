require('dotenv').config();
const {describe,it,beforeEach,after}=require('node:test');
const assert=require('node:assert/strict');
const llm=require('../services/llmclient');
const users=require('../models/userModel');
const trips=require('../models/tripModel');
const visa=require('../services/visaService');
const {rankCountries}=require('../services/countryScoringService');
const {createRecommendations}=require('../controllers/recommendationController');
const original={llm:llm.generateStructured,user:users.findUserById,trip:trips.createTrip,visa:visa.getVisaFreeCountries};
function pair(body={}) {return {req:{body,user:{userId:'owner'}},res:{statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}}};}
const quiz={travelAlterEgo:'Foodie',dailyBudget:'$$$',startDate:'2027-06-05',minNights:6,maxNights:6};
function expected(profile=quiz,allowed=null){return rankCountries(profile,allowed).slice(0,3).map(country=>country.id);}
describe('Deterministic country recommendations',()=>{
 let saved;
 beforeEach(()=>{
  saved=null;
  users.findUserById=async()=>({id:'owner',nationalities:['United States'],quizResponse:quiz});
  trips.createTrip=async(userId,input)=>{saved={userId,...input};return {PK:'private',SK:'private',tripId:'t-1',...input,itinerary:null};};
  llm.generateStructured=async({prompt})=>({model:'test',data:{explanations:JSON.parse(prompt).selected.map(item=>({countryId:item.countryId,reason:'A supported route fits your preferences.',highlights:item.route.bases}))}});
  visa.getVisaFreeCountries=original.visa;
 });
 after(()=>{llm.generateStructured=original.llm;users.findUserById=original.user;trips.createTrip=original.trip;visa.getVisaFreeCountries=original.visa;});
 it('selects exactly three ranked countries and records reproducibility metadata',async()=>{
  const {req,res}=pair({quiz});await createRecommendations(req,res);
  assert.equal(res.statusCode,201);assert.deepEqual(res.body.trip.recommendations.map(item=>item.destinationId),expected());
  assert.equal(res.body.trip.PK,undefined);assert.equal(saved.userId,'owner');assert.equal(saved.model,'test');
  assert.ok(saved.selectionMetadata.catalogVersion);assert.ok(saved.selectionMetadata.policyVersion);
  assert.deepEqual(saved.selectionMetadata.countryIds,expected());
 });
 it('uses the saved assessment when none is supplied',async()=>{const {req,res}=pair();await createRecommendations(req,res);assert.equal(res.statusCode,201);assert.deepEqual(saved.quiz,quiz);});
 it('returns identical order for identical inputs',async()=>{const a=pair({quiz}),b=pair({quiz});await createRecommendations(a.req,a.res);await createRecommendations(b.req,b.res);assert.deepEqual(a.res.body.trip.recommendations,b.res.body.trip.recommendations);});
 for(const [name,mutate] of [
  ['invented IDs',items=>items.map(item=>({...item,countryId:'invented'}))],
  ['duplicate IDs',items=>[items[0],items[0],items[0]]],
  ['omitted countries',items=>items.slice(0,2)],
  ['reordered explanations',items=>items.reverse()],
 ]) it(`AI ${name} cannot change the selected IDs or order`,async()=>{
  llm.generateStructured=async({prompt})=>({model:'test',data:{explanations:mutate(JSON.parse(prompt).selected.map(item=>({countryId:item.countryId,reason:'Reason',highlights:[]})))}});
  const {req,res}=pair({quiz});await createRecommendations(req,res);assert.equal(res.statusCode,201);assert.deepEqual(res.body.trip.recommendations.map(item=>item.destinationId),expected());
 });
 for(const status of [429,502,503]) it(`retains recommendations when explanation generation fails with ${status}`,async()=>{
  llm.generateStructured=async()=>{throw Object.assign(new Error('Provider failure'),{statusCode:status});};
  const {req,res}=pair({quiz});await createRecommendations(req,res);assert.equal(res.statusCode,201);assert.equal(saved.selectionMetadata.explanationSource,'deterministic_fallback');assert.deepEqual(saved.recommendations.map(item=>item.destinationId),expected());
 });
 it('falls back on malformed explanation JSON',async()=>{llm.generateStructured=async()=>({data:{wrong:true}});const {req,res}=pair({quiz});await createRecommendations(req,res);assert.equal(res.statusCode,201);assert.equal(saved.model,null);});
 for(const invalid of [[],{riskTolerance:9},{minNights:5,maxNights:1},{minNights:21},{startDate:'2027-02-30'}]) it(`rejects invalid assessment ${JSON.stringify(invalid)}`,async()=>{const {req,res}=pair({quiz:invalid});await createRecommendations(req,res);assert.equal(res.statusCode,400);assert.equal(saved,null);});
 it('requires an assessment',async()=>{users.findUserById=async()=>({id:'owner'});const {req,res}=pair();await createRecommendations(req,res);assert.equal(res.statusCode,400);assert.equal(res.body.code,'ASSESSMENT_REQUIRED');});
 it('returns 404 for a nonexistent user',async()=>{users.findUserById=async()=>null;const {req,res}=pair({quiz});await createRecommendations(req,res);assert.equal(res.statusCode,404);});
 it('requires valid citizenship for visa-free-only travel',async()=>{users.findUserById=async()=>({nationalities:[]});const {req,res}=pair({quiz:{...quiz,willingToGetVisa:false}});await createRecommendations(req,res);assert.equal(res.statusCode,400);assert.equal(res.body.code,'CITIZENSHIP_REQUIRED');});
 it('retains strict refusal during a visa outage',async()=>{visa.getVisaFreeCountries=async()=>{throw new Error('offline');};const {req,res}=pair({quiz:{...quiz,willingToGetVisa:false}});await createRecommendations(req,res);assert.equal(res.statusCode,503);assert.equal(res.body.code,'VISA_UNAVAILABLE');assert.equal(saved,null);});
 for(const allowed of [[],['PT','JP']]) it(`refuses to fill an insufficient visa pool ${allowed}`,async()=>{visa.getVisaFreeCountries=async()=>new Set(allowed);const {req,res}=pair({quiz:{...quiz,willingToGetVisa:false}});await createRecommendations(req,res);assert.equal(res.statusCode,422);assert.equal(res.body.code,'INSUFFICIENT_COUNTRIES');assert.equal(saved,null);});
 it('uses all citizenships and never allows non-green countries',async()=>{
  users.findUserById=async()=>({nationalities:['United States','Italy']});visa.getVisaFreeCountries=async nationalities=>{assert.deepEqual(nationalities,['United States','Italy']);return new Set(['PT','JP','IT']);};
  const {req,res}=pair({quiz:{...quiz,willingToGetVisa:false}});await createRecommendations(req,res);assert.equal(res.statusCode,201);assert.deepEqual(new Set(saved.recommendations.map(item=>item.countryCode)),new Set(['PT','JP','IT']));
 });
 it('does not call visa lookup when the traveler is willing to apply',async()=>{visa.getVisaFreeCountries=async()=>assert.fail('Unexpected visa call');const {req,res}=pair({quiz:{...quiz,willingToGetVisa:true}});await createRecommendations(req,res);assert.equal(res.statusCode,201);});
 it('does not substitute over-budget countries',async()=>{const profile={...quiz,dailyBudget:'$',riskTolerance:1};const {req,res}=pair({quiz:profile});await createRecommendations(req,res);assert.equal(res.statusCode,201);assert.deepEqual(saved.recommendations.map(item=>item.destinationId),expected(profile));assert.ok(!saved.recommendations.some(item=>item.countryCode==='PT'));});
});

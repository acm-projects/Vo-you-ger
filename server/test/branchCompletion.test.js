require('dotenv').config();
const {describe,it,afterEach,mock}=require('node:test');
const assert=require('node:assert/strict');
const catalog=require('../services/planningDataService');
const destinations=require('../data/destinations.json');
const routes=require('../data/planningCatalog.json');
const {buildOutline,validateOutline}=require('../services/tripOutlineService');
const {buildSchedule}=require('../services/countryItineraryService');
const google=require('../services/googlePlacesService');
const {refreshDay}=require('../services/savedVenueService');
const {discoverStops}=require('../services/stopDiscoveryService');
const trips=require('../models/tripModel');
const {docClient}=require('../db/dynamo');
const {budgetFetch,LIMITS}=require('../scripts/verify-planning-integrations');
afterEach(()=>mock.restoreAll());

describe('Branch completion: assessment compatibility',()=>{
 it('accepts existing assessment labels without bypassing budget or season validation',()=>{
  const {quizSchema}=require('../schemas/recommendationSchema');
  const {wantsVariety,scoreDestination}=require('../services/destinationScoringService');
  assert.equal(wantsVariety({seeAllOrDeeply:'See it all'}),true);
  assert.equal(wantsVariety({seeAllOrDeeply:'Experience deeply'}),false);
  assert.equal(quizSchema.safeParse({dailyBudget:'cheap'}).success,false);
  assert.equal(quizSchema.safeParse({months:['Smarch']}).success,false);
  assert.equal(quizSchema.safeParse({months:['June','sep'],dailyBudget:' $$ '}).success,true);
  const base={countryCode:'FR',tags:[],climate:'cold'};
  assert.equal(scoreDestination(base,{countriesOfInterest:['France'],temperaturePreferences:['Chilly but not too cold']}).parts.preferences,20);
 });
 it('scores the requested arrival season rather than the saved assessment date',()=>{
  const {scoreDestination}=require('../services/destinationScoringService');
  const base={tags:[],bestMonths:['Jun']};
  assert.ok(scoreDestination(base,{startDate:'2027-06-05'}).parts.season>scoreDestination(base,{startDate:'2027-01-05'}).parts.season);
  const june=buildOutline({countryId:'country-pt',startDate:'2027-06-05',numberOfDays:7,quiz:{startDate:'2027-01-05'}});
  const expected=buildOutline({countryId:'country-pt',numberOfDays:7,quiz:{startDate:'2027-06-05'}});
  assert.deepEqual(june.stops,expected.stops);
 });
});

describe('Branch completion: data integrity',()=>{
 it('recomputes coverage instead of trusting a stale registry flag',()=>{
  const record=structuredClone(destinations.find(d=>d.id==='lisbon-pt'));
  const data=catalog.buildPlanningData([record],{version:1,connections:[]},[{id:'country-pt',countryCode:'PT',name:'Portugal',geographicCoverage:'minimum_met',verifiedSettlementCount:5}]);
  assert.equal(data.countries[0].verifiedSettlementCount,1);
  assert.equal(data.countries[0].geographicCoverage,'source_gap');
  assert.ok(data.countries[0].coverageException);
 });
 it('rejects duplicate enabled settlements and geographically displaced anchors',()=>{
  const record=structuredClone(destinations.find(d=>d.id==='lisbon-pt'));
  assert.throws(()=>catalog.buildPlanningData([record,{...record,id:'same-settlement'}],{connections:[]}),/enabled twice/);
  record.planning.lat+=1;
  assert.throws(()=>catalog.buildPlanningData([record],{connections:[]}),/anchor disagrees/);
 });
 it('requires valid review dates and explicit connection directionality',()=>{
  for(const change of [{reviewedOn:'2026-02-30'},{bidirectional:'yes'},{from:routes.connections[0].to}]){
   const invalid=structuredClone(routes);Object.assign(invalid.connections[0],change);
   assert.throws(()=>catalog.buildPlanningData(destinations,invalid));
  }
 });
 it('validates excursion country, coordinates and review dates at load time',()=>{
  for(const change of [{lat:91},{radiusKm:0},{reviewedOn:'2026-02-30'},{destinationId:'tokyo-jp'},{roundTripPlanningMinutes:900}]){
   const invalid=structuredClone(routes);Object.assign(invalid.excursions[0],change);
   assert.throws(()=>catalog.buildPlanningData(destinations,invalid),/excursion/);
  }
 });
 it('fingerprints data changes even when an editor has not changed a version label',()=>{
  const record=structuredClone(destinations.find(d=>d.id==='lisbon-pt'));
  const first=catalog.buildPlanningData([record],{version:1,connections:[]}).version;
  record.tags.push('museums');
  assert.notEqual(catalog.buildPlanningData([record],{version:1,connections:[]}).version,first);
 });
});

describe('Branch completion: reviewed production routes',()=>{
 for(const country of ['fr','ch'])it(`supports a real five-base 21-day ${country.toUpperCase()} route`,()=>{
  const quiz={dailyBudget:'$$$',riskTolerance:3,seeAllOrDeeply:'seeAll'};
  const outline=buildOutline({countryId:`country-${country}`,numberOfDays:21,startDate:'2027-06-05',quiz});
  validateOutline(outline,quiz);
  assert.equal(outline.stops.length,5);assert.equal(outline.stops.reduce((sum,s)=>sum+s.nights,0),20);
  assert.equal(buildSchedule(outline,outline.startDate).length,21);
  assert.ok(outline.transfers.every(t=>t.mode==='train'&&t.sourceUrl.startsWith('https:')));
 });
 it('enables imported bases only with a documented travel review',()=>{
  for(const record of destinations.filter(d=>d.id.startsWith('gn-')&&d.planning.enabled)){
   assert.equal(record.planning.reviewStatus,'reviewed');
   assert.ok(record.provenance.travelReview.sourceUrls.length>=2);
   assert.ok(record.provenance.budget.limitation);
   assert.equal(record.provenance.safety.status,'country_advisory_snapshot');
  }
 });
 it('does not mistake a country advisory for a low-risk city exemption',()=>{
  assert.throws(()=>buildOutline({countryId:'country-fr',numberOfDays:7,quiz:{riskTolerance:1}}),error=>error.code==='NO_FEASIBLE_ROUTE');
 });
});

describe('Branch completion: discovery and saved venue refresh',()=>{
 it('preserves restaurants in a capped pool when attraction results are numerous',async()=>{
  const outline=buildOutline({countryId:'country-pt',numberOfDays:4});
  mock.method(google,'searchPlacesForQueries',async(_queries,base)=>({places:Object.fromEntries(['attractions','food','experiences'].map(category=>[category,Array.from({length:20},(_,i)=>({id:`${category}-${i}`,displayName:{text:'Venue'},location:{latitude:base.lat,longitude:base.lng},addressComponents:[{types:['country'],shortText:'PT'}]}))]))}));
  const stops=await discoverStops(outline,{});
  assert.equal(stops[0].candidatePlaces.length,36);
  assert.equal(stops[0].candidatePlaces.filter(p=>p.category==='food').length,12);
 });
 it('refuses to refresh a schema-v2 day with no verifiable location',async()=>{
  mock.method(google,'getPlaceDetails',()=>assert.fail('No unverifiable provider lookup'));
  await assert.rejects(refreshDay({itinerary:{schemaVersion:2,countryCode:'PT',days:[{day:1,morning:[],afternoon:[],evening:[]}]}},1),error=>error.code==='VENUE_LOCATION_UNAVAILABLE');
 });
 it('rechecks the excursion radius rather than a broader default radius',async()=>{
  const outline=buildOutline({countryId:'country-pt',numberOfDays:7,quiz:{seeAllOrDeeply:'deeply',nightlifeOrSunrise:'nightlife'}});
  const excursion=outline.excursions[0];assert.ok(excursion);
  const itinerary={schemaVersion:2,countryCode:'PT',outline,days:[{day:excursion.day,stopId:excursion.stopId,excursion,morning:[],afternoon:[{placeId:'moved',category:'attractions'}],evening:[]}]};
  mock.method(google,'getPlaceDetails',async()=>({id:'moved',displayName:{text:'Moved venue'},location:{latitude:excursion.lat+0.08,longitude:excursion.lng},addressComponents:[{types:['country'],shortText:'PT'}]}));
  await assert.rejects(refreshDay({itinerary},excursion.day),error=>error.code==='VENUE_NO_LONGER_ELIGIBLE');
 });
});

describe('Branch completion: atomic drafts and live budgets',()=>{
 it('stores a new draft with its itinerary in one conditional put',async()=>{
  const {validateAndEnrich}=require('../services/countryItineraryService');
  const outline=buildOutline({countryId:'country-pt',numberOfDays:1,startDate:'2027-06-05'});
  const schedule=buildSchedule(outline,outline.startDate),stop=outline.stops[0],base=catalog.baseById.get(stop.destinationId);
  const itinerary=validateAndEnrich({tripTitle:'Test visit',summary:'A short visit',days:[{day:1,stopId:stop.stopId,theme:'Explore',morning:[{placeId:'test-venue',activityDescription:'Visit.'}],afternoon:[],evening:[]}]},outline,schedule,[{stopId:stop.stopId,locationId:stop.stopId,candidatePlaces:[{placeId:'test-venue',name:'Transient provider name',stopId:stop.stopId,locationId:stop.stopId,category:'attractions',lat:base.lat,lng:base.lng}]}],{});
  let writes=0;
  mock.method(docClient,'send',async command=>{writes++;assert.equal(command.constructor.name,'PutCommand');assert.equal(command.input.Item.itinerary.placesStoredAs,'ids_only');assert.equal(command.input.Item.isSaved,false);assert.match(command.input.ConditionExpression,/attribute_not_exists/);return {};});
  const result=await trips.createTrip('owner',{title:itinerary.tripTitle,recommendations:[{type:'country',destinationId:'country-pt'}],itinerary});
  assert.equal(writes,1);assert.equal(result.itinerary.days.length,1);assert.ok(!JSON.stringify(result).includes('Transient provider name'));
 });
 it('reserves each outbound attempt before sending and blocks the approved cap',async()=>{
  const counts={google:0,gemini:0,visa:0};let requests=0,saved=0;
  const fetch=budgetFetch(async()=>{requests++;return {ok:true};},counts,()=>saved++);
  for(let i=0;i<LIMITS.google;i++)await fetch('https://places.googleapis.com/v1/places:searchText');
  await assert.rejects(fetch('https://places.googleapis.com/v1/places:searchText'),error=>error.code==='LIVE_BUDGET_EXHAUSTED');
  assert.equal(requests,LIMITS.google);assert.equal(saved,LIMITS.google);
  await assert.rejects(fetch('https://unknown.example/test'),error=>error.code==='UNEXPECTED_PROVIDER');
 });
});

const {describe,it,afterEach,mock}=require('node:test');
const assert=require('node:assert/strict');
const {checkHours}=require('../services/venueHoursService');
const {normalizePlace}=require('../services/placeNormalizer');
const {isVisitCandidate}=require('../services/venueEligibilityService');
const {discoverStops}=require('../services/stopDiscoveryService');
const {rankCountries}=require('../services/countryScoringService');
const {buildOutline}=require('../services/tripOutlineService');
const google=require('../services/googlePlacesService');
afterEach(()=>mock.restoreAll());

describe('Google opening hours in production formats',()=>{
 it('recognizes the reported shared-PM Sunday range and refuses morning',()=>{
  const place={placeId:'reported',openingHours:['Sunday: 1:30 – 11:30 PM']};
  assert.throws(()=>checkHours(place,'Sunday','morning'),error=>error.statusCode===502);
  assert.equal(checkHours(place,'Sunday','afternoon').hoursCheck,'regular_hours_overlap');
  assert.equal(checkHours(place,'Sunday','evening').hoursCheck,'regular_hours_overlap');
 });
 it('handles shared AM, split hours and explicit overnight ranges',()=>{
  const place=hours=>({openingHours:[`Monday: ${hours}`]});
  assert.equal(checkHours(place('9–11 AM'),'Monday','morning').hoursCheck,'regular_hours_overlap');
  assert.throws(()=>checkHours(place('9–11 AM'),'Monday','afternoon'));
  assert.equal(checkHours(place('9–11 AM, 6–10 PM'),'Monday','evening').hoursCheck,'regular_hours_overlap');
  assert.equal(checkHours(place('8:00 PM – 2:00 AM'),'Monday','evening').hoursCheck,'regular_hours_overlap');
  assert.throws(()=>checkHours(place('8:00 PM – 2:00 AM'),'Monday','morning'));
  assert.equal(checkHours(place('by appointment'),'Monday','morning').hoursCheck,'unknown');
  assert.equal(checkHours(place('9–1 PM'),'Monday','morning').hoursCheck,'unknown','Ambiguous missing markers stay unknown');
 });
 it('uses structured local periods even without usable display text',()=>{
  const raw={id:'periods',displayName:{text:'Venue'},location:{latitude:1,longitude:1},types:['museum'],regularOpeningHours:{weekdayDescriptions:['Sunday: Unparseable'],periods:[{open:{day:0,hour:13,minute:30},close:{day:0,hour:23,minute:30}}]}};
  const place=normalizePlace(raw,'attractions');
  assert.throws(()=>checkHours(place,'Sunday','morning'));
  assert.equal(checkHours(place,'Sunday','afternoon').hoursCheck,'regular_hours_overlap');
  assert.throws(()=>checkHours(place,'Monday','afternoon'),'No Monday period means closed');
 });
 it('handles structured weekly rollover, overnight carryover and always-open periods',()=>{
  const place={openingPeriods:[{open:{day:6,hour:23},close:{day:0,hour:11}}]};
  assert.equal(checkHours(place,'Sunday','morning').hoursCheck,'regular_hours_overlap');
  assert.throws(()=>checkHours(place,'Sunday','afternoon'));
  const always={openingPeriods:[{open:{day:0,hour:0,minute:0}}]};
  assert.equal(checkHours(always,'Thursday','evening').hoursCheck,'regular_hours_overlap');
 });
});

describe('Visitable places rather than tour-office addresses',()=>{
 it('rejects the reported operator listings and generic establishments',()=>{
  for(const place of [
   {name:'Wild Experience Safaris & Tours',types:['point_of_interest','establishment']},
   {name:'Adventure Trails Tanzania',types:['point_of_interest','establishment']},
   {name:'Agency',primaryType:'tour_agency',types:['tourist_attraction']},
   {name:'Agency',types:['travel_agency','tourist_attraction']},
   {name:'Wild Experience Safaris & Tours',types:['tourist_attraction']},
  ])assert.equal(isVisitCandidate({...place,category:'experiences'}),false);
  assert.equal(isVisitCandidate({name:'Cultural Heritage Centre',category:'attractions',types:['cultural_center','art_gallery','restaurant']}),true);
  assert.equal(isVisitCandidate({name:'Cafe Arusha',category:'food',types:['cafe','restaurant']}),true);
 });
 it('filters ineligible businesses before discovery candidates, grouping and neighborhood advice',async()=>{
  const outline=buildOutline({countryId:'country-pt',numberOfDays:1,startDate:'2027-06-05',quiz:{}});
  mock.method(google,'searchPlacesForQueries',async(_queries,base)=>{
   const raw=(id,types,name=id)=>({id,displayName:{text:name},types,location:{latitude:base.lat,longitude:base.lng},addressComponents:[{types:['country'],shortText:'PT'}]});
   return {places:{attractions:[raw('museum',['museum'])],food:[raw('cafe',['cafe'])],experiences:[raw('office',['point_of_interest'],'Adventure Trails Tanzania'),raw('agency',['tour_agency','tourist_attraction'])]}};
  });
  const stops=await discoverStops(outline,{});
  assert.deepEqual(stops[0].candidatePlaces.map(place=>place.placeId).sort(),['cafe','museum']);
  assert.ok(!JSON.stringify(stops).includes('Adventure Trails Tanzania'));
 });
});

describe('Country matches respect requested route variety',()=>{
 const profile={minNights:9,maxNights:9,startDate:'2027-06-05',travelAlterEgo:'Explorer',seeAllOrDeeply:'seeAll',dailyBudget:'$$$',walkingAmount:'a bit'};
 it('puts feasible multi-base options ahead of the reported ten-day Arusha-only match',()=>{
  const ranked=rankCountries(profile),top=ranked.slice(0,3);
  assert.equal(top.filter(country=>country.suggestedRoute.bases.length>1).length,3);
  assert.ok(top[0].suggestedRoute.bases.length>1);
  assert.ok(top[0].scoreBreakdown.requestedVarietyBonus>0);
  assert.notEqual(top[0].countryCode,'TZ');
 });
 it('does not invent connections or bypass visa eligibility to obtain variety',()=>{
  const ranked=rankCountries(profile,new Set(['TZ','EE','LV']));
  assert.equal(ranked.length,3);
  for(const country of ranked){assert.equal(country.suggestedRoute.bases.length,1);assert.equal(country.scoreBreakdown.requestedVarietyBonus,0);}
 });
 it('retains one base for relaxed travelers and short stays',()=>{
  for(const quiz of [{...profile,seeAllOrDeeply:'deeply'},{...profile,minNights:3,maxNights:3}])for(const country of rankCountries(quiz)){
   assert.equal(country.suggestedRoute.bases.length,1);assert.equal(country.scoreBreakdown.requestedVarietyBonus,0);
  }
 });
});

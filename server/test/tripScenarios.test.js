// Repeatable scenario/stress checks. Real planning services; only external
// discovery/narrative responses are synthetic. No paid requests or DB writes.
const {describe,it,afterEach,mock}=require('node:test');
const assert=require('node:assert/strict');
const {buildOutline}=require('../services/tripOutlineService');
const {generateCountryItinerary}=require('../services/countryItineraryService');
const {storedItinerary}=require('../services/itineraryStorageService');
const {distanceKm}=require('../services/placeGroupingService');
const catalog=require('../services/planningDataService');
const discovery=require('../services/stopDiscoveryService');
const llm=require('../services/llmclient');
const slots=['morning','afternoon','evening'];
const weekdays=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
afterEach(()=>mock.restoreAll());

const cases=[
 {name:'Portugal: one-day visit with no accommodation',countryId:'country-pt',days:1,bases:1},
 {name:'Argentina: five days stay in Buenos Aires',countryId:'country-ar',days:5,bases:1},
 {name:'France: seven days with two bases',countryId:'country-fr',days:7,bases:2},
 {name:'Portugal: relaxed seven days keep one base',countryId:'country-pt',days:7,bases:1,pace:'deeply'},
 {name:'Japan: ten days with three bases',countryId:'country-jp',days:10,bases:3},
 {name:'Switzerland: 21 days with five bases',countryId:'country-ch',days:21,bases:5,budget:'$$$'},
 {name:'France: 21 days include a grounded excursion',countryId:'country-fr',days:21,bases:5,excursion:true,budget:'$$$'},
 {name:'USA: seven days through two connected bases',countryId:'country-us',days:7,bases:2,budget:'$$$'},
 {name:'Portugal: dates cross leap day',countryId:'country-pt',days:5,startDate:'2028-02-27'},
 {name:'USA: calendar remains correct across daylight saving',countryId:'country-us',days:7,startDate:'2027-03-07',budget:'$$$'},
];

function random(seed){let value=seed>>>0;return()=>((value=(Math.imul(value,1664525)+1013904223)>>>0)/4294967296);}
function fixture(scenario,seed=1){
 const rng=random(seed),quiz={seeAllOrDeeply:scenario.pace||'seeAll',travelAlterEgo:scenario.persona||'Foodie',dailyBudget:scenario.budget||'$$',dietaryRestrictions:scenario.diet||['Vegetarian'],willingToGetVisa:true};
 const startDate=scenario.startDate||'2027-06-05';
 const outline=buildOutline({countryId:scenario.countryId,numberOfDays:scenario.days,startDate,quiz});
 const locations=[...outline.stops.map(stop=>({...stop,locationId:stop.stopId})),...outline.excursions.map(excursion=>({...excursion,locationId:`excursion:${excursion.stopId}:${excursion.destinationId}`}))];
 const discovered=locations.map(location=>{
  const base=catalog.baseById.get(location.destinationId)||catalog.excursions.find(item=>item.destinationId===location.destinationId);
  return {stopId:location.stopId,locationId:location.locationId,candidatePlaces:Array.from({length:36},(_,index)=>{
   const food=index%3===0,closedDay=index%7;
   return {
    placeId:`${location.locationId}-seed-${seed}-venue-${index}`,name:`Synthetic ${food?'vegetarian restaurant':index%2?'museum':'park'} ${index}`,
    category:food?'food':'attractions',types:food?['vegetarian_restaurant']:index%2?['museum']:['park'],
    stopId:location.stopId,locationId:location.locationId,countryCode:outline.countryCode,
    lat:base.lat+Math.floor(index/12)*0.045+rng()*0.003,lng:base.lng+rng()*0.003,
    rating:3.5+rng()*1.5,priceLevel:index%5===0?'PRICE_LEVEL_EXPENSIVE':'PRICE_LEVEL_MODERATE',
    openingHours:index%9===0?null:weekdays.map((day,dayIndex)=>`${day}: ${dayIndex===closedDay?'Closed':food?'11:00 AM – 11:00 PM':'9:00 AM – 5:00 PM'}`),
    neighborhood:'Synthetic provider area',address:'Synthetic provider address',
   };
  })};
 });
 return {outline,discovered,quiz,startDate};
}

function verify(itinerary,f){
 const {outline}=f,allIds=new Set();
 assert.equal(itinerary.days.length,outline.numberOfDays);
 assert.equal(itinerary.tripSummary.numberOfNights,outline.numberOfNights);
 assert.equal(outline.stops.reduce((sum,stop)=>sum+stop.nights,0),outline.numberOfNights);
 const byLocation=new Map(f.discovered.map(location=>[location.locationId,new Map(location.candidatePlaces.map(place=>[place.placeId,place]))]));
 const epoch=Date.parse(`${f.startDate}T00:00:00Z`);
 for(const [index,day] of itinerary.days.entries()){
  const date=new Date(epoch+index*86400000);
  assert.equal(day.day,index+1);assert.equal(day.date,date.toISOString().slice(0,10));
  assert.equal(day.dayOfWeek,weekdays[date.getUTCDay()]);
  const expectedStop=outline.stops.find(stop=>day.day>=stop.startDay&&day.day<=stop.endDay);
  assert.equal(day.stopId,expectedStop.stopId);
  const selected=slots.flatMap(slot=>day[slot]);
  const max=['full','visit'].includes(day.type)?(f.quiz.seeAllOrDeeply==='deeply'?3:4):day.type==='excursion'?2:1;
  assert.ok(selected.length<=max);
  if(['full','visit','excursion'].includes(day.type))assert.ok(selected.length>=1);
  if(['arrival','transfer'].includes(day.type)){assert.equal(day.morning.length,0);assert.equal(day.afternoon.length,0);}
  if(day.type==='departure'){assert.equal(day.afternoon.length,0);assert.equal(day.evening.length,0);}
  if(day.type==='excursion'){assert.equal(day.morning.length,0);assert.equal(day.evening.length,0);}
  for(const slot of slots){
   assert.ok(day[slot].length<=2);
   for(const activity of day[slot]){
    assert.ok(!allIds.has(activity.placeId),'No repeated venue across the trip');allIds.add(activity.placeId);
    const source=byLocation.get(day.locationId).get(activity.placeId);assert.ok(source);
    assert.equal(activity.lat,source.lat);assert.equal(activity.lng,source.lng);
    const hours=source.openingHours?.find(line=>line.startsWith(`${day.dayOfWeek}:`));
    assert.ok(!hours?.includes('Closed'));
    if(hours&&source.category!=='food')assert.notEqual(slot,'evening','Known daytime museums must not be scheduled at night');
    assert.equal(activity.hoursCheck,hours?'regular_hours_overlap':'unknown');
   }
  }
  for(const a of selected)for(const b of selected)assert.ok(distanceKm(a,b)<=8);
 }
 const stored=storedItinerary(itinerary);
 assert.equal(stored.placesStoredAs,'ids_only');
 assert.equal(stored.days.length,itinerary.days.length);
 assert.ok(!JSON.stringify(stored).includes('Synthetic provider address'));
 assert.ok(!JSON.stringify(stored).includes('Synthetic provider area'));
 if(f.quiz.seeAllOrDeeply==='deeply')assert.equal(outline.stops.length,1);
}

async function exercise(scenario,seed,mode='valid'){
 const f=fixture(scenario,seed);
 mock.method(global,'fetch',()=>assert.fail('These tests must remain offline'));
 mock.method(discovery,'discoverStops',async()=>f.discovered);
 let calls=0;
 mock.method(llm,'generateStructured',async request=>{
  calls++;assert.equal(request.maxAttempts,2);
  if(mode==='provider-error')throw Object.assign(new Error('Provider unavailable'),{statusCode:503});
  if(mode==='schema-error')throw Object.assign(new Error('Invalid JSON'),{statusCode:502});
  const payload=JSON.parse(request.prompt),data=payload.plan;
  assert.deepEqual(payload.quiz.dietaryRestrictions,f.quiz.dietaryRestrictions);
  if(mode==='empty'){const day=data.days.find(day=>slots.flatMap(slot=>day[slot]).length);for(const slot of slots)day[slot]=[];}
  if(mode==='overpacked')data.days[0].morning=[{placeId:'invented',activityDescription:'Extra'}];
  return {data,model:'mock-narrative'};
 });
 const {itinerary}=await generateCountryItinerary(f);
 verify(itinerary,f);assert.equal(calls,1);
 if(scenario.bases!==undefined)assert.equal(itinerary.outline.stops.length,scenario.bases);
 if(scenario.excursion)assert.ok(itinerary.days.some(day=>day.type==='excursion'));
 assert.equal(itinerary.narrativeSource,mode==='valid'?'gemini':'deterministic_fallback');
 return {itinerary,f};
}

describe('Named travel scenarios with production planning services',()=>{
 for(const [index,scenario] of cases.entries())it(scenario.name,()=>exercise(scenario,index+1));
});
describe('Repeatable stress scenarios with closures, unknown hours and scattered venues',()=>{
 const modes=['valid','empty','overpacked','schema-error','provider-error'];
 for(let seed=1;seed<=64;seed++){
  const scenario=cases[(seed-1)%cases.length],mode=modes[Math.floor((seed-1)/cases.length)%modes.length];
  it(`seed ${seed}: ${scenario.countryId}, ${scenario.days} days, ${mode}`,()=>exercise(scenario,seed*7919,mode));
 }
});

describe('Preferences affect deterministic venue choices',()=>{
 for(const [persona,preferred] of [['Historian','museum'],['Explorer','park']])it(`prioritizes ${preferred} activities for a ${persona}`,async()=>{
  const {itinerary,f}=await exercise({countryId:'country-pt',days:1,persona},71);
  const seed=itinerary.days[0].morning[0]||itinerary.days[0].afternoon[0];
  const source=f.discovered[0].candidatePlaces.find(place=>place.placeId===seed.placeId);
  assert.ok(source.types.includes(preferred));
 });
 for(const countryId of ['country-ch','country-us'])it(`does not bypass an incompatible budget for ${countryId}`,()=>{
  assert.throws(()=>buildOutline({countryId,numberOfDays:7,startDate:'2027-06-05',quiz:{dailyBudget:'$$',seeAllOrDeeply:'seeAll'}}),error=>error.code==='NO_FEASIBLE_ROUTE');
 });
 for(const diet of ['Vegetarian','Vegan','Gluten-free','None'])it(`preserves ${diet} preferences without inventing dietary guarantees`,async()=>{
  const {itinerary}=await exercise({countryId:'country-pt',days:4,pace:'deeply',diet:[diet]},93,'schema-error');
  const meals=itinerary.days.flatMap(day=>slots.flatMap(slot=>day[slot])).filter(activity=>activity.category==='food');
  assert.ok(meals.length>0);
  for(const meal of meals)assert.match(meal.travelTip,/Confirm.*dietary requirements/);
 });
});

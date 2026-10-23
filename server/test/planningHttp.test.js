// Real HTTP boundaries; only DynamoDB and paid providers are mocked.
require('dotenv').config();
const {describe,it,before,after,afterEach,mock}=require('node:test');
const http=require('node:http');
const assert=require('node:assert/strict');
const app=require('../server');
const users=require('../models/userModel');
const {docClient}=require('../db/dynamo');
const {generateToken}=require('../middleware/authMiddleware');
const itineraries=require('../services/countryItineraryService');
const {buildOutline}=require('../services/tripOutlineService');
const data=require('../services/planningDataService');
const google=require('../services/googlePlacesService');

let server,port;
before(async()=>{
 server=http.createServer(app);
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 port=server.address().port;
});
after(async()=>{if(server?.listening)await new Promise(resolve=>server.close(resolve));});
afterEach(()=>mock.restoreAll());

function request(method,path,body,token) {
 return new Promise((resolve,reject)=>{
  const serialized=typeof body==='string'?body:body===undefined?undefined:JSON.stringify(body);
  const req=http.request({hostname:'127.0.0.1',port,method,path,headers:{Connection:'close',...(serialized===undefined?{}:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(serialized)}),...(token?{Authorization:`Bearer ${token}`}:{})}},res=>{
   let text='';res.setEncoding('utf8');res.on('data',chunk=>text+=chunk);
   res.on('end',()=>{try{resolve({status:res.statusCode,body:JSON.parse(text)});}catch{reject(new Error('Expected a JSON API response'));}});
  });
  req.on('error',reject);req.end(serialized);
 });
}

describe('Planning HTTP contract',()=>{
 it('serves uniform country information without authentication or provider calls',async()=>{
  mock.method(docClient,'send',()=>assert.fail('Country information is public and local'));
  mock.method(global,'fetch',()=>assert.fail('No paid provider lookup for country information'));
  const list=await request('GET','/api/countries');
  assert.equal(list.status,200);assert.equal(list.body.countries.length,249);
  for(const [code,supported] of [['PT',true],['JO',false]]){
   const result=await request('GET',`/api/countries/${code}`);
   assert.equal(result.status,200);assert.equal(result.body.planningAvailable,supported);
   assert.ok(result.body.facts.capital);assert.ok(result.body.photo);
  }
 });
 it('serves readiness publicly and protects both direct planning actions',async()=>{
  mock.method(docClient,'send',()=>assert.fail('Public or unauthenticated request cannot access profiles'));
  mock.method(global,'fetch',()=>assert.fail('No external provider request'));
  const readiness=await request('GET','/api/countries/PT/planning');
  assert.equal(readiness.status,200);assert.equal(readiness.body.countryCode,'PT');
  for(const route of ['route','itinerary'])assert.equal((await request('POST',`/api/countries/PT/${route}`,{})).status,401);
 });
 it('returns stable errors for malformed and oversized JSON',async()=>{
  const invalid=await request('POST','/api/countries/PT/route','{');
  assert.equal(invalid.status,400);assert.equal(invalid.body.code,'INVALID_JSON');
  const large=await request('POST','/api/countries/PT/route',{text:'x'.repeat(110000)});
  assert.equal(large.status,413);assert.equal(large.body.code,'BODY_TOO_LARGE');
 });
 it('previews without writes and rejects invalid duration through the mounted route',async()=>{
  mock.method(users,'findUserById',async()=>({quizResponse:{willingToGetVisa:true}}));
  mock.method(docClient,'send',()=>assert.fail('Preview cannot write'));
  mock.method(global,'fetch',()=>assert.fail('Preview needs no external service'));
  const token=generateToken({id:'http-preview'});
  const valid=await request('POST','/api/countries/CH/route',{startDate:'2027-06-05',numberOfDays:21},token);
  assert.equal(valid.status,200);assert.equal(valid.body.outline.stops.length,5);
  const invalid=await request('POST','/api/countries/PT/route',{numberOfDays:22},token);
  assert.equal(invalid.status,400);assert.equal(invalid.body.code,'INVALID_DURATION');
 });
 it('generates, saves, reopens, refreshes and forks a country trip without exposing database keys',async()=>{
  const owner='http-lifecycle',token=generateToken({id:owner}),rows=new Map();
  const quiz={willingToGetVisa:true,minNights:0,maxNights:0};
  mock.method(users,'findUserById',async()=>({quizResponse:quiz}));
  mock.method(global,'fetch',()=>assert.fail('Paid providers must be mocked'));
  mock.method(itineraries,'generateCountryItinerary',async({outline})=>{
   const stop=outline.stops[0],base=data.baseById.get(stop.destinationId),schedule=itineraries.buildSchedule(outline,outline.startDate);
   const itinerary=itineraries.validateAndEnrich({tripTitle:'A day in Portugal',summary:'A focused visit.',days:[{day:1,stopId:stop.stopId,theme:'Explore',morning:[{placeId:'http-venue',activityDescription:'Consider a visit.'}],afternoon:[],evening:[]}]},outline,schedule,[{stopId:stop.stopId,locationId:stop.stopId,candidatePlaces:[{placeId:'http-venue',name:'Fresh provider name',category:'attractions',stopId:stop.stopId,locationId:stop.stopId,lat:base.lat,lng:base.lng}]}],quiz);
   return {itinerary,model:'mock'};
  });
  mock.method(docClient,'send',async command=>{
   const input=command.input,name=command.constructor.name;
   if(name==='PutCommand') {rows.set(`${input.Item.PK}/${input.Item.SK}`,structuredClone(input.Item));return {};}
   const key=`${input.Key.PK}/${input.Key.SK}`,row=rows.get(key);
   if(name==='GetCommand')return {Item:row&&structuredClone(row)};
   if(name==='UpdateCommand') {
    assert.ok(row);assert.equal(input.ExpressionAttributeValues[':saved'],true);
    row.isSaved=true;row.savedAt=input.ExpressionAttributeValues[':timestamp'];
    return {Attributes:structuredClone(row)};
   }
   assert.fail(`Unexpected database operation: ${name}`);
  });
  const generated=await request('POST','/api/countries/PT/itinerary',{startDate:'2027-06-05',numberOfNights:0},token);
  assert.equal(generated.status,200);assert.equal(generated.body.itinerary.days[0].morning[0].placeName,'Fresh provider name');
  const id=generated.body.trip.tripId;assert.equal(generated.body.trip.PK,undefined);
  assert.equal(generated.body.trip.itinerary.placesStoredAs,'ids_only');assert.equal(rows.size,1);
  const saved=await request('PUT',`/api/trips/${id}/save`,{},token);
  assert.equal(saved.status,200);assert.equal(saved.body.trip.isSaved,true);
  const original=JSON.stringify(saved.body.trip.itinerary);
  const reopened=await request('GET',`/api/trips/${id}`,undefined,token);
  assert.equal(reopened.status,200);assert.equal(reopened.body.trip.itinerary.days[0].morning[0].placeName,undefined);
  const stop=reopened.body.trip.itinerary.outline.stops[0],base=data.baseById.get(stop.destinationId);
  mock.method(google,'getPlaceDetails',async()=>({id:'http-venue',displayName:{text:'Refreshed provider name'},location:{latitude:base.lat,longitude:base.lng},addressComponents:[{types:['country'],shortText:'PT'}]}));
  const details=await request('GET',`/api/trips/${id}/days/1/places`,undefined,token);
  assert.equal(details.status,200);assert.equal(details.body.places[0].placeName,'Refreshed provider name');
  const foreign=await request('GET',`/api/trips/${id}/days/1/places`,undefined,generateToken({id:'another-owner'}));
  assert.equal(foreign.status,404);
  const forked=await request('POST',`/api/itinerary/${id}`,{countryId:'country-pt',startDate:'2027-06-06',numberOfNights:0},token);
  assert.equal(forked.status,200);assert.notEqual(forked.body.trip.tripId,id);assert.equal(forked.body.trip.isSaved,false);assert.equal(rows.size,2);
  const unchanged=await request('GET',`/api/trips/${id}`,undefined,token);
  assert.equal(unchanged.body.trip.isSaved,true);assert.equal(JSON.stringify(unchanged.body.trip.itinerary),original);
 });
 for(const failure of ['valid','empty','overpacked','malformed-json','configuration-rejected','provider-unavailable'])it(`generates, saves and retrieves a real seven-day pipeline with ${failure} Gemini output`,async()=>{
  const owner=`http-real-pipeline-${failure}`,token=generateToken({id:owner});
  const quiz={willingToGetVisa:true,minNights:6,maxNights:6,startDate:'2027-06-05',dailyBudget:'$$',seeAllOrDeeply:'seeAll',travelAlterEgo:'Foodie',dietaryRestrictions:['Vegetarian']};
  const row={PK:`USER#${owner}`,SK:'TRIP#draft',tripId:'draft',userId:owner,schemaVersion:2,isSaved:false,generatedBy:'old-model',quizSnapshot:quiz,recommendations:[{type:'country',destinationId:'country-pl'}]};
  let googleCalls=0,geminiCalls=0;
  const previousKey=process.env.GEMINI_API_KEY,previousGoogle=process.env.GOOGLE_PLACES_API_KEY;
  process.env.GEMINI_API_KEY='mock-pipeline-key';process.env.GOOGLE_PLACES_API_KEY='mock-pipeline-places';
  mock.method(docClient,'send',async command=>{
   const input=command.input;
   assert.equal(input.Key.PK,row.PK);assert.equal(input.Key.SK,row.SK);
   if(command.constructor.name==='GetCommand')return {Item:structuredClone(row)};
   assert.equal(command.constructor.name,'UpdateCommand');
   const values=input.ExpressionAttributeValues;
   if(values[':itinerary']){row.itinerary=structuredClone(values[':itinerary']);row.generatedBy=values[':model'];}
   else if(values[':saved']===true){row.isSaved=true;row.savedAt=values[':timestamp'];}
   else assert.fail('Unexpected update');
   return {Attributes:structuredClone(row)};
  });
  mock.method(global,'fetch',async(url,init)=>{
   const host=new URL(url).hostname;
   if(host==='places.googleapis.com'){
    googleCalls++;const query=JSON.parse(init.body).textQuery;
    const base=data.baseById.get(query.includes('Warsaw')?'warsaw-pl':'krakow-pl');
    const food=query.includes('restaurants'),category=food?'food':query.includes('museums')?'attractions':'experiences';
    return new Response(JSON.stringify({places:Array.from({length:15},(_,index)=>({
     id:`${base.destinationId}-${category}-${index}`,displayName:{text:`Provider ${category} ${index}`},
     types:food?['vegetarian_restaurant']:['museum'],primaryType:food?'vegetarian_restaurant':'museum',
     location:{latitude:base.lat+Math.floor(index/5)*0.05,longitude:base.lng},
     addressComponents:[{types:['country'],shortText:'PL'},{types:['neighborhood'],longText:'Provider district'}],
     regularOpeningHours:{weekdayDescriptions:['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(day=>`${day}: ${food?'11:00 AM – 11:00 PM':'9:00 AM – 5:00 PM'}`)},
    }))}),{status:200,headers:{'Content-Type':'application/json'}});
   }
   assert.equal(host,'generativelanguage.googleapis.com');geminiCalls++;
   if(failure==='provider-unavailable')return new Response(JSON.stringify({error:{code:503,message:'Unavailable',status:'UNAVAILABLE'}}),{status:503,headers:{'Content-Type':'application/json'}});
   if(failure==='configuration-rejected')return new Response(JSON.stringify({error:{code:400,message:'Mock rejected configuration',status:'INVALID_ARGUMENT'}}),{status:400,headers:{'Content-Type':'application/json'}});
   const body=JSON.parse(init.body),payload=JSON.parse(body.contents[0].parts[0].text),copy=payload.plan;
   if(failure==='empty')for(const slot of ['morning','afternoon','evening'])copy.days[1][slot]=[];
   else if(failure==='overpacked')copy.days[1].morning.push({placeId:'extra-1',activityDescription:'Extra'},{placeId:'extra-2',activityDescription:'Extra'});
   return new Response(JSON.stringify({candidates:[{content:{role:'model',parts:[{text:failure==='malformed-json'?'{"days":':JSON.stringify(copy)}]},finishReason:'STOP'}]}),{status:200,headers:{'Content-Type':'application/json'}});
  });
  try{
   const generated=await request('POST','/api/itinerary/draft',{countryId:'country-pl'},token);
   assert.equal(generated.status,200,JSON.stringify(generated.body));
   assert.equal(generated.body.itinerary.days.length,7);assert.equal(generated.body.itinerary.outline.stops.length,2);
   const source=failure==='valid'?'gemini':'deterministic_fallback';
   assert.equal(generated.body.itinerary.narrativeSource,source);
   if(failure==='valid')assert.ok(row.generatedBy);
   else assert.equal(row.generatedBy,null,'Old Gemini attribution must be cleared');
   assert.equal(googleCalls,6);assert.equal(geminiCalls,1);
   const saved=await request('PUT','/api/trips/draft/save',{},token);assert.equal(saved.status,200);
   const reopened=await request('GET','/api/trips/draft',undefined,token);assert.equal(reopened.status,200);
   assert.equal(reopened.body.trip.isSaved,true);assert.equal(reopened.body.trip.itinerary.days.length,7);
   assert.equal(reopened.body.trip.itinerary.narrativeSource,source);
  }finally{
   if(previousKey===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=previousKey;
   if(previousGoogle===undefined)delete process.env.GOOGLE_PLACES_API_KEY;else process.env.GOOGLE_PLACES_API_KEY=previousGoogle;
  }
 });
});

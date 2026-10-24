require('dotenv').config();
const { describe, it, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { TRIP_POLICY, maxBasesForDays, minimumNights } = require('../config/tripPolicy');
const registry = require('../data/countries.json');
const destinations = require('../data/destinations.json');
const catalog = require('../services/planningDataService');
const outlines = require('../services/tripOutlineService');
const itineraries = require('../services/countryItineraryService');
const discovery = require('../services/stopDiscoveryService');
const llm = require('../services/llmclient');
const google = require('../services/googlePlacesService');
const users = require('../models/userModel');
const trips = require('../models/tripModel');
const visa = require('../services/visaService');
const { docClient } = require('../db/dynamo');
const direct = require('../controllers/countryPlanningController');
const { createCountryItinerary } = require('../controllers/countryTripController');
const { rankCountries } = require('../services/countryScoringService');
const { storedItinerary } = require('../services/itineraryStorageService');
const { refreshDay } = require('../services/savedVenueService');
const { mapLimit, instrument, measuredSync, count } = require('../services/telemetryService');
const { normalizeTag, personaTags } = require('../config/interestTags');
const { generationLimiter } = require('../middleware/generationLimiter');

afterEach(() => mock.restoreAll());
function response() {
  return { statusCode: 200, headers: {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; }, setHeader(key,value) { this.headers[key]=value; } };
}
function fixture(days = 7, countryId = 'country-pt', quiz = {}) {
  const outline = outlines.buildOutline({ countryId, numberOfDays: days, startDate: '2027-06-05', quiz });
  const schedule = itineraries.buildSchedule(outline, outline.startDate);
  const discovered = outline.stops.map(stop => {
    const base = catalog.baseById.get(stop.destinationId);
    return { stopId: stop.stopId, locationId: stop.stopId, candidatePlaces: Array.from({length:21},(_,i)=>({
      placeId: `${stop.stopId}-venue-${i}`, stopId:stop.stopId, locationId:stop.stopId, name:'Provider venue',
      category:'food', countryCode:outline.countryCode, lat:base.lat,lng:base.lng,address:'Provider address',
      neighborhood:'Provider district',rating:4.8,openingHours:null,attributions:[{provider:'Test credit'}],
    })) };
  });
  const data = {tripTitle:'A focused trip',summary:'A tailored route.',days:schedule.map(day=>({
    day:day.day,stopId:day.stopId,theme:'Explore locally',morning:[],afternoon:[],evening:[],
    [day.allowedSlots[0]]:[{placeId:`${day.stopId}-venue-${day.day-1}`,activityDescription:'Consider a visit.'}],
  }))};
  return {outline,schedule,discovered,data};
}
// Deliberately synthetic country/settlements: never written to production data.
function syntheticData(size = 5, countryCode = 'XX') {
  const records=Array.from({length:size},(_,i)=>({id:`synthetic-${countryCode}-${i}`,name:`Test town ${i}`,country:'Test country',countryCode,type:'town',tags:['food'],budget:'$$',safety:1,bestMonths:['Jun'],
    coordinates:{lat:10+i/10,lng:20},provenance:{geography:{status:'verified_gazetteer',geonameId:i+1,sourceUrl:'https://example.test/geography'}},
    planning:{enabled:true,reviewStatus:'reviewed',lat:10+i/10,lng:20,region:'Test region',minNights:2,radiusKm:10}}));
  const connections=records.slice(1).map((record,i)=>({from:records[i].id,to:record.id,mode:'train',planningMinutes:90,bidirectional:true,domesticOnly:true,status:'reviewed',reviewedOn:'2026-10-23',sourceUrl:'https://example.test/transport'}));
  return catalog.buildPlanningData(records,{version:'synthetic',connections,excursions:[]},[{countryCode,id:`country-${countryCode.toLowerCase()}`,name:'Test country'}]);
}
function useSynthetic(data) {
  const original={...catalog};
  Object.assign(catalog,data);
  return ()=>Object.assign(catalog,original);
}

describe('Shared worldwide policy',()=>{
  for(const [days,max] of [[1,1],[2,1],[4,1],[5,2],[9,2],[10,3],[15,3],[16,4],[20,4],[21,5]]) {
    it(`enforces ${days} days -> at most ${max} bases`,()=>assert.equal(maxBasesForDays(days),max));
  }
  it('rejects duration underflow, overflow and fractional days',()=>{
    for(const value of [0,22,-1,3.5,NaN,'7',null]) assert.throws(()=>maxBasesForDays(value),RangeError);
    for(const nights of [-1,21,0.5]) assert.throws(()=>outlines.resolveDuration({},undefined,nights));
    assert.throws(()=>outlines.resolveDuration({},5,5));
  });
  it('only relaxes per-base minimum stays for one- and two-day visits',()=>{
    assert.equal(minimumNights({minNights:3},1),0);
    assert.equal(minimumNights({minNights:3},2),1);
    assert.equal(minimumNights({minNights:3},3),3);
  });
  it('generates and stores a real zero-night visit without accommodation',()=>{
    const f=fixture(1); const enriched=itineraries.validateAndEnrich(f.data,f.outline,f.schedule,f.discovered,{});
    assert.equal(f.outline.stops[0].nights,0); assert.equal(f.outline.stops[0].stopType,'visit');
    assert.equal(enriched.days[0].type,'visit'); assert.deepEqual(enriched.stays,[]);
    assert.equal(storedItinerary(enriched).outline.numberOfNights,0);
    assert.equal(require('../services/tripSummaryService').tripSummary({outline:f.outline},{partial:true}).numberOfNights,0);
  });
});

describe('Worldwide geography integrity',()=>{
  it('has a unique ISO registry and explicit truthful coverage exceptions',()=>{
    assert.equal(registry.countries.length,249);
    assert.equal(new Set(registry.countries.map(c=>c.countryCode)).size,249);
    assert.equal(catalog.countries.filter(c=>c.verifiedSettlementCount>=5).length,224);
    for(const country of catalog.countries.filter(c=>c.verifiedSettlementCount<5)) assert.ok(country.coverageException,country.countryCode);
    const {toCountryCode,VALID_ISO_CODES}=require('../utils/countryCodes');
    assert.equal(VALID_ISO_CODES.size,249);assert.equal(toCountryCode("Cote d'Ivoire"),'CI');assert.equal(toCountryCode('constructor'),null);
  });
  it('keeps imported settlements disabled and unknown travel attributes explicit',()=>{
    for(const d of destinations.filter(d=>d.id.startsWith('gn-') && d.planning.reviewStatus==='pending_travel_review')) {
      assert.equal(d.planning.enabled,false);assert.equal(d.budget,null);assert.equal(d.safety,null);
      assert.ok(d.provenance.geography.geonameId);assert.ok(d.provenance.geography.sourceUrl);
    }
  });
  it('rejects duplicate IDs, nonexistent country codes, unknown tags and absent provenance',()=>{
    const sample=structuredClone(destinations.find(d=>d.planning?.enabled));
    for(const records of [[sample,sample],[{...sample,countryCode:'XX'}],[{...sample,tags:['invented-tag']}],[{...sample,provenance:{}}]]) assert.throws(()=>catalog.buildPlanningData(records,{connections:[]}));
    assert.equal(normalizeTag('Gastronomy'),'food');assert.ok(personaTags('The Historian').includes('history'));
  });
});

describe('Five-base routing and independent validation',()=>{
  it('generates, validates and schedules a connected 21-day five-base route',()=>{
    const restore=useSynthetic(syntheticData());
    try {
      const f=fixture(21,'country-xx',{seeAllOrDeeply:'seeAll'});
      assert.equal(f.outline.stops.length,5);assert.equal(f.outline.transfers.length,4);
      assert.equal(f.outline.stops.reduce((sum,s)=>sum+s.nights,0),20);
      assert.equal(f.schedule.length,21);assert.equal(f.schedule.at(-1).date,'2027-06-25');
      const enriched=itineraries.validateAndEnrich(f.data,f.outline,f.schedule,f.discovered,{});
      assert.equal(storedItinerary(enriched).stays.length,5);
      for(const mutate of [o=>o.stops[0].countryCode='YY',o=>o.stops[1].destinationId=o.stops[0].destinationId,o=>o.transfers[0].mode='plane',o=>o.stops[0].nights=1,o=>o.numberOfDays=22]) {
        const invalid=structuredClone(f.outline);mutate(invalid);assert.throws(()=>outlines.validateOutline(invalid));
      }
    } finally {restore();}
  });
  it('honors all duration tiers and relaxed travelers on the same graph',()=>{
    const restore=useSynthetic(syntheticData());
    try {
      for(const days of [1,4,5,9,10,15,16,20,21]) {
        assert.equal(outlines.buildOutline({countryId:'country-xx',numberOfDays:days,quiz:{seeAllOrDeeply:'seeAll'}}).stops.length,maxBasesForDays(days));
      }
      assert.equal(outlines.buildOutline({countryId:'country-xx',numberOfDays:21,quiz:{seeAllOrDeeply:'deeply'}}).stops.length,1);
      assert.equal(outlines.buildOutline({countryId:'country-xx',numberOfDays:21,quiz:{intercityTransportModes:['ferry']}}).stops.length,1);
    } finally {restore();}
  });
  it('bounds dense searches rather than enumerating factorial paths',()=>{
    const bases=Array.from({length:80},(_,i)=>({id:`town-${i}`,tags:['food'],minNights:2}));
    const routes=outlines.enumerateRoutes(bases,{},21,()=>({planningMinutes:60}));
    assert.ok(routes.length<=TRIP_POLICY.candidateBaseLimit+4*TRIP_POLICY.routeBeamWidth);
    assert.equal(Math.max(...routes.map(route=>route.length)),5);
    assert.ok(routes.every(route=>new Set(route.map(b=>b.id)).size===route.length));
  });
  it('does not reward a larger catalog for duplicate matching quality',()=>{
    const restore=useSynthetic(syntheticData(5));
    try {
      const quiz={minNights:0,maxNights:0,travelAlterEgo:'Foodie'};
      const first=rankCountries(quiz)[0].matchScore;
      Object.assign(catalog,syntheticData(40));
      assert.equal(rankCountries(quiz)[0].matchScore,first);
      assert.deepEqual(rankCountries(quiz),rankCountries(quiz));
    } finally {restore();}
  });
});

describe('Direct-country endpoints',()=>{
  const request=()=>({user:{userId:'owner'},params:{countryCode:'pt'},body:{startDate:'2027-06-05',numberOfNights:6}});
  it('reports registered-but-unready countries without any external calls',async()=>{
    mock.method(users,'findUserById',()=>assert.fail('Public readiness must not fetch a user'));
    const res=response();await direct.countryAvailability({params:{countryCode:'jo'}},res);
    assert.equal(res.statusCode,200);assert.equal(res.body.planningAvailable,false);assert.ok(res.body.verifiedSettlementCount>=5);
    for(const [code,status] of [['PTT',400],['XX',404]]) {const res=response();await direct.countryAvailability({params:{countryCode:code}},res);assert.equal(res.statusCode,status);}
  });
  it('previews through the same deterministic engine without database writes',async()=>{
    const quiz={minNights:6,maxNights:6,visaWillingness:true};
    mock.method(users,'findUserById',async id=>{assert.equal(id,'owner');return {quizResponse:quiz};});
    mock.method(trips,'createTrip',()=>assert.fail('Preview cannot write'));
    const req=request(),res=response();await direct.directRoute(req,res);
    assert.equal(res.statusCode,200);assert.deepEqual(res.body.outline,outlines.buildOutline({countryId:'country-pt',quiz,startDate:'2027-06-05',numberOfNights:6}));
  });
  it('rejects missing assessments, invalid duration, unavailable countries and visa uncertainty',async()=>{
    mock.method(users,'findUserById',async()=>({}));
    let res=response();await direct.directRoute(request(),res);assert.equal(res.body.code,'ASSESSMENT_REQUIRED');
    const req=request();req.body.quiz={visaWillingness:true};req.body.numberOfNights=21;
    res=response();await direct.directRoute(req,res);assert.equal(res.body.code,'INVALID_DURATION');
    req.params.countryCode='JO';res=response();await direct.directRoute(req,res);assert.equal(res.body.code,'COUNTRY_NOT_READY');
    req.params.countryCode='PT';req.body.quiz={visaWillingness:false};res=response();await direct.directRoute(req,res);assert.equal(res.body.code,'CITIZENSHIP_REQUIRED');
    req.body.quiz.nationalities=['US'];mock.method(visa,'getVisaFreeCountries',async()=>{throw new Error('private upstream body');});
    res=response();await direct.directRoute(req,res);assert.equal(res.body.code,'VISA_UNAVAILABLE');assert.ok(!JSON.stringify(res.body).includes('private'));
  });
  it('uses shared itinerary generation and only creates a draft after validation',async()=>{
    mock.method(users,'findUserById',async()=>({quizResponse:{visaWillingness:true,minNights:6,maxNights:6}}));
    const f=fixture();const generated=itineraries.validateAndEnrich(f.data,f.outline,f.schedule,f.discovered,{});
    mock.method(itineraries,'generateCountryItinerary',async()=>({itinerary:generated,model:'mock'}));
    let writes=0;
    mock.method(trips,'createTrip',async(id,input)=>{writes++;assert.equal(id,'owner');assert.equal(input.selectionMetadata.source,'direct_country');return {tripId:'new'};});
    mock.method(trips,'updateTripItinerary',async(id,tripId)=>({tripId,userId:id}));
    const res=response();await direct.directItinerary(request(),res);assert.equal(res.statusCode,200);assert.equal(writes,1);
    itineraries.generateCountryItinerary=async()=>{throw Object.assign(new Error('Invalid model output'),{statusCode:502,code:'INVALID_AI_OUTPUT'});};
    const invalid=response();await direct.directItinerary(request(),invalid);assert.equal(invalid.statusCode,502);assert.equal(writes,1);
  });
});

describe('Provider bounds and storage contract',()=>{
  it('filters clearly incompatible venue types and retains returned attribution',()=>{
    const {normalizePlace}=require('../services/placeNormalizer');
    const raw={id:'typed-place',displayName:{text:'Museum'},location:{latitude:10,longitude:20},primaryType:'museum',types:['museum'],attributions:[{provider:'Credit'}]};
    assert.equal(normalizePlace(raw,'food'),null);
    assert.deepEqual(normalizePlace(raw,'attractions').attributions,raw.attributions);
    assert.equal(normalizePlace({...raw,primaryType:'restaurant'},'attractions'),null);
  });
  it('caps Google concurrency, retries one transient response and excludes closed venues',async()=>{
    const old=process.env.GOOGLE_PLACES_API_KEY;process.env.GOOGLE_PLACES_API_KEY='mock-only';
    let active=0,peak=0,calls=0;
    mock.method(global,'fetch',async()=>{active++;peak=Math.max(peak,active);const current=++calls;await new Promise(resolve=>setTimeout(resolve,3));active--;
      return {ok:current!==1,status:current===1?429:200,json:async()=>({places:[{id:'open'},{id:'closed',businessStatus:'CLOSED_PERMANENTLY'}]})};});
    try {
      const result=await google.searchPlacesForQueries({attractions:'test',food:'test',experiences:'test'},{name:'Test',country:'Test'});
      assert.ok(peak<=2);assert.equal(calls,4);assert.ok(Object.values(result.places).every(list=>list.length===1));
    } finally {if(old===undefined)delete process.env.GOOGLE_PLACES_API_KEY;else process.env.GOOGLE_PLACES_API_KEY=old;}
  });
  it('fails closed when Google credentials are missing',async()=>{
    const old=process.env.GOOGLE_PLACES_API_KEY;delete process.env.GOOGLE_PLACES_API_KEY;
    mock.method(global,'fetch',()=>assert.fail('Missing credentials cannot invoke a provider'));
    try {await assert.rejects(google.searchPlaces('test'),error=>error.code==='PLACES_NOT_CONFIGURED');}
    finally {if(old!==undefined)process.env.GOOGLE_PLACES_API_KEY=old;}
  });
  it('caps normalized candidate pools at the configured size for selected locations only',async()=>{
    const outline=outlines.buildOutline({countryId:'country-pt',numberOfDays:7});let calls=0;
    mock.method(google,'searchPlacesForQueries',async(_queries,base,options)=>{
      calls++;assert.equal(options.pageSize,TRIP_POLICY.placesPageSize);
      const places=Array.from({length:50},(_,i)=>({id:`${base.id}-${i}`,displayName:{text:'Venue'},types:['museum'],location:{latitude:base.lat,longitude:base.lng},addressComponents:[{types:['country'],shortText:'PT'}]}));
      return {places:{attractions:places,food:[],experiences:[]}};
    });
    const results=await discovery.discoverStops(outline,{});assert.equal(calls,outline.stops.length);
    assert.ok(results.every(stop=>stop.candidatePlaces.length===TRIP_POLICY.maxCandidatesPerLocation));
  });
  it('keeps the validated plan with neutral text when narrative output fails',async()=>{
    const f=fixture();mock.method(discovery,'discoverStops',async()=>f.discovered);let calls=0;
    mock.method(llm,'generateStructured',async()=>{calls++;return {data:{days:[]}};});
    const result=await itineraries.generateCountryItinerary({outline:f.outline,quiz:{},startDate:f.outline.startDate});assert.equal(calls,1);assert.equal(result.itinerary.days.length,7);
    assert.equal(result.itinerary.narrativeSource,'deterministic_fallback');assert.equal(result.model,null);
    llm.generateStructured=async()=>{calls++;throw Object.assign(new Error('Unavailable'),{statusCode:503});};calls=0;
    const unavailable=await itineraries.generateCountryItinerary({outline:f.outline,quiz:{},startDate:f.outline.startDate});assert.equal(calls,1);
    assert.deepEqual(unavailable.itinerary.days,result.itinerary.days);
  });
  it('persists IDs and app-authored content without raw Google fields',()=>{
    const f=fixture();const enriched=itineraries.validateAndEnrich(f.data,f.outline,f.schedule,f.discovered,{});
    const saved=storedItinerary(enriched);const serialized=JSON.stringify(saved);
    assert.equal(saved.placesStoredAs,'ids_only');assert.ok(saved.days[0].evening[0].placeId);
    for(const secret of ['Provider venue','Provider address','Provider district','Test credit','"rating"','"openingHours"']) assert.ok(!serialized.includes(secret),secret);
    const legacy={days:[],oldField:'preserved'};assert.equal(storedItinerary(legacy),legacy);
    const broken=structuredClone(enriched);broken.days[0].date='2027-06-06';assert.throws(()=>storedItinerary(broken));
    const overpacked=structuredClone(enriched);overpacked.days[0].morning=[{placeId:'extra',category:'food'}];assert.throws(()=>storedItinerary(overpacked));
  });
  it('protects saved itineraries in the conditional database write',async()=>{
    const f=fixture();const enriched=itineraries.validateAndEnrich(f.data,f.outline,f.schedule,f.discovered,{});
    mock.method(docClient,'send',async command=>{
      assert.match(command.input.ConditionExpression,/isSaved = :draftOnly/);assert.equal(command.input.ExpressionAttributeValues[':draftOnly'],false);
      assert.equal(command.input.Key.PK,'USER#owner');assert.equal(command.input.ExpressionAttributeValues[':itinerary'].placesStoredAs,'ids_only');return {Attributes:{tripId:'draft'}};
    });
    await trips.updateTripItinerary('owner','draft',enriched);
  });
  it('returns a conflict if a trip is saved while generation is in flight',async()=>{
    const f=fixture();mock.method(itineraries,'generateCountryItinerary',async()=>({itinerary:itineraries.validateAndEnrich(f.data,f.outline,f.schedule,f.discovered,{}),model:'mock'}));
    mock.method(trips,'updateTripItinerary',async()=>{throw Object.assign(new Error('condition'),{name:'ConditionalCheckFailedException'});});
    const res=response();await createCountryItinerary({user:{userId:'owner'},body:{countryId:'country-pt',startDate:'2027-06-05'}},res,{tripId:'draft',recommendations:[{type:'country',destinationId:'country-pt'}],quizSnapshot:{minNights:6}});
    assert.equal(res.statusCode,409);assert.equal(res.body.code,'TRIP_CHANGED');
  });
  it('refreshes provider content without database writes and rechecks country',async()=>{
    const f=fixture();const enriched=itineraries.validateAndEnrich(f.data,f.outline,f.schedule,f.discovered,{});const saved=storedItinerary(enriched);
    const base=catalog.baseById.get(saved.outline.stops[0].destinationId);
    mock.method(google,'getPlaceDetails',async id=>({id,displayName:{text:'Fresh venue'},types:['restaurant'],location:{latitude:base.lat,longitude:base.lng},addressComponents:[{types:['country'],shortText:'PT'}]}));
    mock.method(docClient,'send',()=>assert.fail('Venue reads cannot persist Google content'));
    const result=await refreshDay({itinerary:saved},1);assert.equal(result.persisted,false);assert.equal(result.places[0].placeName,'Fresh venue');
    google.getPlaceDetails=async id=>({id,displayName:{text:'Foreign venue'},types:['restaurant'],location:{latitude:base.lat,longitude:base.lng},addressComponents:[{types:['country'],shortText:'FR'}]});
    await assert.rejects(refreshDay({itinerary:saved},1),error=>error.code==='VENUE_NO_LONGER_ELIGIBLE');
  });
});

describe('Operational safeguards',()=>{
  it('requires authentication on both direct generation routes',()=>{
    const router=require('../routes/countryRoutes');
    for(const path of ['/:countryCode/route','/:countryCode/itinerary']) {
      const layer=router.stack.find(layer=>layer.route?.path===path);
      assert.ok(layer.route.stack.some(entry=>entry.handle.name==='authenticateToken'));
    }
    const {authenticateToken,generateToken}=require('../middleware/authMiddleware');
    const res=response();authenticateToken({headers:{}},res,()=>assert.fail('Unauthenticated access'));assert.equal(res.statusCode,401);
    const secret=process.env.JWT_SECRET;delete process.env.JWT_SECRET;
    try {assert.throws(()=>generateToken({id:'user'}),/JWT_SECRET is required/);}
    finally {if(secret!==undefined)process.env.JWT_SECRET=secret;}
  });
  it('checks trip ownership before refreshing any provider details',async()=>{
    mock.method(docClient,'send',async command=>{assert.equal(command.input.Key.PK,'USER#other-user');return {};});
    mock.method(google,'getPlaceDetails',()=>assert.fail('Foreign trip cannot cause provider requests'));
    const {getTripDayPlacesController}=require('../controllers/tripController');
    const res=response();await getTripDayPlacesController({user:{userId:'other-user'},params:{tripId:'foreign-trip',day:'1'}},res);assert.equal(res.statusCode,404);
  });
  it('logs only bounded stage metrics and counts, including nested operations',async()=>{
    const old=process.env.PLANNING_METRICS;process.env.PLANNING_METRICS='1';const logged=[];mock.method(console,'info',text=>logged.push(JSON.parse(text)));
    try {await instrument('test',()=>instrument('nested',()=>measuredSync('routeSelection',()=>count('candidates',3))));}
    finally {if(old===undefined)delete process.env.PLANNING_METRICS;else process.env.PLANNING_METRICS=old;}
    assert.equal(logged.length,1);assert.equal(logged[0].planningMetrics.counts.candidates,3);assert.ok('routeSelection' in logged[0].planningMetrics.timingsMs);
  });
  it('bounds parallel work and waits for active requests to settle after failure',async()=>{
    let active=0,peak=0;
    await assert.rejects(mapLimit([1,2,3,4],2,async value=>{active++;peak=Math.max(peak,active);await new Promise(resolve=>setTimeout(resolve,2));active--;if(value===1)throw new Error('expected');return value;}));
    assert.equal(active,0);assert.equal(peak,2);
  });
  it('rate-limits repeated generation with a retry header',()=>{
    const req={user:{userId:'rate-limit-test'}},limit=Number(process.env.GENERATION_REQUESTS_PER_MINUTE)||12;
    for(let i=0;i<limit;i++)generationLimiter(req,response(),()=>{});
    const res=response();generationLimiter(req,res,()=>assert.fail('Over-limit request reached controller'));assert.equal(res.statusCode,429);assert.ok(res.headers['Retry-After']);
  });
});

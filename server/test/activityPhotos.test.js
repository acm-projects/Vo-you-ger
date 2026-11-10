const {describe,it,afterEach,mock}=require('node:test');
const assert=require('node:assert/strict');
const {PHOTO_SUBJECTS,photoCategory,activityPhoto,withActivityPhotos}=require('../services/activityPhotoService');
const catalog=require('../data/activityPhotos.json');
const google=require('../services/googlePlacesService');
const {docClient}=require('../db/dynamo');

afterEach(()=>mock.restoreAll());

describe('Shared Unsplash activity illustrations',()=>{
  it('ships reusable landscape illustrations and complete source/photographer credits for every category',()=>{
    for(const category of Object.keys(PHOTO_SUBJECTS)) {
      const photos=catalog.categories[category];
      assert.ok(photos?.length>=2,category);
      for(const photo of photos) {
        assert.equal(photo.provider,'unsplash');
        assert.equal(new URL(photo.url).hostname,'images.unsplash.com');
        assert.ok(photo.width>photo.height);
        assert.ok(photo.credit);
        for(const field of ['sourceUrl','photographerUrl','providerUrl']) {
          const url=new URL(photo[field]);
          assert.equal(url.hostname,'unsplash.com');
          assert.equal(url.searchParams.get('utm_source'),'voyouger');
        }
      }
    }
  });
  it('matches venue types, prioritizing cafés, beaches and natural parks over broad categories',()=>{
    for(const [input,expected] of [
      [{category:'food'},'restaurant'],[{category:'food',types:['cafe','food']},'cafe'],
      [{category:'attractions',primaryType:'park'},'park'],
      [{types:['national_park','park']},'nature'],[{types:['beach','park']},'beach'],
      [{types:['museum','tourist_attraction']},'museum'],[{primaryType:'church'},'landmark'],
      [{category:'experiences',types:['market']},'city'],[{},'city'],
    ]) assert.equal(photoCategory(input),expected);
  });
  it('returns stable illustrative images without provider requests or database writes',()=>{
    mock.method(global,'fetch',()=>assert.fail('Viewing illustrations must not call providers'));
    mock.method(docClient,'send',()=>assert.fail('Viewing illustrations must not write records'));
    const activity={placeId:'saved-park',category:'attractions',types:['park']};
    const photo=activityPhoto(activity);
    assert.deepEqual(activityPhoto(activity),photo);
    assert.equal(photo.illustrative,true);
    assert.equal(photo.caption,'Illustrative photo');
    assert.match(photo.alt,/Illustrative photo: park/);
    assert.equal(photo.alt.includes(activity.placeId),false);
    assert.equal(new Set(Array.from({length:12},(_,i)=>activityPhoto({...activity,placeId:`park-${i}`}).id)).size,2);
  });
  it('decorates saved and legacy activities without changing the saved plan or reserved empty days',()=>{
    const itinerary={days:[{day:1,morning:[{placeId:'food',category:'food',activityDescription:'Saved meal description'}],afternoon:[],evening:[]},
      {day:2,type:'departure',morning:[],afternoon:[],evening:[]},
      {day:3,activities:[{name:'An existing visit'}]}]};
    const decorated=withActivityPhotos(itinerary);
    assert.equal(decorated.days[0].morning[0].photo.subject,'Restaurant dining');
    assert.equal(decorated.days[0].morning[0].activityDescription,'Saved meal description');
    assert.equal(itinerary.days[0].morning[0].photo,undefined);
    assert.deepEqual(decorated.days[1],itinerary.days[1]);
    assert.equal(decorated.days[2].activities[0].photo.illustrative,true);
  });
  it('refreshed venue facts keep their Google attribution and gain an appropriate illustration without another lookup',async()=>{
    const {buildOutline}=require('../services/tripOutlineService');
    const data=require('../services/planningDataService');
    const outline=buildOutline({countryId:'country-pt',numberOfDays:1,startDate:'2027-06-05',quiz:{}});
    const stop=outline.stops[0],base=data.baseById.get(stop.destinationId);
    const details=mock.method(google,'getPlaceDetails',async id=>({id,displayName:{text:'Verified park'},types:['park'],
      location:{latitude:base.lat,longitude:base.lng},addressComponents:[{types:['country'],shortText:'PT'}]}));
    mock.method(global,'fetch',()=>assert.fail('Illustrations cannot make a second provider request'));
    const result=await require('../services/savedVenueService').refreshDay({itinerary:{schemaVersion:2,outline,days:[{day:1,stopId:stop.stopId,morning:[{placeId:'saved-park',category:'attractions'}],afternoon:[],evening:[]}]}},1);
    assert.equal(details.mock.callCount(),1);
    assert.equal(result.places[0].placeName,'Verified park');
    assert.equal(result.places[0].photo.subject,'Park');
    assert.equal(result.attribution.provider,'Google Maps');
    assert.equal(result.persisted,false);
  });
  it('includes illustrations on authenticated trip reads, keeping database keys private',async()=>{
    mock.method(docClient,'send',async()=>({Item:{PK:'USER#owner',SK:'TRIP#t-example',tripId:'t-example',
      itinerary:{days:[{day:1,morning:[{placeId:'one',category:'food'}],afternoon:[],evening:[]}]}}}));
    mock.method(global,'fetch',()=>assert.fail('Reading a trip cannot call an image provider'));
    const res={status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
    await require('../controllers/tripController').getTripController({user:{userId:'owner'},params:{tripId:'t-example'}},res);
    assert.equal(res.code,200);
    assert.equal(res.body.trip.PK,undefined);
    assert.equal(res.body.trip.itinerary.days[0].morning[0].photo.illustrative,true);
  });
  it('prefers a fresh Google photo and keeps the Unsplash fallback without changing saved records',async()=>{
    const {buildOutline}=require('../services/tripOutlineService');
    const data=require('../services/planningDataService');
    const outline=buildOutline({countryId:'country-pt',numberOfDays:1,startDate:'2027-06-05',quiz:{}});
    const stop=outline.stops[0],base=data.baseById.get(stop.destinationId);
    const trip={itinerary:{schemaVersion:2,outline,days:[{day:1,stopId:stop.stopId,morning:[{placeId:'saved-park',category:'attractions'}],afternoon:[],evening:[]}]}};
    const original=structuredClone(trip);
    mock.method(docClient,'send',()=>assert.fail('Photo refresh cannot write saved records'));
    mock.method(google,'getPlaceDetails',async id=>({id,displayName:{text:'Verified park'},types:['park'],
      location:{latitude:base.lat,longitude:base.lng},addressComponents:[{types:['country'],shortText:'PT'}],
      photos:[{name:`places/${id}/photos/fresh`,authorAttributions:[{displayName:'Photographer'}]}]}));
    const image={provider:'google_places',url:'https://lh3.googleusercontent.com/park',illustrative:false,authorAttributions:[{displayName:'Photographer'}]};
    const photo=mock.method(google,'getPlacePhoto',async raw=>{assert.equal(raw.id,'saved-park');return image;});
    const {refreshDay}=require('../services/savedVenueService');
    const result=await refreshDay(trip,1);
    assert.equal(photo.mock.callCount(),1);assert.deepEqual(result.places[0].photo,image);
    assert.equal(result.places[0].fallbackPhoto.provider,'unsplash');
    assert.equal(result.places[0].fallbackPhoto.subject,'Park');
    assert.equal(result.places[0].photoDetails,undefined);assert.deepEqual(trip,original);
    photo.mock.mockImplementation(async()=>null);
    const fallback=await refreshDay(trip,1);
    assert.equal(fallback.places[0].placeName,'Verified park');
    assert.equal(fallback.places[0].photo.provider,'unsplash');assert.equal(fallback.places[0].photo.illustrative,true);
  });
  it('keeps illustrations out of stored itinerary records',()=>{
    const {buildOutline}=require('../services/tripOutlineService');
    const {buildSchedule}=require('../services/countryItineraryService');
    const outline=buildOutline({countryId:'country-pt',numberOfDays:1,startDate:'2027-06-05',quiz:{}});
    const days=buildSchedule(outline,outline.startDate).map(day=>({...day,morning:[{placeId:'one',category:'attractions',activityDescription:'A saved visit'}],afternoon:[],evening:[]}));
    const displayed=withActivityPhotos({schemaVersion:2,outline,days,stays:[]});
    const stored=require('../services/itineraryStorageService').storedItinerary(displayed);
    assert.ok(!JSON.stringify(stored).includes('images.unsplash.com'));
    assert.equal(stored.days[0].morning[0].placeId,'one');
  });
});

const {describe,it,afterEach,mock}=require('node:test');
const assert=require('node:assert/strict');
const google=require('../services/googlePlacesService');

const previousKey=process.env.GOOGLE_PLACES_API_KEY;
afterEach(()=>{
  mock.restoreAll();
  if(previousKey===undefined) delete process.env.GOOGLE_PLACES_API_KEY;
  else process.env.GOOGLE_PLACES_API_KEY=previousKey;
});
const details=()=>({id:'verified-place',displayName:{text:'Verified museum'},photos:[{
  name:'places/verified-place/photos/current-photo',widthPx:2000,heightPx:1500,
  authorAttributions:[{displayName:'Photo author',uri:'https://maps.google.com/maps/contrib/123'}],
}]});

describe('Google Places photos with optional fallback',()=>{
  it('requests photo metadata on details, without adding it to discovery searches',async()=>{
    process.env.GOOGLE_PLACES_API_KEY='mock-secret';
    const fetch=mock.method(global,'fetch',async()=>Response.json(details()));
    await google.getPlaceDetails('verified-place');
    assert.ok(fetch.mock.calls[0].arguments[1].headers['X-Goog-FieldMask'].split(',').includes('photos'));
    await google.searchPlaces('museum');
    assert.ok(!fetch.mock.calls[1].arguments[1].headers['X-Goog-FieldMask'].includes('photos'));
    await google.getPlaceDetails('verified-place',{photoOnly:true});
    assert.equal(fetch.mock.calls[2].arguments[1].headers['X-Goog-FieldMask'],'id,displayName,photos');
  });
  it('resolves a single photo using server-side credentials and keeps author credits',async()=>{
    process.env.GOOGLE_PLACES_API_KEY='mock-secret';
    const fetch=mock.method(global,'fetch',async(url,options)=>{
      const parsed=new URL(url);
      assert.equal(parsed.origin,'https://places.googleapis.com');
      assert.equal(parsed.pathname,'/v1/places/verified-place/photos/current-photo/media');
      assert.equal(parsed.searchParams.get('skipHttpRedirect'),'true');
      assert.equal(parsed.searchParams.get('maxWidthPx'),'1000');
      assert.equal(parsed.searchParams.has('key'),false);
      assert.equal(options.headers['X-Goog-Api-Key'],'mock-secret');
      assert.equal(options.headers['X-Goog-FieldMask'],undefined);
      assert.equal(options.redirect,'error');
      return Response.json({photoUri:'https://lh3.googleusercontent.com/venue-photo'});
    });
    const photo=await google.getPlacePhoto(details());
    assert.equal(fetch.mock.callCount(),1);
    assert.equal(photo.provider,'google_places');assert.equal(photo.illustrative,false);
    assert.equal(photo.alt,'Photo of Verified museum');
    assert.deepEqual(photo.authorAttributions,details().photos[0].authorAttributions);
    assert.ok(!JSON.stringify(photo).includes('mock-secret'));
    assert.ok(!JSON.stringify(photo).includes('places/verified-place/photos/'));
  });
  it('does not request absent, malformed, or another venue’s photo references',async()=>{
    mock.method(global,'fetch',()=>assert.fail('No photo request is permitted'));
    for(const photos of [undefined,[],{},[null],[{name:'places/other-place/photos/id'}],[{name:'places/verified-place/photos/../../other'}],[{name:'https://example.com/image'}]]) {
      assert.equal(await google.getPlacePhoto({...details(),photos}),null);
    }
  });
  it('selects a large landscape photo without extra calls or mutating the provider metadata',async()=>{
    process.env.GOOGLE_PLACES_API_KEY='mock-secret';
    const place=details();place.photos=[
      {...place.photos[0],name:'places/verified-place/photos/tiny',widthPx:100,heightPx:80},
      {...place.photos[0],name:'places/verified-place/photos/portrait',widthPx:3000,heightPx:5000},
      {...place.photos[0],name:'places/verified-place/photos/landscape',widthPx:1800,heightPx:1100},
    ];
    const before=structuredClone(place);
    const fetch=mock.method(global,'fetch',async url=>{
      assert.ok(String(url).includes('/landscape/media?'));
      return Response.json({photoUri:'//lh3.googleusercontent.com/landscape'});
    });
    const photo=await google.getPlacePhoto(place);
    assert.equal(photo.url,'https://lh3.googleusercontent.com/landscape');
    assert.equal(fetch.mock.callCount(),1);assert.deepEqual(place,before);
  });
  it('reports safe fallback reasons without returning keys, resource names or provider messages',async()=>{
    process.env.GOOGLE_PLACES_API_KEY='mock-secret';
    const events=[];const options={onFallback:event=>events.push(event)};
    const fetch=mock.method(global,'fetch',async()=>Response.json({error:{message:'private-key and provider detail'}},{status:403}));
    assert.equal(await google.getPlacePhoto({...details(),photos:[]},options),null);
    assert.equal(await google.getPlacePhoto(details(),options),null);
    fetch.mock.mockImplementation(async()=>Response.json({},{status:429}));
    assert.equal(await google.getPlacePhoto(details(),options),null);
    fetch.mock.mockImplementation(async()=>{throw new DOMException('private-key','AbortError');});
    assert.equal(await google.getPlacePhoto(details(),options),null);
    delete process.env.GOOGLE_PLACES_API_KEY;
    assert.equal(await google.getPlacePhoto(details(),options),null);
    assert.deepEqual(events,[{reason:'no_photo_metadata'},{reason:'request_denied',providerStatus:403},
      {reason:'rate_limited',providerStatus:429},{reason:'timeout'},{reason:'not_configured'}]);
    assert.ok(!JSON.stringify(events).includes('private'));assert.ok(!JSON.stringify(events).includes('places/'));
  });
  it('treats missing credentials, photo errors and timeouts as optional, without retries',async()=>{
    delete process.env.GOOGLE_PLACES_API_KEY;
    const fetch=mock.method(global,'fetch',async()=>Response.json({},{status:403}));
    assert.equal(await google.getPlacePhoto(details()),null);assert.equal(fetch.mock.callCount(),0);
    process.env.GOOGLE_PLACES_API_KEY='mock-secret';
    for(const status of [403,404,429,500]) {
      fetch.mock.mockImplementation(async()=>Response.json({},{status}));
      const before=fetch.mock.callCount();
      assert.equal(await google.getPlacePhoto(details()),null);assert.equal(fetch.mock.callCount(),before+1);
    }
    fetch.mock.mockImplementation(async()=>{throw new DOMException('Timeout','AbortError');});
    const before=fetch.mock.callCount();
    assert.equal(await google.getPlacePhoto(details()),null);assert.equal(fetch.mock.callCount(),before+1);
  });
  it('rejects unsafe or unreadable media responses instead of exposing them to the browser',async()=>{
    process.env.GOOGLE_PLACES_API_KEY='mock-secret';
    const fetch=mock.method(global,'fetch',async()=>Response.json({}));
    for(const photoUri of [undefined,'http://lh3.googleusercontent.com/photo','https://evil.example/photo','https://lh3.googleusercontent.com.evil.example/photo','https://user:password@lh3.googleusercontent.com/photo']) {
      fetch.mock.mockImplementation(async()=>Response.json({photoUri}));
      assert.equal(await google.getPlacePhoto(details()),null);
    }
    fetch.mock.mockImplementation(async()=>new Response('unreadable'));
    assert.equal(await google.getPlacePhoto(details()),null);
  });
});

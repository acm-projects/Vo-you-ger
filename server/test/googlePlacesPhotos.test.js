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

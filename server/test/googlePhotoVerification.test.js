const {it,afterEach,mock}=require('node:test');
const assert=require('node:assert/strict');
const google=require('../services/googlePlacesService');
const {verifyGooglePhoto,budgetFetch}=require('../scripts/verify-planning-integrations');
afterEach(()=>mock.restoreAll());

function photoResult() {
  mock.method(google,'getPlaceDetails',async(id,options)=>{
    assert.equal(id,'verified');assert.equal(options.photoOnly,true);return {id,photos:[{name:'private-resource'}]};
  });
  mock.method(google,'getPlacePhoto',async()=>({provider:'google_places',url:'https://lh3.googleusercontent.com/temporary',authorAttributions:[{displayName:'Author'}]}));
}
it('verifies image bytes and reports only safe confirmation metadata',async()=>{
  photoResult();
  mock.method(global,'fetch',async()=>new Response(Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0,0,0,0,0]),{headers:{'Content-Type':'image/png'}}));
  const result=await verifyGooglePhoto({placeId:'verified'});
  assert.equal(result.imageVerified,true);assert.equal(result.attributionCount,1);
  assert.ok(!JSON.stringify(result).includes('private-resource'));assert.ok(!JSON.stringify(result).includes('temporary'));
});
it('does not mistake HTTP 200 or an image MIME type for a valid photo',async()=>{
  photoResult();mock.method(global,'fetch',async()=>new Response('<html>No image</html>',{headers:{'Content-Type':'image/png'}}));
  await assert.rejects(verifyGooglePhoto({placeId:'verified'}),error=>error.code==='PHOTO_INVALID_IMAGE');
});
it('distinguishes absent photo metadata without spending an image request',async()=>{
  mock.method(google,'getPlaceDetails',async()=>({id:'verified'}));
  mock.method(google,'getPlacePhoto',async(_place,{onFallback})=>{onFallback({reason:'no_photo_metadata'});return null;});
  mock.method(global,'fetch',()=>assert.fail('No photo reference means no image request'));
  await assert.rejects(verifyGooglePhoto({placeId:'verified'}),error=>error.code==='NO_PHOTO_METADATA'&&error.fallbackReason==='no_photo_metadata');
});
it('counts image downloads against the same approved Google allowance',async()=>{
  const counts={google:0,gemini:0,visa:0};let calls=0;
  const fetch=budgetFetch(async()=>{calls++;return new Response('image');},counts,()=>{},{google:1,gemini:0,visa:0});
  await fetch('https://lh3.googleusercontent.com/photo');
  await assert.rejects(fetch('https://lh3.googleusercontent.com/photo'),error=>error.code==='LIVE_BUDGET_EXHAUSTED');
  assert.equal(calls,1);assert.equal(counts.google,1);
});

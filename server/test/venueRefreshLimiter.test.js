const {it,afterEach,mock}=require('node:test');
const assert=require('node:assert/strict');
const {venueRefreshLimiter}=require('../middleware/venueRefreshLimiter');
const {generationLimiter}=require('../middleware/generationLimiter');
const previousLimit=process.env.VENUE_REFRESH_REQUESTS_PER_MINUTE;
afterEach(()=>{mock.restoreAll();if(previousLimit==null)delete process.env.VENUE_REFRESH_REQUESTS_PER_MINUTE;else process.env.VENUE_REFRESH_REQUESTS_PER_MINUTE=previousLimit;});
function response(){return {headers:{},setHeader(key,value){this.headers[key]=value;},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};}

it('allows browsing every supported day independently of an exhausted generation allowance',()=>{
  delete process.env.VENUE_REFRESH_REQUESTS_PER_MINUTE;
  const req={user:{userId:'independent-browsing'}};
  const generationLimit=Number(process.env.GENERATION_REQUESTS_PER_MINUTE)||12;
  for(let i=0;i<generationLimit;i++)generationLimiter(req,response(),()=>{});
  const blocked=response();generationLimiter(req,blocked,()=>assert.fail('Generation limit must still apply'));
  assert.equal(blocked.code,429);
  let days=0;
  for(let i=0;i<21;i++)venueRefreshLimiter(req,response(),()=>days++);
  assert.equal(days,21);
});

it('limits venue refreshes per account with a retry interval and resets after the window',()=>{
  process.env.VENUE_REFRESH_REQUESTS_PER_MINUTE='2';
  let now=1000;mock.method(Date,'now',()=>now);
  const req={user:{userId:'limited-venue-reader'}};
  for(let i=0;i<2;i++)venueRefreshLimiter(req,response(),()=>{});
  const blocked=response();venueRefreshLimiter(req,blocked,()=>assert.fail('Too many refreshes'));
  assert.equal(blocked.code,429);assert.equal(blocked.body.code,'VENUE_REFRESH_RATE_LIMIT');
  assert.equal(blocked.headers['Retry-After'],'60');assert.equal(blocked.headers['Cache-Control'],'no-store');
  let allowed=0;venueRefreshLimiter({user:{userId:'another-reader'}},response(),()=>allowed++);
  now+=60000;venueRefreshLimiter(req,response(),()=>allowed++);
  assert.equal(allowed,2);
});

it('the day-details route uses its own limiter behind authentication',()=>{
  const router=require('../routes/tripRoutes');
  const route=router.stack.find(layer=>layer.route?.path==='/:tripId/days/:day/places');
  assert.ok(route.route.stack.some(layer=>layer.handle===venueRefreshLimiter));
  assert.ok(!route.route.stack.some(layer=>layer.handle===generationLimiter));
  assert.ok(router.stack.slice(0,router.stack.indexOf(route)).some(layer=>layer.handle.name==='authenticateToken'));
});

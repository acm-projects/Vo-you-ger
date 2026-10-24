const {it} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {runStep, steps} = require('../scripts/backend-flow-test');
const {buildOutline} = require('../services/tripOutlineService');
const {practicalInfoForOutline} = require('../services/travelGuidanceService');

it('walks through signup, login, assessment, selection, generation, saving and current day display without leaking credentials', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'voyouger-flow-fixture-'));
  const calls = [], logs = []; let quiz, generated, saved;
  const request = async (context, method, route, body) => {
    calls.push({method, route, body});
    if (route === '/auth/register') return {token: 'private-mock-token', user: {id: 'owner', firstTime: true}};
    assert.equal(context.token, 'private-mock-token');
    if (route === '/auth/login') return {token: 'private-mock-token', user: {id: 'owner'}};
    if (route === '/quiz') {if (method === 'POST') quiz = body; return {quizResponse: quiz, firstTime: false};}
    if (route === '/recommendations') return {trip: {tripId: 'draft', quizSnapshot: quiz, selectionMetadata: {explanationSource:'gemini',explanationFallbackReason:null}, recommendations: ['PT', 'JP', 'PL'].map(code => ({destinationId: `country-${code.toLowerCase()}`, countryCode: code, type: 'country'}))}};
    if (route === '/trips/draft/route') {
      assert.equal(body.countryId, 'country-jp');
      return {outline: buildOutline({countryId: body.countryId, quiz, ...body})};
    }
    if (route === '/itinerary/draft') {
      const outline = buildOutline({countryId: body.countryId, quiz, ...body});
      const days = Array.from({length: 7}, (_, index) => ({day: index + 1, morning: [{placeId: `venue-${index}`, category: 'attractions', activityDescription: 'Explore at your own pace.', travelTip: 'Check current hours.', travelTipSource: 'planning_guidance', placeName: 'Fresh provider name', address: 'Fresh provider street', rating: 4.5, openingHours: ['Monday: Open 24 hours']}], afternoon: [], evening: []}));
      generated = {schemaVersion: 2, outline, days, practicalInfo: practicalInfoForOutline(outline), narrativeSource: 'gemini', narrativeFallbackReason: null};
      saved = structuredClone(generated);
      for (const day of saved.days) for (const activity of day.morning) for (const field of ['placeName', 'address', 'rating', 'openingHours']) delete activity[field];
      saved.placesStoredAs = 'ids_only';
      return {trip: {tripId: 'forked-draft'}, itinerary: generated};
    }
    if (route === '/trips/forked-draft/save') return {trip: {tripId: 'forked-draft', isSaved: true}};
    if (route === '/trips/forked-draft') return {trip: {tripId: 'forked-draft', isSaved: true, itinerary: saved}};
    if (route === '/trips/forked-draft/days/2/places') return {places: [{placeId: 'venue-1', placeName: 'Refreshed name', address: 'Refreshed street'}], recommendedNeighborhoods: [{name: 'Refreshed area'}], attribution: {provider: 'Google Maps'}, persisted: false};
    if (route === '/trips/saved') return {count: 1, trips: [{tripId: 'forked-draft', isSaved: true, itinerary: saved}]};
    assert.fail(`Unexpected route ${route}`);
  };
  try {
    for (const step of steps) await runStep({step, directory, choice: 2, request, log: message => logs.push(message)});
    assert.equal(calls.length, 11);
    assert.equal(calls[0].route, '/auth/register');
    assert.equal(calls.at(-1).route, '/trips/saved');
    const display = JSON.parse(fs.readFileSync(path.join(directory, 'day-display.json'))).day.morning[0];
    assert.equal(display.placeName, 'Refreshed name'); assert.equal(display.travelTip, 'Check current hours.');
    const credentials = JSON.parse(fs.readFileSync(path.join(directory, 'credentials.json')));
    assert.ok(!logs.join('\n').includes(credentials.password));
    assert.ok(!logs.join('\n').includes('private-mock-token'));
    for (const name of ['account', 'credentials', 'session']) assert.equal(fs.statSync(path.join(directory, `${name}.json`)).mode & 0o777, 0o600);
  } finally {fs.rmSync(directory, {recursive: true, force: true});}
});

it('rejects duplicate signup and missing prerequisites before making any request', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'voyouger-flow-invalid-'));
  const request = () => assert.fail('No request should be made');
  try {
    await assert.rejects(runStep({step: 'generate', directory, request}), /Missing account.json/);
    fs.writeFileSync(path.join(directory, 'account.json'), '{}');
    await assert.rejects(runStep({step: 'signup', directory, request}), /already has an account/);
    await assert.rejects(runStep({step: 'route', directory, choice: 4, request}), /--choice/);
  } finally {fs.rmSync(directory, {recursive: true, force: true});}
});

for(const step of ['recommend','generate'])it(`does not count HTTP success with backup ${step} text as a successful AI verification`,async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'voyouger-flow-degraded-'));
  const recommendations={trip:{tripId:'draft',selectionMetadata:{explanationSource:'deterministic_fallback',explanationFallbackReason:'request_timeout'},recommendations:['PT','JP','PL'].map(countryCode=>({countryCode,destinationId:`country-${countryCode.toLowerCase()}`}))}};
  try{
    for(const [name,value] of Object.entries({account:{token:'private-token'},recommendations,selection:{countryId:'country-pt'}}))fs.writeFileSync(path.join(directory,`${name}.json`),JSON.stringify(value));
    const response=step==='recommend'?recommendations:{trip:{tripId:'draft'},itinerary:{days:[{day:1}],practicalInfo:{currency:{code:'EUR'}},narrativeSource:'deterministic_fallback',narrativeFallbackReason:'request_timeout'}};
    const options={step,directory,log:()=>{},request:async()=>response};
    await assert.rejects(runStep(options),/backup/);
    assert.ok(fs.existsSync(path.join(directory,`${step==='recommend'?'recommendations':'itinerary'}.json`)),'The diagnostic response is retained');
    await runStep({...options,allowFallback:true});
  }finally{fs.rmSync(directory,{recursive:true,force:true});}
});

// User-run API walkthrough. No credentials, provider SDKs or database clients are
// loaded here. Network requests require --allow-live; tests inject a fake request.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');

const scenarios = {
  foodie: {nights: 6, persona: 'Foodie', pace: 'seeAll', budget: '$$', diet: ['Vegetarian']},
  relaxed: {nights: 3, persona: 'Historian', pace: 'deeply', budget: '$$', diet: []},
  variety: {nights: 9, persona: 'Explorer', pace: 'seeAll', budget: '$$$', diet: []},
};
const steps = ['signup', 'login', 'assessment', 'recommend', 'route', 'generate', 'save', 'retrieve', 'day', 'saved'];

async function send({baseUrl, token}, method, route, body) {
  const response = await fetch(`${baseUrl}${route}`, {
    method, headers: {'Content-Type': 'application/json', ...(token ? {Authorization: `Bearer ${token}`} : {})},
    ...(body === undefined ? {} : {body: JSON.stringify(body)}), signal: AbortSignal.timeout(600000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`${method} ${route} failed (${response.status}): ${data.code || data.error || 'REQUEST_FAILED'} — ${data.message || 'Request failed'}`);
  return data;
}

async function runStep({step, directory, scenario = 'foodie', choice = 1, day = 2, allowFallback = false, baseUrl = 'http://localhost:8080/api', request = send, log = console.log}) {
  if (!steps.includes(step)) throw new Error(`Unknown step: ${step}`);
  if (!scenarios[scenario]) throw new Error('Choose --scenario foodie, relaxed or variety.');
  if (!Number.isInteger(choice) || choice < 1 || choice > 3) throw new Error('--choice must be 1, 2 or 3.');
  if (!Number.isInteger(day) || day < 1 || day > 21) throw new Error('--day must be 1–21.');
  fs.mkdirSync(directory, {recursive: true, mode: 0o700});
  const file = name => path.join(directory, `${name}.json`);
  const read = name => {
    if (!fs.existsSync(file(name))) throw new Error(`Missing ${name}.json. Run its earlier step with the same --state directory.`);
    return JSON.parse(fs.readFileSync(file(name), 'utf8'));
  };
  const write = (name, data) => {
    fs.writeFileSync(file(name), JSON.stringify(data, null, 2) + '\n', {mode: 0o600});
    fs.chmodSync(file(name), 0o600);
  };
  const show = value => log(JSON.stringify(value, null, 2));
  const session = fs.existsSync(file('session')) ? read('session') : {baseUrl, scenario};
  const account = step === 'signup' ? null : read('account');
  const context = {baseUrl: session.baseUrl, token: session.token || account?.token};
  const call = async (method, route, body, output) => {
    log(`${method} /api${route}`);
    const data = await request(context, method, route, body);
    write(output, data); return data;
  };
  if (step === 'signup') {
    if (fs.existsSync(file('account'))) throw new Error('This state directory already has an account. Continue with login or use a new directory.');
    const credentials = {fName: 'Backend', lName: 'Tester', email: `voyouger-${crypto.randomUUID()}@example.test`, password: crypto.randomBytes(24).toString('base64url'), nationalities: ['US']};
    write('credentials', credentials);
    const result = await call('POST', '/auth/register', credentials, 'account');
    assert.ok(result.token && result.user?.id, 'Signup must return a token and user ID');
    write('session', {...session, token: result.token});
    show({userId: result.user.id, firstTime: result.user.firstTime, credentials: 'Stored locally; token and password are not printed.'});
  } else if (step === 'login') {
    const {email, password} = read('credentials');
    const result = await call('POST', '/auth/login', {email, password}, 'login');
    assert.ok(result.token, 'Login must return a token');
    write('session', {...session, token: result.token}); show({userId: result.user.id, loggedIn: true});
  } else if (step === 'assessment') {
    const profile = scenarios[session.scenario], quiz = {
      startDate: '2027-06-05', minNights: profile.nights, maxNights: profile.nights,
      travelAlterEgo: profile.persona, seeAllOrDeeply: profile.pace, dailyBudget: profile.budget,
      dietaryRestrictions: profile.diet, willingToGetVisa: true,
      intercityTransportModes: ['train', 'car', 'bus', 'plane', 'ferry'], walkingAmount: 'a bit',
    };
    write('assessment-input', quiz);
    await call('POST', '/quiz', quiz, 'assessment-saved');
    const result = await call('GET', '/quiz', undefined, 'assessment-retrieved');
    assert.deepEqual(result.quizResponse, quiz, 'Saved assessment must round-trip');
    show(result);
  } else if (step === 'recommend') {
    const result = await call('POST', '/recommendations', {}, 'recommendations');
    assert.equal(result.trip.recommendations.length, 3);
    assert.equal(new Set(result.trip.recommendations.map(item => item.countryCode)).size, 3);
    show({tripId: result.trip.tripId, assessmentSnapshot: result.trip.quizSnapshot, selection: result.trip.selectionMetadata, recommendations: result.trip.recommendations});
    if(!allowFallback)assert.equal(result.trip.selectionMetadata?.explanationSource,'gemini',`Recommendations used backup explanations (${result.trip.selectionMetadata?.explanationFallbackReason || 'unknown'}). Response saved; use --allow-fallback only to test degraded operation.`);
  } else if (step === 'route') {
    const trip = read('recommendations').trip, country = trip.recommendations[choice - 1], quiz = read('assessment-input');
    const selection = {countryId: country.destinationId, startDate: quiz.startDate, numberOfNights: quiz.minNights};
    write('selection', selection);
    const result = await call('POST', `/trips/${trip.tripId}/route`, selection, 'route');
    show(result.outline);
  } else if (step === 'generate') {
    const draft = read('recommendations').trip.tripId;
    const result = await call('POST', `/itinerary/${draft}`, read('selection'), 'itinerary');
    assert.ok(result.trip?.tripId && result.itinerary?.days?.length);
    assert.ok(result.itinerary.practicalInfo?.currency?.code, 'Generation must include currency');
    const example = result.itinerary.days.find(item => item.day === day) || result.itinerary.days[0];
    show({tripId: result.trip.tripId, narrativeSource: result.itinerary.narrativeSource,
      narrativeFallbackReason: result.itinerary.narrativeFallbackReason, summary: result.itinerary.tripSummary,
      practicalInfo: result.itinerary.practicalInfo, stays: result.itinerary.stays, exampleDay: example,
      note: 'itinerary contains display-time Google data; trip.itinerary shows the smaller persisted representation.'});
    if(!allowFallback)assert.equal(result.itinerary.narrativeSource,'gemini',`Itinerary used backup descriptions (${result.itinerary.narrativeFallbackReason || 'unknown'}). Response saved; this is not a successful Gemini verification.`);
  } else if (step === 'save') {
    const id = read('itinerary').trip.tripId;
    const result = await call('PUT', `/trips/${id}/save`, {}, 'saved');
    assert.equal(result.trip.isSaved, true);
    show({tripId: result.trip.tripId, isSaved: result.trip.isSaved, savedAt: result.trip.savedAt});
  } else if (step === 'retrieve') {
    const generated = read('itinerary'), id = generated.trip.tripId;
    const result = await call('GET', `/trips/${id}`, undefined, 'retrieved');
    assert.equal(result.trip.isSaved, true, 'Run save before retrieve');
    const original = generated.itinerary, stored = result.trip.itinerary;
    assert.deepEqual(stored.practicalInfo, original.practicalInfo, 'Practical information must survive saving');
    assert.deepEqual(stored.outline, original.outline, 'Route must survive saving');
    const activities = itinerary => itinerary.days.flatMap(item => ['morning', 'afternoon', 'evening'].flatMap(slot => item[slot]));
    const project = activity => ({placeId: activity.placeId, description: activity.activityDescription, travelTip: activity.travelTip, travelTipSource: activity.travelTipSource});
    assert.deepEqual(activities(stored).map(project), activities(original).map(project), 'Descriptions and travel tips must survive saving');
    assert.ok(activities(stored).every(activity => activity.placeName === undefined && activity.address === undefined && activity.rating === undefined && activity.openingHours === undefined), 'Raw Google metadata must not be persisted');
    show({tripId: id, isSaved: true, preserved: ['route', 'practicalInfo and provenance', 'descriptions', 'activity travel tips'],
      placesStoredAs: stored.placesStoredAs, practicalInfo: stored.practicalInfo,
      exampleSavedDay: stored.days.find(item => item.day === day) || stored.days[0],
      note: 'Names, addresses, hours and neighborhood suggestions are fetched by the day step.'});
  } else if (step === 'day') {
    const generated = read('itinerary'), id = generated.trip.tripId;
    const itinerary = read('retrieved').trip.itinerary, savedDay = itinerary.days.find(item => item.day === day);
    if (!savedDay) throw new Error(`This itinerary has no day ${day}. Choose a valid --day.`);
    const result = await call('GET', `/trips/${id}/days/${day}/places`, undefined, 'day-places');
    const places = new Map(result.places.map(place => [place.placeId, place]));
    const display = {...savedDay};
    for (const slot of ['morning', 'afternoon', 'evening']) display[slot] = savedDay[slot].map(activity => ({...places.get(activity.placeId), ...activity}));
    write('day-display', {day: display, recommendedNeighborhoods: result.recommendedNeighborhoods, attribution: result.attribution});
    show({day: display, recommendedNeighborhoods: result.recommendedNeighborhoods, attribution: result.attribution, persisted: result.persisted});
  } else if (step === 'saved') {
    const result = await call('GET', '/trips/saved', undefined, 'saved-list');
    const id = read('itinerary').trip.tripId;
    assert.ok(result.trips.some(trip => trip.tripId === id), 'Saved list must contain this trip');
    show({count: result.count, trips: result.trips.map(trip => ({tripId: trip.tripId, isSaved: trip.isSaved, summary: trip.itinerary?.tripSummary}))});
  }
  log(`Full response files: ${directory}`);
}

async function main() {
  const args = process.argv.slice(2), step = args[0];
  const option = name => {const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1];};
  if (args.includes('--help') || !args.includes('--allow-live')) {
    console.log('Usage: node scripts/backend-flow-test.js STEP --state /path/to/test-directory --allow-live');
    console.log(`Steps: ${steps.join(', ')}, all`);
    console.log('Options: --scenario foodie|relaxed|variety (at signup), --choice 1|2|3 (at route), --day 2, --base-url http://localhost:8080/api, --allow-fallback (explicit degraded-mode test)');
    console.log('Makes real API calls, creates a test account, uses Google/Gemini during recommendations/generation/day refresh, and saves a trip. Credentials stay in private local files.');
    return;
  }
  if (!option('--state')) throw new Error('--state is required. Use a fresh temporary directory for each scenario.');
  const options = {directory: path.resolve(option('--state')), scenario: option('--scenario') || 'foodie',
    choice: Number(option('--choice') || 1), day: Number(option('--day') || 2), allowFallback: args.includes('--allow-fallback'), baseUrl: option('--base-url') || 'http://localhost:8080/api'};
  for (const action of step === 'all' ? steps : [step]) await runStep({...options, step: action});
}
if (require.main === module) main().catch(error => {console.error(`TEST FAILED: ${error.message}`); process.exitCode = 1;});
module.exports = {runStep, scenarios, steps};

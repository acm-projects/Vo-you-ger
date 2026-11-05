// User-run walkthrough for an existing account. Credentials stay in memory.
const assert = require('node:assert/strict');
const readline = require('node:readline/promises');
const { Writable } = require('node:stream');
const countryInfo = require('../data/countryInfo.json').countries;

const baseUrl = 'http://localhost:8080/api';

async function send(token, method, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {'Content-Type': 'application/json', ...(token ? {Authorization: `Bearer ${token}`} : {})},
    ...(body === undefined ? {} : {body: JSON.stringify(body)}),
    signal: AbortSignal.timeout(600000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status} — ${data.message || data.error || 'Request failed'}`);
  return data;
}

async function saveGlobeTrip({email, password, choice = 1, multiCity = false, europe = false, request = send, log = console.log}) {
  assert.ok(Number.isInteger(choice) && choice >= 1 && choice <= 3, 'Choose --choice 1, 2 or 3.');
  log('1. Signing in to your existing account…');
  const account = await request(null, 'POST', '/auth/login', {email, password});
  assert.ok(account.token && account.user?.id, 'Login did not return an account and token.');
  const call = (method, path, body) => request(account.token, method, path, body);

  // This assessment belongs only to the new trip, not the user's profile.
  const nights = multiCity ? 6 : 3;
  const quiz = {
    startDate: '2027-06-05', minNights: nights, maxNights: nights,
    travelAlterEgo: multiCity ? 'Explorer' : 'Historian', seeAllOrDeeply: multiCity ? 'seeAll' : 'deeply', budgetLevel: '$$',
    dietaryRestrictions: [], visaWillingness: true, walkAmount: 'a bit',
    intercityTransportModes: ['train', 'car', 'bus', 'plane', 'ferry'],
    ...(europe ? {preferredCountries: ['Portugal', 'Spain', 'France', 'Italy', 'United Kingdom', 'Switzerland', 'Austria', 'Germany', 'Netherlands']} : {}),
  };
  log(`2. Requesting three countries for a ${nights + 1}-day / ${nights}-night ${multiCity ? 'multi-city' : 'sample'} trip…`);
  const recommended = await call('POST', '/recommendations', {quiz});
  const draft = recommended.trip;
  assert.ok(draft?.tripId && draft.recommendations?.length === 3, 'Expected a draft and three recommendations.');
  const selectable = europe ? draft.recommendations.filter(country => countryInfo[country.countryCode]?.continent === 'Europe') : draft.recommendations;
  if (europe) log('   European matches from these recommendations:');
  selectable.forEach((country, index) => log(`   ${index + 1}. ${country.name}: ${country.reason || ''}`));
  const country = selectable[choice - 1];
  assert.ok(country, europe ? `No European match at choice ${choice}. Generation was not started.` : 'Requested recommendation is missing.');
  const selection = {countryId: country.destinationId, startDate: quiz.startDate, numberOfNights: nights};

  log(`3. Previewing the route for ${country.name} (choice ${choice})…`);
  const preview = await call('POST', `/trips/${encodeURIComponent(draft.tripId)}/route`, selection);
  if (europe) assert.equal(countryInfo[preview.outline.countryCode]?.continent, 'Europe', 'The preview must be in Europe.');
  if (multiCity) assertMultiCity(preview.outline, nights);
  log(`   ${preview.outline.stops.map(stop => `${stop.name} (${stop.nights} nights)`).join(' → ')}`);

  log('4. Generating the itinerary with real venues. This may take a minute or two…');
  const generated = await call('POST', `/itinerary/${encodeURIComponent(draft.tripId)}`, selection);
  assert.ok(generated.trip?.tripId, 'Generation did not return a trip ID.');
  assert.equal(generated.itinerary?.days?.length, nights + 1, `Expected ${nights + 1} itinerary days.`);
  if (multiCity) assertMultiCity(generated.itinerary.outline, nights);
  if (europe) assert.equal(generated.itinerary.outline?.countryCode, country.countryCode, 'The generated itinerary must stay in the selected European country.');
  log(`   ${generated.itinerary.tripTitle}`);
  log(`   Description source: ${generated.itinerary.narrativeSource || 'not reported'}`);

  const tripId = generated.trip.tripId;
  log('5. Saving this itinerary to your account…');
  const saved = await call('PUT', `/trips/${encodeURIComponent(tripId)}/save`, {});
  assert.equal(saved.trip?.tripId, tripId);
  assert.equal(saved.trip?.isSaved, true, 'Trip was not marked as saved.');

  log('6. Checking that your globe can see the saved trip…');
  const globe = await call('GET', '/trips/globe');
  const pinned = (globe.countries || []).flatMap(item => item.trips || []).find(item => item.tripId === tripId);
  assert.ok(pinned && Number.isFinite(pinned.pin?.lat) && Number.isFinite(pinned.pin?.lng),
    `Trip ${tripId} was saved but its globe pin is missing. Keep this ID; do not regenerate just to retry the globe.`);
  if (multiCity) assert.ok(new Set(pinned.baseNames).size >= 2, 'The globe preview must include multiple bases.');
  log(`SUCCESS: ${pinned.displayTitle || country.name} · ${pinned.startCity || 'Country location'}`);
  log(`Trip ID: ${tripId}`);
  if (multiCity) log(`Cities: ${pinned.baseNames.join(' → ')}. One globe pin represents the whole trip, at its starting city.`);
  log('Sign in to this same account in your browser, then open http://localhost:5173/?page=trips and refresh saved trips.');
  return {tripId, pin: pinned.pin};
}

function assertMultiCity(outline, nights) {
  assert.ok(outline?.stops?.length >= 2 && new Set(outline.stops.map(stop => stop.destinationId)).size >= 2,
    'Expected at least two distinct overnight bases for the multi-city test.');
  assert.ok(outline.stops.every(stop => stop.nights > 0), 'Each multi-city base must have an overnight stay.');
  assert.equal(outline.stops.reduce((sum, stop) => sum + stop.nights, 0), nights, 'Route nights must match the requested duration.');
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.includes('--allow-live')) {
    console.log('Usage: node scripts/save-globe-trip.js --allow-live [--multi-city] [--europe] [--choice 1|2|3]');
    console.log('Signs in to an existing account, uses Google/Gemini to generate a sample itinerary, and saves it.');
    return;
  }
  const choiceIndex = args.indexOf('--choice');
  const choice = choiceIndex < 0 ? 1 : Number(args[choiceIndex + 1]);
  assert.ok(Number.isInteger(choice) && choice >= 1 && choice <= 3, 'Choose --choice 1, 2 or 3.');
  if (!process.stdin.isTTY) throw new Error('Run this command in an interactive terminal so you can enter your login privately.');
  let muted = false;
  const output = new Writable({write(chunk, encoding, done) {if (!muted) process.stdout.write(chunk, encoding); done();}});
  const prompt = readline.createInterface({input: process.stdin, output, terminal: true});
  let email, password;
  try {
    email = (await prompt.question('Account email: ')).trim();
    process.stdout.write('Password (hidden): ');
    muted = true;
    password = await prompt.question('');
  } finally {
    muted = false;
    process.stdout.write('\n');
    prompt.close();
  }
  await saveGlobeTrip({email, password, choice, multiCity: args.includes('--multi-city'), europe: args.includes('--europe')});
}

if (require.main === module) main().catch(error => {console.error(`TEST FAILED: ${error.message}`); process.exitCode = 1;});
module.exports = {saveGlobeTrip};

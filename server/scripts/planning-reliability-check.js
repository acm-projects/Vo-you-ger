// Capped provider integration tests. Uses production services with synthetic
// traveler preferences; never imports database models or persists user records.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {performance} = require('node:perf_hooks');
require('dotenv').config({path: path.resolve(__dirname, '../.env'), quiet: true});
const {budgetFetch} = require('./verify-planning-integrations');
const {buildOutline, validateOutline} = require('../services/tripOutlineService');
const {generateCountryItinerary} = require('../services/countryItineraryService');
const {countryItinerarySchema} = require('../schemas/countryItinerarySchema');
const {storedItinerary} = require('../services/itineraryStorageService');
const {distanceKm} = require('../services/placeGroupingService');
const {isVisitCandidate} = require('../services/venueEligibilityService');
const {TRIP_POLICY} = require('../config/tripPolicy');
const discovery = require('../services/stopDiscoveryService');
const slots = ['morning', 'afternoon', 'evening'];

const cases = [
  {id: 'pt-relaxed', country: 'PT', nights: 3, pace: 'deeply', persona: 'Historian', budget: '$$', diet: [], refresh: true},
  {id: 'ar-short', country: 'AR', nights: 4, pace: 'seeAll', persona: 'Foodie', budget: '$$', diet: ['Vegetarian']},
  {id: 'fr-variety', country: 'FR', nights: 6, pace: 'seeAll', persona: 'Foodie', budget: '$$', diet: ['Vegetarian'], refresh: true},
  {id: 'jp-long', country: 'JP', nights: 9, pace: 'seeAll', persona: 'Explorer', budget: '$$', diet: ['Vegan']},
  {id: 'ch-max', country: 'CH', nights: 20, pace: 'seeAll', persona: 'Explorer', budget: '$', diet: ['Gluten-free']},
  {id: 'fr-repeat', country: 'FR', nights: 6, pace: 'seeAll', persona: 'Foodie', budget: '$$', diet: ['Vegetarian']},
];

function preferences(item) {
  return {minNights: item.nights, maxNights: item.nights, startDate: '2027-06-05',
    seeAllOrDeeply: item.pace, travelAlterEgo: item.persona, budgetLevel: item.budget,
    dietaryRestrictions: item.diet, visaWillingness: true, walkAmount: 'a bit',
    intercityTransportModes: ['train', 'car', 'bus', 'plane', 'ferry']};
}

function audit(itinerary, quiz, discovered) {
  assert.ok(countryItinerarySchema.safeParse(itinerary).success, 'Itinerary must match the production schema');
  validateOutline(itinerary.outline, quiz);
  assert.equal(itinerary.days.length, quiz.minNights + 1);
  assert.equal(itinerary.tripSummary.numberOfNights, quiz.minNights);
  const approved = new Map(discovered.map(location => [location.locationId, new Map(location.candidatePlaces.map(place => [place.placeId, place]))]));
  const used = new Set();
  const totals = {activities: 0, meals: 0, mealConflicts: 0, unknownHours: 0, missingStayAreas: 0, operatorNameReview: []};
  const daily = [];
  for (const [index, day] of itinerary.days.entries()) {
    assert.equal(day.day, index + 1);
    assert.equal(day.date, new Date(Date.parse(`${quiz.startDate}T00:00:00Z`) + index * 86400000).toISOString().slice(0, 10));
    const selected = slots.flatMap(slot => day[slot]);
    const cap = ['full', 'visit'].includes(day.type) ? (quiz.seeAllOrDeeply === 'deeply' ? TRIP_POLICY.maxActivitiesPerRelaxedDay : TRIP_POLICY.maxActivitiesPerFullDay) : day.type === 'excursion' ? 2 : 1;
    assert.ok(selected.length <= cap, `Day ${day.day} is overpacked`);
    if (['full', 'visit', 'excursion'].includes(day.type)) assert.ok(selected.length > 0, `Day ${day.day} is empty`);
    if (['arrival', 'transfer'].includes(day.type)) assert.equal(day.morning.length + day.afternoon.length, 0);
    if (day.type === 'departure') assert.equal(day.afternoon.length + day.evening.length, 0);
    if (day.type === 'excursion') assert.equal(day.morning.length + day.evening.length, 0);
    const mealCap = require('../services/dailyPlanService').mealLimit(quiz);
    assert.ok(selected.filter(activity=>activity.category==='food').length <= mealCap, 'Too many restaurant stops for the selected pace');
    for (const slot of slots) assert.ok(day[slot].filter(activity=>activity.category==='food').length <= 1, 'Multiple restaurants in the same time block');
    for (const activity of selected) {
      assert.ok(!used.has(activity.placeId), 'Venue repeats across the itinerary');
      used.add(activity.placeId);
      const source = approved.get(day.locationId)?.get(activity.placeId);
      assert.ok(source, 'Selected venue must come from live discovery for the correct location');
      assert.equal(source.countryCode, itinerary.countryCode);
      assert.ok(isVisitCandidate(source), 'Selected venue is not visitable');
      assert.equal(activity.lat, source.lat);
      assert.equal(activity.lng, source.lng);
      assert.ok(activity.activityDescription?.trim(), 'Missing activity description');
      assert.ok(activity.travelTip?.trim(), 'Missing activity travel tip');
      if (activity.category === 'food') totals.meals++;
      if (activity.hoursCheck === 'unknown') totals.unknownHours++;
      if (/\b(tours?|safaris?|travel agency|tourism)\b/i.test(activity.placeName || '')) totals.operatorNameReview.push(activity.placeName);
    }
    let spreadKm = 0;
    for (const a of selected) for (const b of selected) spreadKm = Math.max(spreadKm, distanceKm(a, b));
    assert.ok(spreadKm <= TRIP_POLICY.maxDailyActivitySpreadKm, 'Daily venues exceed the geographic spread limit');
    totals.activities += selected.length;
    daily.push({day: day.day, date: day.date, type: day.type, city: day.locationName, activities: selected.length, spreadKm: Number(spreadKm.toFixed(2))});
  }
  const stored = storedItinerary(itinerary);
  assert.deepEqual(stored.outline, itinerary.outline);
  assert.deepEqual(stored.practicalInfo, itinerary.practicalInfo);
  assert.equal(stored.placesStoredAs, 'ids_only');
  assert.ok(itinerary.practicalInfo?.currency?.code, 'Missing currency');
  for (const day of stored.days) for (const activity of slots.flatMap(slot => day[slot])) {
    assert.equal(activity.placeName, undefined);
    assert.equal(activity.address, undefined);
    assert.equal(activity.openingHours, undefined);
    assert.ok(activity.activityDescription);
  }
  totals.missingStayAreas = itinerary.stays.filter(stay => !stay.recommendedStayArea).length;
  assert.equal(totals.missingStayAreas,0,'Every overnight base must have a sourced stay-area suggestion');
  return {checksPassed: true, ...totals, daily, storageProjectionVerified: true};
}

async function main() {
  const option = name => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
  const profile = option('profile') || 'standard';
  assert.ok(['standard', 'small'].includes(profile), 'Use --profile=standard or --profile=small');
  const selected = profile === 'small' ? cases.filter(item => !['jp-long', 'ch-max'].includes(item.id)) : cases;
  const recommendationCases = profile === 'small' ? [selected[0]] : [cases[0], cases[3], cases[4]];
  const limits = profile === 'small' ? {google: 30, gemini: 10, visa: 0} : {google: 60, gemini: 18, visa: 0};
  const plan = selected.map(item => {
    const outline = buildOutline({countryId: `country-${item.country.toLowerCase()}`, quiz: preferences(item)});
    return {...item, bases: outline.stops.map(stop => ({name: stop.name, nights: stop.nights})), excursions: outline.excursions.map(stop => stop.name), minimumGoogleSearches: 3 * (outline.stops.length + outline.excursions.length)};
  });
  if (!process.argv.includes('--allow-live')) {
    console.log(JSON.stringify({status: 'dry_run', profile, limits, databaseOperations: 0, itineraryCases: plan, recommendationCases: recommendationCases.map(item => item.id)}, null, 2));
    return;
  }
  const directory = option('report-dir');
  assert.ok(directory && path.isAbsolute(directory), 'Supply --report-dir=/absolute/path');
  fs.mkdirSync(directory, {recursive: true, mode: 0o700});
  const filename = name => path.join(directory, `${name}.json`);
  const write = (name, value) => fs.writeFileSync(filename(name), JSON.stringify(value, null, 2) + '\n', {mode: 0o600});
  const read = name => fs.existsSync(filename(name)) ? JSON.parse(fs.readFileSync(filename(name), 'utf8')) : null;
  const implementationVersion = `${TRIP_POLICY.version}/${require('../prompts/itineraryPrompt').version}`;
  const report = read('report') || {profile, limits, implementationVersion, startedAt: new Date().toISOString(), scope: 'Live planning services; synthetic travelers; no HTTP authentication or database operations', plan, cases: {}, network: []};
  assert.equal(report.profile, profile, 'Use the same profile to resume this report');
  assert.equal(report.implementationVersion,implementationVersion,'Implementation changed; use a fresh report directory rather than reusing earlier results');
  const counts = read('budget') || {google: 0, gemini: 0, visa: 0};
  for (const provider of Object.keys(limits)) assert.ok(Number.isInteger(counts[provider]) && counts[provider] >= 0, 'Invalid persisted budget');
  const originalFetch = global.fetch, originalDiscovery = discovery.discoverStops;
  const originalInfo = console.info, originalWarn = console.warn;
  let current = null, discovered = [];
  const persist = () => {report.requests = {...counts}; write('report', report);};
  global.fetch = budgetFetch(originalFetch, counts, state => write('budget', state), limits, event => {
    report.network.push({caseId: current?.id, ...event});
    persist();
    console.log(JSON.stringify({caseId: current?.id, ...event}));
  });
  discovery.discoverStops = async (...args) => {discovered = await originalDiscovery(...args); return discovered;};
  process.env.PLANNING_METRICS = '1';
  console.info = (value, ...args) => {
    try {const data = JSON.parse(value); if (data.planningMetrics && current) {current.metrics ||= []; current.metrics.push(data.planningMetrics); return;}} catch { /* Other informational log. */ }
    originalInfo(value, ...args);
  };
  console.warn = (value, ...args) => {
    if (current && typeof value === 'string' && /^(Gemini model |Gemini rejected a request)/.test(value)) current.diagnostics.push(value);
    originalWarn(value, ...args);
  };
  async function run(id, minimumGoogle, work) {
    if (report.cases[id]) return;
    current = {id, status: 'running', startedAt: new Date().toISOString(), diagnostics: []};
    report.cases[id] = current;
    const before = {...counts}, start = performance.now();
    console.log(`START ${id}`);
    try {
      if (limits.google - counts.google < minimumGoogle || counts.gemini >= limits.gemini) throw Object.assign(new Error('Insufficient approved allowance for this case'), {code: 'LIVE_BUDGET_EXHAUSTED'});
      Object.assign(current, await work());
    } catch (error) {
      current.status = Object.keys(limits).some(key => counts[key] >= limits[key] && limits[key] > 0) || error.code === 'LIVE_BUDGET_EXHAUSTED' ? 'inconclusive_budget' : 'failed';
      current.error = {code: error.code || error.statusCode || 'VALIDATION_FAILED', ...(error.fallbackReason ? {fallbackReason: error.fallbackReason} : {})};
      if (error.code === 'ERR_ASSERTION') current.error.message = error.message.split('\n')[0];
    } finally {
      current.elapsedMs = Number((performance.now() - start).toFixed(1));
      current.requests = Object.fromEntries(Object.keys(counts).map(key => [key, counts[key] - before[key]]));
      persist();
      console.log(`DONE ${id}: ${current.status} (${current.elapsedMs}ms)`);
    }
  }
  try {
    for (const item of recommendationCases) await run(`recommend-${item.id}`, 0, async () => {
      const quiz = preferences(item);
      const result = await require('../services/countryRecommendationService').recommendCountries({nationalities: ['US']}, quiz);
      assert.equal(result.recommendations.length, 3);
      assert.equal(new Set(result.recommendations.map(country => country.countryCode)).size, 3);
      const routes = result.recommendations.map(country => buildOutline({countryId: country.destinationId, quiz}));
      routes.forEach(outline => assert.equal(outline.numberOfDays, item.nights + 1));
      write(`recommend-${item.id}`, result);
      return {status: result.selectionMetadata.explanationSource === 'gemini' ? 'passed' : 'degraded', source: result.selectionMetadata.explanationSource,
        fallbackReason: result.selectionMetadata.explanationFallbackReason, model: result.model,
        countries: routes.map(outline => ({country: outline.country, bases: outline.stops.map(stop => stop.name), days: outline.numberOfDays}))};
    });
    for (const item of plan) await run(item.id, item.minimumGoogleSearches, async () => {
      const quiz = preferences(item), outline = buildOutline({countryId: `country-${item.country.toLowerCase()}`, quiz});
      discovered = [];
      const result = await generateCountryItinerary({outline, quiz, startDate: quiz.startDate});
      const quality = audit(result.itinerary, quiz, discovered);
      write(item.id, {quiz, ...result, quality});
      const details = {status: result.itinerary.narrativeSource === 'gemini' ? 'passed' : 'degraded', source: result.itinerary.narrativeSource,
        fallbackReason: result.itinerary.narrativeFallbackReason, model: result.model, quality,
        bases: outline.stops.map(stop => stop.name), candidateCounts: discovered.map(location => ({location: location.name, candidates: location.candidatePlaces.length}))};
      // Discovery + generation are the main result. Refresh failure is reported
      // separately and never erases a successful itinerary artifact.
      if (item.refresh) {
        const day = result.itinerary.days.find(day => slots.some(slot => day[slot].length));
        const needed = day ? slots.reduce((sum, slot) => sum + day[slot].length, 0) : 0;
        if (needed && limits.google - counts.google >= needed) {
          const started = performance.now();
          try {
            const refreshed = await require('../services/savedVenueService').refreshDay({itinerary: storedItinerary(result.itinerary)}, day.day);
            assert.equal(refreshed.places.length, needed);
            details.venueRefresh = {status: 'passed', day: day.day, venues: refreshed.places.length};
          } catch (error) {details.venueRefresh = {status: counts.google >= limits.google ? 'inconclusive_budget' : 'failed', code: error.code || error.statusCode || 'REFRESH_FAILED'};}
          details.venueRefresh.elapsedMs = Number((performance.now() - started).toFixed(1));
        } else details.venueRefresh = {status: 'not_run', reason: needed ? 'budget_reserved_for_generation' : 'no_activities'};
      }
      return details;
    });
    const first = read('fr-variety'), repeat = read('fr-repeat');
    if (first && repeat) {
      const key = result => JSON.stringify(result.itinerary.outline.stops.map(stop => [stop.destinationId, stop.nights]));
      const ids = result => new Set(result.itinerary.days.flatMap(day => slots.flatMap(slot => day[slot].map(place => place.placeId))));
      const a = ids(first), b = ids(repeat);
      report.repeatComparison = {sameRouteAndNights: key(first) === key(repeat), bothPassedStructuralChecks: first.quality.checksPassed && repeat.quality.checksPassed,
        venueOverlap: Number(([...a].filter(id => b.has(id)).length / new Set([...a, ...b]).size).toFixed(3)),
        narrativeSources: [first.itinerary.narrativeSource, repeat.itinerary.narrativeSource]};
    }
  } finally {
    global.fetch = originalFetch;
    discovery.discoverStops = originalDiscovery;
    console.info = originalInfo;
    console.warn = originalWarn;
    report.finishedAt = new Date().toISOString();
    persist();
  }
  console.log(JSON.stringify({report: filename('report'), requests: counts, cases: Object.values(report.cases).map(item => ({id: item.id, status: item.status, source: item.source, fallbackReason: item.fallbackReason, elapsedMs: item.elapsedMs, venueRefresh: item.venueRefresh})), repeatComparison: report.repeatComparison}, null, 2));
  if (Object.values(report.cases).some(item => item.status !== 'passed')) process.exitCode = 1;
}

if (require.main === module) main().catch(error => {console.error(`Reliability check could not finish (${error.code || 'CHECK_FAILED'}). No keys or upstream messages printed.`); process.exitCode = 1;});
module.exports = {audit, preferences, cases};

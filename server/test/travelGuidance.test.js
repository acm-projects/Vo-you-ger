const {describe, it, afterEach, mock} = require('node:test');
const assert = require('node:assert/strict');
const {practicalInfoForOutline, activityTravelTip, withTravelGuidance} = require('../services/travelGuidanceService');
const {buildOutline} = require('../services/tripOutlineService');
const {buildSchedule, generateCountryItinerary} = require('../services/countryItineraryService');
const {storedItinerary} = require('../services/itineraryStorageService');
const catalog = require('../services/planningDataService');
const reviewed = require('../data/practicalGuidance.json');
const discovery = require('../services/stopDiscoveryService');
const llm = require('../services/llmclient');
afterEach(() => mock.restoreAll());
const slots = ['morning', 'afternoon', 'evening'];
const outline = code => buildOutline({countryId: `country-${code}`, numberOfDays: 1, startDate: '2027-06-05', quiz: {}});

describe('Country practical information', () => {
  it('uses the sourced currency code and returns reviewed payment guidance with citations', () => {
    const info = practicalInfoForOutline(outline('jp'));
    assert.equal(info.currency.code, 'JPY'); assert.equal(info.currency.symbol, '¥');
    assert.ok(info.paymentMethods.cardsAccepted.includes('JCB'));
    assert.equal(info.provenance.paymentMethods.status, 'source_reviewed');
    assert.match(info.provenance.paymentMethods.sources[0], /^https:\/\/www.japan.travel\//);
    assert.ok(info.culturalTips.some(tip => tip.includes('generally not expected')));
    assert.ok(!JSON.stringify(info).includes('NO TIPPING under any circumstances'));
    assert.ok(info.paymentMethods.acceptanceNote.includes('confirm directly'));
  });
  it('does not invent specific accepted cards, wallets or exchange rates when the source does not establish them', () => {
    const info = practicalInfoForOutline(outline('ar'));
    assert.deepEqual(info.paymentMethods.cardsAccepted, []);
    assert.deepEqual(info.paymentMethods.popularEWallets, []);
    assert.ok(!JSON.stringify(info).includes('MEP dollar rate'));
    assert.equal(info.currency.code, 'ARS');
  });
  it('preserves city tips with their scope and labels unreviewed editorial information honestly', () => {
    const route = {country: 'Test country', countryCode: 'TC', stops: [
      {stopId: 'one', destinationId: 'first', name: 'First city'},
      {stopId: 'two', destinationId: 'second', name: 'Second city'},
    ]};
    const records = [
      {id: 'first', countryCode: 'TC', paymentMethods: {cardsAccepted: ['Visa', 'Mastercard'], cashAdvice: 'First city advice'}, culturalTips: ['First city custom']},
      {id: 'second', countryCode: 'TC', paymentMethods: {cardsAccepted: ['Visa'], cashAdvice: 'Second city advice'}, culturalTips: ['Second city custom']},
    ];
    const info = practicalInfoForOutline(route, records, [{countryCode: 'TC', currencyCode: 'EUR'}], {});
    assert.deepEqual(info.paymentMethods.cardsAccepted, ['Visa']);
    assert.equal(info.provenance.paymentMethods.status, 'legacy_editorial');
    assert.deepEqual(info.culturalTips, [], 'City customs must not become country-wide claims');
    assert.deepEqual(info.byStop[0].culturalTips, ['First city custom']);
    assert.deepEqual(info.byStop[1].culturalTips, ['Second city custom']);
    assert.equal(info.byStop[0].provenance.culturalTips.reviewedOn, null);
    const missing = practicalInfoForOutline({...route, stops: [{destinationId: 'missing', name: 'Missing'}]}, records, [], {});
    assert.equal(missing.currency, null); assert.equal(missing.paymentMethods, null);
    assert.deepEqual(missing.byStop[0].culturalTips, []);
  });
  it('does not mutate catalog snapshots or borrow a different country’s destination guidance', () => {
    const first = practicalInfoForOutline(outline('pt'));
    first.paymentMethods.cardsAccepted.push('Invented network');
    first.byStop[0].paymentMethods.cardsAccepted.push('Invented network');
    first.provenance.paymentMethods.sources.push('https://invalid.example');
    const next = practicalInfoForOutline(outline('pt'));
    assert.ok(!JSON.stringify(next).includes('Invented network'));
    assert.ok(!JSON.stringify(next).includes('invalid.example'));
    const wrong = practicalInfoForOutline({countryCode: 'PL', country: 'Poland', stops: [{destinationId: 'tokyo-jp', name: 'Unknown'}]}, undefined, undefined, {});
    assert.equal(wrong.byStop[0].paymentMethods, null);
  });
  it('has explicit information or unknown values for every enabled country without network calls', () => {
    mock.method(global, 'fetch', () => assert.fail('Practical information must be local'));
    for (const country of catalog.countries.filter(country => country.planningAvailable)) {
      const info = practicalInfoForOutline(outline(country.countryCode.toLowerCase()));
      assert.match(info.currency.code, /^[A-Z]{3}$/);
      assert.ok(Array.isArray(info.culturalTips));
      assert.ok(['source_reviewed', 'legacy_editorial', 'unknown'].includes(info.provenance.paymentMethods.status));
    }
    for (const entry of Object.values(reviewed.countries)) {
      assert.match(entry.reviewedOn, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(entry.paymentSources.length);
      for (const url of [...entry.paymentSources, ...entry.tipSources]) assert.equal(new URL(url).protocol, 'https:');
    }
  });
});

describe('Activity travel tips and persistence', () => {
  it('explains unknown hours, dietary uncertainty and reserved travel time without inventing venue rules', () => {
    const tip = activityTravelTip({category: 'food'}, {type: 'arrival', dayOfWeek: 'Saturday'}, 'evening', {dietaryRestrictions: ['Vegetarian']});
    assert.match(tip, /could not be verified/); assert.match(tip, /cross-contact have not been verified/);
    assert.match(tip, /actual travel arrangements/);
    const known = activityTravelTip({category: 'attractions', openingHours: ['Saturday: 9:00 AM – 5:00 PM']}, {type: 'full', dayOfWeek: 'Saturday'}, 'morning');
    assert.match(known, /regular hours overlap/); assert.match(known, /Check the venue’s own information/);
  });
  for (const mode of ['gemini', 'provider-error', 'schedule-changed']) it(`keeps practical information and server-authored tips through ${mode} generation and storage`, async () => {
    const route = outline('pt'), schedule = buildSchedule(route, route.startDate), stop = route.stops[0];
    const base = catalog.baseById.get(stop.destinationId);
    mock.method(discovery, 'discoverStops', async () => [{stopId: stop.stopId, candidatePlaces: [{
      placeId: 'real-candidate', name: 'Provider venue', category: 'attractions', types: ['museum'], stopId: stop.stopId,
      lat: base.lat, lng: base.lng, address: 'Provider-only street',
    }]}]);
    mock.method(llm, 'generateStructured', async request => {
      if (mode === 'provider-error') throw Object.assign(new Error('Private provider error'), {statusCode: 503});
      const data = JSON.parse(request.prompt).plan;
      data.practicalInfo = {currency: {code: 'FAKE'}};
      for (const day of data.days) for (const activity of slots.flatMap(slot => day[slot])) {
        activity.travelTip = 'Guaranteed free entry at 8 AM';
        activity.activityDescription = 'Take time to explore this museum.';
      }
      if (mode === 'schedule-changed') data.days[0].morning[0].placeId = 'invented';
      return {data, model: 'mock'};
    });
    const {itinerary} = await generateCountryItinerary({outline: route, quiz: {}, startDate: route.startDate});
    assert.equal(itinerary.practicalInfo.currency.code, 'EUR');
    assert.equal(itinerary.narrativeSource, mode === 'gemini' ? 'gemini' : 'deterministic_fallback');
    assert.equal(itinerary.narrativeFallbackReason, mode === 'gemini' ? null : mode === 'schedule-changed' ? 'schedule_changed' : 'provider_unavailable');
    const activity = slots.flatMap(slot => itinerary.days[0][slot])[0];
    assert.match(activity.travelTip, /could not be verified/);
    assert.ok(!activity.travelTip.includes('Guaranteed'));
    assert.equal(activity.travelTipSource, 'planning_guidance');
    const saved = storedItinerary(itinerary);
    assert.deepEqual(saved.practicalInfo, itinerary.practicalInfo);
    assert.equal(saved.narrativeFallbackReason, itinerary.narrativeFallbackReason);
    assert.equal(slots.flatMap(slot => saved.days[0][slot])[0].travelTip, activity.travelTip);
    assert.ok(!JSON.stringify(saved).includes('Provider-only street'));
    assert.deepEqual(withTravelGuidance(saved), saved, 'Retrieval preserves the saved guidance snapshot');
  });
  it('fills gaps in an older country itinerary without modifying the saved object or calling Google', () => {
    mock.method(global, 'fetch', () => assert.fail('No network calls on trip retrieval'));
    const old = {schemaVersion: 2, outline: outline('pt'), days: [{day: 1, dayOfWeek: 'Saturday', morning: [{placeId: 'old', category: 'food', activityDescription: 'A meal', openingHours: ['Saturday: Closed']}], afternoon: [], evening: []}]};
    const original = structuredClone(old), restored = withTravelGuidance(old);
    assert.equal(restored.practicalInfo.currency.code, 'EUR');
    assert.match(restored.days[0].morning[0].travelTip, /could not be verified/);
    assert.deepEqual(old, original);
    const legacy = {schemaVersion: 1, days: []}; assert.equal(withTravelGuidance(legacy), legacy);
  });
});

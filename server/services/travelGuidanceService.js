const registry = require('../data/countries.json');
const destinations = require('../data/destinations.json');
const guidance = require('../data/practicalGuidance.json');

const ACCEPTANCE_NOTE = 'General travel guidance. Acceptance varies by business, terminal and card; confirm directly before paying.';
const legacySource = destinationId => ({
  status: 'legacy_editorial', reviewedOn: null,
  catalog: 'server/data/destinations.json', destinationId,
  note: 'Existing editorial guidance without a recorded source review; applies to this destination only.',
});
const reviewedSource = (entry, sources) => ({status: 'source_reviewed', reviewedOn: entry.reviewedOn, sources: [...sources]});

function currencyFor(country) {
  const code = country?.currencyCode;
  if (!code || !/^[A-Z]{3}$/.test(code)) return null;
  return {
    code,
    name: new Intl.DisplayNames(['en'], {type: 'currency'}).of(code),
    symbol: new Intl.NumberFormat('en', {style: 'currency', currency: code, currencyDisplay: 'narrowSymbol'})
      .formatToParts(0).find(part => part.type === 'currency')?.value || code,
  };
}

function payments(value) {
  return value ? {...structuredClone(value), cardsAccepted: [...(value.cardsAccepted || [])],
    cardsLimited: [...(value.cardsLimited || [])], popularEWallets: [...(value.popularEWallets || [])],
    acceptanceNote: ACCEPTANCE_NOTE} : null;
}

// Country facts stay separate from city-specific customs, costs and safety tiers.
// Never inherit city advice from a different base merely because the country matches.
function practicalInfoForOutline(outline, records = destinations, countries = registry.countries, reviewed = guidance.countries) {
  const country = countries.find(item => item.countryCode === outline.countryCode);
  const entry = reviewed[outline.countryCode];
  const byStop = outline.stops.map(stop => {
    const destination = records.find(item => item.id === stop.destinationId && item.countryCode === outline.countryCode);
    return {
      stopId: stop.stopId, destinationId: stop.destinationId, name: stop.name,
      budget: destination?.budget || null, safety: destination?.safety ?? null,
      paymentMethods: payments(entry?.paymentMethods || destination?.paymentMethods),
      culturalTips: [...(entry?.culturalTips?.length ? entry.culturalTips : destination?.culturalTips || [])],
      provenance: {
        paymentMethods: entry?.paymentMethods ? reviewedSource(entry, entry.paymentSources)
          : destination?.paymentMethods ? legacySource(stop.destinationId) : {status: 'unknown'},
        culturalTips: entry?.culturalTips?.length ? reviewedSource(entry, entry.tipSources)
          : destination?.culturalTips?.length ? legacySource(stop.destinationId) : {status: 'unknown'},
      },
    };
  });
  // Preserve the familiar top-level payment shape when every selected base has
  // guidance. Only shared card networks are summarized; city cash advice stays scoped.
  const commonCards = byStop.length && byStop.every(stop => stop.paymentMethods)
    ? byStop[0].paymentMethods.cardsAccepted.filter(card => byStop.every(stop => stop.paymentMethods.cardsAccepted.includes(card))) : [];
  const commonPayments = byStop.length && byStop.every(stop => stop.paymentMethods) ? {
    cardsAccepted: commonCards,
    cashAdvice: 'Confirm the accepted card and cash options with each business. See byStop for destination-specific editorial guidance.',
  } : null;
  return {
    country: outline.country, countryCode: outline.countryCode, name: outline.country,
    currency: currencyFor(country), languages: [...(country?.languages || [])],
    paymentMethods: payments(entry?.paymentMethods || commonPayments),
    culturalTips: [...(entry?.culturalTips || [])],
    byStop,
    provenance: {
      currency: {status: country?.currencyCode ? 'source_snapshot' : 'unknown',
        source: 'https://www.geonames.org/', snapshotVersion: registry.version, license: 'CC-BY-4.0',
        note: 'Currency code from the country snapshot; English name and display symbol from Intl. No exchange rates.'},
      paymentMethods: entry?.paymentMethods ? reviewedSource(entry, entry.paymentSources)
        : commonPayments ? {status: 'legacy_editorial', reviewedOn: null, destinationIds: byStop.map(stop => stop.destinationId)} : {status: 'unknown'},
      culturalTips: entry?.culturalTips?.length ? reviewedSource(entry, entry.tipSources) : {status: 'unknown'},
    },
    notes: [ACCEPTANCE_NOTE, 'Empty lists mean no guidance is recorded for that field, not that a payment method or custom does not exist.',
      'City-specific editorial tips are in byStop and have not been independently source-reviewed.'],
  };
}

function activityTravelTip(place, day, slot, quiz = {}) {
  const {checkHours} = require('./venueHoursService');
  const hours = checkHours(place, day.dayOfWeek, slot);
  const tips = [hours.hoursCheck === 'unknown'
    ? 'Opening hours for this slot could not be verified; check directly before setting out.'
    : 'Listed regular hours overlap this slot; confirm holiday hours and allow enough time before closing.'];
  if (place.category === 'food') {
    tips.push('Confirm the menu, dietary requirements and accepted payment methods with the venue.');
    if ((quiz.dietaryRestrictions || []).some(value => !/^(none|no restrictions)$/i.test(value.trim())))
      tips.push('The search used your dietary preferences, but ingredients and cross-contact have not been verified.');
  } else tips.push('Check the venue’s own information for admission, reservation and accessibility requirements.');
  if (['arrival', 'transfer', 'departure'].includes(day.type)) tips.push('Keep this optional and adjust it to your actual travel arrangements.');
  return tips.join(' ');
}

// Older country itineraries can expose the restored fields without a database
// rewrite, Google calls, or changing their route. Persisted snapshots take priority.
function withTravelGuidance(itinerary) {
  if (itinerary?.schemaVersion !== 2 || !itinerary.outline?.stops) return itinerary;
  return {
    ...itinerary,
    practicalInfo: itinerary.practicalInfo || practicalInfoForOutline(itinerary.outline),
    days: itinerary.days.map(day => ({...day, ...Object.fromEntries(['morning', 'afternoon', 'evening'].map(slot => [slot,
      (day[slot] || []).map(activity => activity.travelTip ? activity : {...activity,
        // Old embedded provider hours may be stale. Reading a saved trip must
        // not validate them or turn them into a new claim about opening hours.
        travelTip: activityTravelTip({category: activity.category}, day, slot), travelTipSource: 'planning_guidance'}),
    ]))})),
  };
}

module.exports = {practicalInfoForOutline, activityTravelTip, withTravelGuidance};

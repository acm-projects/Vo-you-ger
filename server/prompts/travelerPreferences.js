// Keep arbitrary profile fields and oversized free text out of model prompts.
const FIELDS = [
  'startingLocation', 'preferredCountries', 'preferredMonths', 'minNights', 'maxNights',
  'startDate', 'preferredWeather', 'visaWillingness', 'highRiskDestWillingness',
  'preferredAccomodation', 'travelAlterEgo', 'preferredViews', 'photosToPost',
  'seeAllOrDeeply', 'sleepInOrEarly', 'visitFamousLocationOrHiddenGem',
  'enjoyCrowdsOrSpace', 'walkAmount', 'peopleOnTrip', 'budgetLevel', 'dietaryRestrictions',
  'transportModes', 'intercityTransportModes'
];
function travelerPreferences(quiz={}) {
  return Object.fromEntries(FIELDS.filter(key=>quiz[key]!==undefined).map(key=>[key,Array.isArray(quiz[key])
    ?quiz[key].slice(0,15).map(value=>String(value).slice(0,160))
    :typeof quiz[key]==='string'?quiz[key].slice(0,240):quiz[key]]));
}
module.exports={travelerPreferences};

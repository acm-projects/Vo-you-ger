// Keep arbitrary profile fields and oversized free text out of model prompts.
const FIELDS=['startingLocation','countriesOfInterest','months','temperaturePreferences','weatherPreferences',
  'transportModes','intercityTransportModes','accommodationTypes','groupSize','dailyBudget','dietaryRestrictions',
  'walkingAmount','travelAlterEgo','favoriteView','tripPhotoStyle','nightlifeOrSunrise','famousOrHiddenGem',
  'seeAllOrDeeply','crowdsOrSpace','riskTolerance','startDate','minNights','maxNights','willingToGetVisa','visaWillingness'];
function travelerPreferences(quiz={}) {
  return Object.fromEntries(FIELDS.filter(key=>quiz[key]!==undefined).map(key=>[key,Array.isArray(quiz[key])
    ?quiz[key].slice(0,15).map(value=>String(value).slice(0,160))
    :typeof quiz[key]==='string'?quiz[key].slice(0,240):quiz[key]]));
}
module.exports={travelerPreferences};

const { countryCandidates } = require('./tripOutlineService');
const data = require('./planningDataService');
const { scoreDestination } = require('./destinationScoringService');
const weights = require('../config/scoringWeights');
const { TRIP_POLICY } = require('../config/tripPolicy');

function rankCountries(quiz, visaFreeCountryCodes = null) {
  return countryCandidates(quiz, visaFreeCountryCodes).map(country => {
    const route=country.suggestedRoute;
    const destinations=route.destinationIds.map(id=>data.destinationById.get(id));
    // Average selected destination quality, never sum the whole country's tags.
    const quality=destinations.reduce((sum,base)=>sum+scoreDestination(base,quiz).score,0)/destinations.length;
    const variety=Math.min(weights.countryVarietyCap,(destinations.length-1)*weights.countryVarietyPerBase);
    const burden=route.transferMinutes/weights.countryTransferMinutesDivisor;
    return { ...country, matchScore:Number(Math.max(0,Math.min(100,quality+variety-burden)).toFixed(2)),
      scoringVersion:weights.version, policyVersion:TRIP_POLICY.version, catalogVersion:data.version,
      scoreBreakdown:{ selectedDestinationMean:Number(quality.toFixed(2)), varietyBonus:variety, transferPenalty:burden } };
  }).sort((a,b)=>b.matchScore-a.matchScore||a.countryCode.localeCompare(b.countryCode));
}
module.exports={ rankCountries };

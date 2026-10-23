const destinations=require('../data/destinations.json');
const registry=require('../data/countries.json');
const data=require('../services/planningDataService');
const {supportedBases,enumerateRoutes}=require('../services/tripOutlineService');
const {TRIP_POLICY}=require('../config/tripPolicy');
const combinations={2:new Set(),3:new Set(),4:new Set(),5:new Set()},multi=new Set();
for(const country of data.countries.filter(country=>country.planningAvailable)) {
 for(const route of enumerateRoutes(supportedBases(country.countryCode),{},TRIP_POLICY.maxSupportedDays)) {
  if(route.length<2)continue;
  combinations[route.length].add(route.map(base=>base.id).sort().join(','));multi.add(country.countryCode);
 }
}
const countries=data.countries.map(country=>({countryCode:country.countryCode,name:country.name,verifiedSettlements:country.verifiedSettlementCount,geographicCoverage:country.geographicCoverage,exception:country.coverageException,planningAvailable:country.planningAvailable,overnightBases:country.supportedBaseCount}));
const report={registryScope:registry.scope,registryCountries:countries.length,countriesWithFiveVerifiedSettlements:countries.filter(c=>c.verifiedSettlements>=5).length,countriesBelowFive:countries.filter(c=>c.verifiedSettlements<5).length,verifiedDestinationRecords:destinations.filter(d=>d.provenance?.geography?.status==='verified_gazetteer').length,totalDestinationRecords:destinations.length,planningEnabledCountries:countries.filter(c=>c.planningAvailable).length,overnightBases:data.bases.length,reviewedDomesticConnections:data.connections.filter(c=>c.status==='reviewed').length,multiCityCountries:multi.size,routeCombinations:Object.fromEntries(Object.entries(combinations).map(([size,set])=>[size,set.size])),countriesWithIncompletePlanning:countries.filter(c=>!c.planningAvailable).length,coverageExceptions:countries.filter(c=>c.verifiedSettlements<5),note:'Gazetteer verification proves settlement identity/country, not safety, accommodation availability, or transport readiness. Search is policy-bounded; combinations ignore direction.'};
console.log(JSON.stringify(process.argv.includes('--all')?{...report,countries}:report,null,2));

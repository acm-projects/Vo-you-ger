const catalog = require('./planningDataService');
const display = require('../data/countryInfo.json');
const {apiError} = require('./apiError');

function findCountry(code) {
  if(typeof code!=='string'||!/^[a-z]{2}$/i.test(code)) throw apiError('INVALID_COUNTRY_CODE','Use an ISO alpha-2 country code');
  const country=catalog.countries.find(country=>country.countryCode===code.toUpperCase());
  if(!country) throw apiError('COUNTRY_NOT_FOUND','Country is not in the ISO registry',404);
  return country;
}

function countrySummary(country) {
  const info=display.countries[country.countryCode]||{};
  return {countryCode:country.countryCode,name:country.name,
    flag:String.fromCodePoint(...[...country.countryCode].map(letter=>127397+letter.charCodeAt(0))),
    pin:info.displayPin||country.pin,planningAvailable:country.planningAvailable,
    supportedOvernightBases:country.supportedBaseCount,photo:info.photo||null};
}

function countryDetails(code) {
  const country=findCountry(code),info=display.countries[country.countryCode]||{};
  return {...countrySummary(country),officialName:country.officialName,
    description:`${country.name}${info.continent?` is in ${info.continent}`:''}.${info.capital?` Its capital is ${info.capital}.`:''}`,
    facts:{capital:info.capital||null,continent:info.continent||null,currencyCode:country.currencyCode||null,
      languages:country.languages||[],areaKm2:info.areaKm2??null,population:info.population??null},
    source:{name:'GeoNames',url:display.source,license:display.license,snapshotDate:display.snapshotDate,populationNote:display.populationNote,currency:country.currencyProvenance||null},
    planning:{available:country.planningAvailable,supportedOvernightBases:country.supportedBaseCount,
      assessmentRequired:true,message:country.planningAvailable?'Plan a trip using your travel preferences.':'Trip planning is not available here yet.'}};
}

function listCountries() {
  return catalog.countries.map(countrySummary).sort((a,b)=>a.name.localeCompare(b.name));
}
module.exports={countryDetails,listCountries,findCountry};

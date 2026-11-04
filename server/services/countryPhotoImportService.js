const unsplash = require('./unsplashService');

// Avoid ambiguous searches such as the US state of Georgia or the two Congos.
const SEARCH_QUERIES = {
  GE: 'Tbilisi Georgia', CD: 'Democratic Republic of Congo landscape', CG: 'Brazzaville Republic of Congo',
  KZ: 'Charyn Canyon Kazakhstan', KR: 'Seoul South Korea', KP: 'Pyongyang North Korea',
  GB: 'United Kingdom landscape', US: 'United States landscape', CI: 'Ivory Coast landscape',
  CC: 'Cocos Keeling Islands', BQ: 'Bonaire Caribbean', AX: 'Aland Islands Finland',
  IO: 'Chagos Archipelago', UM: 'Midway Atoll', TF: 'Kerguelen Islands',
  GS: 'South Georgia island penguins', SJ: 'Svalbard Norway', SH: 'Saint Helena island',
  VG: 'British Virgin Islands', VI: 'US Virgin Islands', MF: 'Saint Martin Caribbean island',
  SX: 'Sint Maarten Caribbean island', PN: 'Pitcairn Island', PS: 'Palestine landscape',
  RE: 'Piton de la Fournaise Reunion', GL: 'Ilulissat Greenland icebergs',
  MW: 'Lake Malawi Malawi', GM: 'Banjul The Gambia',
};
const COUNTRY_ALIASES = {
  US: ['USA', 'United States of America', 'U.S.A.'], GB: ['UK', 'Great Britain', 'England', 'Scotland', 'Wales', 'Northern Ireland'],
  RU: ['Russian Federation'], KR: ['Republic of Korea'], KP: ["Democratic People’s Republic of Korea"],
  CZ: ['Czech Republic'], NL: ['Netherlands'], CI: ["Côte d’Ivoire", "Cote d'Ivoire"],
  CV: ['Cape Verde'], SZ: ['Swaziland'], TL: ['East Timor'], TR: ['Türkiye', 'Turkiye'],
  BO: ['Bolivia'], VE: ['Venezuela'], VN: ['Viet Nam'], IR: ['Iran'],
  CD: ['DR Congo', 'Congo (Kinshasa)', 'Congo, the Democratic Republic of the'],
  CG: ['Congo (Brazzaville)'], TZ: ['Tanzania'], TW: ['Taiwan'],
  PS: ['Palestine', 'Palestinian Territories', 'State of Palestine'],
  BQ: ['Bonaire', 'Sint Eustatius', 'Saba', 'Caribbean Netherlands'],
  SJ: ['Svalbard', 'Jan Mayen'], SH: ['Saint Helena', 'Ascension Island', 'Tristan da Cunha'],
  HK: ['Hong Kong'], MO: ['Macau', 'Macao'], AX: ['Åland Islands', 'Aland'],
  RE: ['Réunion'], BL: ['Saint Barthélemy', 'St. Barts'], CW: ['Curaçao'],
  MF: ['Saint Martin', 'Saint-Martin'], SX: ['Sint Maarten', 'St. Maarten'],
  VI: ['US Virgin Islands', 'U.S. Virgin Islands', 'United States Virgin Islands'],
  BS: ['The Bahamas'], MM: ['Myanmar (Burma)'], GM: ['The Gambia'],
};
const PRIORITY = ['KZ', 'JP', 'FR', 'IT', 'US', 'BR', 'ZA', 'AU', 'MX', 'EG', 'TR', 'ES', 'IN', 'TH', 'CA', 'NZ'];

function normalize(value) {
  return String(value || '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function matchesCountry(photo, country) {
  const reported = normalize(photo.location?.country);
  if (!reported) return false;
  const names = [country.name, country.isoName, country.officialName, ...(COUNTRY_ALIASES[country.countryCode] || [])];
  return names.some(name => name && normalize(name) === reported);
}

function countryOrder(countries) {
  return [...countries].sort((a, b) => {
    const priorityA = PRIORITY.indexOf(a.countryCode), priorityB = PRIORITY.indexOf(b.countryCode);
    return (priorityA < 0 ? 100 : priorityA) - (priorityB < 0 ? 100 : priorityB)
      || Number(b.planningAvailable) - Number(a.planningAvailable) || a.name.localeCompare(b.name);
  });
}

// Only this offline importer calls Unsplash. Browsing continues to read saved metadata.
async function populatePhotos({countries, data, save, log = () => {}, api = unsplash}) {
  data.importProgress ||= {};
  let selected = 0;
  const used = new Set(Object.values(data.countries).map(photo => photo.id));
  // User selections take precedence over automatic discovery and survive quota pauses.
  for (const [code, choice] of Object.entries(data.manualSelections || {})) {
    if (choice.status !== 'pending') continue;
    const country = countries.find(item => item.countryCode === code);
    if (!country) throw new Error(`Unknown country in manual selections: ${code}`);
    if (data.countries[code]?.id === choice.id) {
      choice.status = 'selected';
      await save();
      continue;
    }
    if (api.requestUsage().remaining < 2) return {selected, paused: true};
    try {
      let photo;
      try {photo = await api.getPhoto(choice.id);} catch (error) {
        if (error.status !== 404) throw error;
        choice.status = 'unavailable';
        choice.reason = 'Photo not available through the free Unsplash API.';
        await save();
        log(`${country.name}: selected URL unavailable; keeping the existing image.`);
        continue;
      }
      if (!choice.locationVerified && !matchesCountry(photo, country)) {
        choice.status = 'needs_review';
        choice.reason = 'Country could not be confirmed from the photo location.';
        await save();
        log(`${country.name}: selected URL needs a location check; keeping the existing image.`);
        continue;
      }
      let formatted;
      try {
        // A manually selected portrait may be cropped by the existing card; automatic searches stay landscape-only.
        formatted = api.formatPhoto(photo, country, {allowPortrait: true});
      } catch (error) {
        choice.status = 'needs_review';
        choice.reason = error.message;
        await save();
        log(`${country.name}: ${error.message} Keeping the existing image.`);
        continue;
      }
      await api.trackPhoto(photo);
      data.countries[code] = {...formatted, reviewedForCountry: code};
      choice.status = 'selected';
      used.add(photo.id);
      selected += 1;
      await save();
      log(`${country.name}: saved your selection ${photo.id} by ${formatted.credit}`);
    } catch (error) {
      if (error.code === 'UNSPLASH_LIMIT') return {selected, paused: true};
      throw error;
    }
  }
  for (const country of countryOrder(countries)) {
    const code = country.countryCode;
    if (data.countries[code] || data.manualSelections?.[code] || ['no_match', 'needs_review'].includes(data.importProgress[code]?.status)) continue;
    try {
      let progress = data.importProgress[code];
      if (!progress) {
        const query = SEARCH_QUERIES[code] || `${country.name.trim()} landscape`;
        const results = await api.searchPhotos(query);
        const candidates = results.filter(photo => photo.width >= 1600 && photo.width > photo.height && !used.has(photo.id)).map(photo => photo.id);
        progress = data.importProgress[code] = {query, candidates, checked: [], status: 'pending'};
        await save();
      }
      // At most three details lookups per country. Uncertain results keep the default.
      for (const id of progress.candidates.slice(0, 3)) {
        if (progress.checked.includes(id) || used.has(id)) continue;
        if (api.requestUsage().remaining < 2) return {selected, paused: true};
        const photo = await api.getPhoto(id);
        if (!matchesCountry(photo, country)) {
          progress.checked.push(id);
          await save();
          continue;
        }
        let formatted;
        try {formatted = api.formatPhoto(photo, country);} catch {
          progress.checked.push(id);
          await save();
          continue;
        }
        await api.trackPhoto(photo);
        data.countries[code] = {...formatted, locationValidation: {
          method: 'unsplash_country_metadata', reportedCountry: photo.location.country, countryCode: code,
        }};
        progress.status = 'selected';
        used.add(id);
        selected += 1;
        await save();
        log(`${country.name}: selected ${id} by ${formatted.credit}`);
        break;
      }
      if (!data.countries[code]) {
        progress.status = progress.candidates.length ? 'needs_review' : 'no_match';
        await save();
        log(`${country.name}: keeping default; no sufficiently clear country match.`);
      }
    } catch (error) {
      if (error.code === 'UNSPLASH_LIMIT') return {selected, paused: true};
      throw error;
    }
  }
  return {selected, paused: false};
}

module.exports = {matchesCountry, populatePhotos};

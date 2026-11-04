const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config({path: path.join(__dirname, '../.env'), quiet: true});
const {findCountry} = require('../services/countryInfoService');
const {searchPhotos, selectPhoto} = require('../services/unsplashService');
const unsplash = require('../services/unsplashService');
const {populatePhotos} = require('../services/countryPhotoImportService');
const countries = require('../services/planningDataService').countries;

function openCatalog() {
  const filename = path.join(__dirname, '../data/countryPhotos.json');
  let original = fs.readFileSync(filename, 'utf8');
  const data = JSON.parse(original);
  function save() {
    if (fs.readFileSync(filename, 'utf8') !== original) throw new Error('Photo selections changed during this request. Run the command again.');
    const text = JSON.stringify(data, null, 2) + '\n';
    const temporary = `${filename}.${process.pid}.tmp`;
    try {
      fs.writeFileSync(temporary, text, {flag: 'wx'});
      fs.renameSync(temporary, filename);
      original = text;
    } finally {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
  }
  return {data, save};
}

function printStatus(data) {
  const selected = countries.filter(country => data.countries[country.countryCode]).length;
  const checked = countries.filter(country => !data.countries[country.countryCode] && (
    ['needs_review', 'no_match'].includes(data.importProgress?.[country.countryCode]?.status)
    || ['needs_review', 'unavailable'].includes(data.manualSelections?.[country.countryCode]?.status)
  )).length;
  console.log(`Unsplash: ${selected}/${countries.length}. Defaults in use: ${countries.length - selected}.`);
  console.log(`Checked without a clear match: ${checked}. Not yet finished: ${countries.length - selected - checked}.`);
  const manual = Object.values(data.manualSelections || {});
  if (manual.length) console.log(`Your selections: ${manual.filter(choice => choice.status === 'selected').length} saved, ${manual.filter(choice => choice.status === 'pending').length} pending, ${manual.filter(choice => !['selected', 'pending'].includes(choice.status)).length} need attention.`);
}

async function main() {
  const [command, code, ...args] = process.argv.slice(2);
  if (command === 'status') {
    printStatus(openCatalog().data);
    return;
  }
  if (command === 'populate') {
    const options = [code, ...args].filter(value => value !== undefined);
    const keepGoing = options.includes('--continue');
    const budgetOptions = options.filter(value => value !== '--continue');
    if (budgetOptions.length && (budgetOptions.length !== 2 || budgetOptions[0] !== '--max-requests')) {
      throw new Error('Usage: node scripts/country-photos.js populate --max-requests 45 [--continue]');
    }
    const limit = budgetOptions.length ? Number(budgetOptions[1]) : 45;
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new Error('Use a request budget from 1 to 50 for the free demo API.');
    if (keepGoing && limit < 3) throw new Error('Continuation mode needs a budget of at least 3 requests per batch.');
    if (keepGoing) console.log(`Importer process: ${process.pid}. Each batch is bounded; saved progress survives stopping this process.`);
    do {
      unsplash.configureRequestBudget(limit);
      const catalog = openCatalog();
      const result = await populatePhotos({countries, ...catalog, log: console.log});
      printStatus(catalog.data);
      const usage = unsplash.requestUsage();
      console.log(`API requests used this batch: ${usage.requestsMade}. Provider allowance remaining: ${usage.providerRemaining ?? 'not reported'}.`);
      if (!result.paused) {
        console.log('Every registry entry was checked. Countries without a suitable match retain their default image.');
        break;
      }
      if (!keepGoing) {
        console.log('Paused at the request limit. Progress is saved. Run this command again after the hourly allowance resets.');
        break;
      }
      console.log(`Progress saved. Next batch after the hourly reset, at ${new Date(Date.now() + 61 * 60 * 1000).toISOString()}. Stop with Ctrl+C; rerunning resumes saved progress.`);
      await new Promise(resolve => setTimeout(resolve, 61 * 60 * 1000));
    } while (keepGoing);
    return;
  }
  if (!['search', 'select'].includes(command) || !code) {
    throw new Error('Usage:\n  node scripts/country-photos.js search PT "Lisbon Portugal"\n  node scripts/country-photos.js select PT PHOTO_ID --confirm-location\n  node scripts/country-photos.js populate --max-requests 45 [--continue]\n  node scripts/country-photos.js status');
  }
  const country = findCountry(code);
  if (command === 'search') {
    const photos = await searchPhotos(args.join(' ') || `${country.name} landscape`);
    if (!photos.length) {
      console.log('No matches. Try a specific city or landmark; the existing country image is unchanged.');
      return;
    }
    for (const photo of photos) {
      console.log(JSON.stringify({
        id: photo.id, description: photo.alt_description || photo.description,
        photographer: photo.user?.name, preview: photo.links?.html,
        width: photo.width, height: photo.height,
      }, null, 2));
    }
    console.log('Review the preview and location before selecting. Search used one Unsplash API request.');
    return;
  }
  if (args.length !== 2 || args[1] !== '--confirm-location') {
    throw new Error('Review that the photo depicts this country, then use: select COUNTRY_CODE PHOTO_ID --confirm-location');
  }
  const {data, save} = openCatalog();
  if (data.countries[country.countryCode]?.id === args[0]) {
    console.log('This photo is already selected. No API requests or changes were made.');
    return;
  }
  const photo = await selectPhoto(args[0], country);
  data.countries[country.countryCode] = photo;
  save();
  console.log(`Selected ${photo.id} by ${photo.credit} for ${country.name}.`);
  console.log('Selection used two Unsplash API requests. Restart the backend if nodemon did not reload it.');
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});

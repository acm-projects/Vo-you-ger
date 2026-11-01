const {describe, it} = require('node:test');
const assert = require('node:assert/strict');
const {matchesCountry, populatePhotos} = require('../services/countryPhotoImportService');

const kz = {countryCode: 'KZ', name: 'Kazakhstan'};
const fixture = (id, country = 'Kazakhstan') => ({id, width: 2400, height: 1600, location: {country}});
function fakeApi(photos, budget = 50) {
  const calls = [];
  const use = path => {assert.ok(budget > 0, 'Exceeded request budget'); budget -= 1; calls.push(path);};
  return {
    calls, requestUsage: () => ({remaining: budget}),
    searchPhotos: async () => {use('search'); return Object.values(photos);},
    getPhoto: async id => {use(`get:${id}`); return photos[id];},
    trackPhoto: async photo => {use(`track:${photo.id}`);},
    formatPhoto: photo => ({id: photo.id, provider: 'unsplash'}),
  };
}

describe('Resumable country photo import', () => {
  it('requires exact country metadata and disambiguates countries with similar names', () => {
    assert.equal(matchesCountry(fixture('a'), kz), true);
    assert.equal(matchesCountry({location: {}}, kz), false);
    assert.equal(matchesCountry(fixture('a', 'United States'), {countryCode: 'GE', name: 'Georgia'}), false);
    assert.equal(matchesCountry(fixture('a', 'Congo'), {countryCode: 'CG', name: 'Republic of the Congo'}), false);
    assert.equal(matchesCountry(fixture('a', 'Côte d’Ivoire'), {countryCode: 'CI', name: 'Ivory Coast'}), true);
    assert.equal(matchesCountry(fixture('a', 'The Bahamas'), {countryCode: 'BS', name: 'Bahamas'}), true);
    assert.equal(matchesCountry(fixture('a', 'Myanmar (Burma)'), {countryCode: 'MM', name: 'Myanmar'}), true);
    assert.equal(matchesCountry(fixture('a', 'Australia'), {countryCode: 'RE', name: 'Reunion'}), false);
  });
  it('skips a wrong-country result, tracks the matching photo and records the validation method', async () => {
    const data = {countries: {PT: {id: 'keep-existing'}}};
    const api = fakeApi({wrong: fixture('wrong', 'United States'), right: fixture('right')});
    let saved = 0;
    await populatePhotos({countries: [kz], data, save: () => {saved += 1;}, api});
    assert.equal(data.countries.KZ.id, 'right');
    assert.equal(data.countries.KZ.locationValidation.method, 'unsplash_country_metadata');
    assert.equal(data.countries.KZ.reviewedForCountry, undefined);
    assert.equal(data.countries.PT.id, 'keep-existing');
    assert.deepEqual(api.calls, ['search', 'get:wrong', 'get:right', 'track:right']);
    assert.ok(saved > 0);
  });
  it('saves candidates and resumes without repeating search or touching selected countries', async () => {
    const data = {countries: {}};
    const first = fakeApi({right: fixture('right')}, 2);
    const paused = await populatePhotos({countries: [kz], data, save() {}, api: first});
    assert.equal(paused.paused, true);
    assert.deepEqual(first.calls, ['search']);
    assert.equal(data.countries.KZ, undefined);
    const second = fakeApi({right: fixture('right')});
    await populatePhotos({countries: [kz], data, save() {}, api: second});
    assert.deepEqual(second.calls, ['get:right', 'track:right']);
    const third = fakeApi({});
    await populatePhotos({countries: [kz], data, save() {}, api: third});
    assert.deepEqual(third.calls, []);
  });
  it('leaves defaults in place when all results are unsuitable or tracking fails', async () => {
    const data = {countries: {}};
    const api = fakeApi({wrong: fixture('wrong', 'Russia')});
    await populatePhotos({countries: [kz], data, save() {}, api});
    assert.equal(data.countries.KZ, undefined);
    assert.equal(data.importProgress.KZ.status, 'needs_review');
    const nextData = {countries: {}};
    const failing = fakeApi({right: fixture('right')});
    failing.trackPhoto = async () => {throw new Error('Tracking unavailable');};
    await assert.rejects(populatePhotos({countries: [kz], data: nextData, save() {}, api: failing}), /Tracking unavailable/);
    assert.equal(nextData.countries.KZ, undefined);
    assert.equal(nextData.importProgress.KZ.status, 'pending');
  });
  it('does not reuse the same photo across different countries', async () => {
    const data = {countries: {PT: {id: 'used'}}};
    const api = fakeApi({used: fixture('used')});
    await populatePhotos({countries: [kz], data, save() {}, api});
    assert.equal(data.countries.KZ, undefined);
    assert.deepEqual(api.calls, ['search']);
  });
  it('prioritizes and resumes user choices, replacing earlier automatic selections', async () => {
    const data = {countries: {KZ: {id: 'automatic'}}, manualSelections: {KZ: {id: 'chosen', status: 'pending', locationVerified: true}}};
    const first = fakeApi({chosen: fixture('chosen')}, 1);
    assert.equal((await populatePhotos({countries: [kz], data, save() {}, api: first})).paused, true);
    assert.deepEqual(first.calls, []);
    assert.equal(data.countries.KZ.id, 'automatic');
    const second = fakeApi({chosen: fixture('chosen')});
    await populatePhotos({countries: [kz], data, save() {}, api: second});
    assert.deepEqual(second.calls, ['get:chosen', 'track:chosen']);
    assert.equal(data.countries.KZ.id, 'chosen');
    assert.equal(data.countries.KZ.reviewedForCountry, 'KZ');
    assert.equal(data.manualSelections.KZ.status, 'selected');
  });
  it('keeps existing images if a user URL is unavailable or its country cannot be confirmed', async () => {
    for (const unavailable of [true, false]) {
      const data = {countries: {}, manualSelections: {KZ: {id: 'chosen', status: 'pending'}}};
      const api = fakeApi({chosen: fixture('chosen', 'Norway')});
      if (unavailable) api.getPhoto = async () => {throw Object.assign(new Error('Not found'), {status: 404});};
      await populatePhotos({countries: [kz], data, save() {}, api});
      assert.equal(data.countries.KZ, undefined);
      assert.equal(data.manualSelections.KZ.status, unavailable ? 'unavailable' : 'needs_review');
      assert.ok(!api.calls.includes('track:chosen'));
      assert.ok(!api.calls.includes('search'));
    }
  });
});

const {describe, it, afterEach, mock} = require('node:test');
const assert = require('node:assert/strict');
const {searchPhotos, selectPhoto, formatPhoto, configureRequestBudget, requestUsage} = require('../services/unsplashService');
const info = require('../services/countryInfoService');
const selections = require('../data/countryPhotos.json');
const display = require('../data/countryInfo.json');

const country = {countryCode: 'PT', name: 'Portugal'};
const previousKey = process.env.UNSPLASH_ACCESS_KEY;
const previousSelection = selections.countries.PT;
const fixture = () => ({
  id: 'lisbon-test', width: 3600, height: 2400, alt_description: 'A tram in Lisbon',
  urls: {raw: 'https://images.unsplash.com/example?ixid=keep-this&ixlib=rb-test'},
  user: {name: 'Test Photographer', links: {html: 'https://unsplash.com/@test'}},
  links: {html: 'https://unsplash.com/photos/lisbon-test', download_location: 'https://api.unsplash.com/photos/lisbon-test/download'},
});
afterEach(() => {
  mock.restoreAll();
  configureRequestBudget(Infinity);
  if (previousKey === undefined) delete process.env.UNSPLASH_ACCESS_KEY;
  else process.env.UNSPLASH_ACCESS_KEY = previousKey;
  if (previousSelection === undefined) delete selections.countries.PT;
  else selections.countries.PT = previousSelection;
});

describe('Curated Unsplash country photos', () => {
  it('keeps hotlink tracking parameters and provides responsive photos and photographer attribution', () => {
    const photo = formatPhoto(fixture(), country);
    assert.equal(new URL(photo.url).hostname, 'images.unsplash.com');
    assert.equal(new URL(photo.url).searchParams.get('ixid'), 'keep-this');
    assert.match(photo.srcSet, /640w/);
    assert.match(photo.srcSet, /1800w/);
    assert.equal(new URL(photo.photographerUrl).pathname, '/@test');
    assert.equal(new URL(photo.providerUrl).searchParams.get('utm_source'), 'voyouger');
  });
  it('rejects small or portrait images and foreign image hosts', () => {
    assert.throws(() => formatPhoto({...fixture(), width: 800}, country), /landscape/);
    assert.throws(() => formatPhoto({...fixture(), height: 4000}, country), /landscape/);
    assert.throws(() => formatPhoto({...fixture(), urls: {raw: 'https://example.com/image'}}, country), /image address/);
    assert.equal(formatPhoto({...fixture(), height: 4000}, country, {allowPortrait: true}).width, 3600);
    assert.throws(() => formatPhoto({...fixture(), width: 800}, country, {allowPortrait: true}), /1200 pixels/);
  });
  it('searches in one bounded request and uses server-side authentication', async () => {
    process.env.UNSPLASH_ACCESS_KEY = 'test-key';
    const fetch = mock.method(global, 'fetch', async (url, options) => {
      assert.equal(url.origin, 'https://api.unsplash.com');
      assert.equal(url.searchParams.get('orientation'), 'landscape');
      assert.equal(options.headers.Authorization, 'Client-ID test-key');
      assert.ok(options.signal);
      return Response.json({results: [fixture()]});
    });
    assert.equal((await searchPhotos('Lisbon Portugal'))[0].id, 'lisbon-test');
    assert.equal(fetch.mock.callCount(), 1);
  });
  it('tracks a selection before returning it for storage', async () => {
    process.env.UNSPLASH_ACCESS_KEY = 'test-key';
    const paths = [];
    mock.method(global, 'fetch', async url => {
      paths.push(url.pathname);
      return Response.json(paths.length === 1 ? fixture() : {url: 'unused-download-url'});
    });
    assert.equal((await selectPhoto('lisbon-test', country)).id, 'lisbon-test');
    assert.deepEqual(paths, ['/photos/lisbon-test', '/photos/lisbon-test/download']);
  });
  it('does not send credentials to a foreign tracking endpoint', async () => {
    process.env.UNSPLASH_ACCESS_KEY = 'test-key';
    const photo = fixture();
    photo.links.download_location = 'https://example.com/photos/lisbon-test/download';
    const fetch = mock.method(global, 'fetch', async () => Response.json(photo));
    await assert.rejects(selectPhoto('lisbon-test', country), /tracking address/);
    assert.equal(fetch.mock.callCount(), 1);
  });
  it('reports quota and timeout errors without hidden retries or returning a selection', async () => {
    process.env.UNSPLASH_ACCESS_KEY = 'test-key';
    const fetch = mock.method(global, 'fetch', async () => new Response('', {status: 403, headers: {'x-ratelimit-remaining': '0'}}));
    await assert.rejects(selectPhoto('lisbon-test', country), /allowance exhausted/);
    assert.equal(fetch.mock.callCount(), 1);
    configureRequestBudget(Infinity);
    fetch.mock.mockImplementation(async () => {throw new DOMException('secret-free timeout', 'TimeoutError');});
    await assert.rejects(selectPhoto('lisbon-test', country), /timed out/);
    assert.equal(fetch.mock.callCount(), 2);
  });
  it('returns curated detail photos with a fallback and keeps browsing independent of the provider', () => {
    selections.countries.PT = formatPhoto(fixture(), country);
    mock.method(global, 'fetch', () => assert.fail('Browsing must not call Unsplash'));
    const details = info.countryDetails('PT');
    assert.equal(details.photo.id, 'lisbon-test');
    assert.equal(details.imageUrl, details.photo.url);
    assert.deepEqual(details.fallbackPhoto, display.countries.PT.photo);
    const savedKz = selections.countries.KZ;
    delete selections.countries.KZ;
    let untouched;
    try {untouched = info.countryDetails('KZ');} finally {
      if (savedKz !== undefined) selections.countries.KZ = savedKz;
    }
    assert.deepEqual(untouched.photo, display.countries.KZ.photo);
    assert.equal(untouched.fallbackPhoto, null);
    // Existing recommendation-card images remain unchanged; Unsplash is used in the country panel.
    assert.deepEqual(info.listCountries().find(item => item.countryCode === 'PT').photo, display.countries.PT.photo);
  });
  it('stops before exceeding the configured budget or provider allowance', async () => {
    process.env.UNSPLASH_ACCESS_KEY = 'test-key';
    configureRequestBudget(1);
    const fetch = mock.method(global, 'fetch', async () => Response.json({results: []}));
    await searchPhotos('Portugal');
    await assert.rejects(searchPhotos('Japan'), error => error.code === 'UNSPLASH_LIMIT');
    assert.equal(fetch.mock.callCount(), 1);
    assert.equal(requestUsage().requestsMade, 1);
    configureRequestBudget(45);
    fetch.mock.mockImplementation(async () => Response.json({results: []}, {headers: {'x-ratelimit-remaining': '0'}}));
    await searchPhotos('Portugal');
    await assert.rejects(searchPhotos('Japan'), error => error.code === 'UNSPLASH_LIMIT');
    assert.equal(fetch.mock.callCount(), 2);
  });
});

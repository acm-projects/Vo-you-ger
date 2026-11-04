const {it} = require('node:test');
const assert = require('node:assert/strict');
const {saveGlobeTrip} = require('../scripts/save-globe-trip');

it('saves a generated trip for the existing account without modifying its assessment', async () => {
  const paths = [];
  const messages = [];
  const result = await saveGlobeTrip({email: 'existing@example.test', password: 'private-password', choice: 2,
    log: value => messages.push(value),
    request: async (token, method, path, body) => {
      paths.push(`${method} ${path}`);
      if (path === '/auth/login') {
        assert.equal(token, null);
        assert.deepEqual(body, {email: 'existing@example.test', password: 'private-password'});
        return {token: 'private-token', user: {id: 'existing-owner'}};
      }
      assert.equal(token, 'private-token');
      if (path === '/recommendations') {
        assert.equal(body.quiz.minNights, 3);
        return {trip: {tripId: 'draft', recommendations: ['Canada', 'Portugal', 'Japan'].map(name => ({name, destinationId: name}))}};
      }
      if (path === '/trips/draft/route') {
        assert.equal(body.countryId, 'Portugal');
        return {outline: {stops: [{name: 'Porto', nights: 3}]}};
      }
      if (path === '/itinerary/draft') return {trip: {tripId: 'generated'}, itinerary: {days: [{}, {}, {}, {}], tripTitle: 'Sample Portugal', narrativeSource: 'gemini'}};
      if (path === '/trips/generated/save') return {trip: {tripId: 'generated', isSaved: true}};
      if (path === '/trips/globe') return {countries: [{trips: [{tripId: 'generated', startCity: 'Porto', pin: {lat: 41, lng: -8}}]}]};
      assert.fail(`Unexpected endpoint ${path}`);
    },
  });
  assert.equal(result.tripId, 'generated');
  assert.deepEqual(paths, ['POST /auth/login', 'POST /recommendations', 'POST /trips/draft/route', 'POST /itinerary/draft', 'PUT /trips/generated/save', 'GET /trips/globe']);
  assert.ok(!messages.join('\n').includes('private-password'));
  assert.ok(!messages.join('\n').includes('private-token'));
});

it('stops on login failure without creating or saving a trip', async () => {
  let requests = 0;
  await assert.rejects(saveGlobeTrip({email: 'wrong@example.test', password: 'wrong', log: () => {}, request: async () => {
    requests++;
    throw new Error('Invalid email or password');
  }}), /Invalid email or password/);
  assert.equal(requests, 1);
});

it('requests variety and saves seven days across two overnight bases', async () => {
  const outline = {stops: [{destinationId: 'porto-pt', name: 'Porto', nights: 3}, {destinationId: 'lisbon-pt', name: 'Lisbon', nights: 3}]};
  const paths = [];
  const result = await saveGlobeTrip({email: 'existing@example.test', password: 'secret', multiCity: true, log: () => {},
    request: async (token, method, path, body) => {
      paths.push(path);
      if (path === '/auth/login') return {token: 'private-token', user: {id: 'existing-owner'}};
      if (path === '/recommendations') {
        assert.equal(body.quiz.minNights, 6);
        assert.equal(body.quiz.maxNights, 6);
        assert.equal(body.quiz.seeAllOrDeeply, 'seeAll');
        assert.equal(body.quiz.travelAlterEgo, 'Explorer');
        return {trip: {tripId: 'draft', recommendations: [1, 2, 3].map(() => ({name: 'Portugal', destinationId: 'country-pt'}))}};
      }
      if (path === '/trips/draft/route') {
        assert.equal(body.numberOfNights, 6);
        return {outline};
      }
      if (path === '/itinerary/draft') return {trip: {tripId: 'new-trip'}, itinerary: {outline, days: Array.from({length: 7}, () => ({}))}};
      if (path === '/trips/new-trip/save') return {trip: {tripId: 'new-trip', isSaved: true}};
      if (path === '/trips/globe') return {countries: [{trips: [{tripId: 'new-trip', pin: {lat: 41, lng: -8}, baseNames: ['Porto', 'Lisbon']}]}]};
      assert.fail(`Unexpected endpoint ${path}`);
    },
  });
  assert.equal(result.tripId, 'new-trip');
  assert.ok(paths.includes('/trips/new-trip/save'));
});

it('stops before generation if the multi-city preview has only one base', async () => {
  const paths = [];
  await assert.rejects(saveGlobeTrip({email: 'existing@example.test', password: 'secret', multiCity: true, log: () => {},
    request: async (token, method, path) => {
      paths.push(path);
      if (path === '/auth/login') return {token: 'token', user: {id: 'owner'}};
      if (path === '/recommendations') return {trip: {tripId: 'draft', recommendations: [1, 2, 3].map(() => ({name: 'Portugal', destinationId: 'country-pt'}))}};
      if (path === '/trips/draft/route') return {outline: {stops: [{destinationId: 'porto-pt', name: 'Porto', nights: 6}]}};
      assert.fail('Generation and saving should not happen.');
    },
  }), /at least two distinct overnight bases/);
  assert.equal(paths.length, 3);
});

it('selects a European multi-city route using the real catalog and leaves profile preferences untouched', async () => {
  const {rankCountries} = require('../services/countryScoringService');
  const {buildOutline} = require('../services/tripOutlineService');
  const countryInfo = require('../data/countryInfo.json').countries;
  let quiz, outline, selectedCode;
  await saveGlobeTrip({email: 'existing@example.test', password: 'secret', multiCity: true, europe: true, log: () => {},
    request: async (token, method, path, body) => {
      if (path === '/auth/login') return {token: 'token', user: {id: 'owner'}};
      if (path === '/recommendations') {
        quiz = body.quiz;
        assert.ok(quiz.preferredCountries.includes('Portugal'));
        const recommendations = rankCountries(quiz).slice(0, 3).map(country => ({
          name: country.name, countryCode: country.countryCode, destinationId: country.id,
        }));
        return {trip: {tripId: 'draft', recommendations}};
      }
      if (path === '/trips/draft/route') {
        outline = buildOutline({...body, quiz});
        selectedCode = outline.countryCode;
        assert.equal(countryInfo[selectedCode].continent, 'Europe');
        assert.ok(outline.stops.length >= 2);
        return {outline};
      }
      if (path === '/itinerary/draft') return {trip: {tripId: 'european-trip'}, itinerary: {outline, days: Array.from({length: 7}, () => ({}))}};
      if (path === '/trips/european-trip/save') return {trip: {tripId: 'european-trip', isSaved: true}};
      if (path === '/trips/globe') return {countries: [{trips: [{tripId: 'european-trip', pin: {lat: 41, lng: -8}, baseNames: outline.stops.map(stop => stop.name)}]}]};
      assert.fail(`Unexpected endpoint ${path}`);
    },
  });
});

it('does not generate outside Europe when none of the recommendations are European', async () => {
  const paths = [];
  await assert.rejects(saveGlobeTrip({email: 'existing@example.test', password: 'secret', europe: true, multiCity: true, log: () => {},
    request: async (token, method, path) => {
      paths.push(path);
      if (path === '/auth/login') return {token: 'token', user: {id: 'owner'}};
      if (path === '/recommendations') return {trip: {tripId: 'draft', recommendations: ['CA', 'JP', 'US'].map(countryCode => ({name: countryCode, countryCode, destinationId: `country-${countryCode.toLowerCase()}`}))}};
      assert.fail('A non-European route must not be generated.');
    },
  }), /No European match/);
  assert.equal(paths.length, 2);
});

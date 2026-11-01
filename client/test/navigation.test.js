import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clearPlanningSession, itineraryUrl, loginDestination, paths, readRoute } from '../src/services/navigation.js';

test('signup and unfinished assessments lead to the assessment; returning users reach the globe', () => {
  assert.equal(loginDestination({isSignup:true,firstTime:false}),paths.assessment);
  assert.equal(loginDestination({isSignup:false,firstTime:true}),paths.assessment);
  assert.equal(loginDestination({isSignup:false,firstTime:false}),paths.globe);
});

test('Back/Forward route parsing distinguishes the globe, picks, and two loading operations', () => {
  assert.deepEqual(readRoute('?page=trips'),{page:'trips',mode:'recommendations'});
  assert.deepEqual(readRoute('?page=recommendations'),{page:'recommendations',mode:'recommendations'});
  assert.deepEqual(readRoute('?page=loading&mode=itinerary'),{page:'loading',mode:'itinerary'});
  assert.deepEqual(readRoute('?page=loading'),{page:'loading',mode:'recommendations'});
  assert.deepEqual(readRoute('?page=unknown&mode=unknown'),{page:'home',mode:'recommendations'});
});

test('switching accounts and logging out remove old planning data without clearing unrelated settings', () => {
  const storage = new Map([
    ['voyager_recommendations','old picks'],['voyager_trip','old trip'],
    ['voyager_itinerary','old plan'],['selectedDestination','old selection'],
    ['currentTripId','old id'],['unrelatedPreference','keep'],
  ]);
  clearPlanningSession({removeItem:key=>storage.delete(key)});
  assert.deepEqual([...storage],[['unrelatedPreference','keep']]);
});

test('itinerary links carry the exact returned trip identifier and reject a missing one', () => {
  const id='trip/with spaces&another=value';
  const url=new URL(itineraryUrl(id),'http://localhost');
  assert.equal(url.pathname,'/ItineraryNew/itenNew.html');
  assert.equal(url.searchParams.get('tripId'),id);
  assert.equal(url.searchParams.has('another'),false);
  assert.throws(()=>itineraryUrl(null),/No trip was returned/);
});

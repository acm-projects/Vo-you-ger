import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clearPlanningSession, countryPlanningUrl, itineraryUrl, loginDestination, paths, readRoute, safePlanningReturn, withPlanningReturn } from '../src/services/navigation.js';

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
  assert.equal(url.pathname,'/ItineraryFinal/itenF.html');
  assert.equal(url.searchParams.get('tripId'),id);
  assert.equal(url.searchParams.has('another'),false);
  assert.throws(()=>itineraryUrl(null),/No trip was returned/);
});

test('country planning routes retain the selected country and validate its identifier', () => {
  assert.equal(countryPlanningUrl('pt'),'/?page=plan&country=PT');
  assert.deepEqual(readRoute('?page=plan&country=pt'),{page:'plan',mode:'recommendations',countryCode:'PT'});
  for(const code of [null,'Portugal','PT&country=ES','']) assert.throws(()=>countryPlanningUrl(code));
  assert.equal(readRoute('?page=plan&country=invalid').countryCode,null);
});

test('country selection survives sign-in and required assessment without permitting external redirects', () => {
  const selected=countryPlanningUrl('ES');
  assert.equal(loginDestination({isSignup:false,firstTime:false,returnTo:selected}),selected);
  const assessment=loginDestination({isSignup:false,firstTime:true,returnTo:selected});
  assert.equal(new URL(assessment,'http://localhost').pathname,paths.assessment);
  assert.equal(new URL(assessment,'http://localhost').searchParams.get('returnTo'),selected);
  assert.equal(loginDestination({isSignup:true,firstTime:false,returnTo:selected}),assessment);
  assert.equal(new URL(withPlanningReturn(paths.login,selected),'http://localhost').searchParams.get('returnTo'),selected);
  assert.equal(safePlanningReturn('/?country=es&page=plan&extra=value'),selected);
  for(const target of ['https://evil.example/?page=plan&country=PT','//evil.example','javascript:alert(1)','/?page=loading&mode=itinerary','/?page=plan&country=PT%26other%3D1']) {
    assert.equal(safePlanningReturn(target),null);
    assert.equal(loginDestination({isSignup:false,firstTime:false,returnTo:target}),paths.globe);
  }
});

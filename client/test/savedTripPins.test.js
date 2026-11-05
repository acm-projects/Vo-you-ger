import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addTripMarkers, globeTrips, tripsAtPin } from '../src/services/savedTripPins.js';

describe('Saved trip pins', () => {
  const first = {tripId: 'first', country: 'Portugal', startCity: 'Porto', pin: {lat: 41.15, lng: -8.61}};
  const second = {...first, tripId: 'second', displayTitle: 'Portugal — July 2028'};

  it('keeps every saved trip, including those without map coordinates', () => {
    const trips = globeTrips({countries: [{countryCode: 'PT', country: 'Portugal', trips: [first, second]}], unmappedTrips: [{tripId: 'unknown'}]});
    assert.equal(trips.length, 3);
    assert.equal(trips[0].countryCode, 'PT');
    assert.deepEqual(tripsAtPin(trips, first).map(trip => trip.tripId), ['first', 'second']);
    assert.equal(globeTrips(null).length, 0);
  });

  it('creates one interactive pin per valid trip and cleans up listeners', () => {
    class Marker extends EventTarget {
      constructor(options) { super(); Object.assign(this, options); }
      remove() { this.removed = true; }
    }
    const children = [];
    const selected = [];
    const markers = addTripMarkers({appendChild: marker => children.push(marker)}, Marker,
      [first, second, {tripId: 'invalid', pin: {lat: 100, lng: 0}}, {tripId: 'missing'}], trip => selected.push(trip.tripId));
    assert.equal(children.length, 2);
    assert.deepEqual(children[0].position, first.pin);
    assert.equal(children[0].drawsWhenOccluded, false);
    const click = new Event('gmp-click', {bubbles: true});
    children[1].dispatchEvent(click);
    assert.deepEqual(selected, ['second']);
    markers.highlight('second');
    assert.equal(children[1].label, 'Porto');
    assert.equal(children[0].label, null);
    markers.remove();
    assert.ok(children.every(marker => marker.removed));
    children[0].dispatchEvent(new Event('gmp-click'));
    assert.deepEqual(selected, ['second']);
  });
});

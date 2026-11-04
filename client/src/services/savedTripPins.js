export function validPin(pin) {
  return Boolean(pin && Number.isFinite(pin.lat) && Math.abs(pin.lat) <= 90 &&
    Number.isFinite(pin.lng) && Math.abs(pin.lng) <= 180);
}

export function globeTrips(data) {
  const seen = new Set();
  return [
    ...(data?.countries || []).flatMap(country => (country.trips || []).map(trip => ({
      ...trip,
      country: trip.country || country.country,
      countryCode: trip.countryCode || country.countryCode,
      pin: trip.pin || country.pin,
    }))),
    ...(data?.unmappedTrips || []),
  ].filter(trip => {
    if (!trip.tripId || seen.has(trip.tripId)) return false;
    seen.add(trip.tripId);
    return true;
  });
}

export function tripLabel(trip) {
  return trip.displayTitle || trip.title || trip.country || 'Saved trip';
}

// Keep identical starting coordinates accurate. The panel lists all trips at
// that point so coincident pins never make an older trip inaccessible.
export function tripsAtPin(trips, selected) {
  if (!validPin(selected.pin)) return [];
  return trips.filter(trip => validPin(trip.pin) && trip.pin.lat === selected.pin.lat && trip.pin.lng === selected.pin.lng);
}

export function addTripMarkers(map, Marker, trips, onSelect) {
  const markers = trips.filter(trip => validPin(trip.pin)).map(trip => {
    const marker = new Marker({
      position: trip.pin,
      title: `${tripLabel(trip)}${trip.startCity ? ` · ${trip.startCity}` : ''}`,
      altitudeMode: 'CLAMP_TO_GROUND',
      sizePreserved: true,
      drawsWhenOccluded: false,
      collisionBehavior: 'REQUIRED',
    });
    function select(event) {
      event.stopPropagation();
      onSelect(trip);
    }
    marker.addEventListener('gmp-click', select);
    map.appendChild(marker);
    return {marker, trip, select};
  });
  return {
    highlight(tripId) {
      for (const {marker, trip} of markers) {
        marker.zIndex = trip.tripId === tripId ? 2 : 1;
        marker.label = trip.tripId === tripId ? trip.startCity || trip.country || 'Saved trip' : null;
      }
    },
    remove() {
      for (const {marker, select} of markers) {
        marker.removeEventListener('gmp-click', select);
        marker.remove();
      }
    },
  };
}

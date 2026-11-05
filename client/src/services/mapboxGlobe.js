import { validPin, tripLabel } from "./savedTripPins.js";

export const COUNTRY_LAYER = "voyouger-country-selection";
export const COUNTRY_SOURCE = "voyouger-countries";
// Use Mapbox's homepage demo basemap at dusk, with hidden labels and transparent space.
export const GLOBE_STYLE = "mapbox://styles/mapbox/standard";
export const GLOBE_BASEMAP_CONFIG = {
  lightPreset: "dusk",
  showPlaceLabels: false,
  showPointOfInterestLabels: false,
  showRoadLabels: false,
  showTransitLabels: false,
  showLandmarkIcons: false,
  showLandmarkIconLabels: false,
  showIndoorLabels: false,
};

export function countryFromFeature(feature) {
  if (!feature) return null;
  const properties = feature.properties || {};
  const countryCode = [properties.ISO_A2_EH, properties.ISO_A2]
    .find(code => /^[A-Z]{2}$/.test(code || ""));
  return {name: properties.ADMIN || properties.NAME, countryCode: countryCode || null};
}

export function configureGlobeStyle(map, countries) {
  map.setProjection("globe");
  // Preserve the native atmosphere while removing the opaque sky and stars.
  map.setFog({...map.getFog(), "space-color": "rgba(0,0,0,0)", "star-intensity": 0});
  // Leave the basemap's colors, borders, and 3D features intact.
  // This transparent interaction layer only becomes visible on country selection.
  map.addSource(COUNTRY_SOURCE, {type: "geojson", data: countries, generateId: true});
  map.addLayer({
    id: COUNTRY_LAYER, type: "fill", source: COUNTRY_SOURCE,
    paint: {
      "fill-color": "#ffffff",
      "fill-opacity": ["case", ["boolean", ["feature-state", "selected"], false], 0.2, 0],
    },
  });
}

export function selectCountry(map, countries, code) {
  if (!map.getSource(COUNTRY_SOURCE)) return;
  countries.features.forEach((feature, id) => {
    const country = countryFromFeature(feature);
    map.setFeatureState({source: COUNTRY_SOURCE, id}, {selected: Boolean(code && country.countryCode === code)});
  });
}

export function addMapboxTripMarkers(map, Marker, trips, onSelect, documentObject = document) {
  const markers = trips.filter(trip => validPin(trip.pin)).map(trip => {
    const element = documentObject.createElement("button");
    element.type = "button";
    element.className = "trip-home__mapbox-pin";
    element.title = `${tripLabel(trip)}${trip.startCity ? ` · ${trip.startCity}` : ""}`;
    element.setAttribute("aria-label", element.title);
    const dot = documentObject.createElement("span");
    dot.className = "trip-home__mapbox-pin-dot";
    dot.setAttribute("aria-hidden", "true");
    const label = documentObject.createElement("span");
    label.className = "trip-home__mapbox-pin-label";
    label.textContent = trip.startCity || trip.country || "Saved trip";
    label.hidden = true;
    element.append(dot, label);
    function select(event) {
      event.stopPropagation();
      onSelect(trip);
    }
    element.addEventListener("click", select);
    const marker = new Marker({element, anchor: "bottom", occludedOpacity: 0,
      rotationAlignment: "viewport", pitchAlignment: "viewport"})
      .setLngLat([trip.pin.lng, trip.pin.lat]).addTo(map);
    return {marker, element, label, trip, select};
  });
  return {
    highlight(tripId) {
      for (const {element, label, trip} of markers) {
        const selected = trip.tripId === tripId;
        element.setAttribute("aria-pressed", String(selected));
        element.style.zIndex = selected ? "2" : "1";
        label.hidden = !selected;
      }
    },
    remove() {
      for (const {marker, element, select} of markers) {
        element.removeEventListener("click", select);
        marker.remove();
      }
    },
  };
}

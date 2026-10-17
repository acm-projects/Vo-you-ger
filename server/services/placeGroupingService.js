
const ACTIVITY_CATEGORIES = [
  "attractions",
  "food",
  "experiences",
];

const DEFAULT_RADIUS_KM = 2.5;

// Calculate straight-line distance between two locations.
function distanceKm(a, b) {
  const R = 6371;
  const toRadians = (degrees) => degrees * Math.PI / 180;

  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);

  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) *
    Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function isValidLocation(place) {
  return Number.isFinite(place?.lat) &&
    Number.isFinite(place?.lng) &&
    place.lat >= -90 &&
    place.lat <= 90 &&
    place.lng >= -180 &&
    place.lng <= 180;
}

function calculateCenter(places) {
  return {
    lat:
      places.reduce((sum, p) => sum + p.lat, 0) /
      places.length,
    lng:
      places.reduce((sum, p) => sum + p.lng, 0) /
      places.length,
  };
}

function groupPlacesByGeography(
  normalizedPlaces,
  options = {}
) {
  const {
    radiusKm = DEFAULT_RADIUS_KM,
    transportModes = [],
  } = options;

  if (!Number.isFinite(radiusKm) || radiusKm <= 0) {
    throw new Error("radiusKm must be positive");
  }

  // Only itinerary activities are grouped.
  // Hotels are no longer part of the pipeline.
  const activities = ACTIVITY_CATEGORIES.flatMap(
    (category) => normalizedPlaces?.[category] || []
  );

  const groups = [];
  const seen = new Set();

  for (const place of activities) {
    if (!isValidLocation(place)) continue;

    if (place.placeId && seen.has(place.placeId)) {
      continue;
    }

    if (place.placeId) seen.add(place.placeId);

    const neighborhood =
      typeof place.neighborhood === "string"
        ? place.neighborhood.trim() || null
        : null;

    const candidates = groups
      .map((group, index) => {
        const center = calculateCenter(group.places);
        const distance = distanceKm(place, center);

        const sameNeighborhood =
          neighborhood &&
          group.neighborhood &&
          neighborhood.toLowerCase() ===
            group.neighborhood.toLowerCase();

        const compatibleNeighborhood =
          !neighborhood ||
          !group.neighborhood ||
          sameNeighborhood;

        return {
          index,
          distance,
          compatibleNeighborhood,
        };
      })
      .filter(
        (candidate) =>
          candidate.compatibleNeighborhood &&
          candidate.distance <= radiusKm
      )
      .sort((a, b) => a.distance - b.distance);

    if (candidates.length > 0) {
      const group = groups[candidates[0].index];

      group.places.push(place);

      // Assign a known neighborhood to a group
      // that previously contained unnamed locations.
      if (!group.neighborhood && neighborhood) {
        group.neighborhood = neighborhood;
      }
    } else {
      groups.push({
        neighborhood,
        places: [place],
      });
    }
  }

  return {
    groups: groups.map((group, index) => ({
      groupId: `area-${index + 1}`,
      name:
        group.neighborhood ||
        `Geographic Area ${index + 1}`,
      neighborhood: group.neighborhood,
      center: calculateCenter(group.places),
      places: group.places,
      placeCount: group.places.length,
    })),
    transportModes: [...transportModes],
    distanceMethod: "haversine_straight_line",
    groupingRadiusKm: radiusKm,
  };
}

module.exports = {
  distanceKm,
  groupPlacesByGeography,
};

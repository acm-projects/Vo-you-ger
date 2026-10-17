
const {
  distanceKm,
} = require("./placeGroupingService");

const ACTIVITY_CATEGORIES = [
  "attractions",
  "food",
  "experiences",
];

function isValidLocation(place) {
  return (
    Number.isFinite(place?.lat) &&
    Number.isFinite(place?.lng) &&
    place.lat >= -90 &&
    place.lat <= 90 &&
    place.lng >= -180 &&
    place.lng <= 180
  );
}

function recommendNeighborhoods(
  normalizedPlaces,
  options = {}
) {
  const {
    limit = 3,
    nearbyRadiusKm = 2.5,
    closeRadiusKm = 1.0,
  } = options;

  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("limit must be a positive integer");
  }

  if (
    !Number.isFinite(nearbyRadiusKm) ||
    nearbyRadiusKm <= 0
  ) {
    throw new Error("nearbyRadiusKm must be positive");
  }

  if (
    !Number.isFinite(closeRadiusKm) ||
    closeRadiusKm <= 0 ||
    closeRadiusKm > nearbyRadiusKm
  ) {
    throw new Error(
      "closeRadiusKm must be positive and no greater than nearbyRadiusKm"
    );
  }

  const seen = new Set();

  const activities = ACTIVITY_CATEGORIES
    .flatMap(
      category => normalizedPlaces?.[category] || []
    )
    .filter(place => {
      if (!isValidLocation(place)) return false;

      if (place.placeId) {
        if (seen.has(place.placeId)) return false;
        seen.add(place.placeId);
      }

      return true;
    });

  const candidates = new Map();

  for (const place of activities) {
    const name =
      typeof place.neighborhood === "string"
        ? place.neighborhood.trim()
        : "";

    if (!name) continue;

    const key = name.toLocaleLowerCase();

    if (!candidates.has(key)) {
      candidates.set(key, {
        name,
        places: [],
        areaGranularity:
          place.areaGranularity || "unknown",
      });
    }

    const candidate = candidates.get(key);

    candidate.places.push(place);

    // Prefer a specific neighborhood classification
    // if the same area has mixed metadata.
    if (place.areaGranularity === "neighborhood") {
      candidate.areaGranularity = "neighborhood";
    } else if (
      candidate.areaGranularity === "unknown" &&
      place.areaGranularity === "district"
    ) {
      candidate.areaGranularity = "district";
    }
  }

  const recommendations = [];

  for (const candidate of candidates.values()) {
    // Approximate activity center, not an official
    // district center or verified hotel location.
    const center = {
      lat:
        candidate.places.reduce(
          (sum, place) => sum + place.lat,
          0
        ) / candidate.places.length,

      lng:
        candidate.places.reduce(
          (sum, place) => sum + place.lng,
          0
        ) / candidate.places.length,
    };

    const distances = activities
      .map(place => ({
        place,
        distanceKm: distanceKm(center, place),
      }))
      .sort(
        (a, b) => a.distanceKm - b.distanceKm
      );

    const nearby = distances.filter(
      item => item.distanceKm <= nearbyRadiusKm
    );

    const close = distances.filter(
      item => item.distanceKm <= closeRadiusKm
    );

    const averageDistanceKm =
      distances.length > 0
        ? distances.reduce(
            (sum, item) => sum + item.distanceKm,
            0
          ) / distances.length
        : 0;

    recommendations.push({
      name: candidate.name,

      areaGranularity:
        candidate.areaGranularity,

      center,

      // Activities labeled as belonging to this area.
      activitiesInAreaCount:
        candidate.places.length,

      // Activities within the tighter radius.
      closeActivityCount: close.length,

      // Existing nearby metric.
      nearbyActivityCount: nearby.length,

      totalActivityCount: activities.length,

      averageDistanceKm:
        Number(averageDistanceKm.toFixed(2)),

      nearbyActivities: nearby.map(item => ({
        placeId: item.place.placeId,
        name: item.place.name,
        category: item.place.category,
        distanceKm:
          Number(item.distanceKm.toFixed(2)),
      })),

      distanceMethod:
        "haversine_straight_line",

      closeRadiusKm,
      nearbyRadiusKm,
    });
  }

  // Prioritize overall proximity to the itinerary,
  // then use activity density to distinguish areas.
  recommendations.sort((a, b) =>
    a.averageDistanceKm - b.averageDistanceKm ||
    b.closeActivityCount - a.closeActivityCount ||
    b.activitiesInAreaCount - a.activitiesInAreaCount ||
    a.name.localeCompare(b.name)
  );

  return recommendations.slice(0, limit);
}

module.exports = {
  recommendNeighborhoods,
};

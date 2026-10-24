
const CATEGORIES = [
  "attractions",
  "food",
  "experiences",
];

function extractArea(place) {
  const components = Array.isArray(place?.addressComponents)
    ? place.addressComponents
    : [];

  const preferredTypes = [
    "neighborhood",
    "sublocality_level_4",
    "sublocality_level_3",
    "sublocality_level_2",
    "sublocality_level_1",
  ];

  for (const type of preferredTypes) {
    const match = components.find(
      (part) =>
        Array.isArray(part.types) &&
        part.types.includes(type) &&
        typeof part.longText === "string" &&
        part.longText.trim()
    );

    if (match) {
      return {
        name: match.longText.trim(),
        type,
        granularity:
          type === "sublocality_level_1"
            ? "district"
            : "neighborhood",
      };
    }
  }

  return null;
}

function extractNeighborhood(place) {
  return extractArea(place)?.name || null;
}

function normalizePlace(place, category) {
  if (!CATEGORIES.includes(category)) {
    throw new Error(`Unknown category: ${category}`);
  }

  if (place?.businessStatus === "CLOSED_PERMANENTLY" || !place?.id || !place?.displayName?.text) {
    return null;
  }

  const foodTypes = /restaurant|cafe|coffee_shop|bakery|bar$|food|meal_takeaway|ice_cream_shop/;
  if (category === 'food' && place.types?.length && !place.types.some(type => foodTypes.test(type))) return null;
  if (category === 'attractions' && foodTypes.test(place.primaryType || '')) return null;

  const lat = place.location?.latitude;
  const lng = place.location?.longitude;

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }

  const area = extractArea(place);

  return {
    placeId: place.id,
    name: place.displayName.text,
    category,
    types: Array.isArray(place.types) ? place.types : [],
    primaryType: place.primaryType || null,
    address: place.formattedAddress || null,
    countryCode: place.addressComponents?.find((part) => part.types?.includes("country"))?.shortText || null,

    // Keep the existing property name for compatibility
    // with grouping and recommendation services.
    neighborhood: area?.name || null,

    // Additional metadata distinguishes a broader district
    // from a more specific neighborhood.
    areaType: area?.type || null,
    areaGranularity: area?.granularity || null,

    lat,
    lng,
    rating: place.rating ?? null,
    priceLevel: place.priceLevel ?? null,
    attributions: place.attributions || [],
    openingHours:
      place.regularOpeningHours?.weekdayDescriptions ?? null,
    openingPeriods: place.regularOpeningHours?.periods ?? null,
    typicalTimeSpent: null,
  };
}

function normalizePlaces(groupedPlaces) {
  const normalized = {};
  const seen = new Set();

  for (const category of CATEGORIES) {
    normalized[category] = [];

    for (const rawPlace of groupedPlaces?.[category] || []) {
      const place = normalizePlace(rawPlace, category);

      if (!place || seen.has(place.placeId)) {
        continue;
      }

      seen.add(place.placeId);
      normalized[category].push(place);
    }
  }

  return normalized;
}

module.exports = {
  normalizePlace,
  normalizePlaces,
  extractNeighborhood,
  extractArea,
};

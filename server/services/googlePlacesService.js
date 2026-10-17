
const PLACES_URL =
  "https://places.googleapis.com/v1/places:searchText";


const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.addressComponents",
  "places.regularOpeningHours",
  "places.rating",
  "places.priceLevel",
].join(",");


async function searchPlaces(query, options = {}) {
  if (typeof query !== "string" || !query.trim()) {
    throw new Error("A valid Google Places search query is required");
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    throw new Error("GOOGLE_PLACES_API_KEY is missing");
  }

  const { pageSize = 10 } = options;

  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 20) {
    throw new Error("pageSize must be between 1 and 20");
  }

  const response = await fetch(PLACES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({
      textQuery: query.trim(),
      pageSize,
    }),
    signal: AbortSignal.timeout(15000),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `Google Places API (${response.status}): ` +
      (data.error?.message || "Unknown error")
    );
  }

  return data.places || [];
}

async function searchPlacesForQueries(queries, destination, options = {}) {
  for (const category of [
    "attractions",
    "food",
    "experiences",
  ]) {
    if (typeof queries?.[category] !== "string" ||
        !queries[category].trim()) {
      throw new Error(`Missing search query: ${category}`);
    }
  }

  if (!destination?.name || !destination?.country) {
    throw new Error("Destination name and country are required");
  }

  // Only search for places that will be used in the itinerary.
  // Accommodation neighborhoods will be recommended separately
  // based on the locations of these activities.
  const searchRequests = {
    attractions: queries.attractions,
    food: queries.food,
    experiences: queries.experiences,
  };

  const { pageSize = 10 } = options;

  // sequential requests are easier to debug and stay within usage limits.
  const results = {};

  for (const [category, query] of Object.entries(searchRequests)) {
    results[category] = await searchPlaces(query, {
      pageSize,
    });
  }

  return {
    queries: searchRequests,
    places: results,
  };
}

module.exports = {
  searchPlaces,
  searchPlacesForQueries,
};

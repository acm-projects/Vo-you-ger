
const assert = require("node:assert/strict");

const {
  recommendNeighborhoods,
} = require("../services/neighborhoodRecommendationService");

console.log("\n=== NEIGHBORHOOD RECOMMENDATION TEST ===\n");

// Synthetic test data inspired by Tokyo.
// Coordinates are test inputs, not official
// neighborhood boundaries.
const places = {
  attractions: [
    {
      placeId: "a1",
      name: "Shibuya Attraction",
      category: "attractions",
      neighborhood: "Shibuya",
      lat: 35.659,
      lng: 139.701,
    },
    {
      placeId: "a2",
      name: "Shibuya Observation Deck",
      category: "attractions",
      neighborhood: "Shibuya",
      lat: 35.660,
      lng: 139.702,
    },
    {
      placeId: "a3",
      name: "Roppongi Attraction",
      category: "attractions",
      neighborhood: "Roppongi",
      lat: 35.663,
      lng: 139.731,
    },
  ],

  food: [
    {
      placeId: "f1",
      name: "Shibuya Restaurant",
      category: "food",
      neighborhood: "Shibuya",
      lat: 35.661,
      lng: 139.703,
    },
    {
      placeId: "f2",
      name: "Roppongi Restaurant",
      category: "food",
      neighborhood: "Roppongi",
      lat: 35.664,
      lng: 139.732,
    },
  ],

  experiences: [
    {
      placeId: "e1",
      name: "Shibuya Experience",
      category: "experiences",
      neighborhood: "Shibuya",
      lat: 35.662,
      lng: 139.704,
    },
  ],
};

const recommendations = recommendNeighborhoods(places, {
  limit: 3,
  nearbyRadiusKm: 2.5,
});

console.log(JSON.stringify(recommendations, null, 2));

// Test 1: Recommendations are returned as an array.
assert.ok(Array.isArray(recommendations));

// Test 2: Both named neighborhoods are represented.
assert.equal(recommendations.length, 2);

// Test 3: Shibuya ranks first because more
// activities are concentrated nearby.
assert.equal(recommendations[0].name, "Shibuya");

// Test 4: Recommendations contain geographic data.
for (const neighborhood of recommendations) {
  assert.ok(Number.isFinite(neighborhood.center.lat));
  assert.ok(Number.isFinite(neighborhood.center.lng));

  assert.ok(neighborhood.averageDistanceKm >= 0);
  assert.ok(neighborhood.nearbyActivityCount > 0);

  assert.equal(
    neighborhood.distanceMethod,
    "haversine_straight_line"
  );
}

// Test 5: Duplicate places do not inflate counts.
const duplicateResults = recommendNeighborhoods({
  attractions: [places.attractions[0], places.attractions[0]],
  food: [],
  experiences: [],
});

assert.equal(duplicateResults.length, 1);
assert.equal(duplicateResults[0].totalActivityCount, 1);

// Test 6: Missing neighborhood names are not invented.
const unnamedResults = recommendNeighborhoods({
  attractions: [{
    placeId: "unknown",
    name: "Unknown Area Attraction",
    category: "attractions",
    neighborhood: null,
    lat: 35.67,
    lng: 139.72,
  }],
  food: [],
  experiences: [],
});

assert.deepEqual(unnamedResults, []);

// Test 7: Empty activity lists are handled.
assert.deepEqual(
  recommendNeighborhoods({
    attractions: [],
    food: [],
    experiences: [],
  }),
  []
);

// Test 8: Invalid settings are rejected.
assert.throws(
  () => recommendNeighborhoods(places, { limit: 0 }),
  /limit must be a positive integer/
);

assert.throws(
  () => recommendNeighborhoods(places, {
    nearbyRadiusKm: -2,
  }),
  /nearbyRadiusKm must be positive/
);

// Test 9: No hotel recommendations are returned.
assert.equal(
  recommendations.some(item => "hotels" in item),
  false
);

console.log("\nFINAL RESULT: PASS");

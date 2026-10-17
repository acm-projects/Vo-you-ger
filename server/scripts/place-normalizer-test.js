
const assert = require("node:assert/strict");

const {
  normalizePlaces,
} = require("../services/placeNormalizer");

const tokyoTower = {
  id: "ChIJCewJkL2LGGAR3Qmk0vCTGkg",
  displayName: { text: "Tokyo Tower" },
  formattedAddress:
    "4-chōme-2-8 Shibakōen, Minato City, Tokyo, Japan",
  location: {
    latitude: 35.6585805,
    longitude: 139.7454329,
  },
  addressComponents: [
    {
      longText: "Minato City",
      types: ["locality"],
    },
  ],
  photos: [{ name: "unnecessary-photo-data" }],
  reviews: [{ text: "unnecessary-review-data" }],
};

const roppongiPlace = {
  id: "test-roppongi-place",
  displayName: { text: "Roppongi Test Attraction" },
  formattedAddress: "Roppongi, Minato City, Tokyo, Japan",
  location: {
    latitude: 35.6627,
    longitude: 139.7314,
  },
  addressComponents: [
    {
      longText: "Roppongi",
      types: ["neighborhood"],
    },
    {
      longText: "Minato City",
      types: ["locality"],
    },
  ],
};

const results = normalizePlaces({
  attractions: [tokyoTower, tokyoTower, roppongiPlace],
  food: [],
  experiences: [],
});

// Test 1: Duplicate places are removed.
assert.equal(results.attractions.length, 2);

// Test 2: Tokyo Tower is normalized correctly.
const place = results.attractions.find(
  (item) => item.name === "Tokyo Tower"
);

assert.ok(place);

assert.equal(place.name, "Tokyo Tower");

// Broad administrative areas should not be
// treated as specific neighborhoods.
assert.equal(place.neighborhood, null);

assert.equal(place.category, "attractions");
assert.equal(place.rating, null);
assert.equal(place.typicalTimeSpent, null);
assert.equal(place.lat, 35.6585805);

// Unnecessary Google Places data is excluded.
assert.equal("photos" in place, false);
assert.equal("reviews" in place, false);

// Test 3: Specific neighborhoods are extracted.
const roppongi = results.attractions.find(
  (item) => item.name === "Roppongi Test Attraction"
);

assert.ok(roppongi);
assert.equal(roppongi.neighborhood, "Roppongi");

// Test 4: Only the three itinerary categories exist.
assert.deepEqual(
  Object.keys(results),
  ["attractions", "food", "experiences"]
);

// Test 5: Hotels are no longer a supported category.
assert.throws(
  () => normalizePlaces({
    attractions: [],
    food: [],
    experiences: [],
    hotels: [],
  }).hotels.length,
  TypeError
);

console.log("\n=== PLACE NORMALIZER TEST ===\n");
console.log(JSON.stringify(results, null, 2));
console.log("\nFINAL RESULT: PASS");

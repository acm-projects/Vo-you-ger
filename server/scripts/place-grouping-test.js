
const assert = require("node:assert/strict");

const {
  distanceKm,
  groupPlacesByGeography,
} = require("../services/placeGroupingService");

console.log("\n=== VOYOUGER GEOGRAPHIC GROUPING TEST ===\n");

// Sample attractions, restaurants, and experiences in Tokyo.
const normalizedPlaces = {
  attractions: [
    {
      placeId: "tokyo-tower",
      name: "Tokyo Tower",
      category: "attractions",
      neighborhood: "Roppongi",
      lat: 35.6585805,
      lng: 139.7454329,
    },
    {
      placeId: "roppongi-hills",
      name: "Roppongi Hills - Tokyo City View",
      category: "attractions",
      neighborhood: "Roppongi",
      lat: 35.6600712,
      lng: 139.7292907,
    },
    {
      placeId: "shibuya-sky",
      name: "Shibuya Sky",
      category: "attractions",
      neighborhood: "Shibuya",
      lat: 35.6586719,
      lng: 139.7019848,
    },
  ],

  food: [
    {
      placeId: "jikasei-mensho",
      name: "Jikasei MENSHO",
      category: "food",
      neighborhood: "Shibuya",
      lat: 35.661,
      lng: 139.702,
    },
    {
      placeId: "vegan-bistro",
      name: "Vegan Bistro Jangara",
      category: "food",
      neighborhood: "Shibuya",
      lat: 35.669713,
      lng: 139.7034628,
    },
  ],

  experiences: [
    {
      placeId: "foodie-adventure",
      name: "Foodie Adventure Japan",
      category: "experiences",
      neighborhood: "Roppongi",
      lat: 35.6716076,
      lng: 139.7401256,
    },
  ],
};

// Generate geographic groups.
const result = groupPlacesByGeography(
  normalizedPlaces,
  {
    radiusKm: 2.5,
    transportModes: ["train"],
  }
);

// Display the grouped locations.
for (const group of result.groups) {
  console.log(
    `\n${group.name} (${group.placeCount} places)`
  );

  for (const place of group.places) {
    console.log(
      `  - ${place.name} [${place.category}]`
    );
  }

  console.log("  Center:", group.center);
}

console.log("\nTransport modes:", result.transportModes);
console.log("Grouping radius:", result.groupingRadiusKm, "km");

// TEST 1: Two geographic groups should be created.
assert.equal(result.groups.length, 2);

// TEST 2: All six activities should be included.
const totalPlaces = result.groups.reduce(
  (sum, group) => sum + group.placeCount,
  0
);

assert.equal(totalPlaces, 6);

// TEST 3: The expected neighborhoods should exist.
const roppongi = result.groups.find(
  (group) => group.neighborhood === "Roppongi"
);

const shibuya = result.groups.find(
  (group) => group.neighborhood === "Shibuya"
);

assert.ok(roppongi);
assert.ok(shibuya);

assert.equal(roppongi.placeCount, 3);
assert.equal(shibuya.placeCount, 3);

// TEST 4: Group centers should have valid coordinates.
for (const group of result.groups) {
  assert.ok(Number.isFinite(group.center.lat));
  assert.ok(Number.isFinite(group.center.lng));

  assert.equal(group.placeCount, group.places.length);
}

// TEST 5: Transportation preferences are preserved.
assert.deepEqual(result.transportModes, ["train"]);

// TEST 6: Grouping settings are preserved.
assert.equal(result.groupingRadiusKm, 2.5);
assert.equal(
  result.distanceMethod,
  "haversine_straight_line"
);

// TEST 7: Hotels must not appear in the output.
assert.equal(Object.hasOwn(result, "hotels"), false);

// TEST 8: Duplicate activities should be removed.
const duplicateResult = groupPlacesByGeography({
  attractions: [
    normalizedPlaces.attractions[0],
    normalizedPlaces.attractions[0],
  ],
  food: [],
  experiences: [],
});

assert.equal(duplicateResult.groups.length, 1);
assert.equal(duplicateResult.groups[0].placeCount, 1);

// TEST 9: Distance calculations should work.
const zeroDistance = distanceKm(
  { lat: 35.66, lng: 139.73 },
  { lat: 35.66, lng: 139.73 }
);

assert.equal(zeroDistance, 0);

const positiveDistance = distanceKm(
  { lat: 35.66, lng: 139.73 },
  { lat: 35.69, lng: 139.70 }
);

assert.ok(positiveDistance > 0);

// TEST 10: Invalid radius should be rejected.
assert.throws(
  () =>
    groupPlacesByGeography(normalizedPlaces, {
      radiusKm: -1,
    }),
  /radiusKm must be positive/
);

console.log("\nFINAL RESULT: PASS");

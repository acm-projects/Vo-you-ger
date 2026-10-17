
require("dotenv").config();

const {
  buildPlacesQueries,
} = require("../services/placesQueryBuilder");

const {
  searchPlacesForQueries,
} = require("../services/googlePlacesService");

async function main() {
  console.log("\n=== VOYOUGER PLACES SEARCH TEST ===\n");

  const destination = {
    name: "Tokyo",
    country: "Japan",
  };

  const quiz = {
    dailyBudget: "$$",
    travelAlterEgo: "Foodie",
    dietaryRestrictions: ["Vegetarian"],
    minNights: 5,
    maxNights: 7,
    transportModes: ["train"],
    favoriteView: "City skyline at night",
  };

  // Step 1: Gemini creates three personalized queries
  const generated = await buildPlacesQueries({
    destination,
    quiz,
  });

  console.log("Gemini generated search queries:");
  console.log(generated.queries);

  // Step 2: Google Places searches for real locations
  const result = await searchPlacesForQueries(
    generated.queries,
    destination
  );

  console.log("\n=== GOOGLE PLACES RESULTS ===");

  for (const [category, places] of Object.entries(result.places)) {
    console.log(`\n${category.toUpperCase()} (${places.length})`);

    for (const place of places) {
      console.log({
        name: place.displayName?.text,
        placeId: place.id,
        address: place.formattedAddress,
        lat: place.location?.latitude,
        lng: place.location?.longitude,
      });
    }
  }

  // Step 3: Verify that only the three required categories exist
  const allCategories = [
    "attractions",
    "food",
    "experiences",
  ];

  const returnedCategories = Object.keys(result.places);

  const passed =
    returnedCategories.length === allCategories.length &&
    allCategories.every(
      category =>
        Array.isArray(result.places[category]) &&
        result.places[category].length > 0
    );

  console.log(
    "\nFINAL RESULT:",
    passed ? "PASS" : "FAIL"
  );

  if (!passed) {
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error("TEST FAILED:", error.message);
  process.exitCode = 1;
});


require("dotenv").config();

const {
  buildPlacesQueries,
} = require("../services/placesQueryBuilder");

async function main() {
  console.log("\n=== VOYOUGER QUERY GENERATION TEST ===\n");

  // Simulated destination selected from the three recommendations
  const destination = {
    name: "Tokyo",
    country: "Japan",
  };

  // Simulated saved assessment
  const quiz = {
    startingLocation: "Dallas, TX",
    months: ["October"],
    minNights: 5,
    maxNights: 7,
    dailyBudget: "$$",
    travelAlterEgo: "Foodie",
    dietaryRestrictions: ["Vegetarian"],
    transportModes: ["train"],
    walkingAmount: "a lot",
    famousOrHiddenGem: "Discover a hidden gem",
    tripPhotoStyle: "Cool historical/cultural stuff",
    favoriteView: "City skyline at night",
    nightlifeOrSunrise: "Enjoy the nightlife and sleep in",
    seeAllOrDeeply: "See it deeply",
    crowdsOrSpace: "Enjoy the bustle of the locals",
  };

  const result = await buildPlacesQueries({
    destination,
    quiz,
  });

  console.log("Destination:", result.destination.name);
  console.log("Gemini model:", result.model);

  console.log("\nQUERY 1 — ATTRACTIONS:");
  console.log(result.queries.attractions);

  console.log("\nQUERY 2 — FOOD:");
  console.log(result.queries.food);

  console.log("\nQUERY 3 — EXPERIENCES:");
  console.log(result.queries.experiences);

  const passed =
    Object.keys(result.queries).length === 3 &&
    Object.values(result.queries).every(
      (query) =>
        typeof query === "string" &&
        query.toLowerCase().includes("tokyo")
    );

  console.log(
    "\nFINAL RESULT:",
    passed ? "PASS" : "FAIL"
  );

  if (!passed) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("\nTEST FAILED:", error.message);
  process.exitCode = 1;
});

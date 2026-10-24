
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
    preferredMonths: ["October"],
    minNights: 5,
    maxNights: 7,
    budgetLevel: "$$",
    travelAlterEgo: "Foodie",
    dietaryRestrictions: ["Vegetarian"],
    transportModes: ["train"],
    walkAmount: "a lot",
    visitFamousLocationOrHiddenGem: "Discover a hidden gem",
    photosToPost: "Cool historical/cultural stuff",
    preferredViews: "City skyline at night",
    sleepInOrEarly: "Sleep in",
    seeAllOrDeeply: "See it deeply",
    enjoyCrowdsOrSpace: "Enjoy the bustle of the locals",
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

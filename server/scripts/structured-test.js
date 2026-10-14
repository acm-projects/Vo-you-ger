
require("dotenv").config();

const destinations = require("../data/destinations.json");

const {
  generateStructured,
} = require("../services/llmclient");

const {
  recommendationResultSchema,
  getResponseJsonSchema,
} = require("../schemas/recommendationSchema");

const {
  buildPrompt,
} = require("../services/promptBuilder");

async function main() {
  // Example traveler preferences for a real Gemini test.
  const quiz = {
    travelAlterEgo: "Foodie",
    dailyBudget: "$$",
    riskTolerance: 2,
    minNights: 4,
    maxNights: 7,
    temperaturePreferences: ["warm"],
  };

  // Use the actual prompt builder and destination database.
  const {
    prompt,
    systemPrompt,
    candidateIds,
  } = buildPrompt({
    quiz,
    nationalities: ["United States"],
    destinations,
  });

  console.log("Testing Gemini structured output...");
  console.log(
    `Candidate destinations: ${candidateIds.length}`
  );

  // Generate structured recommendations.
  const { data, model } = await generateStructured({
    prompt,
    systemPrompt,
    jsonSchema: getResponseJsonSchema(),
    zodSchema: recommendationResultSchema,
  });

  // Validate the AI response against our Zod schema.
  const parsed = recommendationResultSchema.safeParse(data);

  if (!parsed.success) {
    throw new Error(
      "Gemini returned a response that failed schema validation."
    );
  }

  const recommendations = parsed.data.recommendations;

  // Make sure all IDs belong to the candidate list.
  const allowedIds = new Set(candidateIds);

  const allIdsValid = recommendations.every((r) =>
    allowedIds.has(r.destinationId)
  );

  if (!allIdsValid) {
    throw new Error(
      "Gemini recommended a destination outside the candidate list."
    );
  }

  // Prevent duplicate destination IDs.
  const uniqueIds = new Set(
    recommendations.map((r) => r.destinationId)
  );

  if (uniqueIds.size !== 3) {
    throw new Error(
      "Gemini did not return three unique destinations."
    );
  }

  // Validate country uniqueness against our database.
  const destinationById = new Map(
    destinations.map((d) => [d.id, d])
  );

  const uniqueCountries = new Set(
    recommendations.map(
      (r) => destinationById.get(r.destinationId).country
    )
  );

  if (uniqueCountries.size !== 3) {
    throw new Error(
      "Gemini did not return destinations in three different countries."
    );
  }

  console.log("\nStructured output test passed!");
  console.log(`Model used: ${model}`);

  console.log(
    "\nGenerated recommendations:\n"
  );

  console.log(
    JSON.stringify(parsed.data, null, 2)
  );
}

main().catch((err) => {
  console.error(
    "\nStructured output test failed:",
    err.message
  );

  process.exitCode = 1;
});

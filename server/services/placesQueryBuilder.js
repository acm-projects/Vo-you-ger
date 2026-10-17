
const { z } = require("zod");
const { generateStructured } = require("./llmclient");
const { quizSchema } = require("../schemas/recommendationSchema");

// The backend controls the categories.
// Gemini controls the wording of each query.
const searchQuerySchema = z.object({
  attractions: z.string().min(5),
  food: z.string().min(5),
  experiences: z.string().min(5),
});

function getQueryJsonSchema() {
  const schema = z.toJSONSchema(searchQuerySchema);
  delete schema.$schema;
  return schema;
}

async function buildPlacesQueries({ destination, quiz = {} }) {
  if (
    !destination ||
    typeof destination.name !== "string" ||
    !destination.name.trim() ||
    typeof destination.country !== "string" ||
    !destination.country.trim()
  ) {
    throw new Error("A destination name and country are required");
  }

  const validatedQuiz = quizSchema.parse(quiz);

  const systemPrompt = `
You generate search queries for Google Places Text Search.

Generate exactly three search queries:
1. attractions: landmarks, museums, sightseeing and historical sites.
2. food: restaurants, local specialties and dining.
3. experiences: activities, entertainment and cultural experiences.

Rules:
- Every query must explicitly include the destination.
- Personalize the queries using the traveler's assessment.
- Respect stated interests, food restrictions, budget and travel style.
- Prefer specific, natural-language Google Places queries.
- Do not invent business names or claim places exist.
- Do not include hotels in these three categories.
- Do not generate additional query categories.
- Return only the required structured JSON.
`;

  const prompt = JSON.stringify({
    task: "Create three personalized Google Places search queries",
    destination: {
      name: destination.name,
      country: destination.country,
    },
    assessment: validatedQuiz,
    categories: ["attractions", "food", "experiences"],
  });

  const { data, model } = await generateStructured({
    prompt,
    systemPrompt,
    jsonSchema: getQueryJsonSchema(),
    zodSchema: searchQuerySchema,
  });

  // Additional server-side validation.
  const queries = searchQuerySchema.parse(data);

  const destinationName = destination.name.toLowerCase();

  for (const [category, query] of Object.entries(queries)) {
    if (!query.toLowerCase().includes(destinationName)) {
      throw new Error(
        `Generated ${category} query does not mention ${destination.name}`
      );
    }
  }

  return {
    destination: {
      name: destination.name,
      country: destination.country,
    },
    queries,
    model,
  };
}

module.exports = {
  buildPlacesQueries,
  searchQuerySchema,
  getQueryJsonSchema,
};

/**
 * server/schemas/recommendationSchema.js
 *
 * Defines Zod schemas for validating:
 * 1. Incoming quiz answers (quizSchema)
 * 2. Individual recommendation items (recommendationItemSchema)
 * 3. Structured LLM recommendation results (recommendationResultSchema)
 * 4. JSON schema converter for Gemini structured output generation
 */

const { z } = require("zod");

// ---------- INPUT: what the frontend sends us ----------
// Key names are loose to prevent minor frontend variations from breaking the endpoint.
// Nationalities come primarily from the user profile, but can also be passed via quiz.
const quizSchema = z.looseObject({
  // Trip basics
  startingLocation: z.string().optional(),
  countriesOfInterest: z.array(z.string()).optional(),
  months: z.array(z.string()).optional(),
  minNights: z.number().int().min(1).optional(),
  maxNights: z.number().int().min(1).optional(),
  temperaturePreferences: z.array(z.string()).optional(), // warm | cool | chilly
  weatherPreferences: z.array(z.string()).optional(), // sunny | overcast | rainy
  willingToGetVisa: z.boolean().optional(),
  visaWillingness: z.boolean().optional(),
  riskTolerance: z.number().int().min(1).max(5).optional(), // 1 safer, 5 riskier

  // Logistics
  transportModes: z.array(z.string()).optional(), // plane | car | train
  accommodationTypes: z.array(z.string()).optional(),
  groupSize: z.string().optional(), // "1" | "2" | "3-5" | "6-9" | "10+"
  dailyBudget: z.string().optional(), // "$" | "$$" | "$$$"
  dietaryRestrictions: z.array(z.string()).optional(),
  walkingAmount: z.string().optional(), // none | a bit | a lot

  // Personality
  travelAlterEgo: z.string().optional(), // Explorer | Historian | Foodie | Spa Lover
  favoriteView: z.string().optional(),
  tripPhotoStyle: z.string().optional(),
  nightlifeOrSunrise: z.string().optional(),
  famousOrHiddenGem: z.string().optional(),
  seeAllOrDeeply: z.string().optional(),
  crowdsOrSpace: z.string().optional(),
});

// ---------- OUTPUT: what we want back from the model ----------
// .describe() text is passed into the Gemini system prompt as field instructions.
const recommendationItemSchema = z.object({
  destinationId: z
    .string()
    .describe("The exact id of a destination from the provided list"),
  name: z.string().describe("The destination's name"),
  type: z
    .enum(["country", "city", "place"])
    .describe("Whether this destination is a country, a city, or a specific place"),
  country: z.string().describe("The country this destination is in"),
  countryCode: z
    .string()
    .length(2)
    .optional()
    .describe("The 2-letter capitalized ISO country code (e.g. 'FR', 'JP')"),
  matchScore: z
    .number()
    .min(0)
    .max(100)
    .describe("How well this destination fits the traveler, 0-100"),
  reason: z
    .string()
    .describe("2-3 sentences on why this fits the traveler's quiz answers"),
  highlights: z
    .array(z.string())
    .describe("2-4 short things the traveler could do or see there"),
});

const recommendationResultSchema = z.object({
  title: z.string().describe("A short title for this set of recommendations"),
  summary: z
    .string()
    .describe("One or two sentences summarizing what the traveler is looking for"),
  recommendations: z
    .array(recommendationItemSchema)
    .length(3)
    .describe("Exactly 3 destinations in 3 different countries, best match first"),
});

// ---------- Schema to send to Gemini ----------
// Zod 4 converts itself to JSON Schema. Gemini requires "$schema" to be omitted.
function getResponseJsonSchema() {
  const jsonSchema = z.toJSONSchema(recommendationResultSchema);
  delete jsonSchema.$schema;
  return jsonSchema;
}

module.exports = {
  quizSchema,
  recommendationItemSchema,
  recommendationResultSchema,
  getResponseJsonSchema,
};
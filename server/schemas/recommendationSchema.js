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
const { TRIP_POLICY } = require('../config/tripPolicy');
const monthNames='January February March April May June July August September October November December'.split(' ');
const validMonths=new Set(monthNames.flatMap(month=>[month.toLowerCase(),month.slice(0,3).toLowerCase()]));

// ---------- INPUT: what the frontend sends us ----------
// Nationalities come primarily from the user profile, but can also be passed via quiz.
const quizSchema = z.looseObject({
  // Trip basics
  startingLocation: z.union([z.string(), z.array(z.string())]).optional(),
  preferredCountries: z.array(z.string()).optional(),
  preferredMonths: z.array(z.string().trim().refine(value=>validMonths.has(value.toLowerCase()),'Use a month name or three-letter abbreviation')).max(12).optional(),
  minNights: z.number().int().min(0).max(TRIP_POLICY.maxSupportedDays - 1).optional(),
  maxNights: z.number().int().min(0).max(TRIP_POLICY.maxSupportedDays - 1).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) =>
    !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value,
  "startDate must be a real calendar date").optional(),
  preferredWeather: z.string().optional(),
  visaWillingness: z.boolean().optional(),
  highRiskDestWillingness: z.boolean().optional(),

  // Logistics
  transportModes: z.array(z.string()).optional(), // plane | car | train
  intercityTransportModes: z.array(z.enum(["train", "car", "bus", "plane", "ferry"])).optional(),
  preferredAccomodation: z.string().optional(),
  peopleOnTrip: z.union([z.number(), z.string()]).optional(),
  budgetLevel: z.string().trim().pipe(z.enum(['$','$$','$$$'])).optional(),
  dietaryRestrictions: z.union([z.string(), z.array(z.string())]).optional(),
  walkAmount: z.string().optional(),

  // Personality
  travelAlterEgo: z.string().optional(), // The Explorer | The Historian | The Foodie | The Spa Lover
  preferredViews: z.string().optional(),
  photosToPost: z.string().optional(),
  seeAllOrDeeply: z.string().optional(),
  sleepInOrEarly: z.string().optional(),
  visitFamousLocationOrHiddenGem: z.string().optional(),
  enjoyCrowdsOrSpace: z.string().optional(),
}).refine((quiz) => quiz.minNights == null || quiz.maxNights == null || quiz.minNights <= quiz.maxNights, {
  message: "minNights must not exceed maxNights", path: ["maxNights"],
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
  imageUrl: z
    .string()
    .url()
    .nullable()
    .optional()
    .describe("High quality landscape photo url of the country or destination"),
  photo: z
    .object({
      url: z.string(),
      sourceUrl: z.string().optional(),
      credit: z.string().optional(),
      license: z.string().optional(),
      licenseUrl: z.string().optional(),
      alt: z.string().optional(),
      contextUrl: z.string().optional(),
    })
    .nullable()
    .optional()
    .describe("Attributed photo metadata for display and licensing compliance"),
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

/**
 * server/schemas/itinerarySchema.js
 *
 * Defines Zod schemas and JSON Schema generators for Itinerary Generation (Phase 3).
 *
 * Key Capabilities & Architecture:
 * 1. Specific Dates & Days of the Week:
 *    - Each day has `date` (YYYY-MM-DD) and `dayOfWeek` (e.g. "Saturday").
 *    - Allows checking candidate opening hours (e.g. avoiding closed museums on Mondays).
 * 2. Multi-Activity Pacing ("See It All" vs "Deeply"):
 *    - morning: Array of 1-2 activities.
 *    - afternoon: Array of 1-3 activities.
 *    - evening: Array of 1-2 activities.
 * 3. Odd Hours & Nightlife (Night Owls):
 *    - Optional `lateNight` slot for travelers preferring evening/nightlife energy
 *      (e.g. post-dinner jazz bar, night market, rooftop lounge, illuminated walks).
 * 4. Structured Output Conversion:
 *    - Converts to clean JSON schema for Gemini's `responseJsonSchema`.
 */

const { z } = require("zod");

// ============================================================================
// 1. Activity Slot Schema (Individual Venue / Experience)
// ============================================================================
const activitySlotSchema = z.object({
  placeId: z
    .string()
    .describe(
      "The exact placeId from the provided candidate places list. NEVER invent an ID."
    ),
  placeName: z
    .string()
    .describe("The canonical name of the venue or attraction from the candidate list."),
  activityDescription: z
    .string()
    .describe(
      "A vivid 2-3 sentence description of what the traveler will do here, tailored to their travel style and preferences."
    ),
  estimatedCost: z
    .string()
    .describe(
      "Estimated cost per person (e.g. 'Free', '$10-15', '$30') fitting the user's budget tier."
    ),
  travelTip: z
    .string()
    .describe(
      "Practical insider advice (e.g., optimal arrival time, booking advice, dress code, photo spot)."
    ),
  mealType: z
    .string()
    .optional()
    .describe(
      "Specify if this activity is a meal: 'breakfast', 'lunch', 'dinner', 'late_night_eats', or omit if not a meal."
    ),
});

// ============================================================================
// 2. Daily Itinerary Schema
// ============================================================================
// Represents a single calendar day with specific date, day of week, and flexible slots.
const itineraryDaySchema = z.object({
  day: z
    .number()
    .int()
    .min(1)
    .describe("The sequential day number of the itinerary (e.g. 1, 2, 3)."),
  date: z
    .string()
    .describe("The calendar date in YYYY-MM-DD format (e.g. '2026-10-24')."),
  dayOfWeek: z
    .string()
    .describe("The day of the week (e.g. 'Saturday', 'Sunday', 'Monday')."),
  theme: z
    .string()
    .describe(
      "A catchy 3-6 word theme summarizing this day's focus (e.g., 'Historic Temples & Skyline Sunset')."
    ),
  morning: z
    .array(activitySlotSchema)
    .min(1)
    .max(2)
    .describe(
      "Morning activities (typically 9:00 AM – 12:30 PM). 1 activity for relaxed pace, 2 for 'see it all'."
    ),
  afternoon: z
    .array(activitySlotSchema)
    .min(1)
    .max(3)
    .describe(
      "Afternoon activities (typically 1:00 PM – 5:30 PM). 1-2 for deep focus, up to 3 for 'see it all'."
    ),
  evening: z
    .array(activitySlotSchema)
    .min(1)
    .max(2)
    .describe(
      "Evening activities (typically 6:00 PM – 9:30 PM), such as dinner, sunset viewpoints, or night markets."
    ),
  lateNight: activitySlotSchema
    .optional()
    .describe(
      "Optional late-night activity (typically 9:30 PM onwards) for night owls, nightlife, live music, or cocktail bars."
    ),
});

// ============================================================================
// 3. Complete Itinerary Result Schema (Output from Gemini)
// ============================================================================
const itineraryResultSchema = z.object({
  tripTitle: z
    .string()
    .describe("An evocative, personalized title for this custom itinerary."),
  destination: z
    .string()
    .describe("The destination name and country (e.g. 'Tokyo, Japan')."),
  summary: z
    .string()
    .describe(
      "A 2-3 sentence summary explaining how this itinerary fulfills the traveler's quiz preferences."
    ),
  recommendedStayArea: z
    .string()
    .describe(
      "A recommended neighborhood, district, or area to stay in based on the itinerary's geographic distribution and traveler style (e.g. 'George Town', 'Shinjuku'). Do NOT name specific hotels."
    ),
  stayAreaRationale: z
    .string()
    .describe(
      "A brief 2-3 sentence rationale explaining why staying in this area minimizes travel time and complements their travel style."
    ),
  days: z
    .array(itineraryDaySchema)
    .min(1)
    .describe("Array of sequential daily itineraries for the duration of the trip."),
});

// ============================================================================
const candidatePlaceSchema = z.object({
  placeId: z.string().min(1, "placeId is required"),
  name: z.string().min(1, "name is required"),
  category: z.string().optional(),
  description: z.string().optional(),
  estimatedCost: z.string().optional(),
  address: z.string().optional(),
  neighborhood: z.string().optional(),
  location: z
    .object({
      lat: z.number(),
      lng: z.number(),
    })
    .optional(),
  tags: z.array(z.string()).optional(),
  daysOpen: z.array(z.string()).optional(), // e.g. ["Mon", "Wed", "Thu", "Fri", "Sat", "Sun"]
  openingHours: z.string().optional(), // e.g. "10:00 - 22:00, Closed Tuesdays"
  includesMeals: z.array(z.string()).optional(), // e.g. ["breakfast", "dinner"] for onsens, ryokans, resorts
  dietaryOptions: z.array(z.string()).optional(), // e.g. ["halal", "vegetarian", "vegan", "gluten-free"]
});

// ============================================================================
// 5. JSON Schema Converter for Gemini
// ============================================================================
function getItineraryResponseJsonSchema() {
  const jsonSchema = z.toJSONSchema(itineraryResultSchema);
  delete jsonSchema.$schema;
  return jsonSchema;
}

module.exports = {
  activitySlotSchema,
  itineraryDaySchema,
  itineraryResultSchema,
  candidatePlaceSchema,
  getItineraryResponseJsonSchema,
};

/**
 * server/services/itineraryService.js
 *
 * Core service executing Gemini Itinerary Generation (Phase 3).
 *
 * Responsibilities:
 * 1. Coordinates with `itineraryPromptBuilder` to assemble the personalized prompt,
 *    calendar dates, day of week, and negative constraints.
 * 2. Invokes Gemini via `llmclient.generateStructured()` with the JSON Schema from `itinerarySchema.js`.
 * 3. Enforces post-generation Anti-Hallucination validation:
 *    - Validates morning, afternoon, evening arrays and optional lateNight slots.
 *    - Cross-references every placeId selected by Gemini against the candidate places from Phase 2.
 *    - Replaces place names with canonical titles from the candidate catalog to maintain database integrity.
 *    - Rejects any output attempting to introduce an unverified venue.
 */

const llm = require("./llmclient");
const {
  itineraryResultSchema,
  getItineraryResponseJsonSchema,
} = require("../schemas/itinerarySchema");
const { buildItineraryPrompt } = require("./itineraryPromptBuilder");

/**
 * Generates a validated day-by-day itinerary using Gemini.
 *
 * @param {object} params
 * @param {string|object} params.destination - The target destination (e.g. "Tokyo, Japan")
 * @param {object} params.quiz - Traveler's assessment quiz responses
 * @param {Array<object>} params.candidatePlaces - Vetted candidate venues/activities from Phase 2
 * @param {number} [params.numberOfDays] - Target duration in days
 * @param {string} [params.startDate] - Optional YYYY-MM-DD start date
 * @param {object} [params.context] - Optional extra metadata
 * @returns {Promise<{ itinerary: object, model: string }>} Validated itinerary and answering model
 */
async function generateItinerary({
  destination,
  quiz = {},
  candidatePlaces = [],
  numberOfDays,
  startDate,
  context = {},
}) {
  // Pre-condition: Candidate places must not be empty
  if (!Array.isArray(candidatePlaces) || candidatePlaces.length === 0) {
    const error = new Error(
      "Cannot generate itinerary: candidate places list from Phase 2 is empty."
    );
    error.statusCode = 400;
    throw error;
  }

  // 1. Build prompt, calendar schedule, and candidate ID lookup
  const { systemPrompt, prompt, candidatePlaceIds, schedule } =
    buildItineraryPrompt({
      destination,
      quiz,
      candidatePlaces,
      numberOfDays,
      startDate,
      context,
    });

  // 2. Request structured output from Gemini
  const { data, model } = await llm.generateStructured({
    prompt,
    systemPrompt,
    jsonSchema: getItineraryResponseJsonSchema(),
    zodSchema: itineraryResultSchema,
  });

  // 3. Anti-Hallucination Verification:
  // Build lookup map: placeId -> candidate place record
  const placeById = new Map(
    candidatePlaces.map((place) => [place.placeId, place])
  );

  const days = data.days || [];
  const timeSlots = ["morning", "afternoon", "evening"];

  for (const day of days) {
    for (const slot of timeSlots) {
      const activities = day[slot];
      if (!Array.isArray(activities) || activities.length === 0) {
        const error = new Error(
          `AI returned an incomplete day: missing ${slot} activities for Day ${day.day}`
        );
        error.statusCode = 502;
        throw error;
      }

      for (const activity of activities) {
        // Check if placeId exists in the candidate catalog
        if (!placeById.has(activity.placeId)) {
          const error = new Error(
            `AI hallucinated an unknown placeId "${activity.placeId}" for Day ${day.day} (${day.dayOfWeek || ""}) ${slot}. Venue must be from candidate places.`
          );
          error.statusCode = 502;
          throw error;
        }

        // Overwrite placeName with canonical name from candidate list to prevent subtle naming hallucinations
        const canonical = placeById.get(activity.placeId);
        activity.placeName = canonical.name;
      }
    }

    // Check optional lateNight slot if returned by the model
    if (day.lateNight) {
      if (!placeById.has(day.lateNight.placeId)) {
        const error = new Error(
          `AI hallucinated an unknown placeId "${day.lateNight.placeId}" for Day ${day.day} lateNight. Venue must be from candidate places.`
        );
        error.statusCode = 502;
        throw error;
      }
      day.lateNight.placeName = placeById.get(day.lateNight.placeId).name;
    }
  }

  return {
    itinerary: data,
    model,
  };
}

module.exports = {
  generateItinerary,
};

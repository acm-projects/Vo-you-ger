/**
 * server/controllers/recommendationController.js
 *
 * Implements Phase 1B: Personalized destination recommendations (3 locations in 3 countries).
 *
 * Workflow:
 * 1. Authenticate user and retrieve profile data (including citizenship nationalities).
 * 2. Validate travel quiz responses (either sent in request body or retrieved from profile).
 * 3. Visa Constraint Handling (Phase 1B):
 *    - If traveler answered "no" to visa willingness (willingToGetVisa === false or visaWillingness === false),
 *      we call the TravelBuddy Visa API (/v2/visa/map) to get all countries with "green" status (visa-free).
 *    - Destinations in destinations.json are filtered down to only those matching green country codes.
 * 4. Constraint & Preference Comparison:
 *    - Candidate destinations are compared against user budget, safety/risk tolerance, and travel preferences.
 * 5. Gemini Generation:
 *    - Prompt is generated containing only valid candidate destinations.
 *    - Gemini returns structured recommendations for exactly 3 destinations across 3 distinct countries.
 * 6. Validation & Persistence:
 *    - The response is rigorously verified against canonical database records (preventing hallucination).
 *    - Stored as a new Trip in DynamoDB and returned with HTTP 201.
 */

const destinations = require("../data/destinations.json");
const {
  quizSchema,
  recommendationResultSchema,
  getResponseJsonSchema,
} = require("../schemas/recommendationSchema");
const { buildPrompt } = require("../services/promptBuilder");

// Imported as objects so unit tests can easily mock external services
const llm = require("../services/llmclient");
const userModel = require("../models/userModel");
const tripModel = require("../models/tripModel");
const visaService = require("../services/visaService");

/**
 * POST /api/recommendations
 *
 * Generates 3 initial destination recommendations tailored to user quiz responses.
 *
 * Request Header:
 *   Authorization: Bearer <token>
 *
 * Request Body (optional if saved quiz exists in user profile):
 *   {
 *     "quiz": { ... }
 *   }
 */
async function createRecommendations(req, res) {
  try {
    // -------------------------------------------------------------
    // Step 1: Retrieve Authenticated User Profile
    // -------------------------------------------------------------
    // Nationalities (citizenship) stored in user profile are essential
    // for determining visa-free travel eligibility under international laws.
    const user = await userModel.findUserById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        error: "Not Found",
        message: "User not found",
      });
    }

    // -------------------------------------------------------------
    // Step 2: Validate Travel Assessment Quiz Answers
    // -------------------------------------------------------------
    // Prefer quiz provided in request body; fallback to saved profile response.
    const rawQuiz = req.body?.quiz ?? user.quizResponse;

    if (
      !rawQuiz ||
      typeof rawQuiz !== "object" ||
      Array.isArray(rawQuiz) ||
      Object.keys(rawQuiz).length === 0
    ) {
      return res.status(400).json({
        error: "Bad Request",
        message:
          "Quiz answers are required (send { quiz } or save a quiz to your profile first)",
      });
    }

    const parsedQuiz = quizSchema.safeParse(rawQuiz);

    if (!parsedQuiz.success) {
      return res.status(400).json({
        error: "Bad Request",
        message:
          "Invalid quiz answers: " +
          parsedQuiz.error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join("; "),
      });
    }

    const quiz = parsedQuiz.data;

    // -------------------------------------------------------------
    // Step 3: Phase 1B Visa Verification via TravelBuddy API
    // -------------------------------------------------------------
    // Check if the user opted out of getting a visa.
    // If willingToGetVisa is explicitly false (or visaWillingness === false),
    // we query TravelBuddy POST /v2/visa/map for the user's passport nationality.
    // Only countries with "green" (visa-free) status are eligible.
    const notWillingToGetVisa =
      quiz.willingToGetVisa === false || quiz.visaWillingness === false;

    let visaFreeCountryCodes = null;

    if (notWillingToGetVisa) {
      const userNationalities =
        Array.isArray(user.nationalities) && user.nationalities.length > 0
          ? user.nationalities
          : Array.isArray(quiz.nationalities)
          ? quiz.nationalities
          : [];

      if (userNationalities.length > 0) {
        try {
          // Query the external Visa API to obtain the Set of green ISO country codes
          visaFreeCountryCodes = await visaService.getVisaFreeCountries(
            userNationalities
          );
        } catch (visaErr) {
          console.error(
            "[recommendationController] Error querying Visa API:",
            visaErr.message
          );
          // Return 503 Service Unavailable so we do not recommend visa-requiring places by accident
          return res.status(503).json({
            error: "Service Unavailable",
            message:
              "The visa verification service is temporarily unavailable. Please try again in a moment.",
          });
        }
      }
    }

    // -------------------------------------------------------------
    // Step 4: Construct Personalized Prompt & Filtered Candidates
    // -------------------------------------------------------------
    // Merges quiz preferences, user citizenship, and candidate destinations
    // that satisfy the visa filter, budget limits, and risk tolerance.
    const {
      systemPrompt,
      prompt,
      candidateIds,
    } = buildPrompt({
      quiz,
      nationalities: user.nationalities || [],
      destinations,
      visaFreeCountryCodes,
    });

    // -------------------------------------------------------------
    // Step 5: Generate Structured Recommendations Using Gemini
    // -------------------------------------------------------------
    const { data, model } = await llm.generateStructured({
      prompt,
      systemPrompt,
      jsonSchema: getResponseJsonSchema(),
      zodSchema: recommendationResultSchema,
    });

    // -------------------------------------------------------------
    // Step 6: Validate LLM Output & Protect Against AI Hallucinations
    // -------------------------------------------------------------
    const parsedRecommendations =
      recommendationResultSchema.safeParse(data);

    if (!parsedRecommendations.success) {
      return res.status(502).json({
        error: "Bad Gateway",
        message:
          "The AI returned an invalid response. Please try again.",
      });
    }

    const generated = parsedRecommendations.data;

    // Build a lookup map of permitted candidates from destinations.json
    const allowedIds = new Set(candidateIds);
    const candidateById = new Map(
      destinations
        .filter((destination) => allowedIds.has(destination.id))
        .map((destination) => [destination.id, destination])
    );

    const recommendations = generated.recommendations;

    // Verify exactly 3 destinations are returned with unique IDs from candidate list
    const uniqueIds = new Set(recommendations.map((r) => r.destinationId));
    const allIdsValid = recommendations.every((r) =>
      candidateById.has(r.destinationId)
    );

    if (
      recommendations.length !== 3 ||
      uniqueIds.size !== 3 ||
      !allIdsValid
    ) {
      return res.status(502).json({
        error: "Bad Gateway",
        message:
          "The AI returned invalid destination recommendations. Please try again.",
      });
    }

    // Rule: Must be located in 3 distinct countries
    const uniqueCountries = new Set(
      recommendations.map(
        (r) => candidateById.get(r.destinationId).country
      )
    );

    if (uniqueCountries.size !== 3) {
      return res.status(502).json({
        error: "Bad Gateway",
        message:
          "The AI must recommend destinations in three different countries. Please try again.",
      });
    }

    // Merge validated canonical destination metadata (names, types, countryCode)
    // with AI-generated personalized matchScores, reasons, and highlights
    const validatedRecommendations = recommendations.map((r) => {
      const destination = candidateById.get(r.destinationId);

      return {
        ...r,
        name: destination.name,
        type: destination.type,
        country: destination.country,
        countryCode: destination.countryCode,
      };
    });

    // -------------------------------------------------------------
    // Step 7: Persist Trip Recommendations to DynamoDB
    // -------------------------------------------------------------
    const trip = await tripModel.createTrip(
      user.id || req.user.userId,
      {
        title: generated.title,
        summary: generated.summary,
        recommendations: validatedRecommendations,
        quiz,
        model,
      }
    );

    // Remove internal database partition keys before returning response
    const { PK, SK, ...safeTrip } = trip;

    return res.status(201).json({
      message: "Recommendations generated",
      trip: safeTrip,
    });
  } catch (err) {
    if (err.statusCode === 503) {
      return res.status(503).json({
        error: "Service Unavailable",
        message:
          "The AI service is busy right now. Please try again in a moment.",
      });
    }

    if (err.statusCode === 502) {
      return res.status(502).json({
        error: "Bad Gateway",
        message:
          "The AI returned an invalid response. Please try again.",
      });
    }

    console.error("[recommendationController] Error generating recommendations:", err);

    return res.status(500).json({
      error: "Internal Server Error",
      message:
        "An error occurred while generating recommendations",
    });
  }
}

module.exports = { createRecommendations };

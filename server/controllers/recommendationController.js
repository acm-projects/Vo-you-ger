
const destinations = require("../data/destinations.json");
const {
  quizSchema,
  recommendationResultSchema,
  getResponseJsonSchema,
} = require("../schemas/recommendationSchema");
const { buildPrompt } = require("../services/promptBuilder");

// Import as objects so tests can mock these functions.
const llm = require("../services/llmclient");
const userModel = require("../models/userModel");
const tripModel = require("../models/tripModel");

/**
 * POST /api/recommendations
 *
 * Requires authentication.
 *
 * Body:
 * {
 *   quiz?: { ... }
 * }
 *
 * If quiz is omitted, use the user's saved quizResponse.
 */
async function createRecommendations(req, res) {
  try {
    // 1. Find the authenticated user.
    const user = await userModel.findUserById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        error: "Not Found",
        message: "User not found",
      });
    }

    // 2. Get and validate the travel assessment.
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
            .map((issue) =>
              `${issue.path.join(".")}: ${issue.message}`
            )
            .join("; "),
      });
    }

    const quiz = parsedQuiz.data;

    // 3. Build the personalized prompt and candidate list.
    const {
      systemPrompt,
      prompt,
      candidateIds,
    } = buildPrompt({
      quiz,
      nationalities: user.nationalities || [],
      destinations,
    });

    // 4. Generate structured recommendations using Gemini.
    const { data, model } = await llm.generateStructured({
      prompt,
      systemPrompt,
      jsonSchema: getResponseJsonSchema(),
      zodSchema: recommendationResultSchema,
    });

    // 5. Validate the complete model response.
    // This also protects us when the LLM client is mocked,
    // or returns data that bypasses its own validation.
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

    // Only allow destinations included in the prompt.
    const allowedIds = new Set(candidateIds);

    const candidateById = new Map(
      destinations
        .filter((destination) =>
          allowedIds.has(destination.id)
        )
        .map((destination) => [
          destination.id,
          destination,
        ])
    );

    const recommendations = generated.recommendations;

    // Check that all IDs are valid and unique.
    const uniqueIds = new Set(
      recommendations.map((r) => r.destinationId)
    );

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

    // Validate countries using our own database,
    // rather than trusting the country names from Gemini.
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

    // Use canonical destination metadata from our dataset.
    // Keep the AI's personalized explanations and scores.
    const validatedRecommendations = recommendations.map(
      (r) => {
        const destination = candidateById.get(r.destinationId);

        return {
          ...r,
          name: destination.name,
          type: destination.type,
          country: destination.country,
        };
      }
    );

    // 6. Save the recommendations as a trip.
    // Detailed itinerary generation happens in a later feature.
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

    // 7. Return the saved trip without internal DynamoDB keys.
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

    console.error("Error generating recommendations:", err);

    return res.status(500).json({
      error: "Internal Server Error",
      message:
        "An error occurred while generating recommendations",
    });
  }
}

module.exports = { createRecommendations };

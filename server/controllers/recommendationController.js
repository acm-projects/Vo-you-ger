
/**
 * server/controllers/recommendationController.js
 *
 * Phase 1B: Personalized destination recommendations.
 *
 * 1. Authenticate the user and retrieve their profile.
 * 2. Validate travel assessment responses.
 * 3. Apply visa requirements based on citizenship.
 * 4. Filter and compare eligible destinations.
 * 5. Generate three personalized destinations using Gemini.
 * 6. Validate and save recommendations in DynamoDB.
 *
 * Phase 2A: Destination places and neighborhoods.
 *
 * 1. Validate the selected destination and trip ownership.
 * 2. Generate personalized Google Places search queries.
 * 3. Retrieve real attractions, food, and experiences.
 * 4. Normalize and geographically group the results.
 * 5. Rank neighborhoods based on nearby activities.
 * 6. Return places and neighborhood recommendations.
 */

const {
  buildPlacesQueries,
} = require("../services/placesQueryBuilder");

const {
  searchPlacesForQueries,
} = require("../services/googlePlacesService");

const {
  normalizePlaces,
} = require("../services/placeNormalizer");

const {
  groupPlacesByGeography,
} = require("../services/placeGroupingService");

const {
  recommendNeighborhoods,
} = require("../services/neighborhoodRecommendationService");

const destinations = require("../data/destinations.json");

const {
  quizSchema,
  recommendationResultSchema,
  getResponseJsonSchema,
} = require("../schemas/recommendationSchema");

const {
  buildPrompt,
} = require("../services/promptBuilder");

// Imported as objects so unit tests can mock external services.
const llm = require("../services/llmclient");
const userModel = require("../models/userModel");
const tripModel = require("../models/tripModel");
const visaService = require("../services/visaService");

/**
 * POST /api/recommendations
 *
 * Generates three personalized destinations in
 * three different countries.
 */
async function createRecommendations(req, res) {
  try {
    // Step 1: Retrieve the authenticated user.
    const user = await userModel.findUserById(
      req.user.userId
    );

    if (!user) {
      return res.status(404).json({
        error: "Not Found",
        message: "User not found",
      });
    }

    // Step 2: Validate travel assessment responses.
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
            .map(
              (issue) =>
                `${issue.path.join(".")}: ${issue.message}`
            )
            .join("; "),
      });
    }

    const quiz = parsedQuiz.data;

    // Step 3: Check visa willingness.
    const notWillingToGetVisa =
      quiz.willingToGetVisa === false ||
      quiz.visaWillingness === false;

    let visaFreeCountryCodes = null;

    if (notWillingToGetVisa) {
      const userNationalities =
        Array.isArray(user.nationalities) &&
        user.nationalities.length > 0
          ? user.nationalities
          : Array.isArray(quiz.nationalities)
            ? quiz.nationalities
            : [];

      if (userNationalities.length > 0) {
        try {
          visaFreeCountryCodes =
            await visaService.getVisaFreeCountries(
              userNationalities
            );
        } catch (visaErr) {
          console.error(
            "[recommendationController] Error querying Visa API:",
            visaErr.message
          );

          return res.status(503).json({
            error: "Service Unavailable",
            message:
              "The visa verification service is temporarily unavailable. Please try again in a moment.",
          });
        }
      }
    }

    // Step 4: Construct personalized destination prompt.
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

    // Step 5: Generate structured recommendations.
    const { data, model } = await llm.generateStructured({
      prompt,
      systemPrompt,
      jsonSchema: getResponseJsonSchema(),
      zodSchema: recommendationResultSchema,
    });

    // Step 6: Validate Gemini output.
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

    // Ensure three valid, unique destinations.
    const uniqueIds = new Set(
      recommendations.map((r) => r.destinationId)
    );

    const allIdsValid = recommendations.every(
      (r) => candidateById.has(r.destinationId)
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

    // Ensure the destinations are in different countries.
    const uniqueCountries = new Set(
      recommendations.map(
        (r) =>
          candidateById.get(r.destinationId).country
      )
    );

    if (uniqueCountries.size !== 3) {
      return res.status(502).json({
        error: "Bad Gateway",
        message:
          "The AI must recommend destinations in three different countries. Please try again.",
      });
    }

    // Merge validated canonical destination information
    // with Gemini's personalized recommendations.
    const validatedRecommendations =
      recommendations.map((r) => {
        const destination = candidateById.get(
          r.destinationId
        );

        return {
          ...r,
          name: destination.name,
          type: destination.type,
          country: destination.country,
          countryCode: destination.countryCode,
        };
      });

    // Step 7: Save recommendations to DynamoDB.
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

    // Exclude internal DynamoDB keys.
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

    console.error(
      "[recommendationController] Error generating recommendations:",
      err
    );

    return res.status(500).json({
      error: "Internal Server Error",
      message:
        "An error occurred while generating recommendations",
    });
  }
}

/**
 * POST /api/recommendations/:tripId/places
 *
 * Retrieves attractions, restaurants, experiences,
 * geographic groups, and recommended neighborhoods
 * for a selected destination.
 */
async function getDestinationPlaces(req, res) {
  try {
    const userId = req.user.userId;
    const tripId = req.params.tripId;
    const { destinationId } = req.body || {};

    // Step 1: Validate selected destination.
    if (
      typeof destinationId !== "string" ||
      !destinationId.trim()
    ) {
      return res.status(400).json({
        error: "Bad Request",
        message: "destinationId is required",
      });
    }

    // Step 2: Retrieve the authenticated user's trip.
    const trip = await tripModel.findTripById(
      userId,
      tripId
    );

    if (!trip) {
      return res.status(404).json({
        error: "Not Found",
        message: "Trip not found",
      });
    }

    // Step 3: Validate destination against saved trip.
    const destination = trip.recommendations?.find(
      (item) => item.destinationId === destinationId
    );

    if (!destination) {
      return res.status(400).json({
        error: "Bad Request",
        message:
          "Destination is not one of the recommended destinations for this trip",
      });
    }

    // Step 4: Retrieve the quiz snapshot.
    const quiz = trip.quizSnapshot;

    if (
      !quiz ||
      typeof quiz !== "object" ||
      Array.isArray(quiz)
    ) {
      return res.status(400).json({
        error: "Bad Request",
        message: "This trip has no saved assessment",
      });
    }

    // Step 5: Generate three personalized search queries.
    const generated = await buildPlacesQueries({
      destination,
      quiz,
    });

    // Step 6: Search Google Places.
    // Searches attractions, food, and experiences.
    // Individual hotel searches are excluded.
    const searchResults = await searchPlacesForQueries(
      generated.queries,
      destination
    );

    // Step 7: Normalize real places and remove duplicates.
    const normalized = normalizePlaces(
      searchResults.places
    );

    // Step 8: Organize activities into geographic groups.
    const grouped = groupPlacesByGeography(
      normalized,
      {
        radiusKm: 2.5,
        transportModes: quiz.transportModes || [],
      }
    );

    // Step 9: Recommend neighborhoods for accommodation.
    // Ranking is based on nearby activities and
    // straight-line geographic distances.
    //
    // Candidate names are derived from available
    // neighborhood labels in Google Places data.
    const recommendedNeighborhoods =
      recommendNeighborhoods(normalized, {
        limit: 3,
        nearbyRadiusKm: 2.5,
      });

    // Step 10: Return places and neighborhood suggestions.
    return res.status(200).json({
      message:
        "Destination places retrieved successfully",

      tripId,

      destination: {
        destinationId: destination.destinationId,
        name: destination.name,
        country: destination.country,
      },

      generatedQueries: generated.queries,
      generatedBy: generated.model,

      groupedPlaces: grouped,

      recommendedNeighborhoods,
    });
  } catch (error) {
    console.error(
      "[recommendationController] Places error:",
      error
    );

    if (error.statusCode === 503) {
      return res.status(503).json({
        error: "Service Unavailable",
        message:
          "The AI service is temporarily unavailable",
      });
    }

    if (error.statusCode === 502) {
      return res.status(502).json({
        error: "Bad Gateway",
        message: "Gemini returned an invalid response",
      });
    }

    return res.status(500).json({
      error: "Internal Server Error",
      message: "Unable to retrieve destination places",
    });
  }
}

module.exports = {
  createRecommendations,
  getDestinationPlaces,
};

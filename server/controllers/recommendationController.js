
/**
 * server/controllers/recommendationController.js
 *
 * Phase 1B: Personalized destination recommendations.
 *
 * 1. Authenticate the user and retrieve their profile.
 * 2. Validate travel assessment responses.
 * 3. Apply visa requirements based on citizenship.
 * 4. Filter and compare eligible destinations.
 * 5. Rank countries deterministically; ask Gemini only for explanations.
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

const { quizSchema } = require("../schemas/recommendationSchema");

// Imported as objects so unit tests can mock external services.
const userModel = require("../models/userModel");
const tripModel = require("../models/tripModel");
const { isCountryTrip } = require("../services/tripOutlineService");

/**
 * POST /api/recommendations
 *
 * Generates three personalized destinations in
 * three different countries.
 */
async function createRecommendations(req, res) {
  const { recommendCountries } = require('../services/countryRecommendationService');
  const { apiError, sendError } = require('../services/apiError');
  try {
    if(req.body!=null && (typeof req.body!=='object'||Array.isArray(req.body))) throw apiError('INVALID_BODY','A JSON object body is required');
    const user=await userModel.findUserById(req.user.userId);
    if(!user) throw apiError('USER_NOT_FOUND','User not found',404);
    const rawQuiz=req.body?.quiz ?? user.quizResponse;
    if(!rawQuiz || typeof rawQuiz!=='object' || Array.isArray(rawQuiz) || !Object.keys(rawQuiz).length) throw apiError('ASSESSMENT_REQUIRED','Quiz answers are required');
    const parsed=quizSchema.safeParse(rawQuiz);
    if(!parsed.success) throw apiError('INVALID_ASSESSMENT','Invalid quiz answers: '+parsed.error.issues.map(issue=>`${issue.path.join('.')}: ${issue.message}`).join('; '));
    const generated=await recommendCountries(user,parsed.data);
    const trip=await tripModel.createTrip(req.user.userId,{...generated,quiz:parsed.data});
    const {PK,SK,...safeTrip}=trip;
    return res.status(201).json({message:'Recommendations generated',trip:safeTrip});
  } catch(error) { return sendError(res,error); }
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
    const { destinationId = req.body?.countryId } = req.body || {};

    // Step 1: Validate selected destination.
    if (
      typeof destinationId !== "string" ||
      !destinationId.trim()
    ) {
      return res.status(400).json({
        error: "Bad Request",
        message: "destinationId or countryId is required",
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

    if (isCountryTrip(trip)) {
      const { getCountryPlaces } = require("./countryTripController");
      return await getCountryPlaces(req, res, trip);
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

/**
 * server/controllers/itineraryController.js
 *
 * Controller for Itinerary Generation (Phase 3).
 *
 * Workflow:
 * 1. Authenticate user request.
 * 2. Validate input parameters:
 *    - `destination`: Destination name or object (e.g., "Tokyo, Japan").
 *    - `candidatePlaces`: Vetted venues/activities retrieved in Phase 2.
 *    - `tripId`: Optional. If provided, associates and saves the itinerary to the trip in DynamoDB.
 *    - `numberOfDays`: Optional duration override (otherwise derived from quiz minNights/maxNights).
 * 3. Retrieve traveler quiz profile from the specified trip snapshot, user profile, or request body.
 * 4. Execute `itineraryService.generateItinerary()`:
 *    - Injects the quiz profile and candidate places.
 *    - Passes the Zod itinerary schema to Gemini structured outputs.
 *    - Enforces negative constraints and post-generation anti-hallucination verification.
 * 5. If `tripId` was specified, persist the generated itinerary into DynamoDB.
 * 6. Return HTTP 200/201 with the completed itinerary.
 */

const userModel = require("../models/userModel");
const tripModel = require("../models/tripModel");
const itineraryService = require("../services/itineraryService");
const { candidatePlaceSchema } = require("../schemas/itinerarySchema");

/**
 * POST /api/itinerary/generate
 * (also mounted as POST /api/trips/:tripId/itinerary)
 *
 * Generates a structured day-by-day itinerary from Phase 2 candidate places.
 */
async function createItinerary(req, res) {
  try {
    const userId = req.user.userId;
    const tripId = req.params.tripId || req.body.tripId;

    // 1. Validate destination
    const destination = req.body.destination;
    if (!destination) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Destination is required (e.g. 'Tokyo, Japan' or { name, country }).",
      });
    }

    // 2. Validate candidate places from Phase 2
    // Supports either flat candidatePlaces array or Phase 2 groupedPlaces response
    let candidatePlaces = req.body.candidatePlaces;
    if (!Array.isArray(candidatePlaces) && req.body.groupedPlaces?.groups) {
      candidatePlaces = req.body.groupedPlaces.groups.flatMap(
        (group) => group.places || []
      );
    }

    if (!Array.isArray(candidatePlaces) || candidatePlaces.length === 0) {
      return res.status(400).json({
        error: "Bad Request",
        message:
          "candidatePlaces must be a non-empty array of venue/activity objects from Phase 2.",
      });
    }

    // Validate that each candidate place has minimum required fields (placeId and name)
    const invalidPlace = candidatePlaces.find(
      (p) => !p || typeof p !== "object" || !p.placeId || !p.name
    );
    if (invalidPlace) {
      return res.status(400).json({
        error: "Bad Request",
        message:
          "Each candidate place in candidatePlaces must include at least 'placeId' and 'name'.",
      });
    }

    // 3. Resolve user profile and trip if tripId is provided
    let trip = null;
    if (tripId) {
      trip = await tripModel.findTripById(userId, tripId);
      if (!trip) {
        return res.status(404).json({
          error: "Not Found",
          message: `Trip with id "${tripId}" was not found.`,
        });
      }
    }

    const user = await userModel.findUserById(userId);

    // Prefer quiz provided in request body, then trip snapshot, then user profile
    const quiz =
      req.body.quiz ||
      trip?.quizSnapshot ||
      user?.quizResponse ||
      {};

    // 4. Generate structured itinerary via Gemini
    const { itinerary, model } = await itineraryService.generateItinerary({
      destination,
      quiz,
      candidatePlaces,
      numberOfDays: req.body.numberOfDays,
      startDate: req.body.startDate,
      context: req.body.context || {},
    });

    // 5. If linked to an existing trip, persist itinerary to DynamoDB
    let updatedTrip = null;
    if (tripId) {
      const savedAttributes = await tripModel.updateTripItinerary(
        userId,
        tripId,
        itinerary,
        model
      );
      const { PK, SK, ...safeTrip } = savedAttributes;
      updatedTrip = safeTrip;
    }

    return res.status(200).json({
      message: "Itinerary generated successfully",
      destination,
      itinerary,
      model,
      trip: updatedTrip,
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
        message: err.message || "The AI returned an invalid itinerary response.",
      });
    }

    if (err.statusCode === 400) {
      return res.status(400).json({
        error: "Bad Request",
        message: err.message,
      });
    }

    console.error("[itineraryController] Error generating itinerary:", err);

    return res.status(500).json({
      error: "Internal Server Error",
      message: "An error occurred while generating the itinerary.",
    });
  }
}

module.exports = {
  createItinerary,
};


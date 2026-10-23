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
const placesQueryBuilder = require("../services/placesQueryBuilder");
const googlePlacesService = require("../services/googlePlacesService");
const placeNormalizer = require("../services/placeNormalizer");
const placeGroupingService = require("../services/placeGroupingService");
const destinations = require("../data/destinations.json");
const { isCountryTrip } = require("../services/tripOutlineService");

/**
 * POST /api/itinerary/generate
 * (also mounted as POST /api/itinerary/:tripId)
 *
 * Orchestrates full itinerary generation:
 * - Accepts { tripId, destinationId, startDate? } (single clean entry point from frontend)
 *   OR direct { destination, candidatePlaces, tripId?, startDate? }.
 * - When candidatePlaces are omitted, executes Phase 2 places discovery pipeline.
 * - Generates grounded day-by-day itinerary via Phase 3 Gemini service.
 * - Attaches Phase 5 non-AI curated travel metadata (languages, currency, payment methods, safety, culture).
 * - Persists completed itinerary to DynamoDB via tripModel.updateTripItinerary.
 */
async function createItinerary(req, res) {
  try {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({ error: "Bad Request", message: "A JSON object body is required" });
    }
    if(req.body.numberOfDays != null) { try { require('../config/tripPolicy').maxBasesForDays(req.body.numberOfDays); } catch { return res.status(400).json({error:'Bad Request',code:'INVALID_DURATION',message:'Trip duration must be between 1 and 21 calendar days'}); } }
    const userId = req.user.userId;
    const tripId = req.params.tripId || req.body.tripId;
    const destinationId =
      req.body.destinationId ||
      req.body.destination?.id ||
      req.body.destination?.destinationId;

    // 1. Resolve trip if tripId is provided
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

    if (isCountryTrip(trip)) {
      const { createCountryItinerary } = require("./countryTripController");
      return await createCountryItinerary(req, res, trip);
    }

    if (req.body.countryId || (typeof destinationId === "string" && destinationId.startsWith("country-"))) {
      return res.status(400).json({ error: "Bad Request", message: "Country itineraries require a tripId from country recommendations" });
    }

    // 2. Resolve destination object and metadata
    let destination = req.body.destination;
    let selectedRec = null;

    if (trip?.recommendations && destinationId) {
      selectedRec = trip.recommendations.find(
        (r) => r.destinationId === destinationId || r.id === destinationId
      );
    }

    // Look up canonical destination from destinations.json
    let canonicalDest = null;
    if (destinationId) {
      canonicalDest = destinations.find(
        (d) => d.id === destinationId || d.id === destinationId.toLowerCase()
      );
    }
    if (
      !canonicalDest &&
      (selectedRec?.name || (typeof destination === "object" && destination?.name))
    ) {
      const destName = (selectedRec?.name || destination.name).toLowerCase();
      canonicalDest = destinations.find(
        (d) => d.name.toLowerCase() === destName
      );
    }
    if (!canonicalDest && typeof destination === "string") {
      const destName = destination.split(",")[0].trim().toLowerCase();
      canonicalDest = destinations.find(
        (d) => d.name.toLowerCase() === destName
      );
    }

    // If destination was not explicitly passed, infer it from selectedRec or canonicalDest
    if (!destination) {
      if (selectedRec) {
        destination = {
          id: selectedRec.destinationId || selectedRec.id,
          name: selectedRec.name,
          country: selectedRec.country,
        };
      } else if (canonicalDest) {
        destination = {
          id: canonicalDest.id,
          name: canonicalDest.name,
          country: canonicalDest.country,
        };
      }
    }

    if (!destination) {
      return res.status(400).json({
        error: "Bad Request",
        message:
          "Destination is required (provide destinationId or destination e.g. 'Tokyo, Japan').",
      });
    }

    // 3. Resolve Phase 5 Extra Trip Details (Languages, Budget, Currency, Payment Methods, Safety, Culture)
    // Curated non-AI data directly from destinations.json
    const practicalInfo = canonicalDest
      ? {
          destinationId: canonicalDest.id,
          name: canonicalDest.name,
          country: canonicalDest.country,
          countryCode: canonicalDest.countryCode,
          languages: canonicalDest.languages || [],
          budget: canonicalDest.budget || null,
          currency: canonicalDest.currency || null,
          paymentMethods: canonicalDest.paymentMethods || null,
          safety: canonicalDest.safety ?? null,
          culturalTips: canonicalDest.culturalTips || [],
        }
      : null;

    // 4. Resolve user profile and quiz assessment
    const user = await userModel.findUserById(userId);
    const quiz =
      req.body.quiz ||
      trip?.quizSnapshot ||
      user?.quizResponse ||
      {};

    // 5. Resolve candidate places:
    // Check if directly provided (candidatePlaces array or Phase 2 groupedPlaces)
    let candidatePlaces = req.body.candidatePlaces;
    if (!Array.isArray(candidatePlaces) && req.body.groupedPlaces?.groups) {
      candidatePlaces = req.body.groupedPlaces.groups.flatMap(
        (group) => group.places || []
      );
    }

    // If candidate places were not provided, orchestrate Conrad's Phase 2 pipeline:
    if (!Array.isArray(candidatePlaces) || candidatePlaces.length === 0) {
      const destObj =
        typeof destination === "object"
          ? destination
          : {
              name: canonicalDest?.name || destination.split(",")[0].trim(),
              country:
                canonicalDest?.country ||
                destination.split(",")[1]?.trim() ||
                "",
            };

      // 5a. Build Google Places queries based on destination & quiz
      const generated = await placesQueryBuilder.buildPlacesQueries({
        destination: destObj,
        quiz,
      });

      // 5b. Search real places via Google Places Text Search
      const searchResults = await googlePlacesService.searchPlacesForQueries(
        generated.queries,
        destObj
      );

      // 5c. Normalize places
      const normalized = placeNormalizer.normalizePlaces(
        searchResults.places
      );

      // 5d. Flatten normalized places into candidate places array
      candidatePlaces = ["attractions", "food", "experiences"].flatMap(
        (category) => normalized[category] || []
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

    // 6. Generate structured itinerary via Gemini (Phase 3)
    const formattedDestination =
      typeof destination === "string"
        ? destination
        : `${destination.name}, ${destination.country}`;

    const { itinerary, model } = await itineraryService.generateItinerary({
      destination: formattedDestination,
      quiz,
      candidatePlaces,
      numberOfDays: req.body.numberOfDays,
      startDate: req.body.startDate,
      context: req.body.context || {},
    });

    // 7. Attach Phase 5 extra trip details to the itinerary
    if (practicalInfo) {
      itinerary.practicalInfo = practicalInfo;
    }

    // 8. If linked to an existing trip, persist itinerary to DynamoDB
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
      destination: formattedDestination,
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
        message:
          err.message || "The AI returned an invalid itinerary response.",
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


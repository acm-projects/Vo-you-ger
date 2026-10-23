const tripModel = require("../models/tripModel");
const { buildOutline, planningError } = require("../services/tripOutlineService");
const discovery = require("../services/stopDiscoveryService");
const countryItineraries = require("../services/countryItineraryService");

function outlineForTrip(trip, body = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw require('../services/apiError').apiError('INVALID_BODY','A JSON object body is required');
  const countryId = body.countryId || body.destinationId;
  if (typeof countryId !== "string" || !trip.recommendations?.some((item) =>
    item.type === "country" && item.destinationId === countryId)) {
    throw planningError("Select a countryId from this trip's recommendations");
  }
  if (!trip.quizSnapshot || typeof trip.quizSnapshot !== "object" || Array.isArray(trip.quizSnapshot)) {
    throw planningError("This trip has no saved assessment");
  }
  return buildOutline({
    countryId, quiz: trip.quizSnapshot, numberOfDays: body.numberOfDays, numberOfNights: body.numberOfNights,
    startDate: body.startDate ?? trip.itinerary?.outline?.startDate ?? trip.quizSnapshot.startDate,
  });
}

function handleError(error, res) {
  if(error.name==='ConditionalCheckFailedException') error=require('../services/apiError').apiError('TRIP_CHANGED','Trip was saved or changed during generation; retry to create a separate draft',409);
  return require('../services/apiError').sendError(res,error);
}

// Preview is pure: it does not invalidate or change a previously saved itinerary.
async function previewCountryRoute(req, res) {
  try {
    const trip = await tripModel.findTripById(req.user.userId, req.params.tripId);
    if (!trip) throw require('../services/apiError').apiError('TRIP_NOT_FOUND', "Trip not found", 404);
    const outline = outlineForTrip(trip, req.body);
    return res.status(200).json({ tripId: trip.tripId, outline });
  } catch (error) {
    return handleError(error, res);
  }
}

async function getCountryPlaces(req, res, trip) {
  try {
    const outline = outlineForTrip(trip, req.body);
    const stops = await discovery.discoverStops(outline, trip.quizSnapshot);
    return res.status(200).json({ tripId: trip.tripId, outline, stops });
  } catch (error) {
    return handleError(error, res);
  }
}

async function createCountryItinerary(req, res, trip) {
  return require('../services/telemetryService').instrument('countryTrip', () => generateAndPersist(req, res, trip));
}

async function generateAndPersist(req, res, trip) {
  try {
    const outline = outlineForTrip(trip, req.body);
    // Ignore client candidatePlaces, quiz, and context: all country trips use the
    // stored assessment and fresh server-side Google Places discovery.
    const { itinerary, model } = await countryItineraries.generateCountryItinerary({
      outline, quiz: trip.quizSnapshot, startDate: outline.startDate,
    });
    // Saved itineraries are stable artifacts. A new generation forks a draft so
    // another country/date choice cannot silently replace a trip on the globe.
    let updated;
    if (trip.isSaved === true || !trip.tripId) {
      updated = await tripModel.createTrip(req.user.userId, {
        title: itinerary.tripTitle, summary: itinerary.summary,
        recommendations: trip.recommendations, quiz: trip.quizSnapshot, model, selectionMetadata: trip.selectionMetadata, itinerary,
      });
    } else {
      updated = await tripModel.updateTripItinerary(req.user.userId, trip.tripId, itinerary, model);
    }
    // New drafts use one atomic put; existing drafts use one conditional update.
    const { PK, SK, ...safeTrip } = updated;
    return res.status(200).json({ message: "Itinerary generated successfully", destination: outline.country, itinerary, model, trip: safeTrip });
  } catch (error) {
    return handleError(error, res);
  }
}

module.exports = { previewCountryRoute, getCountryPlaces, createCountryItinerary, outlineForTrip };

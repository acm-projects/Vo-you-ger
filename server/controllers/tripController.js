
const {
  findTripById,
  saveTrip,
  unsaveTrip,
  getSavedTrips,
  getSavedTripSummaries,
} = require("../models/tripModel");
const { globeResponse } = require("../services/tripSummaryService");
const {apiError,sendError}=require('../services/apiError');
function publicTrip(trip) {const {PK,SK,...result}=trip;return result;}
async function getTripDayPlacesController(req,res) {
  try {
    const trip=await findTripById(req.user.userId,req.params.tripId);
    if(!trip) throw apiError('TRIP_NOT_FOUND','Trip not found',404);
    const data=await require('../services/savedVenueService').refreshDay(trip,Number(req.params.day));
    return res.json(data);
  } catch(error) {return sendError(res,error);}
}

async function getTripGlobeController(req, res) {
  try {
    return res.status(200).json(globeResponse(await getSavedTripSummaries(req.user.userId)));
  } catch (error) {
    return handleTripError(error, res);
  }
}

function handleTripError(error, res) {
  if (
    error.statusCode === 404 ||
    error.name === "ConditionalCheckFailedException"
  ) {
    return res.status(404).json({
      error: "Not Found",
      message: "Trip not found",
    });
  }

  if (error.statusCode === 400) {
    return res.status(400).json({
      error: "Bad Request",
      message: error.message,
    });
  }

  console.error("Trip operation failed:", error);

  return res.status(500).json({
    error: "Internal Server Error",
    message: "An error occurred while processing the trip",
  });
}

// PUT /api/trips/:tripId/save
async function saveTripController(req, res) {
  try {
    const trip = await saveTrip(
      req.user.userId,
      req.params.tripId,
    );

    return res.status(200).json({
      message: "Trip saved successfully",
      trip: publicTrip(trip),
    });
  } catch (error) {
    return handleTripError(error, res);
  }
}

// DELETE /api/trips/:tripId/save
async function unsaveTripController(req, res) {
  try {
    const trip = await unsaveTrip(
      req.user.userId,
      req.params.tripId,
    );

    return res.status(200).json({
      message: "Trip removed from saved trips",
      trip: publicTrip(trip),
    });
  } catch (error) {
    return handleTripError(error, res);
  }
}

// GET /api/trips/saved
async function getSavedTripsController(req, res) {
  try {
    const trips = await getSavedTrips(req.user.userId);

    return res.status(200).json({
      trips: trips.map(publicTrip),
      count: trips.length,
    });
  } catch (error) {
    return handleTripError(error, res);
  }
}

// GET /api/trips/:tripId
async function getTripController(req, res) {
  try {
    const trip = await findTripById(
      req.user.userId,
      req.params.tripId,
    );

    if (!trip) {
      return res.status(404).json({
        error: "Not Found",
        message: "Trip not found",
      });
    }

    return res.status(200).json({ trip: publicTrip(trip) });
  } catch (error) {
    return handleTripError(error, res);
  }
}

module.exports = {
  saveTripController,
  unsaveTripController,
  getSavedTripsController,
  getTripController,
  getTripGlobeController,
  getTripDayPlacesController,
};

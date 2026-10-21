
const {
  findTripById,
  saveTrip,
  unsaveTrip,
  getSavedTrips,
} = require("../models/tripModel");

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
      trip,
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
      trip,
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
      trips,
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

    return res.status(200).json({ trip });
  } catch (error) {
    return handleTripError(error, res);
  }
}

module.exports = {
  saveTripController,
  unsaveTripController,
  getSavedTripsController,
  getTripController,
};

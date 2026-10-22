
const express = require("express");
const router = express.Router();

const {
  saveTripController,
  unsaveTripController,
  getSavedTripsController,
  getTripController,
} = require("../controllers/tripController");

const {
  authenticateToken,
} = require("../middleware/authMiddleware");

// All trip routes require authentication.
router.use(authenticateToken);

// GET /api/trips/saved
// Retrieve the authenticated user's saved trips.
router.get("/saved", getSavedTripsController);

// PUT /api/trips/:tripId/save
// Save an existing generated itinerary.
router.put("/:tripId/save", saveTripController);

// DELETE /api/trips/:tripId/save
// Remove a trip from saved trips without deleting it.
router.delete("/:tripId/save", unsaveTripController);

// GET /api/trips/:tripId
// Retrieve a specific trip owned by the user.
router.get("/:tripId", getTripController);

module.exports = router;

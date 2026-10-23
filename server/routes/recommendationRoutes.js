const { generationLimiter } = require('../middleware/generationLimiter');

const express = require("express");
const router = express.Router();

const {
  createRecommendations,
  getDestinationPlaces,
} = require("../controllers/recommendationController");

const {
  authenticateToken,
} = require("../middleware/authMiddleware");

// Generate three destination recommendations.
router.post(
  "/",
  authenticateToken,
  generationLimiter,
  createRecommendations
);

// Retrieve real places after a destination is selected.
router.post(
  "/:tripId/places",
  authenticateToken,
  generationLimiter,
  getDestinationPlaces
);

module.exports = router;

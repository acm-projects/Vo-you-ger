const { generationLimiter } = require('../middleware/generationLimiter');
/**
 * server/routes/itineraryRoutes.js
 *
 * Route definitions for Itinerary Generation (Phase 3).
 * Requires JWT Bearer token authentication.
 */

const express = require("express");
const router = express.Router();
const { createItinerary } = require("../controllers/itineraryController");
const { authenticateToken } = require("../middleware/authMiddleware");

// POST /api/itinerary/generate
// Generates an itinerary from Phase 2 candidate places and traveler quiz profile
router.post("/generate", authenticateToken, generationLimiter, createItinerary);

// POST /api/itinerary/:tripId
// Generates an itinerary and directly updates the specified trip in DynamoDB
router.post("/:tripId", authenticateToken, generationLimiter, createItinerary);

module.exports = router;


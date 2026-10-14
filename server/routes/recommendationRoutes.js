const express = require("express");
const router = express.Router();
const { createRecommendations } = require("../controllers/recommendationController");
const { authenticateToken } = require("../middleware/authMiddleware");

router.post("/", authenticateToken, createRecommendations);

module.exports = router;
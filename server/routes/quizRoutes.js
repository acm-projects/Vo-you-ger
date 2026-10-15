const express = require("express");
const router = express.Router();
const { saveQuiz, getQuiz } = require("../controllers/quizController");
const { authenticateToken } = require("../middleware/authMiddleware");

// Both routes require a valid JWT token

// Mount routes
router.post("/", authenticateToken, saveQuiz);
router.get("/", authenticateToken, getQuiz);

module.exports = router;

const express = require("express");
const router = express.Router();
const {
  register,
  login,
  getMe,
  updateMe,
} = require("../controllers/authController");
const { authenticateToken } = require("../middleware/authMiddleware");

// Public endpoints
router.post("/register", register);
router.post("/login", login);

// Authenticated endpoints
router.get("/me", authenticateToken, getMe);
router.patch("/me", authenticateToken, updateMe);

module.exports = router;


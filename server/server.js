// Load variables from .env file and attach them to process.env
require("dotenv").config();

// Import express
const express = require("express");

// Create app instance
const app = express();

// Import and configure cors to accept requests from front end
const cors = require("cors");
const corsOptions = {
  origin: ["http://localhost:5173"],
};

// Initialize app to use cors
app.use(cors(corsOptions));

// Allow parsing incoming JSON request bodies
app.use(express.json());

// Import routes
const authRoutes = require("./routes/authRoutes");
const recommendationRoutes = require("./routes/recommendationRoutes");
const quizRoutes = require("./routes/quizRoutes");
const itineraryRoutes = require("./routes/itineraryRoutes");

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Mount authentication and user routes
app.use("/api/auth", authRoutes);

// Mount quiz assessment routes
app.use("/api/quiz", quizRoutes);

// Mount AI recommendation routes
app.use("/api/recommendations", recommendationRoutes);

// Mount AI itinerary routes (Phase 3)
app.use("/api/itinerary", itineraryRoutes);

// Export app instance (useful for testing)
module.exports = app;

// Run app
const PORT = process.env.PORT || 8080;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
  });
}
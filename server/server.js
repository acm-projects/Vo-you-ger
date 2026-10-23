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
const tripRoutes = require("./routes/tripRoutes");

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
// Mount Saved Trips routes
app.use("/api/trips", tripRoutes);
app.use("/api/countries", require("./routes/countryRoutes"));
app.use((error, req, res, next) => {
  if(error.type==='entity.too.large') return res.status(413).json({error:'Request Error',code:'BODY_TOO_LARGE',message:'Request body exceeds the supported size'});
  if(error instanceof SyntaxError && error.status === 400) return res.status(400).json({error:"Bad Request",code:"INVALID_JSON",message:"Request body must be valid JSON"});
  if(res.headersSent) return next(error);
  return res.status(500).json({error:"Internal Server Error",code:"INTERNAL_ERROR",message:"Unable to process this request"});
});

// Export app instance (useful for testing)
module.exports = app;

// Run app
const PORT = process.env.PORT || 8080;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
  });
}

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

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Mount authentication and user routes
app.use("/api/auth", authRoutes);

// Export app instance (useful for testing)
module.exports = app;

// Run app
const PORT = process.env.PORT || 8080;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
  });
}

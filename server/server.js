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

// Create entry route for backend API
app.get("/api", (req, res) => {
  res.json({ fruits: ["apple", "orange", "strawberry"] });
});

// Run app
app.listen(8080, () => {
  console.log("Server started on port 8080");
});

// Load environment variables (DATABASE_URL, JWT_SECRET) before anything else
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

// Local imports
const prisma = require("./lib/prisma");
const authRoutes = require("./routes/auth");
const requireAuth = require("./middleware/auth");

if (!process.env.JWT_SECRET) {
  console.error("Missing JWT_SECRET in .env");
  process.exit(1);
}

// Initialize app to use cors
app.use(cors(corsOptions));

// Parse JSON request bodies (needed for register/login)
app.use(express.json());

// Auth routes: POST /api/auth/register and POST /api/auth/login
app.use("/api/auth", authRoutes);

// Create entry route for backend API
app.get("/api", (req, res) => {
  res.json({ fruits: ["apple", "orange", "strawberry"] });
});

// Example protected route, handy for testing the middleware
app.get("/api/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      fName: true,
      lName: true,
      email: true,
      nationalities: true,
      firstTime: true,
    },
  });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  res.json({ user });
});

// Run app
app.listen(8080, () => {
  console.log("Server started on port 8080");
});
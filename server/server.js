require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const prisma = require("./db");
const authenticateToken = require("./middleware/auth");

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is missing from .env");
}

const app = express();

app.use(cors({
  origin: ["http://localhost:5173"],
}));

// Makes JSON request bodies available through req.body.
app.use(express.json({ limit: "16kb" }));

function createToken(userId) {
  return jwt.sign({}, process.env.JWT_SECRET, {
    subject: userId,
    algorithm: "HS256",
    expiresIn: "1h",
  });
}

// Only these user fields may be returned to the frontend.
const publicUserFields = {
  id: true,
  fName: true,
  lName: true,
  email: true,
  nationalities: true,
  firstTime: true,
};

app.get("/api", (req, res) => {
  res.json({ fruits: ["apple", "orange", "strawberry"] });
});

// REGISTER
app.post("/api/auth/register", async (req, res, next) => {
  const {
    fName,
    lName,
    email,
    password,
    nationalities = [],
  } = req.body || {};

  if (
    typeof fName !== "string" || !fName.trim() ||
    typeof lName !== "string" || !lName.trim() ||
    typeof email !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
    typeof password !== "string"
  ) {
    return res.status(400).json({
      message: "First name, last name, valid email, and password are required.",
    });
  }

  // bcrypt only handles the first 72 bytes of a password.
  if (
    password.length < 8 ||
    Buffer.byteLength(password, "utf8") > 72
  ) {
    return res.status(400).json({
      message: "Password must be at least 8 characters and at most 72 bytes.",
    });
  }

  if (
    !Array.isArray(nationalities) ||
    !nationalities.every(
      (value) => typeof value === "string" && value.trim()
    )
  ) {
    return res.status(400).json({
      message: "Nationalities must be an array of nonempty strings.",
    });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return res.status(409).json({
        message: "An account with this email already exists.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        fName: fName.trim(),
        lName: lName.trim(),
        email: normalizedEmail,
        password: passwordHash,
        nationalities: nationalities.map((value) => value.trim()),
      },
      select: publicUserFields,
    });

    return res.status(201).json({
      token: createToken(user.id),
      user,
    });
  } catch (error) {
    // Handles simultaneous registrations with the same email.
    if (error.code === "P2002") {
      return res.status(409).json({
        message: "An account with this email already exists.",
      });
    }

    next(error);
  }
});

// LOGIN
app.post("/api/auth/login", async (req, res, next) => {
  const { email, password } = req.body || {};

  if (
    typeof email !== "string" || !email.trim() ||
    typeof password !== "string" || !password
  ) {
    return res.status(400).json({
      message: "Email and password are required.",
    });
  }

  if (Buffer.byteLength(password, "utf8") > 72) {
    return res.status(401).json({
      message: "Invalid email or password.",
    });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    const validPassword = user
      ? await bcrypt.compare(password, user.password)
      : false;

    if (!validPassword) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    return res.json({
      token: createToken(user.id),
      user: {
        id: user.id,
        fName: user.fName,
        lName: user.lName,
        email: user.email,
        nationalities: user.nationalities,
        firstTime: user.firstTime,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Example authenticated endpoint.
app.get("/api/auth/me", authenticateToken, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: publicUserFields,
    });

    if (!user) {
      return res.status(401).json({
        message: "User no longer exists.",
      });
    }

    res.json({ user });
  } catch (error) {
    next(error);
  }
});

// Error handler must come after the routes.
app.use((error, req, res, next) => {
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Invalid JSON body." });
  }

  if (error.type === "entity.too.large") {
    return res.status(413).json({ message: "Request body is too large." });
  }

  console.error("Request failed:", error.message);
  res.status(500).json({ message: "An internal server error occurred." });
});

async function startServer() {
  await prisma.$connect();

  app.listen(8080, () => {
    console.log("Server started on port 8080");
  });
}

startServer().catch((error) => {
  console.error("Could not start server:", error.message);
  process.exit(1);
});
const bcrypt = require("bcryptjs");
const {
  createUser,
  findUserByEmail,
  findUserById,
  updateUser,
  sanitizeUser,
} = require("../models/userModel");
const { generateToken } = require("../middleware/authMiddleware");

// Simple email regex for validation
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/auth/register
 * Registers a new user, hashes password, saves to DynamoDB, and returns JWT.
 */
async function register(req, res) {
  try {
    const { fName, lName, email, password, nationalities, quizResponse } = req.body;

    // Validate presence of required fields
    if (!fName || !lName || !email || !password) {
      return res.status(400).json({
        error: "Bad Request",
        message: "First name, last name, email, and password are required",
      });
    }

    // Validate field types and constraints
    if (typeof fName !== "string" || !fName.trim()) {
      return res.status(400).json({
        error: "Bad Request",
        message: "First name must be a non-empty string",
      });
    }

    if (typeof lName !== "string" || !lName.trim()) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Last name must be a non-empty string",
      });
    }

    const trimmedEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      return res.status(400).json({
        error: "Bad Request",
        message: "A valid email address is required",
      });
    }

    if (typeof password !== "string" || password.length < 6) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Password must be at least 6 characters long",
      });
    }

    if (nationalities !== undefined && !Array.isArray(nationalities)) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Nationalities must be an array of strings",
      });
    }

    // Hash password with bcrypt
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Save user to DynamoDB
    const newUser = await createUser({
      fName,
      lName,
      email: trimmedEmail,
      passwordHash,
      nationalities: nationalities || [],
      quizResponse: quizResponse || null,
    });

    const safeUser = sanitizeUser(newUser);
    const token = generateToken(safeUser);

    return res.status(201).json({
      message: "User registered successfully",
      token,
      user: safeUser,
    });
  } catch (err) {
    if (err.statusCode === 409 || err.code === "EMAIL_ALREADY_EXISTS") {
      return res.status(409).json({
        error: "Conflict",
        message: "An account with this email already exists",
      });
    }

    console.error("Error during user registration:", err);
    return res.status(500).json({
      error: "Internal Server Error",
      message: "An error occurred while creating your account",
    });
  }
}

/**
 * POST /api/auth/login
 * Verifies email and password credentials, and returns JWT.
 */
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Email and password are required",
      });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const user = await findUserByEmail(trimmedEmail);

    if (!user) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Invalid email or password",
      });
    }

    // Verify password against stored hash
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Invalid email or password",
      });
    }

    const safeUser = sanitizeUser(user);
    const token = generateToken(safeUser);

    return res.status(200).json({
      message: "Login successful",
      token,
      user: safeUser,
    });
  } catch (err) {
    console.error("Error during user login:", err);
    return res.status(500).json({
      error: "Internal Server Error",
      message: "An error occurred while logging in",
    });
  }
}

/**
 * GET /api/auth/me
 * Retrieves current authenticated user's profile.
 */
async function getMe(req, res) {
  try {
    const user = await findUserById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        error: "Not Found",
        message: "User not found",
      });
    }

    return res.status(200).json({
      user: sanitizeUser(user),
    });
  } catch (err) {
    console.error("Error fetching current user profile:", err);
    return res.status(500).json({
      error: "Internal Server Error",
      message: "An error occurred while fetching user profile",
    });
  }
}

/**
 * PATCH /api/auth/me
 * Updates current authenticated user's core attributes.
 */
async function updateMe(req, res) {
  try {
    const { fName, lName, nationalities, firstTime, quizResponse } = req.body;
    const updates = {};

    if (fName !== undefined) {
      if (typeof fName !== "string" || !fName.trim()) {
        return res.status(400).json({
          error: "Bad Request",
          message: "First name must be a non-empty string",
        });
      }
      updates.fName = fName.trim();
    }

    if (lName !== undefined) {
      if (typeof lName !== "string" || !lName.trim()) {
        return res.status(400).json({
          error: "Bad Request",
          message: "Last name must be a non-empty string",
        });
      }
      updates.lName = lName.trim();
    }

    if (nationalities !== undefined) {
      if (!Array.isArray(nationalities)) {
        return res.status(400).json({
          error: "Bad Request",
          message: "Nationalities must be an array of strings",
        });
      }
      updates.nationalities = nationalities;
    }

    if (firstTime !== undefined) {
      updates.firstTime = Boolean(firstTime);
    }

    if (quizResponse !== undefined) {
      updates.quizResponse = quizResponse;
    }

    const updatedUser = await updateUser(req.user.userId, updates);

    return res.status(200).json({
      message: "Profile updated successfully",
      user: sanitizeUser(updatedUser),
    });
  } catch (err) {
    console.error("Error updating user profile:", err);
    return res.status(500).json({
      error: "Internal Server Error",
      message: "An error occurred while updating profile",
    });
  }
}

module.exports = {
  register,
  login,
  getMe,
  updateMe,
};


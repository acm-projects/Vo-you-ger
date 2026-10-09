const jwt = require("jsonwebtoken");

function getJwtSecret() {
  return process.env.JWT_SECRET || "default_jwt_secret_dev";
}

function getJwtExpiresIn() {
  return process.env.JWT_EXPIRES_IN || "7d";
}

/**
 * Generate a JWT token for a user.
 */
function generateToken(user) {
  const payload = {
    userId: user.id || user.userId,
    email: user.email,
  };

  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: getJwtExpiresIn(),
  });
}

/**
 * Express middleware to verify JWT in Authorization header.
 * Expected format: Bearer <token>
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (!authHeader) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Access token is required",
    });
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Invalid token format. Expected: Bearer <token>",
    });
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Token has expired",
      });
    }

    return res.status(403).json({
      error: "Forbidden",
      message: "Invalid token",
    });
  }
}

module.exports = {
  authenticateToken,
  generateToken,
};

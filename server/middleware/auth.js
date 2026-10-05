const jwt = require("jsonwebtoken");

function authenticateToken(req, res, next) {
  const authorization = req.headers.authorization;
  const match = /^Bearer\s+(\S+)$/i.exec(authorization || "");

  if (!match) {
    return res.status(401).json({
      message: "A Bearer token is required.",
    });
  }

  try {
    const payload = jwt.verify(match[1], process.env.JWT_SECRET, {
      algorithms: ["HS256"],
    });

    if (
      typeof payload !== "object" ||
      typeof payload.sub !== "string"
    ) {
      return res.status(401).json({
        message: "Invalid token.",
      });
    }

    req.user = { id: payload.sub };
    next();
  } catch {
    return res.status(401).json({
      message: "Invalid or expired token.",
    });
  }
}

module.exports = authenticateToken;
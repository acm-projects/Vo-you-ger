const { quizSchema } = require("../schemas/recommendationSchema");
const { findUserById, updateUser } = require("../models/userModel");

/**
 * POST /api/quiz
 * Saves or updates the user's travel quiz responses in DynamoDB.
 * Requires Authentication.
 */
async function saveQuiz(req, res) {
  try {
    // Extract req.user.userId from the verified JWT token
    const userId = req.user.userId;

    // Verify user exists
    const user = await findUserById(userId);
    if (!user) {
      return res.status(404).json({
        error: "Not Found",
        message: "User not found",
      });
    }

    // Validate request body against Zod quizSchema
    if (
      !req.body ||
      typeof req.body !== "object" ||
      Object.keys(req.body).length === 0
    ) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Quiz responses cannot be empty",
      });
    }

    // If the user sends invalid data (e.g. minNights: "three" instead of a number), it fails fast with a 400 Bad Request and descriptive error message before touching the database.
    const validationResult = quizSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errorDetails = validationResult.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ");

      return res.status(400).json({
        error: "Bad Request",
        message: `Invalid quiz data: ${errorDetails}`,
      });
    }

    const validatedQuiz = validationResult.data;

    // Call updateUser to update DynamoDB save quiz response and set firstTime to false
    const updatedUser = await updateUser(userId, {
      quizResponse: validatedQuiz,
      firstTime: false,
    });

    return res.status(200).json({
      message: "Quiz responses saved successfully",
      quizResponse: updatedUser.quizResponse,
      firstTime: updatedUser.firstTime,
    });
  } catch (err) {
    console.error("Error saving quiz responses:", err);
    return res.status(500).json({
      error: "Internal Server Error",
      message: "An error occurred while saving your quiz responses",
    });
  }
}

/**
 * GET /api/quiz
 * Retrieves the authenticated user's saved quiz responses.
 * Requires Authentication.
 *
 * Returns the user's quiz response (or null if no user found)
 */
async function getQuiz(req, res) {
  try {
    // Extract req.user.userId from the verified JWT token
    const userId = req.user.userId;

    // Verify user exists
    const user = await findUserById(userId);
    if (!user) {
      return res.status(404).json({
        error: "Not Found",
        message: "User not found",
      });
    }

    return res.status(200).json({
      quizResponse: user.quizResponse || null,
      firstTime: user.firstTime !== undefined ? user.firstTime : true,
    });
  } catch (err) {
    console.error("Error retrieving quiz responses:", err);
    return res.status(500).json({
      error: "Internal Server Error",
      message: "An error occurred while retrieving your quiz responses",
    });
  }
}

module.exports = {
  saveQuiz,
  getQuiz,
};

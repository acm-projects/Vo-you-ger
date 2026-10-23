function apiError(code, message, statusCode = 400) {
  return Object.assign(new Error(message), { code, statusCode });
}
function sendError(res, error) {
  const status = [400, 401, 403, 404, 409, 413, 422, 429, 502, 503, 504].includes(error.statusCode) ? error.statusCode : 500;
  return res.status(status).json({ error: status >= 500 ? "Service Error" : "Request Error", code: error.code || (status === 500 ? "INTERNAL_ERROR" : "REQUEST_FAILED"), message: status === 500 ? "Unable to complete this request" : error.message });
}
module.exports = { apiError, sendError };

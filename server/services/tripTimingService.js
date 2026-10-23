function validateStartDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) {
    throw Object.assign(new Error("startDate must be a real calendar date in YYYY-MM-DD format"), { statusCode: 400 });
  }
  return value;
}

module.exports = { validateStartDate };

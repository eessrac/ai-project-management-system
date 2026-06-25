const {
  normalizeString,
  isValidDateOnly,
} = require("../utils/validation");

const ALLOWED_SPRINT_STATUS = new Set(["PLANNED", "ACTIVE", "DONE"]);

function validateSprintCreate(req, res, next) {
  const { start_date, name } = req.body;

  if (!start_date || !isValidDateOnly(start_date)) {
    return res.status(400).json({
      message: "start_date required (YYYY-MM-DD)",
    });
  }

  if (name !== undefined && !normalizeString(name)) {
    return res.status(400).json({ message: "name cannot be empty" });
  }

  if (name !== undefined) {
    req.body.name = normalizeString(name);
  }

  next();
}

function validateSprintUpdate(req, res, next) {
  const { name, start_date, end_date, status } = req.body;

  if (name !== undefined && !normalizeString(name)) {
    return res.status(400).json({ message: "name cannot be empty" });
  }

  if (
    start_date !== undefined &&
    start_date !== "" &&
    !isValidDateOnly(start_date)
  ) {
    return res.status(400).json({
      message: "Invalid start_date format. Use YYYY-MM-DD",
    });
  }

  if (
    end_date !== undefined &&
    end_date !== "" &&
    !isValidDateOnly(end_date)
  ) {
    return res.status(400).json({
      message: "Invalid end_date format. Use YYYY-MM-DD",
    });
  }

  if (status !== undefined && !ALLOWED_SPRINT_STATUS.has(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }

  if (name !== undefined) {
    req.body.name = normalizeString(name);
  }

  next();
}

module.exports = {
  validateSprintCreate,
  validateSprintUpdate,
  ALLOWED_SPRINT_STATUS,
};

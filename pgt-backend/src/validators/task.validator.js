const {
  normalizeString,
  isNonEmptyString,
  isValidDateOnly,
} = require("../utils/validation");

const ALLOWED_STATUS = new Set(["TODO", "IN_PROGRESS", "DONE"]);
const ALLOWED_PRIORITY = new Set(["LOW", "MEDIUM", "HIGH"]);

function isValidIdArray(value) {
  if (value === undefined) return true;
  if (value === null) return true;
  if (!Array.isArray(value)) return false;

  return value.every((id) => typeof id === "string" && id.trim() !== "");
}

function isValidNonNegativeNumber(value) {
  if (value === undefined || value === null || value === "") return true;

  const n = Number(value);
  return Number.isFinite(n) && n >= 0;
}

function validateTaskCreate(req, res, next) {
  const { title, priority, start_date, due_date, assignee_ids, estimated_cost, actual_cost } = req.body;

  if (!isNonEmptyString(title)) {
    return res.status(400).json({ message: "title required" });
  }

  if (priority !== undefined && !ALLOWED_PRIORITY.has(priority)) {
    return res.status(400).json({ message: "Invalid priority" });
  }

  if (
    start_date !== undefined &&
    start_date !== null &&
    start_date !== "" &&
    !isValidDateOnly(start_date)
  ) {
    return res.status(400).json({
      message: "Invalid start_date format. Use YYYY-MM-DD",
    });
  }

  if (
    due_date !== undefined &&
    due_date !== null &&
    due_date !== "" &&
    !isValidDateOnly(due_date)
  ) {
    return res.status(400).json({
      message: "Invalid due_date format. Use YYYY-MM-DD",
    });
  }

  if (!isValidIdArray(assignee_ids)) {
    return res.status(400).json({
      message: "assignee_ids must be an array of user ids",
    });
  }

  if (!isValidNonNegativeNumber(estimated_cost)) {
    return res.status(400).json({
      message: "estimated_cost must be a non-negative number",
    });
  }

  if (!isValidNonNegativeNumber(actual_cost)) {
    return res.status(400).json({
      message: "actual_cost must be a non-negative number",
    });
  }

  req.body.title = normalizeString(title);

  if (Array.isArray(assignee_ids)) {
    req.body.assignee_ids = assignee_ids
      .map((id) => String(id).trim())
      .filter(Boolean);
  }

  next();
}

function validateTaskUpdate(req, res, next) {
  const { title, status, priority, start_date, due_date, assignee_ids, estimated_cost, actual_cost } = req.body;

  if (title !== undefined && !isNonEmptyString(title)) {
    return res.status(400).json({ message: "title cannot be empty" });
  }

  if (status !== undefined && !ALLOWED_STATUS.has(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }

  if (priority !== undefined && !ALLOWED_PRIORITY.has(priority)) {
    return res.status(400).json({ message: "Invalid priority" });
  }

  if (
    start_date !== undefined &&
    start_date !== null &&
    start_date !== "" &&
    !isValidDateOnly(start_date)
  ) {
    return res.status(400).json({
      message: "Invalid start_date format. Use YYYY-MM-DD",
    });
  }

  if (
    due_date !== undefined &&
    due_date !== null &&
    due_date !== "" &&
    !isValidDateOnly(due_date)
  ) {
    return res.status(400).json({
      message: "Invalid due_date format. Use YYYY-MM-DD",
    });
  }

  if (!isValidNonNegativeNumber(estimated_cost)) {
    return res.status(400).json({
      message: "estimated_cost must be a non-negative number",
    });
  }

  if (!isValidNonNegativeNumber(actual_cost)) {
    return res.status(400).json({
      message: "actual_cost must be a non-negative number",
    });
  }

  if (!isValidIdArray(assignee_ids)) {
    return res.status(400).json({
      message: "assignee_ids must be an array of user ids",
    });
  }

  if (title !== undefined) {
    req.body.title = normalizeString(title);
  }

  if (Array.isArray(assignee_ids)) {
    req.body.assignee_ids = assignee_ids
      .map((id) => String(id).trim())
      .filter(Boolean);
  }

  next();
}

module.exports = {
  validateTaskCreate,
  validateTaskUpdate,
  ALLOWED_STATUS,
  ALLOWED_PRIORITY,
};
const {
  normalizeString,
  isNonEmptyString,
} = require("../utils/validation");

function validateProjectCreate(req, res, next) {
  const { name, color } = req.body;

  if (!isNonEmptyString(name)) {
    return res.status(400).json({ message: "name required" });
  }

  const normalizedName = normalizeString(name);

  if (normalizedName.length > 120) {
    return res.status(400).json({ message: "name must be at most 120 characters" });
  }

  req.body.name = normalizedName;

  if (req.body.description !== undefined) {
    if (
      req.body.description !== null &&
      typeof req.body.description !== "string"
    ) {
      return res.status(400).json({ message: "description must be a string or null" });
    }

    const normalizedDescription = normalizeString(req.body.description);
    if (normalizedDescription && normalizedDescription.length > 5000) {
      return res.status(400).json({ message: "description is too long" });
    }

    req.body.description = normalizedDescription || null;
  }

    if (req.body.sprint_duration_days !== undefined) {
      const duration = Number(req.body.sprint_duration_days);

      if (!Number.isInteger(duration) || duration < 1 || duration > 60) {
        return res.status(400).json({
          message: "sprint_duration_days must be between 1 and 60",
        });
      }

      req.body.sprint_duration_days = duration;
    } else {
      req.body.sprint_duration_days = 14;
    }

  if (color !== undefined) {
    const normalizedColor = normalizeString(color);

    if (!/^#[0-9A-Fa-f]{6}$/.test(normalizedColor)) {
      return res.status(400).json({ message: "Invalid project color" });
    }

    req.body.color = normalizedColor;
  } else {
    req.body.color = "#4F46E5";
  }

  next();
}

function validateProjectUpdate(req, res, next) {
  const { name, description, sprint_duration_days, color } = req.body;

  if (
    name === undefined &&
    description === undefined &&
    sprint_duration_days === undefined &&
    color === undefined
  ) {
    return res.status(400).json({ message: "name, description, sprint duration or color required" });
  }

  if (name !== undefined) {
    if (!isNonEmptyString(name)) {
      return res.status(400).json({ message: "name cannot be empty" });
    }

    const normalizedName = normalizeString(name);

    if (normalizedName.length > 120) {
      return res.status(400).json({ message: "name must be at most 120 characters" });
    }

    req.body.name = normalizedName;
  }

  if (description !== undefined) {
    if (description !== null && typeof description !== "string") {
      return res.status(400).json({ message: "description must be a string or null" });
    }

    const normalizedDescription = normalizeString(description);

    if (normalizedDescription && normalizedDescription.length > 5000) {
      return res.status(400).json({ message: "description is too long" });
    }

    req.body.description = normalizedDescription || null;
  }

    if (sprint_duration_days !== undefined) {
      const duration = Number(sprint_duration_days);

      if (!Number.isInteger(duration) || duration < 1 || duration > 60) {
        return res.status(400).json({
          message: "sprint_duration_days must be between 1 and 60",
        });
      }

      req.body.sprint_duration_days = duration;
    }

  if (color !== undefined) {
    const normalizedColor = normalizeString(color);

    if (!/^#[0-9A-Fa-f]{6}$/.test(normalizedColor)) {
      return res.status(400).json({ message: "Invalid project color" });
    }

    req.body.color = normalizedColor;
  }

  next();
}

function validateJoinProject(req, res, next) {
  const joinCode = normalizeString(req.body.join_code).toUpperCase();

  if (!joinCode) {
    return res.status(400).json({ message: "join_code required" });
  }

  req.body.join_code = joinCode;

  next();
}

function validateJoinRequestDecision(req, res, next) {
  const { requestId } = req.params;

  if (!requestId) {
    return res.status(400).json({ message: "requestId required" });
  }

  next();
}

module.exports = {
  validateProjectCreate,
  validateProjectUpdate,
  validateJoinProject,
  validateJoinRequestDecision,
};
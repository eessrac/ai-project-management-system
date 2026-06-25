const {
  normalizeString,
  isNonEmptyString,
} = require("../utils/validation");

function validateUpdateMe(req, res, next) {
  const { full_name } = req.body;

  if (!isNonEmptyString(full_name)) {
    return res.status(400).json({ message: "full_name is required" });
  }

  req.body.full_name = normalizeString(full_name);

  next();
}

function validatePasswordChange(req, res, next) {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      message: "currentPassword and newPassword are required",
    });
  }

  if (String(newPassword).length < 6) {
    return res.status(400).json({
      message: "New password must be at least 6 characters",
    });
  }

  next();
}

module.exports = {
  validateUpdateMe,
  validatePasswordChange,
};

const {
  normalizeString,
  isNonEmptyString,
} = require("../utils/validation");

function validateTaskCommentCreate(req, res, next) {
  const body = String(req.body?.body || "").trim();

  if (!body) {
    return res.status(400).json({ message: "Comment body is required" });
  }

  if (body.length > 2000) {
    return res.status(400).json({ message: "Comment is too long" });
  }

  req.body.body = body;
  next();
}

function validateTaskCommentUpdate(req, res, next) {
  const body = String(req.body?.body || "").trim();

  if (!body) {
    return res.status(400).json({ message: "Comment body is required" });
  }

  if (body.length > 2000) {
    return res.status(400).json({ message: "Comment is too long" });
  }

  req.body.body = body;
  next();
}

module.exports = {
  validateTaskCommentCreate,
  validateTaskCommentUpdate,
};


const jwt = require("jsonwebtoken");

module.exports = function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Missing token" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ normalize et: her yerde req.user.userId garanti olsun
    req.user = {
      ...decoded,
      userId: decoded.userId || decoded.id || decoded.sub,
    };

    if (!req.user.userId) {
      return res.status(401).json({ message: "Invalid token payload (no userId)" });
    }

    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
};
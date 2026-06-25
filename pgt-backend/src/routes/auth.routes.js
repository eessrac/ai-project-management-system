const router = require("express").Router();
const rateLimit = require("express-rate-limit");
const { register, login } = require("../controllers/auth.controller");

// Login brute force koruması
const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 dakika
  max: 20, // 10 dakikada en fazla 5 deneme
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many login attempts. Please try again after 10 minutes.",
  },
});

router.post("/register", register);
router.post("/login", loginLimiter, login);

module.exports = router;
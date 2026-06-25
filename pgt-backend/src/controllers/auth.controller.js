const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../config/db.js");

/**
 * Bu controller, kullanıcı kayıt ve giriş işlemlerini yönetir.
 * Kullanıcı bilgilerini doğrular, güvenli parola kontrolü yapar,
 * şifreleri şifreleyerek veritabanına kaydeder ve başarılı girişlerde JWT token üretir.
 */

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";
const SALT_ROUNDS = 10;

function isStrongPassword(password) {
  // En az 8 karakter, 1 büyük harf, 1 küçük harf, 1 rakam
  const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  return strongPasswordRegex.test(password);
}

async function register(req, res) {
  const { full_name, email, password } = req.body;

  if (!full_name || !full_name.trim()) {
    return res.status(400).json({ message: "full_name required" });
  }

  if (!email || !email.trim()) {
    return res.status(400).json({ message: "email required" });
  }

  if (!password) {
    return res.status(400).json({ message: "password required" });
  }

  if (!isStrongPassword(password)) {
    return res.status(400).json({
      message:
        "Password must be at least 8 characters and include at least 1 uppercase letter, 1 lowercase letter, and 1 number.",
    });
  }

  const emailNorm = email.trim().toLowerCase();

  try {
    const exists = await pool.query(
      `SELECT id FROM users WHERE email=$1`,
      [emailNorm]
    );

    if (exists.rows.length) {
      return res.status(409).json({ message: "Email already in use" });
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    const ins = await pool.query(
      `INSERT INTO users (full_name, email, password_hash)
       VALUES ($1,$2,$3)
       RETURNING id, full_name, email, is_active, created_at`,
      [full_name.trim(), emailNorm, password_hash]
    );

    const user = ins.rows[0];

    const token = jwt.sign(
      { userId: user.id, email: user.email, full_name: user.full_name },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(201).json({ user, token });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !email.trim()) {
    return res.status(400).json({ message: "email required" });
  }

  if (!password) {
    return res.status(400).json({ message: "password required" });
  }

  const emailNorm = email.trim().toLowerCase();

  try {
    const q = await pool.query(
      `SELECT id, full_name, email, password_hash, is_active
       FROM users
       WHERE email=$1`,
      [emailNorm]
    );

    if (!q.rows.length) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const user = q.rows[0];

    if (!user.is_active) {
      return res.status(403).json({ message: "User inactive" });
    }

    const ok = await bcrypt.compare(password, user.password_hash);

    if (!ok) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, full_name: user.full_name },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
      },
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

module.exports = { register, login };

//en az 8 karakter olacak
//en az 1 büyük harf olacak
//en az 1 küçük harf olacak
//en az 1 rakam olacak
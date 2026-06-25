const pool = require("../config/db.js");
const bcrypt = require("bcryptjs");

/**
 * Bu controller, kullanıcı profil işlemlerini yönetir.
 * Profil bilgilerini görüntüleme ve güncelleme, şifre ve e-posta değiştirme,
 * kullanıcı arama ve kullanıcı profillerini görüntüleme işlemlerini gerçekleştirir.
 */

async function me(req, res) {
  try {
    const result = await pool.query(
      `
      SELECT id, full_name, email, is_active, created_at, updated_at, bio, title, avatar_url
      FROM users
      WHERE id=$1
      `,
      [req.user.userId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({ user: result.rows[0] });
  } catch (err) {
    console.error("ME ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function updateMe(req, res) {
  const { full_name, bio, title, avatar_url } = req.body;

  if (!full_name || !full_name.trim()) {
    return res.status(400).json({ message: "full_name is required" });
  }

  try {
    const result = await pool.query(
      `
      UPDATE users
      SET full_name = $1,
          bio = $2,
          title = $3,
          avatar_url = $4,
          updated_at = NOW()
      WHERE id = $5
      RETURNING id, full_name, email, is_active, created_at, updated_at, bio, title, avatar_url
      `,
      [
        full_name.trim(),
        bio?.trim() || null,
        title?.trim() || null,
        avatar_url?.trim() || null,
        req.user.userId,
      ]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({
      message: "Profile updated successfully",
      user: result.rows[0],
    });
  } catch (err) {
    console.error("UPDATE ME ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      message: "currentPassword and newPassword are required",
    });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({
      message: "New password must be at least 6 characters",
    });
  }

  try {
    const result = await pool.query(
      "SELECT id, password_hash FROM users WHERE id=$1",
      [req.user.userId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = result.rows[0];

    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);

    if (!isMatch) {
      return res.status(400).json({
        message: "Current password is incorrect",
      });
    }

    const sameAsOld = await bcrypt.compare(newPassword, user.password_hash);

    if (sameAsOld) {
      return res.status(400).json({
        message: "New password cannot be the same as current password",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await pool.query(
      `
      UPDATE users
      SET password_hash = $1,
          updated_at = NOW()
      WHERE id = $2
      `,
      [hashedPassword, req.user.userId]
    );

    return res.json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("CHANGE PASSWORD ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function searchUsers(req, res) {
  const q = String(req.query.q || "").trim().toLowerCase();
  const projectId = String(req.query.projectId || "").trim();

  if (q.length < 2) {
    return res.json({ users: [] });
  }

  try {
    let result;

    if (projectId) {
      result = await pool.query(
        `
        SELECT u.id, u.full_name, u.email
        FROM users u
        WHERE (
          LOWER(u.email) LIKE $1
          OR LOWER(COALESCE(u.full_name, '')) LIKE $1
        )
        AND NOT EXISTS (
          SELECT 1
          FROM project_members pm
          WHERE pm.project_id = $2
            AND pm.user_id = u.id
        )
        ORDER BY u.email ASC
        LIMIT 10
        `,
        [`%${q}%`, projectId]
      );
    } else {
      result = await pool.query(
        `
        SELECT u.id, u.full_name, u.email
        FROM users u
        WHERE (
          LOWER(u.email) LIKE $1
          OR LOWER(COALESCE(u.full_name, '')) LIKE $1
        )
        ORDER BY u.email ASC
        LIMIT 10
        `,
        [`%${q}%`]
      );
    }

    return res.json({ users: result.rows });
  } catch (err) {
    console.error("SEARCH USERS ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function getUserProfile(req, res) {
  const userId = req.params.id;

  try {
    const userResult = await pool.query(
      `
      SELECT id, full_name, email, created_at, bio, title, avatar_url
      FROM users
      WHERE id = $1
      `,
      [userId]
    );

    if (!userResult.rows.length) {
      return res.status(404).json({ message: "User not found" });
    }

    const memberProjectsResult = await pool.query(
      `
      SELECT
        p.id,
        p.name,
        p.description,
        pm.role,
        pm.joined_at
      FROM project_members pm
      JOIN projects p ON p.id = pm.project_id
      WHERE pm.user_id = $1
        AND COALESCE(p.is_archived, false) = false
      ORDER BY p.created_at DESC
      `,
      [userId]
    );

    const leaderProjects = memberProjectsResult.rows.filter(
      (p) => p.role === "LEADER"
    );

    return res.json({
      user: userResult.rows[0],
      member_projects: memberProjectsResult.rows,
      leader_projects: leaderProjects,
    });
  } catch (err) {
    console.error("GET USER PROFILE ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function updateMyEmail(req, res) {
  const userId = req.user.userId;
  const { email } = req.body;

  if (!email || typeof email !== "string") {
    return res.status(400).json({ message: "Geçerli bir email gir." });
  }

  const emailClean = email.trim().toLowerCase();

  try {
    // başka biri kullanıyor mu
    const exists = await pool.query(
      `SELECT id FROM users WHERE email = $1 AND id <> $2`,
      [emailClean, userId]
    );

    if (exists.rows.length) {
      return res.status(400).json({ message: "Bu email zaten kullanılıyor" });
    }

    const result = await pool.query(
      `
      UPDATE users
      SET email = $1
      WHERE id = $2
      RETURNING id, full_name, email
      `,
      [emailClean, userId]
    );

    return res.json({
      message: "Email güncellendi",
      user: result.rows[0],
    });
  } catch (err) {
    console.error("UPDATE EMAIL ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

module.exports = {
  me,
  updateMe,
  changePassword,
  searchUsers,
  getUserProfile,
  updateMyEmail,
};
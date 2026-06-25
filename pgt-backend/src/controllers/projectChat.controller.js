const pool = require("../config/db.js");
const { createNotification } = require("../utils/notification");
const { getIO } = require("../socket");

/**
 * Bu controller, proje sohbeti işlemlerini yönetir.
 * Proje üyelerinin mesajları listelemesini, yeni mesaj göndermesini,
 * kullanıcı etiketlemelerini, bildirimleri ve gerçek zamanlı socket mesajlarını sağlar.
 */

async function ensureProjectMember(projectId, userId) {
  const memberCheck = await pool.query(
    `
    SELECT 1
    FROM project_members
    WHERE project_id = $1 AND user_id = $2
    LIMIT 1
    `,
    [projectId, userId]
  );

  return memberCheck.rows.length > 0;
}

function extractMentionTokens(text) {
  if (!text) return [];
  const matches = text.match(/@([a-zA-Z0-9_.çğıöşüÇĞİÖŞÜ]+)/g) || [];
  return [...new Set(matches.map((m) => m.slice(1).trim().toLowerCase()))];
}

async function resolveMentionedUsers(projectId, tokens) {
  if (!tokens.length) return [];

  const q = await pool.query(
    `
    SELECT DISTINCT u.id, u.full_name, u.email
    FROM project_members pm
    JOIN users u ON u.id = pm.user_id
    WHERE pm.project_id = $1
    `,
    [projectId]
  );

  const users = q.rows;

  const matched = users.filter((u) => {
    const fullName = String(u.full_name || "").trim().toLowerCase();
    const emailName = String(u.email || "")
      .split("@")[0]
      .trim()
      .toLowerCase();

    return tokens.some(
      (t) => t === fullName || t === emailName || fullName.includes(t)
    );
  });

  return matched;
}

async function getProjectMessages(req, res) {
  const projectId = req.params.id;
  const userId = req.user.userId;

  try {
    const isMember = await ensureProjectMember(projectId, userId);

    if (!isMember) {
      return res.status(403).json({ message: "You are not a member of this project" });
    }

    const result = await pool.query(
      `
      SELECT
        pm.id,
        pm.project_id,
        pm.sender_id,
        pm.message,
        pm.created_at,
        u.full_name AS sender_name,
        u.email AS sender_email
      FROM project_messages pm
      JOIN users u ON u.id = pm.sender_id
      WHERE pm.project_id = $1
      ORDER BY pm.created_at ASC
      `,
      [projectId]
    );

    return res.json({ messages: result.rows });
  } catch (err) {
    console.error("GET PROJECT MESSAGES ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function sendProjectMessage(req, res) {
  const projectId = req.params.id;
  const userId = req.user.userId;
  const message = String(req.body.message || "").trim();

  if (!message) {
    return res.status(400).json({ message: "message is required" });
  }

  if (message.length > 2000) {
    return res.status(400).json({ message: "message is too long" });
  }

  try {
    const isMember = await ensureProjectMember(projectId, userId);

    if (!isMember) {
      return res.status(403).json({ message: "You are not a member of this project" });
    }

    // Mesajı kaydet
    const result = await pool.query(
      `
      INSERT INTO project_messages (project_id, sender_id, message)
      VALUES ($1, $2, $3)
      RETURNING id, project_id, sender_id, message, created_at
      `,
      [projectId, userId, message]
    );

    const inserted = result.rows[0];

    // Gönderen bilgisi
    const senderResult = await pool.query(
      `
      SELECT full_name, email
      FROM users
      WHERE id = $1
      `,
      [userId]
    );

    const senderName = senderResult.rows[0]?.full_name || "Bir kullanıcı";

    // Projedeki diğer üyeler
    const membersResult = await pool.query(
      `
      SELECT user_id
      FROM project_members
      WHERE project_id = $1
        AND user_id != $2
      `,
      [projectId, userId]
    );

    // Mention edilen kullanıcıları bul
    const mentionTokens = extractMentionTokens(message);
    const mentionedUsers = await resolveMentionedUsers(projectId, mentionTokens);

    const mentionedUserIds = new Set(
      mentionedUsers
        .filter((u) => String(u.id) !== String(userId))
        .map((u) => String(u.id))
    );

    // Önce mention edilenlere özel bildirim
    for (const user of mentionedUsers) {
      if (String(user.id) === String(userId)) continue;

      await createNotification({
        userId: user.id,
        type: "PROJECT_CHAT_MENTION",
        title: "Seni proje sohbetinde etiketledi",
        body: message.length > 140 ? message.slice(0, 140) + "..." : message,
        projectId,
        triggeredBy: userId,
      });
    }

    // Mention edilmeyen diğer üyelere normal chat bildirimi
    for (const row of membersResult.rows) {
      if (mentionedUserIds.has(String(row.user_id))) continue;

      await createNotification({
        userId: row.user_id,
        type: "PROJECT_CHAT_MESSAGE",
        title: `${senderName} projede mesaj gönderdi`,
        body: message.length > 140 ? message.slice(0, 140) + "..." : message,
        projectId,
        triggeredBy: userId,
      });
    }

    const chatMessagePayload = {
        ...inserted,
        sender_name: senderResult.rows[0]?.full_name || null,
        sender_email: senderResult.rows[0]?.email || null,
    };

    getIO()
        .to(`project:${projectId}`)
        .emit("project-chat:new-message", chatMessagePayload);

    return res.status(201).json({
        message: "Message sent",
        chat_message: chatMessagePayload,
    });
  } catch (err) {
    console.error("SEND PROJECT MESSAGE ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

module.exports = {
  getProjectMessages,
  sendProjectMessage,
};
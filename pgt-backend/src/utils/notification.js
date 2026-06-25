const pool = require("../config/db.js");

async function createNotification({
  userId,
  type,
  title,
  body = null,
  projectId = null,
  taskId = null,
  commentId = null,
  triggeredBy = null,
}) {
  // Zorunlu alanlar
  if (!userId || !type || !title) return null;

  // Kendi kendine bildirim oluşturma
  if (triggeredBy && String(userId) === String(triggeredBy)) {
    return null;
  }

  const safeTitle = String(title).trim();
  const safeBody = body == null ? null : String(body).trim();

  // Aynı comment için aynı kullanıcıya aynı type bildirimi tekrar düşmesin
  // Özellikle comment/mention senaryolarında faydalı olur
  if (commentId) {
    const duplicateQ = await pool.query(
      `
      SELECT id
      FROM notifications
      WHERE user_id = $1
        AND type = $2
        AND comment_id = $3
      LIMIT 1
      `,
      [userId, type, commentId]
    );

    if (duplicateQ.rows.length) {
      return duplicateQ.rows[0];
    }
  }

  const result = await pool.query(
    `
    INSERT INTO notifications
      (user_id, type, title, body, project_id, task_id, comment_id, triggered_by)
    VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
    `,
    [userId, type, safeTitle, safeBody, projectId, taskId, commentId, triggeredBy]
  );

  return result.rows[0];
}

async function createManyNotifications(items = []) {
  const created = [];

  for (const item of items) {
    const row = await createNotification(item);
    if (row) created.push(row);
  }

  return created;
}

module.exports = {
  createNotification,
  createManyNotifications,
};
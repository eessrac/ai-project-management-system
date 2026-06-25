const pool = require("../config/db.js");

const { createNotification } = require("../utils/notification");

/**
 * Bu controller, kullanıcı bildirimlerinin yönetimini sağlar.
 * Bildirimleri listeleme, okunma durumunu güncelleme ve yaklaşan görev tarihleri için otomatik bildirim oluşturma işlemlerini gerçekleştirir.
 */

async function getNotifications(req, res) {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);

    const result = await pool.query(
      `
      SELECT
        n.id,
        n.user_id,
        n.type,
        n.title,
        n.body,
        n.project_id,
        n.task_id,
        n.comment_id,
        n.triggered_by,
        n.is_read,
        n.read_at,
        n.created_at,
        u.full_name AS triggered_by_name,
        u.email AS triggered_by_email,
        t.title AS task_title,
        p.name AS project_name
      FROM notifications n
      LEFT JOIN users u ON u.id = n.triggered_by
      LEFT JOIN tasks t ON t.id = n.task_id
      LEFT JOIN projects p ON p.id = n.project_id
      WHERE n.user_id = $1
      ORDER BY n.created_at DESC
      LIMIT $2
      `,
      [req.user.userId, limit]
    );

    const countsQ = await pool.query(
      `
      SELECT
        COUNT(*)::int AS total_count,
        COUNT(*) FILTER (WHERE is_read = false)::int AS unread_count,
        COUNT(*) FILTER (WHERE is_read = true)::int AS read_count
      FROM notifications
      WHERE user_id = $1
      `,
      [req.user.userId]
    );

    return res.json({
      notifications: result.rows,
      total_count: countsQ.rows[0].total_count,
      unread_count: countsQ.rows[0].unread_count,
      read_count: countsQ.rows[0].read_count,
    });
  } catch (err) {
    console.error("GET NOTIFICATIONS ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function getUnreadCount(req, res) {
  try {
    const result = await pool.query(
      `
      SELECT COUNT(*)::int AS unread_count
      FROM notifications
      WHERE user_id = $1
        AND is_read = false
      `,
      [req.user.userId]
    );

    return res.json({
      unread_count: result.rows[0].unread_count,
    });
  } catch (err) {
    console.error("GET UNREAD COUNT ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function markNotificationRead(req, res) {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `
      UPDATE notifications
      SET is_read = true,
          read_at = now()
      WHERE id = $1
        AND user_id = $2
      RETURNING *
      `,
      [id, req.user.userId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Notification not found" });
    }

    return res.json({
      message: "Notification marked as read",
      notification: result.rows[0],
    });
  } catch (err) {
    console.error("MARK NOTIFICATION READ ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function markAllNotificationsRead(req, res) {
  try {
    await pool.query(
      `
      UPDATE notifications
      SET is_read = true,
          read_at = now()
      WHERE user_id = $1
        AND is_read = false
      `,
      [req.user.userId]
    );

    return res.json({
      message: "All notifications marked as read",
    });
  } catch (err) {
    console.error("MARK ALL NOTIFICATIONS READ ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function generateDueSoonNotifications(req, res) {
  try {
    const result = await pool.query(
      `
      SELECT
        t.id AS task_id,
        t.project_id,
        t.title,
        t.due_date,
        t.assigned_to
      FROM tasks t
      WHERE t.assigned_to IS NOT NULL
        AND t.status <> 'DONE'
        AND t.due_date IS NOT NULL
        AND t.due_date >= CURRENT_DATE
        AND t.due_date <= CURRENT_DATE + 2
      `
    );

    let created = 0;

    for (const row of result.rows) {
      const existsQ = await pool.query(
        `
        SELECT id
        FROM notifications
        WHERE user_id = $1
          AND type = 'DUE_DATE_SOON'
          AND task_id = $2
          AND created_at::date = CURRENT_DATE
        LIMIT 1
        `,
        [row.assigned_to, row.task_id]
      );

      if (existsQ.rows.length) continue;

      await createNotification({
        userId: row.assigned_to,
        type: "DUE_DATE_SOON",
        title: "Task son tarihi yaklaşıyor",
        body: `${row.title} • ${row.due_date}`,
        projectId: row.project_id,
        taskId: row.task_id,
        triggeredBy: null,
      });

      created++;
    }

    return res.json({
      message: "Due soon notifications generated",
      created,
    });
  } catch (err) {
    console.error("GENERATE DUE SOON NOTIFICATIONS ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

module.exports = {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  generateDueSoonNotifications,
};
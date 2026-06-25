const pool = require("../config/db.js");
const {
  ensureProjectMember,
  ensureLeader,
} = require("../utils/projectAuth");
const { createNotification } = require("../utils/notification");
const { emitProjectEvent } = require("../socket");

/**
 * Bu controller, görev yorumlarının yönetimini sağlar.
 * Proje üyeleri görevlere yorum ekleyebilir, düzenleyebilir ve silebilir.
 * Ayrıca kullanıcı etiketleme, bildirim gönderme ve yorum aktivitelerinin kaydedilmesi işlemlerini gerçekleştirir.
 */

async function addLog({
  projectId,
  taskId = null,
  actorId,
  action,
  message,
  meta = {},
}) {
  await pool.query(
    `INSERT INTO task_logs (project_id, task_id, actor_id, action, message, meta)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [projectId, taskId, actorId, action, message, meta]
  );
}

async function ensureTaskInProject(projectId, taskId) {
  const q = await pool.query(
    `
    SELECT
      t.id,
      t.title,
      t.assigned_to,
      t.created_by,
      COALESCE(
        array_agg(DISTINCT ta.user_id) FILTER (WHERE ta.user_id IS NOT NULL),
        '{}'
      ) AS assignee_ids
    FROM tasks t
    LEFT JOIN task_assignees ta ON ta.task_id = t.id
    WHERE t.id = $1
      AND t.project_id = $2
    GROUP BY t.id
    `,
    [taskId, projectId]
  );

  return q.rows[0] || null;
}

async function getCommentInTask(projectId, taskId, commentId) {
  const q = await pool.query(
    `SELECT id, task_id, project_id, author_id, body, created_at, updated_at
     FROM task_comments
     WHERE id = $1 AND task_id = $2 AND project_id = $3`,
    [commentId, taskId, projectId]
  );

  return q.rows[0] || null;
}

function shortBody(text) {
  if (!text) return "";
  return text.length > 140 ? text.slice(0, 140) + "..." : text;
}

async function getActorInfo(userId) {
  const q = await pool.query(
    `
    SELECT id, full_name, email
    FROM users
    WHERE id = $1
    `,
    [userId]
  );

  return q.rows[0] || null;
}

async function notifyCommentCreated({
  actorId,
  actorName,
  projectId,
  task,
  commentId,
  body,
  mentionedUsers,
}) {
  const recipients = new Map();
  const mentionedIds = new Set(mentionedUsers.map((u) => String(u.id)));

  // 1) Mention bildirimi
  for (const user of mentionedUsers) {
    if (String(user.id) === String(actorId)) continue;

    recipients.set(String(user.id), {
      userId: user.id,
      type: "MENTION",
      title: "Seni bir yorumda etiketledi",
      body: shortBody(body),
    });
  }

  // 2) Task atanan kişi
  if (
    task.assignee_ids &&
    String(task.assignee_ids) !== String(actorId) &&
    !mentionedIds.has(String(task.assignee_ids))
  ) {
    recipients.set(String(task.assignee_ids), {
      userId: task.assignee_ids,
      type: "COMMENT_ON_ASSIGNED_TASK",
      title: "Atandığın task'a yorum yapıldı",
      body: `${actorName} "${task.title}" taskına yorum yaptı.`,
    });
  }

  // 3) Task oluşturan kişi
  if (
    task.created_by &&
    String(task.created_by) !== String(actorId) &&
    String(task.created_by) !== String(task.assignee_ids) &&
    !mentionedIds.has(String(task.created_by))
  ) {
    recipients.set(String(task.created_by), {
      userId: task.created_by,
      type: "COMMENT_ON_CREATED_TASK",
      title: "Oluşturduğun task'a yorum yapıldı",
      body: `${actorName} "${task.title}" taskına yorum yaptı.`,
    });
  }

  for (const [, notif] of recipients) {
    await createNotification({
      userId: notif.userId,
      type: notif.type,
      title: notif.title,
      body: notif.body,
      projectId,
      taskId: task.id,
      commentId,
      triggeredBy: actorId,
    });
  }
}

async function notifyCommentUpdated({
  actorId,
  actorName,
  projectId,
  task,
  commentId,
  body,
  mentionedUsers,
}) {
  const recipients = new Map();
  const mentionedIds = new Set(mentionedUsers.map((u) => String(u.id)));

  // 1) Mention bildirimi
  for (const user of mentionedUsers) {
    if (String(user.id) === String(actorId)) continue;

    recipients.set(String(user.id), {
      userId: user.id,
      type: "MENTION",
      title: "Seni düzenlenen bir yorumda etiketledi",
      body: shortBody(body),
    });
  }

  // 2) Task assigned kişi
  if (
    task.assignee_ids &&
    String(task.assignee_ids) !== String(actorId) &&
    !mentionedIds.has(String(task.assignee_ids))
  ) {
    recipients.set(String(task.assignee_ids), {
      userId: task.assignee_ids,
      type: "COMMENT_UPDATED_ON_ASSIGNED_TASK",
      title: "Atandığın task'ta bir yorum düzenlendi",
      body: `${actorName} "${task.title}" taskındaki bir yorumu düzenledi.`,
    });
  }

  // 3) Task oluşturan kişi
  if (
    task.created_by &&
    String(task.created_by) !== String(actorId) &&
    String(task.created_by) !== String(task.assignee_ids) &&
    !mentionedIds.has(String(task.created_by))
  ) {
    recipients.set(String(task.created_by), {
      userId: task.created_by,
      type: "COMMENT_UPDATED_ON_CREATED_TASK",
      title: "Oluşturduğun task'ta bir yorum düzenlendi",
      body: `${actorName} "${task.title}" taskındaki bir yorumu düzenledi.`,
    });
  }

  for (const [, notif] of recipients) {
    await createNotification({
      userId: notif.userId,
      type: notif.type,
      title: notif.title,
      body: notif.body,
      projectId,
      taskId: task.id,
      commentId,
      triggeredBy: actorId,
    });
  }
}

async function notifyCommentDeleted({
  actorId,
  actorName,
  projectId,
  task,
  comment,
}) {
  const recipients = new Map();

  // 1) Yorum sahibi, yorumu başkası sildiyse
  if (String(comment.author_id) !== String(actorId)) {
    recipients.set(String(comment.author_id), {
      userId: comment.author_id,
      type: "COMMENT_DELETED",
      title: "Yorumun silindi",
      body: `${actorName} "${task.title}" taskındaki yorumunu sildi.`,
    });
  }

  // 2) Task assigned kişisi
  if (
    task.assignee_ids &&
    String(task.assignee_ids) !== String(actorId) &&
    String(task.assignee_ids) !== String(comment.author_id)
  ) {
    recipients.set(String(task.assignee_ids), {
      userId: task.assignee_ids,
      type: "COMMENT_DELETED_ON_ASSIGNED_TASK",
      title: "Atandığın task'ta bir yorum silindi",
      body: `${actorName} "${task.title}" taskındaki bir yorumu sildi.`,
    });
  }

  // 3) Task oluşturan kişi
  if (
    task.created_by &&
    String(task.created_by) !== String(actorId) &&
    String(task.created_by) !== String(comment.author_id) &&
    String(task.created_by) !== String(task.assignee_ids)
  ) {
    recipients.set(String(task.created_by), {
      userId: task.created_by,
      type: "COMMENT_DELETED_ON_CREATED_TASK",
      title: "Oluşturduğun task'ta bir yorum silindi",
      body: `${actorName} "${task.title}" taskındaki bir yorumu sildi.`,
    });
  }

  for (const [, notif] of recipients) {
    await createNotification({
      userId: notif.userId,
      type: notif.type,
      title: notif.title,
      body: notif.body,
      projectId,
      taskId: task.id,
      commentId: comment.id,
      triggeredBy: actorId,
    });
  }
}

async function listTaskComments(req, res) {
  const { projectId, taskId } = req.params;
  const all = req.query.all === "1";

  try {
    const membership = await ensureProjectMember(projectId, req.user.userId);
    if (!membership) {
      return res.status(403).json({ message: "Not a member of this project" });
    }

    const task = await ensureTaskInProject(projectId, taskId);
    if (!task) {
      return res.status(404).json({ message: "Task not found in project" });
    }

    const q = await pool.query(
      `
      SELECT
        c.id,
        c.task_id,
        c.project_id,
        c.author_id,
        c.body,
        c.created_at,
        c.updated_at,
        COALESCE(u.full_name, u.email) AS author_name,
        u.email AS author_email,
        COALESCE((
          SELECT json_agg(
            json_build_object(
              'id', mu.id,
              'full_name', mu.full_name,
              'email', mu.email
            )
          )
          FROM task_comment_mentions cm
          JOIN users mu ON mu.id = cm.mentioned_user_id
          WHERE cm.comment_id = c.id
        ), '[]'::json) AS mentions
      FROM task_comments c
      JOIN users u ON u.id = c.author_id
      WHERE c.project_id = $1
        AND c.task_id = $2
        AND ($3::boolean = true OR c.created_at >= now() - interval '7 days')
      ORDER BY c.created_at ASC
      `,
      [projectId, taskId, all]
    );

    return res.json({
      comments: q.rows,
      mode: all ? "ALL" : "LAST_7_DAYS",
    });
  } catch (e) {
    console.error("LIST TASK COMMENTS ERROR:", e);
    return res.status(500).json({ message: "Server error" });
  }
}

async function createTaskComment(req, res) {
  const { projectId, taskId } = req.params;
  const { body } = req.body;

  try {
    const membership = await ensureProjectMember(projectId, req.user.userId);
    if (!membership) {
      return res.status(403).json({ message: "Not a member of this project" });
    }

    const task = await ensureTaskInProject(projectId, taskId);
    if (!task) {
      return res.status(404).json({ message: "Task not found in project" });
    }

    const ins = await pool.query(
      `
      INSERT INTO task_comments (task_id, project_id, author_id, body)
      VALUES ($1,$2,$3,$4)
      RETURNING id, task_id, project_id, author_id, body, created_at, updated_at
      `,
      [taskId, projectId, req.user.userId, body]
    );

    const mentionTokens = extractMentionTokens(body);
    const mentionedUsers = await resolveMentionedUsers(projectId, mentionTokens);
    await saveCommentMentions(ins.rows[0].id, mentionedUsers);

    const actor = await getActorInfo(req.user.userId);
    const actorName = actor?.full_name || actor?.email || "Bir kullanıcı";

    await notifyCommentCreated({
      actorId: req.user.userId,
      actorName,
      projectId,
      task,
      commentId: ins.rows[0].id,
      body,
      mentionedUsers,
    });

    await addLog({
      projectId,
      taskId,
      actorId: req.user.userId,
      action: "COMMENT_ADDED",
      message: `Yorum eklendi`,
      meta: {
        comment_id: ins.rows[0].id,
        comment_body: body,
        task_title: task.title,
        mentioned_user_ids: mentionedUsers.map((u) => u.id),
      },
    });

    emitProjectEvent(projectId, "project:comment-created", {
      taskId,
      comment: ins.rows[0],
    });

    return res.status(201).json({ comment: ins.rows[0] });
  } catch (e) {
    console.error("CREATE TASK COMMENT ERROR:", e);
    return res.status(500).json({ message: "Server error" });
  }
}

async function deleteTaskComment(req, res) {
  const { projectId, taskId, commentId } = req.params;

  try {
    const membership = await ensureProjectMember(projectId, req.user.userId);
    if (!membership) {
      return res.status(403).json({ message: "Not a member of this project" });
    }

    const task = await ensureTaskInProject(projectId, taskId);
    if (!task) {
      return res.status(404).json({ message: "Task not found in project" });
    }

    const comment = await getCommentInTask(projectId, taskId, commentId);
    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    const isAuthor = String(comment.author_id) === String(req.user.userId);

    if (!isAuthor) {
      const authz = await ensureLeader(projectId, req.user.userId);

      if (!authz.ok) {
        return res.status(403).json({
          message: "Only comment author or LEADER can delete comment",
        });
      }
    }

    const actor = await getActorInfo(req.user.userId);
    const actorName = actor?.full_name || actor?.email || "Bir kullanıcı";

    await notifyCommentDeleted({
      actorId: req.user.userId,
      actorName,
      projectId,
      task,
      comment,
    });

    await pool.query(
      `DELETE FROM task_comments
       WHERE id = $1 AND task_id = $2 AND project_id = $3`,
      [commentId, taskId, projectId]
    );

    await addLog({
      projectId,
      taskId,
      actorId: req.user.userId,
      action: "COMMENT_DELETED",
      message: `Task yorumu silindi: "${task.title}"`,
      meta: {
        comment_id: comment.id,
        deleted_comment_author_id: comment.author_id,
      },
    });

    emitProjectEvent(projectId, "project:comment-deleted", {
      taskId,
      commentId,
    });

    return res.json({ message: "Comment deleted" });
  } catch (e) {
    console.error("DELETE TASK COMMENT ERROR:", e);
    return res.status(500).json({ message: "Server error" });
  }
}

async function updateTaskComment(req, res) {
  const { projectId, taskId, commentId } = req.params;
  const { body } = req.body;

  try {
    const membership = await ensureProjectMember(projectId, req.user.userId);
    if (!membership) {
      return res.status(403).json({ message: "Not a member of this project" });
    }

    const task = await ensureTaskInProject(projectId, taskId);
    if (!task) {
      return res.status(404).json({ message: "Task not found in project" });
    }

    const comment = await getCommentInTask(projectId, taskId, commentId);
    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    const isAuthor = String(comment.author_id) === String(req.user.userId);

    if (!isAuthor) {
      const authz = await ensureLeader(projectId, req.user.userId);
      if (!authz.ok) {
        return res.status(403).json({
          message: "Only comment author or LEADER can update comment",
        });
      }
    }

    const upd = await pool.query(
      `
      UPDATE task_comments
      SET body = $1,
          updated_at = now()
      WHERE id = $2
        AND task_id = $3
        AND project_id = $4
      RETURNING id, task_id, project_id, author_id, body, created_at, updated_at
      `,
      [body, commentId, taskId, projectId]
    );

    await pool.query(
      `DELETE FROM task_comment_mentions WHERE comment_id = $1`,
      [commentId]
    );

    const mentionTokens = extractMentionTokens(body);
    const mentionedUsers = await resolveMentionedUsers(projectId, mentionTokens);
    await saveCommentMentions(commentId, mentionedUsers);

    const actor = await getActorInfo(req.user.userId);
    const actorName = actor?.full_name || actor?.email || "Bir kullanıcı";

    await notifyCommentUpdated({
      actorId: req.user.userId,
      actorName,
      projectId,
      task,
      commentId,
      body,
      mentionedUsers,
    });

    await addLog({
      projectId,
      taskId,
      actorId: req.user.userId,
      action: "COMMENT_UPDATED",
      message: "Yorum düzenlendi",
      meta: {
        comment_id: commentId,
        comment_body: body,
        task_title: task.title,
        mentioned_user_ids: mentionedUsers.map((u) => u.id),
      },
    });

    emitProjectEvent(projectId, "project:comment-updated", {
      taskId,
      comment: upd.rows[0],
    });

    return res.json({ comment: upd.rows[0] });
  } catch (e) {
    console.error("UPDATE TASK COMMENT ERROR:", e);
    return res.status(500).json({ message: "Server error" });
  }
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

async function saveCommentMentions(commentId, mentionedUsers) {
  for (const user of mentionedUsers) {
    await pool.query(
      `
      INSERT INTO task_comment_mentions (comment_id, mentioned_user_id)
      VALUES ($1, $2)
      ON CONFLICT (comment_id, mentioned_user_id) DO NOTHING
      `,
      [commentId, user.id]
    );
  }
}

module.exports = {
  listTaskComments,
  createTaskComment,
  deleteTaskComment,
  updateTaskComment,
};
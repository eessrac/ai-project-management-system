const path = require("path");
const fs = require("fs");
const pool = require("../config/db.js");
const { ensureProjectMember, ensureLeader } = require("../utils/projectAuth");
const { emitProjectEvent } = require("../socket");

/**
 * Bu controller, görev dosya ekleri işlemlerini yönetir.
 * Proje üyeleri görev dosyalarını listeleyebilir, yükleyebilir,
 * görüntüleyebilir ve indirebilir.
 * Dosya silme işlemi ise sadece proje lideri veya dosyayı yükleyen kullanıcı tarafından yapılabilir.
 */

async function listTaskAttachments(req, res) {
  const { projectId, taskId } = req.params;

  try {
    const membership = await ensureProjectMember(projectId, req.user.userId);
    if (!membership) return res.status(403).json({ message: "Not a member" });

    const result = await pool.query(
      `
      SELECT
        a.*,
        u.full_name AS uploaded_by_name,
        u.email AS uploaded_by_email,
        t.title AS task_title
      FROM task_attachments a
      LEFT JOIN users u ON u.id = a.uploaded_by
      LEFT JOIN tasks t ON t.id = a.task_id
      WHERE a.project_id = $1
        AND ($2::uuid IS NULL OR a.task_id = $2)
      ORDER BY a.created_at DESC
      `,
      [projectId, taskId || null]
    );

    return res.json({ attachments: result.rows });
  } catch (err) {
    console.error("LIST ATTACHMENTS ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function uploadTaskAttachment(req, res) {
  const { projectId } = req.params;
  const { task_id } = req.body;

  try {
    if (!req.file) {
      return res.status(400).json({ message: "File required" });
    }

    const membership = await ensureProjectMember(projectId, req.user.userId);
    if (!membership) return res.status(403).json({ message: "Not a member" });

    if (!task_id) {
      return res.status(400).json({ message: "task_id required" });
    }

    const taskQ = await pool.query(
      `SELECT id, title FROM tasks WHERE id = $1 AND project_id = $2`,
      [task_id, projectId]
    );

    if (!taskQ.rows.length) {
      return res.status(404).json({ message: "Task not found in this project" });
    }

    const filePath = req.file.path.replace(/\\/g, "/");

    const ins = await pool.query(
      `
      INSERT INTO task_attachments (
        project_id,
        task_id,
        uploaded_by,
        original_name,
        file_name,
        mime_type,
        size_bytes,
        file_path
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *
      `,
      [
        projectId,
        task_id,
        req.user.userId,
        req.file.originalname,
        req.file.filename,
        req.file.mimetype,
        req.file.size,
        filePath,
      ]
    );

    const attachment = ins.rows[0];

    await pool.query(
      `
      INSERT INTO task_logs (project_id, task_id, actor_id, action, message, meta)
      VALUES ($1,$2,$3,$4,$5,$6)
      `,
      [
        projectId,
        task_id,
        req.user.userId,
        "ATTACHMENT_ADDED",
        `Dosya eklendi: "${req.file.originalname}"`,
        JSON.stringify({
          attachment_id: attachment.id,
          file_name: req.file.originalname,
        }),
      ]
    );

    emitProjectEvent(projectId, "project:attachment-created", {
      attachment,
      taskId: task_id,
    });

    return res.status(201).json({ attachment });
  } catch (err) {
    console.error("UPLOAD ATTACHMENT ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function downloadAttachment(req, res) {
  const { attachmentId } = req.params;

  try {
    const q = await pool.query(
      `SELECT * FROM task_attachments WHERE id = $1`,
      [attachmentId]
    );

    if (!q.rows.length) {
      return res.status(404).json({ message: "Attachment not found" });
    }

    const attachment = q.rows[0];

    const membership = await ensureProjectMember(
      attachment.project_id,
      req.user.userId
    );

    if (!membership) return res.status(403).json({ message: "Not a member" });

    const absolutePath = path.resolve(attachment.file_path);

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ message: "File not found on server" });
    }

    return res.download(absolutePath, attachment.original_name);
  } catch (err) {
    console.error("DOWNLOAD ATTACHMENT ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function viewAttachment(req, res) {
  const { attachmentId } = req.params;

  try {
    const q = await pool.query(
      `SELECT * FROM task_attachments WHERE id = $1`,
      [attachmentId]
    );

    if (!q.rows.length) {
      return res.status(404).json({ message: "Attachment not found" });
    }

    const attachment = q.rows[0];

    const membership = await ensureProjectMember(
      attachment.project_id,
      req.user.userId
    );

    if (!membership) return res.status(403).json({ message: "Not a member" });

    const absolutePath = path.resolve(attachment.file_path);

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ message: "File not found on server" });
    }

    res.setHeader("Content-Type", attachment.mime_type || "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(attachment.original_name)}"`
    );

    return res.sendFile(absolutePath);
  } catch (err) {
    console.error("VIEW ATTACHMENT ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function deleteAttachment(req, res) {
  const { attachmentId } = req.params;

  try {
    const q = await pool.query(
      `SELECT * FROM task_attachments WHERE id = $1`,
      [attachmentId]
    );

    if (!q.rows.length) {
      return res.status(404).json({ message: "Attachment not found" });
    }

    const attachment = q.rows[0];

    const authz = await ensureLeader(attachment.project_id, req.user.userId);
    const isUploader = String(attachment.uploaded_by) === String(req.user.userId);

    if (!authz.ok && !isUploader) {
      return res.status(403).json({
        message: "Only leader or uploader can delete attachment",
      });
    }

    await pool.query(`DELETE FROM task_attachments WHERE id = $1`, [attachmentId]);

    const absolutePath = path.resolve(attachment.file_path);
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }

    emitProjectEvent(attachment.project_id, "project:attachment-deleted", {
      attachmentId,
      taskId: attachment.task_id,
    });

    return res.json({ message: "Attachment deleted" });
  } catch (err) {
    console.error("DELETE ATTACHMENT ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

module.exports = {
  listTaskAttachments,
  uploadTaskAttachment,
  downloadAttachment,
  viewAttachment,
  deleteAttachment,
};
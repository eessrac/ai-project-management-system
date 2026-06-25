const pool = require("../config/db.js");

async function blockIfProjectArchivedByProjectId(req, res, next) {
  const projectId = req.params.projectId;

  const q = await pool.query(
    `SELECT is_archived FROM projects WHERE id = $1`,
    [projectId]
  );

  if (q.rows[0]?.is_archived) {
    return res.status(403).json({
      message: "Bu proje arşivlenmiş. Dosya ekleme/silme yapılamaz.",
    });
  }

  next();
}

async function blockIfProjectArchivedByAttachmentId(req, res, next) {
  const attachmentId = req.params.attachmentId;

  const q = await pool.query(
    `
    SELECT p.is_archived
    FROM task_attachments ta
    JOIN projects p ON p.id = ta.project_id
    WHERE ta.id = $1
    `,
    [attachmentId]
  );

  if (q.rows[0]?.is_archived) {
    return res.status(403).json({
      message: "Bu proje arşivlenmiş. Dosya silinemez.",
    });
  }

  next();
}

const express = require("express");
const multer = require("multer");
const path = require("path");

const {
  listTaskAttachments,
  uploadTaskAttachment,
  downloadAttachment,
  viewAttachment,
  deleteAttachment,
} = require("../controllers/attachment.controller");

const auth = require("../middleware/auth");

const router = express.Router();

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, path.join(__dirname, "../uploads/task-attachments"));
  },
  filename(req, file, cb) {
    const safeName = file.originalname.replace(/\s+/g, "_");
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

router.get(
  "/projects/:projectId/attachments",
  auth,
  listTaskAttachments
);

router.get(
  "/projects/:projectId/tasks/:taskId/attachments",
  auth,
  listTaskAttachments
);

router.post(
  "/projects/:projectId/attachments",
  auth,
  blockIfProjectArchivedByProjectId,
  upload.single("file"),
  uploadTaskAttachment
);

router.get(
  "/attachments/:attachmentId/download",
  auth,
  downloadAttachment
);

router.get(
  "/attachments/:attachmentId/view",
  auth,
  viewAttachment
);

router.delete(
  "/attachments/:attachmentId",
  auth,
  blockIfProjectArchivedByAttachmentId,
  deleteAttachment
);

module.exports = router;
const pool = require("../config/db.js");

async function blockIfProjectArchivedByProjectId(req, res, next) {
  const projectId = req.params.id || req.params.projectId;

  const q = await pool.query(
    `SELECT is_archived FROM projects WHERE id = $1`,
    [projectId]
  );

  if (q.rows[0]?.is_archived) {
    return res.status(403).json({
      message: "Bu proje arşivlenmiş. Arşivdeki projelerde değişiklik yapılamaz.",
    });
  }

  next();
}

async function blockIfProjectArchivedByTaskId(req, res, next) {
  const taskId = req.params.taskId;

  const q = await pool.query(
    `
    SELECT p.is_archived
    FROM tasks t
    JOIN projects p ON p.id = t.project_id
    WHERE t.id = $1
    `,
    [taskId]
  );

  if (q.rows[0]?.is_archived) {
    return res.status(403).json({
      message: "Bu proje arşivlenmiş. Arşivdeki tasklar değiştirilemez.",
    });
  }

  next();
}

console.log("task.routes loaded ✅");

const router = require("express").Router();
const auth = require("../middleware/auth");

const {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  getProjectActivity,
  getTaskById,
  getBacklogCount,
  getBacklogTasks,
  assignTask,
  getDependencies,
  setDependencies,
} = require("../controllers/task.controller");

const {
  validateTaskCreate,
  validateTaskUpdate,
} = require("../validators/task.validator");

// /projects/:id/tasks
router.get("/projects/:id/tasks", auth, getTasks);
router.post(
  "/projects/:id/tasks",
  auth,
  blockIfProjectArchivedByProjectId,
  validateTaskCreate,
  createTask
);
router.get("/projects/:id/activity", auth, getProjectActivity);
router.get("/projects/:id/backlog/count", auth, getBacklogCount);
router.get("/projects/:id/backlog/tasks", auth, getBacklogTasks);

// /tasks/:taskId
router.get("/tasks/:taskId", auth, getTaskById);
router.patch(
  "/tasks/:taskId/assign",
  auth,
  blockIfProjectArchivedByTaskId,
  assignTask
);
router.patch(
  "/tasks/:taskId",
  auth,
  blockIfProjectArchivedByTaskId,
  validateTaskUpdate,
  updateTask
);
router.delete(
  "/tasks/:taskId",
  auth,
  blockIfProjectArchivedByTaskId,
  deleteTask
);
router.get("/tasks/:taskId/dependencies", auth, getDependencies);
router.put(
  "/tasks/:taskId/dependencies",
  auth,
  blockIfProjectArchivedByTaskId,
  setDependencies
);
module.exports = router;

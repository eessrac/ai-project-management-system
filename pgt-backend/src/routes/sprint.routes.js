const pool = require("../config/db.js");

async function blockIfProjectArchived(req, res, next) {
  const projectId = req.params.id;

  const q = await pool.query(
    `SELECT is_archived FROM projects WHERE id = $1`,
    [projectId]
  );

  if (q.rows[0]?.is_archived) {
    return res.status(403).json({
      message: "Bu proje arşivlenmiş. Arşivdeki sprintler değiştirilemez.",
    });
  }

  next();
}

console.log("sprint.routes loaded ✅");

const router = require("express").Router();
const auth = require("../middleware/auth");

const {
  listSprints,
  getActiveSprint,
  createSprint,
  updateSprint,
  setActiveSprint,
  closeSprint,
  deleteSprint,
  claimTasksToSprint,
  getSprintArchive,
  listSprintArchiveTasks,
  getSprintArchiveTaskDetail,
  getSavedSprintAiAnalysis,
  generateSprintAiAnalysis,
} = require("../controllers/sprint.controller");

const {
  validateSprintCreate,
  validateSprintUpdate,
} = require("../validators/sprint.validator");

// /projects/:id/sprints
router.get("/projects/:id/sprints", auth, listSprints);
router.post("/projects/:id/sprints", auth, blockIfProjectArchived, validateSprintCreate, createSprint);

// active
router.get("/projects/:id/sprints/active", auth, getActiveSprint);

// update
router.patch(
  "/projects/:id/sprints/:sprintId",
  auth,
  blockIfProjectArchived,
  validateSprintUpdate,
  updateSprint
);

// actions
router.post("/projects/:id/sprints/:sprintId/activate", auth, blockIfProjectArchived, setActiveSprint);
router.post("/projects/:id/sprints/:sprintId/close", auth, blockIfProjectArchived, closeSprint);

// delete
router.delete("/projects/:id/sprints/:sprintId", auth, blockIfProjectArchived, deleteSprint);

// backlog -> sprint
router.post(
  "/projects/:id/sprints/:sprintId/claim-tasks",
  auth,
  blockIfProjectArchived,
  claimTasksToSprint
);

// archive
router.get("/projects/:id/sprints/:sprintId/archive", auth, getSprintArchive);
router.get("/projects/:id/sprints/:sprintId/archive/tasks", auth, listSprintArchiveTasks);
router.get(
  "/projects/:id/sprints/:sprintId/archive/tasks/:archiveTaskId",
  auth,
  getSprintArchiveTaskDetail
);

router.get(
  "/projects/:id/sprints/:sprintId/archive/ai-analysis",
  auth,
  getSavedSprintAiAnalysis
);

router.post(
  "/projects/:id/sprints/:sprintId/archive/ai-analysis",
  auth,
  generateSprintAiAnalysis
);

module.exports = router;
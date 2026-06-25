const router = require("express").Router();
const auth = require("../middleware/auth");

const {
  createProject,
  myProjects,
  joinProject,
  getProject,
  getMembers,
  removeMember,
  changeMemberRole,
  leaveProject,
  transferLeadership,
  regenerateJoinCode,
  updateProject,
  archiveProject,
  unarchiveProject,
  myArchivedProjects,
  deleteProject,
  getProjectSummary,
  addMember,
  getProjectJoinRequests,
  approveProjectJoinRequest,
  rejectProjectJoinRequest,
  myJoinRequests,
  getWorkloadAnalysis,
  getArchivedProjectAiSummary,
} = require("../controllers/project.controller");

const {
  validateProjectCreate,
  validateProjectUpdate,
  validateJoinProject,
  validateJoinRequestDecision,
} = require("../validators/project.validator");

const {
  generateAiTaskSuggestions,
  getAiTaskSuggestions,
  acceptAiTaskSuggestion,
  rejectAiTaskSuggestion,
  deleteAiTaskSuggestion,
} = require("../controllers/aiTaskSuggestion.controller");

const {
  getProjectTaskDependencyGraph,
} = require("../controllers/task.controller");

router.post("/", auth, validateProjectCreate, createProject);
router.get("/", auth, myProjects);

router.get("/archived", auth, myArchivedProjects);

/* join request sistemi */
router.post("/join", auth, validateJoinProject, joinProject);
router.get("/my-join-requests", auth, myJoinRequests);
router.get("/:id/join-requests", auth, getProjectJoinRequests);

router.patch(
  "/join-requests/:requestId/approve",
  auth,
  validateJoinRequestDecision,
  approveProjectJoinRequest
);

router.patch(
  "/join-requests/:requestId/reject",
  auth,
  validateJoinRequestDecision,
  rejectProjectJoinRequest
);

router.patch("/:id/archive", auth, archiveProject);
router.patch("/:id/unarchive", auth, unarchiveProject);
router.patch("/:id", auth, validateProjectUpdate, updateProject);
router.delete("/:id", auth, deleteProject);

router.post("/:id/members", auth, addMember);
router.get("/:id/members", auth, getMembers);
router.delete("/:id/members/:userId", auth, removeMember);
router.patch("/:id/members/:userId/role", auth, changeMemberRole);
router.patch("/:id/transfer-leadership", auth, transferLeadership);
router.patch("/:id/join-code/regenerate", auth, regenerateJoinCode);
router.delete("/:id/leave", auth, leaveProject);

const pool = require("../config/db.js");

async function blockIfProjectArchived(req, res, next) {
  const projectId = req.params.id;

  const q = await pool.query(
    `SELECT is_archived FROM projects WHERE id = $1`,
    [projectId]
  );

  if (q.rows[0]?.is_archived) {
    return res.status(403).json({
      message: "Bu proje arşivlenmiş. AI görev önerisi değiştirilemez.",
    });
  }

  next();
}

router.get("/:id/ai-task-suggestions", auth, getAiTaskSuggestions);

router.post("/:id/ai-task-suggestions/generate", auth, blockIfProjectArchived, generateAiTaskSuggestions);
router.patch("/:id/ai-task-suggestions/:suggestionId/accept", auth, blockIfProjectArchived, acceptAiTaskSuggestion);
router.patch("/:id/ai-task-suggestions/:suggestionId/reject", auth, blockIfProjectArchived, rejectAiTaskSuggestion);
router.delete("/:id/ai-task-suggestions/:suggestionId", auth, blockIfProjectArchived, deleteAiTaskSuggestion);

router.get("/:id/task-dependency-graph", auth, getProjectTaskDependencyGraph);

router.get("/:id/code-submissions", auth, async (req, res) => {
  const { id } = req.params;

  try {
    const q = await pool.query(
      `
      SELECT 
        cs.*,
        t.title AS task_title,
        t.status AS task_status,
        t.assigned_to,
        u.full_name AS uploaded_by_name,
        u.email AS uploaded_by_email
      FROM code_submissions cs
      JOIN tasks t ON t.id = cs.task_id
      LEFT JOIN users u ON u.id = cs.uploaded_by
      WHERE t.project_id = $1
      ORDER BY cs.created_at DESC
      `,
      [id]
    );

    res.json({ submissions: q.rows });
  } catch (err) {
    console.error("GET PROJECT CODE SUBMISSIONS ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ekip iş yükü analizi */
router.get("/:id/workload-analysis", auth, getWorkloadAnalysis);
router.get("/:id/archive-ai-summary", auth, getArchivedProjectAiSummary);
router.get("/:id/summary", auth, getProjectSummary);
router.get("/:id", auth, getProject);

module.exports = router;
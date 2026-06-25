const router = require("express").Router();
const auth = require("../middleware/auth");
const {
  listTaskComments,
  createTaskComment,
  deleteTaskComment,
  updateTaskComment,
} = require("../controllers/comment.controller");

const {
  validateTaskCommentCreate,
  validateTaskCommentUpdate,
} = require("../validators/comment.validator");

router.get("/projects/:projectId/tasks/:taskId/comments", auth, listTaskComments);

router.post(
  "/projects/:projectId/tasks/:taskId/comments",
  auth,
  validateTaskCommentCreate,
  createTaskComment
);

router.delete(
  "/projects/:projectId/tasks/:taskId/comments/:commentId",
  auth,
  deleteTaskComment
);

router.patch(
  "/projects/:projectId/tasks/:taskId/comments/:commentId",
  auth,
  validateTaskCommentUpdate,
  updateTaskComment,
);

module.exports = router;

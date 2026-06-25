const router = require("express").Router();
const auth = require("../middleware/auth");

const {
  getProjectMessages,
  sendProjectMessage,
} = require("../controllers/projectChat.controller");

router.get("/projects/:id/chat", auth, getProjectMessages);
router.post("/projects/:id/chat", auth, sendProjectMessage);

module.exports = router;
const router = require("express").Router();
const auth = require("../middleware/auth");

const {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  generateDueSoonNotifications,
} = require("../controllers/notification.controller");

router.get("/", auth, getNotifications);
router.get("/unread-count", auth, getUnreadCount);
router.patch("/:id/read", auth, markNotificationRead);
router.patch("/read-all", auth, markAllNotificationsRead);
router.post("/generate-due-soon", auth, generateDueSoonNotifications);

module.exports = router;
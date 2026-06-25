const router = require("express").Router();
const auth = require("../middleware/auth");
const {
  me,
  updateMe,
  changePassword,
  searchUsers,
  getUserProfile,
  updateMyEmail,
} = require("../controllers/user.controller");

const {
  validateUpdateMe,
  validatePasswordChange,
} = require("../validators/user.validator");

router.get("/me", auth, me);
router.patch("/me", auth, validateUpdateMe, updateMe);
router.patch("/me/email", auth, updateMyEmail);
router.patch("/change-password", auth, validatePasswordChange, changePassword);
router.get("/search", auth, searchUsers);

// başkasının profilini görme
router.get("/:id/profile", auth, getUserProfile);

module.exports = router;
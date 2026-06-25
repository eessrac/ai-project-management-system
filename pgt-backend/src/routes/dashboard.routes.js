const router = require("express").Router();
const auth = require("../middleware/auth");
const { getDashboardSummary } = require("../controllers/dashboard.controller");

router.get("/summary", auth, getDashboardSummary);

module.exports = router;
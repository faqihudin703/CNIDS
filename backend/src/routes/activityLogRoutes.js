const express = require("express");
const router = express.Router();

const { authenticate, requireRole } = require("../middleware/auth");
const { listActivityLogs } = require("../controllers/activityLogController");

// Log aktivitas hanya relevan untuk audit oleh admin — tidak untuk viewer.
router.use(authenticate, requireRole("ADMIN"));

router.get("/", listActivityLogs);

module.exports = router;

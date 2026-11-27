const express = require("express");
const router = express.Router();

const { authenticate, requireRole } = require("../middleware/auth");
const { triggerAllChecks } = require("../controllers/monitoringController");

router.use(authenticate, requireRole("ADMIN"));

router.post("/check-all", triggerAllChecks);

module.exports = router;

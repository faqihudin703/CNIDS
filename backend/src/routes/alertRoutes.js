const express = require("express");
const router = express.Router();

const { authenticate, requireRole } = require("../middleware/auth");
const alertController = require("../controllers/alertController");
const alertSettings = require("../controllers/alertSettingsController");
const { validateBody } = require("../middleware/validate");
const { alertSettingsSchema } = require("../utils/validators/alertSettingsValidators");

// Peringatan memuat status & latensi perangkat -> admin only (sama seperti port dan IPAM).
router.use(authenticate, requireRole("ADMIN"));

router.get("/", alertController.listAlerts);
router.get("/summary", alertController.summary);
router.get("/settings", alertSettings.getSettings);
router.put("/settings", requireRole("SUPERADMIN"), validateBody(alertSettingsSchema), alertSettings.updateSettings);
router.post("/acknowledge-all", alertController.acknowledgeAll);
router.post("/:id/acknowledge", alertController.acknowledge);

module.exports = router;

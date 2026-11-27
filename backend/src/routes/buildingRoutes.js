const express = require("express");
const router = express.Router();

const { authenticate, requireRole } = require("../middleware/auth");
const { validateBody } = require("../middleware/validate");
const { createBuildingSchema, updateBuildingSchema } = require("../utils/validators/buildingValidators");
const buildingController = require("../controllers/buildingController");

router.use(authenticate);

router.get("/", buildingController.listBuildings);
router.post("/", requireRole("ADMIN"), validateBody(createBuildingSchema), buildingController.createBuilding);
router.patch("/:id", requireRole("ADMIN"), validateBody(updateBuildingSchema), buildingController.updateBuilding);
router.delete("/:id", requireRole("ADMIN"), buildingController.deleteBuilding);

module.exports = router;

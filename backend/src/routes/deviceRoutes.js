const express = require("express");
const router = express.Router();

const { authenticate, requireRole } = require("../middleware/auth");
const { validateBody } = require("../middleware/validate");
const { loadDevice } = require("../middleware/loadDevice");

const deviceController = require("../controllers/deviceController");
const historyController = require("../controllers/historyController");
const photoController = require("../controllers/photoController");
const configController = require("../controllers/configController");
const monitoringController = require("../controllers/monitoringController");
const portController = require("../controllers/portController");

const {
  bulkMoveSchema,
  createDeviceSchema,
  updateDeviceSchema,
  createHistorySchema,
  createPortSchema,
  bulkCreatePortsSchema,
  generatePortsSchema,
  updatePortSchema,
} = require("../utils/validators/deviceValidators");
const { verifyUpload } = require("../middleware/uploadChecks");
const { uploadPhoto: uploadPhotoMiddleware, uploadConfig: uploadConfigMiddleware } = require("../config/upload");

// Semua route device mensyaratkan login (baik viewer maupun admin).
router.use(authenticate);

// --- Device CRUD ---
// Read: kedua role boleh (viewer dapat versi field yang sudah disaring di controller).
router.get("/", deviceController.listDevices);
router.get("/:id", deviceController.getDevice);

// Write: admin only.
router.post("/bulk-move", requireRole("ADMIN"), validateBody(bulkMoveSchema), deviceController.bulkMove);
router.post("/", requireRole("ADMIN"), validateBody(createDeviceSchema), deviceController.createDevice);
router.patch("/:id", requireRole("ADMIN"), loadDevice, validateBody(updateDeviceSchema), deviceController.updateDevice);
router.delete("/:id", requireRole("ADMIN"), loadDevice, deviceController.deleteDevice);

// --- Port perangkat (admin only: VLAN & tujuan koneksi tergolong informasi sensitif) ---
router.get("/:id/ports", requireRole("ADMIN"), loadDevice, portController.listPorts);
router.post("/:id/ports", requireRole("ADMIN"), loadDevice, validateBody(createPortSchema), portController.createPort);
router.post("/:id/ports/bulk", requireRole("ADMIN"), loadDevice, validateBody(bulkCreatePortsSchema), portController.bulkCreatePorts);
router.post("/:id/ports/generate", requireRole("ADMIN"), loadDevice, validateBody(generatePortsSchema), portController.generatePorts);
router.patch("/ports/:portId", requireRole("ADMIN"), validateBody(updatePortSchema), portController.updatePort);
router.delete("/ports/:portId", requireRole("ADMIN"), portController.deletePort);

// --- Riwayat perangkat ---
router.get("/:id/history", loadDevice, historyController.listHistory);
router.post("/:id/history", requireRole("ADMIN"), loadDevice, validateBody(createHistorySchema), historyController.addHistory);

// --- Foto perangkat (viewer boleh lihat via getDevice; upload/hapus admin only) ---
router.post("/:id/photos", requireRole("ADMIN"), loadDevice, uploadPhotoMiddleware.single("photo"), verifyUpload("image"), photoController.uploadPhoto);
router.delete("/photos/:photoId", requireRole("ADMIN"), photoController.deletePhoto);

// --- Backup konfigurasi (admin only sepenuhnya — termasuk melihat daftar & unduh) ---
router.post(
  "/:id/configs",
  requireRole("ADMIN"),
  loadDevice,
  uploadConfigMiddleware.single("config"),
  verifyUpload("text"),
  configController.uploadConfig
);
router.get("/configs/:configId/download", requireRole("ADMIN"), configController.downloadConfig);
router.delete("/configs/:configId", requireRole("ADMIN"), configController.deleteConfig);

// --- Monitoring pelengkap ---
router.get("/:id/status", loadDevice, monitoringController.getLatestStatus);
router.post("/:id/status/check", requireRole("ADMIN"), loadDevice, monitoringController.triggerCheck);

module.exports = router;

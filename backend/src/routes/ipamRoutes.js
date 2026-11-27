const express = require("express");
const router = express.Router();

const { authenticate, requireRole } = require("../middleware/auth");
const { listIpEntries, listPools } = require("../controllers/ipamController");

// IPAM menampilkan detail port (VLAN, pool, dsb) yang sama sensitifnya dengan
// tab Port per perangkat — sehingga diperlakukan admin only, konsisten dengan
// kebijakan akses port di deviceRoutes.js.
router.use(authenticate, requireRole("ADMIN"));

router.get("/", listIpEntries);
router.get("/pools", listPools);

module.exports = router;

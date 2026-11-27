const express = require("express");
const router = express.Router();

const { authenticate } = require("../middleware/auth");
const { getSummary } = require("../controllers/dashboardController");

// Semua peran boleh mengakses; isi response disaring per peran di controller.
router.get("/", authenticate, getSummary);

module.exports = router;

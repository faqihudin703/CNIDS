const express = require("express");
const router = express.Router();

const { authenticate, requireRole } = require("../middleware/auth");
const { validateBody } = require("../middleware/validate");
const userController = require("../controllers/userController");
const {
  createUserSchema,
  updateUserSchema,
  resetPasswordSchema,
} = require("../utils/validators/userValidators");

// Kelola akun (user & admin) hanya untuk Superadmin.
router.use(authenticate, requireRole("SUPERADMIN"));

router.get("/", userController.listUsers);
router.post("/", validateBody(createUserSchema), userController.createUser);
router.patch("/:id", validateBody(updateUserSchema), userController.updateUser);
router.post("/:id/reset-password", validateBody(resetPasswordSchema), userController.resetPassword);
router.delete("/:id", userController.deleteUser);

module.exports = router;

import express = require("express");
import roleController = require("../controllers/roleController");
import authMiddleware = require("../middleware/auth");

const router = express.Router();
const requireRoleManagement = [
  authMiddleware.verifyToken,
  authMiddleware.hasPermission("roles.manage"),
];

router.post("/", requireRoleManagement, roleController.createRole);
router.get("/", requireRoleManagement, roleController.getRoles);
router.get("/:id", requireRoleManagement, roleController.getRoleById);
router.put("/:id", requireRoleManagement, roleController.updateRole);
router.delete("/:id", requireRoleManagement, roleController.deleteRole);

export = router;

import express = require("express");
import userController = require("../controllers/userController");
import authMiddleware = require("../middleware/auth");

const router = express.Router();
const requireUserManagement = [
  authMiddleware.verifyToken,
  authMiddleware.hasPermission("users.manage"),
];

router.post("/", requireUserManagement, userController.createUser);
router.get("/", requireUserManagement, userController.getUsers);
router.get("/:id", requireUserManagement, userController.getUserById);
router.put("/:id", requireUserManagement, userController.updateUser);
router.delete("/:id", requireUserManagement, userController.deleteUser);
router.post("/:id/reset-password", requireUserManagement, userController.resetPassword);

export = router;

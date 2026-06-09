import express = require("express");
import authController = require("../controllers/authController");
import userController = require("../controllers/userController");
import authMiddleware = require("../middleware/auth");
import validateRequest = require("../middleware/validateRequest");

const router = express.Router();

router.post("/login", validateRequest(["usernameOrEmail", "password"]), authController.login);
router.post("/register", userController.registerUser);
router.post(
  "/change-password",
  authMiddleware.verifyToken,
  validateRequest(["currentPassword", "newPassword"]),
  authController.changePassword,
);
router.post("/logout", authController.logout);
router.get("/me", authMiddleware.verifyToken, authController.getMe);

export = router;

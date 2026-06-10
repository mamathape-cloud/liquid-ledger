import bcrypt = require("bcrypt");
import express = require("express");
import jwt = require("jsonwebtoken");
import Role = require("../models/Role");
import User = require("../models/User");

function isValidPassword(password: string): boolean {
  return /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(password);
}

const login: express.RequestHandler = async (req, res): Promise<void> => {
  try {
    const { usernameOrEmail, email, password } = req.body;
    const loginIdentifier =
      typeof usernameOrEmail === "string" && usernameOrEmail.trim()
        ? usernameOrEmail.trim().toLowerCase()
        : typeof email === "string"
          ? email.trim().toLowerCase()
          : "";

    if (!loginIdentifier || typeof password !== "string" || !password) {
      res.status(400).json({
        success: false,
        message: "Username/email and password are required",
        error: "LOGIN_FIELDS_REQUIRED",
      });
      return;
    }

    console.log("Login attempt:", loginIdentifier);

    const user = await User.findOne({
      isDeleted: false,
      $or: [{ email: loginIdentifier }, { username: loginIdentifier }],
    }).populate("roleId");

    if (!user) {
      res.status(401).json({
        success: false,
        message: `No active user found for "${loginIdentifier}". Check the email/username or register the user.`,
        error: "USER_NOT_FOUND",
      });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        message: `Password is incorrect for ${user.email}. If an admin reset it, use Welcome@1234 exactly.`,
        error: "PASSWORD_INCORRECT",
      });
      return;
    }

    const role = await Role.findOne({ _id: user.roleId, isDeleted: false });

    if (!role) {
      res.status(403).json({
        success: false,
        message: `User ${user.email} exists and the password is correct, but no active role is assigned. Ask an admin to update the user's role.`,
        error: "ROLE_NOT_ASSIGNED",
      });
      return;
    }

    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      res.status(500).json({ success: false, message: "JWT secret is not configured" });
      return;
    }

    const token = jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email,
        roleId: role._id.toString(),
        permissions: role.permissions,
      },
      jwtSecret,
      { expiresIn: "7d" },
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      data: {
        id: user._id.toString(),
        name: user.name,
        username: user.username,
        email: user.email,
        phone: user.phone,
        role: {
          id: role._id.toString(),
          name: role.name,
        },
        permissions: role.permissions,
        mustChangePassword: user.mustChangePassword,
      },
    });
  } catch (error) {
    console.error(error);

    if (error instanceof Error) {
      res.status(500).json({ success: false, message: error.message });
      return;
    }

    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const changePassword: express.RequestHandler = async (req, res): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (typeof currentPassword !== "string" || !currentPassword) {
      res.status(400).json({
        success: false,
        message: "Current password is required.",
        error: "CURRENT_PASSWORD_REQUIRED",
      });
      return;
    }

    if (!isValidPassword(newPassword)) {
      res.status(400).json({
        success: false,
        message:
          "New password must be at least 8 characters and include one uppercase letter, one number, and one special character.",
        error: "NEW_PASSWORD_INVALID",
      });
      return;
    }

    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Your login session has expired. Please log in again.",
        error: "SESSION_EXPIRED",
      });
      return;
    }

    const user = await User.findOne({ _id: req.user.id, isDeleted: false }).select(
      "email password",
    );

    if (!user) {
      res.status(401).json({
        success: false,
        message: "Your user account could not be found. Please log in again.",
        error: "USER_NOT_FOUND",
      });
      return;
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);

    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        message:
          "Current password is incorrect. If your password was reset, enter Welcome@1234 as the current password.",
        error: "CURRENT_PASSWORD_INCORRECT",
      });
      return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await User.updateOne(
      { _id: user._id, isDeleted: false },
      {
        $set: {
          password: hashedPassword,
          mustChangePassword: false,
        },
      },
    );

    res.json({
      success: true,
      message: `Password changed successfully for ${user.email}.`,
    });
  } catch (_error) {
    res.status(400).json({
      success: false,
      message: "Unable to change password. Please try again or ask an admin to reset it.",
      error: "PASSWORD_CHANGE_FAILED",
    });
  }
};

const logout: express.RequestHandler = (_req, res): void => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
  });

  res.json({ success: true, message: "Logged out successfully" });
};

const getMe: express.RequestHandler = (req, res): void => {
  res.json({
    success: true,
    data: {
      id: req.user?.id,
      name: req.user?.name,
      username: req.user?.username,
      email: req.user?.email,
      phone: req.user?.phone,
      role: req.user?.role,
      permissions: req.user?.permissions,
      mustChangePassword: req.user?.mustChangePassword,
    },
  });
};

export = {
  login,
  changePassword,
  logout,
  getMe,
};

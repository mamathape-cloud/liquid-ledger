import bcrypt = require("bcrypt");
import express = require("express");
import mongoose = require("mongoose");
import Role = require("../models/Role");
import User = require("../models/User");

const TEMPORARY_PASSWORD = "Welcome@1234";
const SALT_ROUNDS = 10;

function getValidObjectId(id: unknown): mongoose.Types.ObjectId | null {
  if (typeof id !== "string" || !mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }

  return new mongoose.Types.ObjectId(id);
}

function formatRole(role: any) {
  return {
    id: role._id.toString(),
    name: role.name,
    permissions: role.permissions,
  };
}

function formatUser(user: any) {
  return {
    id: user._id.toString(),
    name: user.name,
    username: user.username,
    email: user.email,
    phone: user.phone,
    role: formatRole(user.roleId),
    mustChangePassword: user.mustChangePassword,
  };
}

async function getEmployeeRole() {
  let role = await Role.findOne({ name: "Employee", isDeleted: false });

  if (!role) {
    role = await Role.create({
      name: "Employee",
      permissions: ["expenses.create", "expenses.upload_proof", "expenses.view_own"],
      isSystemRole: true,
    });
  }

  return role;
}

const createUser: express.RequestHandler = async (req, res): Promise<void> => {
  try {
    const { name, username, email, phone, roleId } = req.body;

    if (
      !name ||
      !username ||
      !email ||
      !phone ||
      !roleId ||
      typeof name !== "string" ||
      typeof username !== "string" ||
      typeof email !== "string" ||
      typeof phone !== "string" ||
      !name.trim() ||
      !username.trim() ||
      !email.trim() ||
      !phone.trim()
    ) {
      res.status(400).json({
        success: false,
        message: "Full name, username, email, phone, and role are required",
      });
      return;
    }

    const validRoleId = getValidObjectId(roleId);

    if (!validRoleId) {
      res.status(400).json({ success: false, message: "Invalid roleId" });
      return;
    }

    const normalizedUsername = username.trim().toLowerCase();
    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({
      isDeleted: false,
      $or: [{ email: normalizedEmail }, { username: normalizedUsername }],
    });

    if (existingUser) {
      res.status(400).json({
        success: false,
        message:
          existingUser.email === normalizedEmail
            ? "Email already in use"
            : "Username already in use",
      });
      return;
    }

    const role = await Role.findOne({ _id: validRoleId, isDeleted: false });

    if (!role) {
      res.status(400).json({ success: false, message: "Role not found" });
      return;
    }

    const hashedPassword = await bcrypt.hash(TEMPORARY_PASSWORD, SALT_ROUNDS);
    const user = await User.create({
      name: name.trim(),
      username: normalizedUsername,
      email: normalizedEmail,
      phone: phone.trim(),
      roleId: role._id,
      password: hashedPassword,
      mustChangePassword: true,
    });

    res.status(201).json({
      success: true,
      data: formatUser({
        ...user.toObject(),
        roleId: role,
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create user";
    res.status(400).json({ success: false, message });
  }
};

const registerUser: express.RequestHandler = async (req, res): Promise<void> => {
  try {
    const { name, username, email, phone } = req.body;

    if (
      !name ||
      !username ||
      !email ||
      !phone ||
      typeof name !== "string" ||
      typeof username !== "string" ||
      typeof email !== "string" ||
      typeof phone !== "string" ||
      !name.trim() ||
      !username.trim() ||
      !email.trim() ||
      !phone.trim()
    ) {
      res.status(400).json({
        success: false,
        message: "Full name, username, email, and phone are required",
      });
      return;
    }

    const normalizedUsername = username.trim().toLowerCase();
    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({
      isDeleted: false,
      $or: [{ email: normalizedEmail }, { username: normalizedUsername }],
    });

    if (existingUser) {
      res.status(400).json({
        success: false,
        message:
          existingUser.email === normalizedEmail
            ? "Email already in use"
            : "Username already in use",
      });
      return;
    }

    const role = await getEmployeeRole();
    const hashedPassword = await bcrypt.hash(TEMPORARY_PASSWORD, SALT_ROUNDS);
    const user = await User.create({
      name: name.trim(),
      username: normalizedUsername,
      email: normalizedEmail,
      phone: phone.trim(),
      roleId: role._id,
      password: hashedPassword,
      mustChangePassword: true,
    });

    res.status(201).json({
      success: true,
      data: formatUser({
        ...user.toObject(),
        roleId: role,
      }),
      message: "A temporary password Welcome@1234 will be assigned.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to register user";
    res.status(400).json({ success: false, message });
  }
};

const getUsers: express.RequestHandler = async (_req, res): Promise<void> => {
  const users = await User.find({ isDeleted: false })
    .select("-password")
    .populate("roleId", "name permissions")
    .sort({ createdAt: -1 });

  res.json({ success: true, data: users.map(formatUser) });
};

const getUserById: express.RequestHandler = async (req, res): Promise<void> => {
  const userId = getValidObjectId(req.params.id);

  if (!userId) {
    res.status(404).json({ success: false, message: "User not found" });
    return;
  }

  const user = await User.findOne({ _id: userId, isDeleted: false })
    .select("-password")
    .populate("roleId", "name permissions");

  if (!user) {
    res.status(404).json({ success: false, message: "User not found" });
    return;
  }

  res.json({ success: true, data: formatUser(user) });
};

const updateUser: express.RequestHandler = async (req, res): Promise<void> => {
  try {
    const userId = getValidObjectId(req.params.id);
    const { name, username, phone, roleId } = req.body;

    if (!userId) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    if (name !== undefined && (typeof name !== "string" || !name.trim())) {
      res.status(400).json({ success: false, message: "Name is required" });
      return;
    }

    if (username !== undefined && (typeof username !== "string" || !username.trim())) {
      res.status(400).json({ success: false, message: "Username is required" });
      return;
    }

    if (phone !== undefined && (typeof phone !== "string" || !phone.trim())) {
      res.status(400).json({ success: false, message: "Phone is required" });
      return;
    }

    const user = await User.findOne({ _id: userId, isDeleted: false });

    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    if (roleId !== undefined) {
      if (req.user?.id === user._id.toString()) {
        res.status(403).json({ success: false, message: "Cannot update your own role" });
        return;
      }

      const validRoleId = getValidObjectId(roleId);

      if (!validRoleId) {
        res.status(400).json({ success: false, message: "Invalid roleId" });
        return;
      }

      const role = await Role.findOne({ _id: validRoleId, isDeleted: false });

      if (!role) {
        res.status(400).json({ success: false, message: "Role not found" });
        return;
      }

      user.roleId = role._id;
    }

    if (name !== undefined) {
      user.name = name.trim();
    }

    if (username !== undefined) {
      const normalizedUsername = username.trim().toLowerCase();
      const existingUser = await User.findOne({
        _id: { $ne: user._id },
        username: normalizedUsername,
        isDeleted: false,
      });

      if (existingUser) {
        res.status(400).json({ success: false, message: "Username already in use" });
        return;
      }

      user.username = normalizedUsername;
    }

    if (phone !== undefined) {
      user.phone = phone.trim();
    }

    await user.save();

    const updatedUser = await User.findOne({ _id: user._id, isDeleted: false })
      .select("-password")
      .populate("roleId", "name permissions");

    res.json({ success: true, data: formatUser(updatedUser) });
  } catch (_error) {
    res.status(400).json({ success: false, message: "Unable to update user" });
  }
};

const deleteUser: express.RequestHandler = async (req, res): Promise<void> => {
  const userId = getValidObjectId(req.params.id);

  if (!userId) {
    res.status(404).json({ success: false, message: "User not found" });
    return;
  }

  if (req.user?.id === userId.toString()) {
    res.status(403).json({ success: false, message: "Cannot delete your own account" });
    return;
  }

  const user = await User.findOne({ _id: userId, isDeleted: false });

  if (!user) {
    res.status(404).json({ success: false, message: "User not found" });
    return;
  }

  user.isDeleted = true;
  await user.save();

  res.json({ success: true, message: "User deleted successfully" });
};

const resetPassword: express.RequestHandler = async (req, res): Promise<void> => {
  try {
    const userId = getValidObjectId(req.params.id);

    if (!userId) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    const user = await User.findOne({ _id: userId, isDeleted: false }).select(
      "name email username",
    );

    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    const hashedPassword = await bcrypt.hash(TEMPORARY_PASSWORD, SALT_ROUNDS);

    await User.updateOne(
      { _id: user._id, isDeleted: false },
      {
        $set: {
          password: hashedPassword,
          mustChangePassword: true,
        },
      },
    );

    res.json({
      success: true,
      data: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        username: user.username || "",
        temporaryPassword: TEMPORARY_PASSWORD,
      },
      message: `Password reset successfully for ${user.email}`,
    });
  } catch (_error) {
    res.status(400).json({ success: false, message: "Unable to reset password" });
  }
};

export = {
  createUser,
  registerUser,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  resetPassword,
};

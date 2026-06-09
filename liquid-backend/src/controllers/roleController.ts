import express = require("express");
import mongoose = require("mongoose");
import Role = require("../models/Role");
import User = require("../models/User");

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatRole(role: any) {
  return {
    id: role._id.toString(),
    name: role.name,
    permissions: role.permissions,
    isSystemRole: role.isSystemRole,
    createdAt: role.createdAt,
  };
}

function getValidRoleObjectId(id: unknown): mongoose.Types.ObjectId | null {
  if (typeof id !== "string" || !mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }

  return new mongoose.Types.ObjectId(id);
}

const createRole: express.RequestHandler = async (req, res): Promise<void> => {
  try {
    const { name, permissions } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      res.status(400).json({ success: false, message: "Role name is required" });
      return;
    }

    if (permissions !== undefined && !Array.isArray(permissions)) {
      res.status(400).json({ success: false, message: "Permissions must be an array" });
      return;
    }

    const trimmedName = name.trim();
    const existingRole = await Role.findOne({
      name: { $regex: `^${escapeRegex(trimmedName)}$`, $options: "i" },
      isDeleted: false,
    });

    if (existingRole) {
      res.status(400).json({ success: false, message: "Role already exists" });
      return;
    }

    const role = await Role.create({
      name: trimmedName,
      permissions: permissions || [],
      isSystemRole: false,
    });

    res.status(201).json({ success: true, data: formatRole(role) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create role";
    res.status(400).json({ success: false, message });
  }
};

const getRoles: express.RequestHandler = async (_req, res): Promise<void> => {
  const roles = await Role.find({ isDeleted: false })
    .select("name permissions isSystemRole createdAt")
    .sort({ createdAt: -1 });

  res.json({ success: true, data: roles.map(formatRole) });
};

const getRoleById: express.RequestHandler = async (req, res): Promise<void> => {
  const roleId = getValidRoleObjectId(req.params.id);

  if (!roleId) {
    res.status(404).json({ success: false, message: "Role not found" });
    return;
  }

  const role = await Role.findOne({ _id: roleId, isDeleted: false });

  if (!role) {
    res.status(404).json({ success: false, message: "Role not found" });
    return;
  }

  res.json({ success: true, data: formatRole(role) });
};

const updateRole: express.RequestHandler = async (req, res): Promise<void> => {
  try {
    const roleId = getValidRoleObjectId(req.params.id);
    const { name, permissions } = req.body;

    if (!roleId) {
      res.status(404).json({ success: false, message: "Role not found" });
      return;
    }

    if (name !== undefined && (typeof name !== "string" || !name.trim())) {
      res.status(400).json({ success: false, message: "Role name is required" });
      return;
    }

    if (permissions !== undefined && !Array.isArray(permissions)) {
      res.status(400).json({ success: false, message: "Permissions must be an array" });
      return;
    }

    const role = await Role.findOne({ _id: roleId, isDeleted: false });

    if (!role) {
      res.status(404).json({ success: false, message: "Role not found" });
      return;
    }

    if (role.isSystemRole) {
      res.status(403).json({ success: false, message: "System roles cannot be edited" });
      return;
    }

    if (name !== undefined) {
      const trimmedName = name.trim();
      const existingRole = await Role.findOne({
        _id: { $ne: role._id },
        name: { $regex: `^${escapeRegex(trimmedName)}$`, $options: "i" },
        isDeleted: false,
      });

      if (existingRole) {
        res.status(400).json({ success: false, message: "Role already exists" });
        return;
      }

      role.name = trimmedName;
    }

    if (permissions !== undefined) {
      role.permissions = permissions;
    }

    await role.save();

    res.json({ success: true, data: formatRole(role) });
  } catch (error) {
    res.status(400).json({ success: false, message: "Unable to update role" });
  }
};

const deleteRole: express.RequestHandler = async (req, res): Promise<void> => {
  const roleId = getValidRoleObjectId(req.params.id);

  if (!roleId) {
    res.status(404).json({ success: false, message: "Role not found" });
    return;
  }

  const role = await Role.findOne({ _id: roleId, isDeleted: false });

  if (!role) {
    res.status(404).json({ success: false, message: "Role not found" });
    return;
  }

  if (role.isSystemRole) {
    res.status(403).json({ success: false, message: "System roles cannot be deleted" });
    return;
  }

  const activeUser = await User.exists({ roleId: role._id, isDeleted: false });

  if (activeUser) {
    res.status(400).json({ success: false, message: "Cannot delete role with active users" });
    return;
  }

  role.isDeleted = true;
  await role.save();

  res.json({ success: true, message: "Role deleted successfully" });
};

export = {
  createRole,
  getRoles,
  getRoleById,
  updateRole,
  deleteRole,
};

import express = require("express");
import jwt = require("jsonwebtoken");
import Role = require("../models/Role");
import User = require("../models/User");

interface AuthenticatedUser {
  id: string;
  name: string;
  username?: string;
  email: string;
  phone?: string;
  role: {
    id: string;
    name: string;
  };
  permissions: string[];
  mustChangePassword: boolean;
}

interface TokenPayload extends jwt.JwtPayload {
  id?: string;
  userId?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

const verifyToken: express.RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const token = req.cookies?.token;

    if (!token) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      res.status(500).json({ success: false, message: "JWT secret is not configured" });
      return;
    }

    const decoded = jwt.verify(token, jwtSecret);

    if (typeof decoded === "string") {
      res.status(401).json({ success: false, message: "Invalid token" });
      return;
    }

    const payload = decoded as TokenPayload;
    const userId = payload.id || payload.userId;

    if (!userId) {
      res.status(401).json({ success: false, message: "Invalid token" });
      return;
    }

    const user = await User.findOne({ _id: userId, isDeleted: false }).select("-password");

    if (!user) {
      res.status(401).json({ success: false, message: "Invalid token" });
      return;
    }

    const role = await Role.findOne({ _id: user.roleId, isDeleted: false });

    if (!role) {
      res.status(401).json({ success: false, message: "Invalid token" });
      return;
    }

    req.user = {
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
    };

    next();
  } catch (_error) {
    res.status(401).json({ success: false, message: "Invalid token" });
  }
};

function hasPermission(permission: string): express.RequestHandler {
  return (req, res, next): void => {
    if (!req.user?.permissions.includes(permission)) {
      res.status(403).json({ success: false, message: "Access denied" });
      return;
    }

    next();
  };
}

export = { verifyToken, hasPermission };

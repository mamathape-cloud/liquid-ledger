import bcrypt = require("bcrypt");
import Role = require("../models/Role");
import User = require("../models/User");

const ALL_PERMISSIONS = [
  "expenses.create",
  "expenses.approve",
  "expenses.disburse",
  "expenses.upload_proof",
  "expenses.audit",
  "expenses.view_all",
  "expenses.view_own",
  "petty_cash.view",
  "users.manage",
  "roles.manage",
  "reports.view",
] as const;

async function adminSeeder(): Promise<void> {
  const existingUser = await User.findOne({ isDeleted: false });

  if (existingUser) {
    console.log("Seed already done");
    return;
  }

  const superAdminRole = new Role({
    name: "Super Admin",
    permissions: [...ALL_PERMISSIONS],
    isSystemRole: true,
  });
  await superAdminRole.save();

  const hashedPassword = await bcrypt.hash("Admin@1234", 10);

  await User.create({
    name: "Super Admin",
    username: "superadmin",
    email: "admin@liquidledger.com",
    phone: "9999999999",
    password: hashedPassword,
    roleId: superAdminRole._id,
    mustChangePassword: true,
  });

  console.log("Admin seeded successfully");
}

export = adminSeeder;

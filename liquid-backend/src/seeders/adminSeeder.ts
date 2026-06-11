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

const ADMIN_EMAIL = "admin@liquidledger.com";
const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "Admin@1234";
const ADMIN_PHONE = "9999999999";

async function adminSeeder(): Promise<void> {
  const adminRole = await Role.findOneAndUpdate(
    { name: "Admin", isDeleted: false },
    {
      $set: {
        permissions: [...ALL_PERMISSIONS],
        isSystemRole: true,
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    },
  );

  const existingAdmin = await User.findOne({
    isDeleted: false,
    $or: [{ email: ADMIN_EMAIL }, { username: ADMIN_USERNAME }],
  });

  const shouldResetPassword = process.env.RESET_ADMIN_PASSWORD === "true";
  const userUpdate: Record<string, unknown> = {
    name: "Admin",
    username: ADMIN_USERNAME,
    email: ADMIN_EMAIL,
    phone: ADMIN_PHONE,
    roleId: adminRole._id,
  };

  if (!existingAdmin || shouldResetPassword) {
    userUpdate.password = await bcrypt.hash(ADMIN_PASSWORD, 10);
    userUpdate.mustChangePassword = true;
  }

  await User.findOneAndUpdate(
    {
      isDeleted: false,
      $or: [{ email: ADMIN_EMAIL }, { username: ADMIN_USERNAME }],
    },
    {
      $set: userUpdate,
      $setOnInsert: { isDeleted: false },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    },
  );

  console.log(
    shouldResetPassword
      ? "Admin login created and password reset successfully"
      : "Admin login ensured successfully",
  );
}

export = adminSeeder;

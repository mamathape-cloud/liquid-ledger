import mongoose = require("mongoose");

const ROLE_PERMISSIONS = [
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

type Permission = (typeof ROLE_PERMISSIONS)[number];

interface IRole extends mongoose.Document {
  name: string;
  permissions: Permission[];
  isSystemRole: boolean;
  isDeleted: boolean;
}

const roleSchema = new mongoose.Schema<IRole>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    permissions: [
      {
        type: String,
        enum: ROLE_PERMISSIONS,
      },
    ],
    isSystemRole: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

roleSchema.virtual("id").get(function (this: IRole) {
  return this._id.toString();
});

roleSchema.index(
  { name: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);

const Role = mongoose.model<IRole>("Role", roleSchema);

export = Role;

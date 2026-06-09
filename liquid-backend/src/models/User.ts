import mongoose = require("mongoose");

interface IUser extends mongoose.Document {
  name: string;
  username: string;
  email: string;
  phone: string;
  password: string;
  roleId: mongoose.Types.ObjectId;
  mustChangePassword: boolean;
  isDeleted: boolean;
}

const userSchema = new mongoose.Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    username: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: true,
    },
    mustChangePassword: {
      type: Boolean,
      default: true,
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

userSchema.virtual("id").get(function (this: IUser) {
  return this._id.toString();
});

userSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);
userSchema.index(
  { username: 1 },
  {
    unique: true,
    partialFilterExpression: { isDeleted: false, username: { $type: "string" } },
  },
);

const User = mongoose.model<IUser>("User", userSchema);

export = User;

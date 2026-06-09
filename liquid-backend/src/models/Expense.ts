import mongoose = require("mongoose");

const EXPENSE_CATEGORIES = [
  "TRAVEL",
  "HOTEL",
  "FOOD",
  "LOCAL_TRANS",
  "EQUIP_LOG",
  "CONTINGENCY",
  "PETTY_MISC",
  "VENDOR_ADV",
  "REIMBURSE",
  "OTHER",
] as const;

const EXPENSE_STATUSES = [
  "DRAFT",
  "PENDING",
  "APPROVED",
  "REJECTED",
  "DISBURSED",
  "PROOF_PENDING",
  "AUDIT_PENDING",
  "SETTLED",
  "DISCREPANCY",
] as const;

type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

interface IExpense extends mongoose.Document {
  eventId?: mongoose.Types.ObjectId;
  eventName: string;
  employeeId: mongoose.Types.ObjectId;
  category: ExpenseCategory;
  advanceAmount?: number;
  requestedAmount: number;
  approvedAmount?: number;
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  disbursedAmount?: number;
  disbursedBy?: mongoose.Types.ObjectId;
  purpose: string;
  requiredDate: Date;
  status: ExpenseStatus;
  proofUrls: string[];
  attachmentUrls: string[];
  proofSubmittedAt?: Date;
  disbursedAt?: Date;
  proofDeadline?: Date;
  auditedBy?: mongoose.Types.ObjectId;
  auditedAt?: Date;
  settledAt?: Date;
  isDeleted: boolean;
  notes?: string;
}

const expenseSchema = new mongoose.Schema<IExpense>(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
    },
    eventName: {
      type: String,
      required: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    category: {
      type: String,
      enum: EXPENSE_CATEGORIES,
      required: true,
    },
    advanceAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    requestedAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    approvedAmount: {
      type: Number,
      min: 0,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    approvedAt: {
      type: Date,
    },
    disbursedAmount: {
      type: Number,
      min: 0,
    },
    disbursedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    purpose: {
      type: String,
      required: true,
      minlength: 10,
      maxlength: 300,
    },
    requiredDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: EXPENSE_STATUSES,
      default: "DRAFT",
    },
    proofUrls: {
      type: [String],
      default: [],
    },
    attachmentUrls: {
      type: [String],
      default: [],
    },
    proofSubmittedAt: {
      type: Date,
    },
    disbursedAt: {
      type: Date,
    },
    proofDeadline: {
      type: Date,
    },
    auditedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    auditedAt: {
      type: Date,
    },
    settledAt: {
      type: Date,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    notes: {
      type: String,
    },
  },
  {
    strict: true,
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        const expense = ret as Record<string, unknown>;
        delete expense._id;
        delete expense.__v;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: (_doc, ret) => {
        const expense = ret as Record<string, unknown>;
        delete expense._id;
        delete expense.__v;
        return ret;
      },
    },
  },
);

expenseSchema.virtual("id").get(function (this: IExpense) {
  return this._id.toString();
});

expenseSchema.virtual("displayId").get(function (this: IExpense) {
  return `EXP-${this._id.toString().slice(-6).toUpperCase()}`;
});

function excludeDeleted(this: mongoose.Query<unknown, unknown>): void {
  this.where({ isDeleted: { $ne: true } });
}

expenseSchema.pre("find", excludeDeleted);
expenseSchema.pre("findOne", excludeDeleted);
expenseSchema.pre("findOneAndUpdate", excludeDeleted);

const Expense = mongoose.model<IExpense>("Expense", expenseSchema);

export = Expense;

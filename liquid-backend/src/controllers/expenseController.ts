import express = require("express");
import mongoose = require("mongoose");
import Event = require("../models/Event");
import Expense = require("../models/Expense");

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

const PROOF_DEADLINE_HOURS = 48;
const PAGE_SIZE_DEFAULT = 20;

type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];
type AuditResult = "SETTLED" | "DISCREPANCY";

function getValidObjectId(id: unknown): mongoose.Types.ObjectId | null {
  if (typeof id !== "string" || !mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }

  return new mongoose.Types.ObjectId(id);
}

function isExpenseCategory(category: unknown): category is ExpenseCategory {
  return typeof category === "string" && EXPENSE_CATEGORIES.includes(category as ExpenseCategory);
}

function isExpenseStatus(status: unknown): status is ExpenseStatus {
  return typeof status === "string" && EXPENSE_STATUSES.includes(status as ExpenseStatus);
}

function isAuditResult(auditResult: unknown): auditResult is AuditResult {
  return auditResult === "SETTLED" || auditResult === "DISCREPANCY";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string" && item.trim());
}

function hasPermission(req: express.Request, permission: string): boolean {
  return Boolean(req.user?.permissions.includes(permission));
}

function isOwner(expense: { employeeId: unknown }, userId?: string): boolean {
  return Boolean(userId && expense.employeeId?.toString() === userId);
}

function getQueryString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function findExpenseById(id: unknown) {
  const expenseId = getValidObjectId(id);

  if (!expenseId) {
    return null;
  }

  return Expense.findOne({ _id: expenseId, isDeleted: false });
}

const createExpense: express.RequestHandler = async (req, res): Promise<void> => {
  try {
    const {
      eventId,
      eventName,
      category,
      requestedAmount,
      purpose,
      requiredDate,
      remarks,
      attachmentUrls,
      status,
    } = req.body;

    if (
      !eventId ||
      !category ||
      requestedAmount === undefined ||
      typeof purpose !== "string" ||
      !purpose.trim() ||
      !requiredDate
    ) {
      res.status(400).json({
        success: false,
        message: "eventId, category, requestedAmount, purpose, and requiredDate are required",
      });
      return;
    }

    if (!isExpenseCategory(category)) {
      res.status(400).json({ success: false, message: "Invalid expense category" });
      return;
    }

    const parsedRequestedAmount = Number(requestedAmount);

    if (!Number.isFinite(parsedRequestedAmount) || parsedRequestedAmount <= 0) {
      res.status(400).json({ success: false, message: "requestedAmount must be greater than 0" });
      return;
    }

    const trimmedPurpose = purpose.trim();

    if (trimmedPurpose.length < 10 || trimmedPurpose.length > 300) {
      res.status(400).json({
        success: false,
        message: "purpose must be between 10 and 300 characters",
      });
      return;
    }

    const parsedRequiredDate = new Date(requiredDate);

    if (Number.isNaN(parsedRequiredDate.getTime())) {
      res.status(400).json({ success: false, message: "requiredDate must be a valid date" });
      return;
    }

    if (remarks !== undefined && typeof remarks !== "string") {
      res.status(400).json({ success: false, message: "remarks must be a string" });
      return;
    }

    if (attachmentUrls !== undefined && !isStringArray(attachmentUrls)) {
      res.status(400).json({ success: false, message: "attachmentUrls must contain URL strings" });
      return;
    }

    if (status !== undefined && status !== "DRAFT" && status !== "PENDING") {
      res.status(400).json({ success: false, message: "status must be DRAFT or PENDING" });
      return;
    }

    const employeeId = getValidObjectId(req.user?.id);

    if (!employeeId) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const selectedEventId = getValidObjectId(eventId);

    if (!selectedEventId) {
      res.status(400).json({ success: false, message: "Invalid eventId" });
      return;
    }

    const selectedEvent = await Event.findOne({
      _id: selectedEventId,
      isDeleted: false,
      "allocations.employeeId": employeeId,
    });

    if (!selectedEvent) {
      res.status(400).json({
        success: false,
        message: "Select an event assigned to you by Finance",
      });
      return;
    }

    const allocation = selectedEvent.allocations.find(
      (item: { employeeId: mongoose.Types.ObjectId }) =>
        item.employeeId.toString() === employeeId.toString(),
    );

    const expensePayload: Record<string, unknown> = {
      eventId: selectedEvent._id,
      eventName: selectedEvent.eventName,
      category,
      advanceAmount: allocation?.allocatedAmount || 0,
      requestedAmount: parsedRequestedAmount,
      purpose: trimmedPurpose,
      requiredDate: parsedRequiredDate,
      employeeId,
      status: status === "PENDING" ? "PENDING" : "DRAFT",
      proofUrls: [],
      attachmentUrls: attachmentUrls
        ? attachmentUrls.map((url: string) => url.trim())
        : [],
    };

    if (typeof remarks === "string" && remarks.trim()) {
      expensePayload.notes = remarks.trim();
    }

    const expense = await Expense.create(expensePayload);

    res.status(201).json({ success: true, data: expense });
  } catch (_error) {
    res.status(400).json({ success: false, message: "Unable to create expense" });
  }
};

const submitExpense: express.RequestHandler = async (req, res): Promise<void> => {
  const expense = await findExpenseById(req.params.id);

  if (!expense) {
    res.status(404).json({ success: false, message: "Expense not found" });
    return;
  }

  if (!isOwner(expense, req.user?.id)) {
    res.status(403).json({ success: false, message: "You can only submit your own expense" });
    return;
  }

  if (expense.status !== "DRAFT") {
    res.status(400).json({ success: false, message: "Only DRAFT expenses can be submitted" });
    return;
  }

  expense.status = "PENDING";
  await expense.save();

  res.json({ success: true, data: expense });
};

const getExpenses: express.RequestHandler = async (req, res): Promise<void> => {
  const canViewAll = hasPermission(req, "expenses.view_all");
  const canViewOwn = hasPermission(req, "expenses.view_own");

  if (!canViewAll && !canViewOwn) {
    res.status(403).json({ success: false, message: "Access denied" });
    return;
  }

  const filters: Record<string, unknown> = { isDeleted: false };

  if (!canViewAll) {
    const employeeId = getValidObjectId(req.user?.id);

    if (!employeeId) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    filters.employeeId = employeeId;
  }

  const status = getQueryString(req.query.status);
  const category = getQueryString(req.query.category);
  const eventName = getQueryString(req.query.eventName) || getQueryString(req.query.search);
  const eventId = getQueryString(req.query.eventId);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.max(Number(req.query.limit) || PAGE_SIZE_DEFAULT, 1);

  if (status) {
    if (!isExpenseStatus(status)) {
      res.status(400).json({ success: false, message: "Invalid expense status" });
      return;
    }

    filters.status = status;
  }

  if (category) {
    if (!isExpenseCategory(category)) {
      res.status(400).json({ success: false, message: "Invalid expense category" });
      return;
    }

    filters.category = category;
  }

  if (eventName) {
    filters.eventName = { $regex: escapeRegex(eventName), $options: "i" };
  }

  if (eventId) {
    const selectedEventId = getValidObjectId(eventId);

    if (!selectedEventId) {
      res.status(400).json({ success: false, message: "Invalid eventId" });
      return;
    }

    filters.eventId = selectedEventId;
  }

  const [expenses, total] = await Promise.all([
    Expense.find(filters)
    .populate("employeeId", "name email")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Expense.countDocuments(filters),
  ]);

  res.json({ success: true, data: { expenses, total, page, limit } });
};

const getExpenseById: express.RequestHandler = async (req, res): Promise<void> => {
  const canViewAll = hasPermission(req, "expenses.view_all");
  const canViewOwn = hasPermission(req, "expenses.view_own");

  if (!canViewAll && !canViewOwn) {
    res.status(403).json({ success: false, message: "Access denied" });
    return;
  }

  const expense = await findExpenseById(req.params.id);

  if (!expense) {
    res.status(404).json({ success: false, message: "Expense not found" });
    return;
  }

  if (!canViewAll && !isOwner(expense, req.user?.id)) {
    res.status(403).json({ success: false, message: "Access denied" });
    return;
  }

  await expense.populate("employeeId", "name email");

  res.json({ success: true, data: expense });
};

const updateExpense: express.RequestHandler = async (req, res): Promise<void> => {
  try {
    const expense = await findExpenseById(req.params.id);

    if (!expense) {
      res.status(404).json({ success: false, message: "Expense not found" });
      return;
    }

    const canEditAll = hasPermission(req, "expenses.view_all");

    if (!canEditAll && !isOwner(expense, req.user?.id)) {
      res.status(403).json({ success: false, message: "Access denied" });
      return;
    }

    const {
      eventName,
      category,
      requestedAmount,
      purpose,
      requiredDate,
      remarks,
      attachmentUrls,
    } = req.body;

    if (eventName !== undefined) {
      if (typeof eventName !== "string" || !eventName.trim()) {
        res.status(400).json({ success: false, message: "eventName is required" });
        return;
      }

      expense.eventName = eventName.trim();
    }

    if (category !== undefined) {
      if (!isExpenseCategory(category)) {
        res.status(400).json({ success: false, message: "Invalid expense category" });
        return;
      }

      expense.category = category;
    }

    if (requestedAmount !== undefined) {
      const parsedRequestedAmount = Number(requestedAmount);

      if (!Number.isFinite(parsedRequestedAmount) || parsedRequestedAmount <= 0) {
        res.status(400).json({ success: false, message: "requestedAmount must be greater than 0" });
        return;
      }

      expense.requestedAmount = Number(parsedRequestedAmount.toFixed(2));
    }

    if (purpose !== undefined) {
      if (typeof purpose !== "string" || !purpose.trim()) {
        res.status(400).json({ success: false, message: "purpose is required" });
        return;
      }

      const trimmedPurpose = purpose.trim();

      if (trimmedPurpose.length < 10 || trimmedPurpose.length > 300) {
        res.status(400).json({
          success: false,
          message: "purpose must be between 10 and 300 characters",
        });
        return;
      }

      expense.purpose = trimmedPurpose;
    }

    if (requiredDate !== undefined) {
      const parsedRequiredDate = new Date(requiredDate);

      if (Number.isNaN(parsedRequiredDate.getTime())) {
        res.status(400).json({ success: false, message: "requiredDate must be a valid date" });
        return;
      }

      expense.requiredDate = parsedRequiredDate;
    }

    if (remarks !== undefined) {
      if (typeof remarks !== "string") {
        res.status(400).json({ success: false, message: "remarks must be a string" });
        return;
      }

      expense.notes = remarks.trim();
    }

    if (attachmentUrls !== undefined) {
      if (!isStringArray(attachmentUrls)) {
        res.status(400).json({ success: false, message: "attachmentUrls must contain URL strings" });
        return;
      }

      expense.attachmentUrls = attachmentUrls.map((url) => url.trim());
    }

    await expense.save();
    await expense.populate("employeeId", "name email");

    res.json({ success: true, data: expense });
  } catch (_error) {
    res.status(400).json({ success: false, message: "Unable to update expense" });
  }
};

const approveExpense: express.RequestHandler = async (req, res): Promise<void> => {
  const { approvedAmount, notes } = req.body;
  const parsedApprovedAmount = Number(approvedAmount);

  if (!Number.isFinite(parsedApprovedAmount) || parsedApprovedAmount <= 0) {
    res.status(400).json({ success: false, message: "approvedAmount must be greater than 0" });
    return;
  }

  if (notes !== undefined && typeof notes !== "string") {
    res.status(400).json({ success: false, message: "notes must be a string" });
    return;
  }

  const expense = await findExpenseById(req.params.id);

  if (!expense) {
    res.status(404).json({ success: false, message: "Expense not found" });
    return;
  }

  if (expense.status !== "PENDING") {
    res.status(400).json({ success: false, message: "Only PENDING expenses can be approved" });
    return;
  }

  const approverId = getValidObjectId(req.user?.id);

  if (!approverId) {
    res.status(401).json({ success: false, message: "Authentication required" });
    return;
  }

  expense.status = "APPROVED";
  expense.approvedAmount = parsedApprovedAmount;
  expense.approvedBy = approverId;
  expense.approvedAt = new Date();

  if (notes !== undefined) {
    expense.notes = notes.trim();
  }

  await expense.save();

  res.json({ success: true, data: expense });
};

const rejectExpense: express.RequestHandler = async (req, res): Promise<void> => {
  const notes = req.body.notes ?? req.body.reason;

  if (typeof notes !== "string" || !notes.trim()) {
    res.status(400).json({ success: false, message: "notes are required" });
    return;
  }

  const expense = await findExpenseById(req.params.id);

  if (!expense) {
    res.status(404).json({ success: false, message: "Expense not found" });
    return;
  }

  if (expense.status !== "PENDING") {
    res.status(400).json({ success: false, message: "Only PENDING expenses can be rejected" });
    return;
  }

  const approverId = getValidObjectId(req.user?.id);

  if (!approverId) {
    res.status(401).json({ success: false, message: "Authentication required" });
    return;
  }

  expense.status = "REJECTED";
  expense.approvedBy = approverId;
  expense.approvedAt = new Date();
  expense.notes = notes.trim();
  await expense.save();

  res.json({ success: true, data: expense });
};

const disburseExpense: express.RequestHandler = async (req, res): Promise<void> => {
  const { disbursedAmount } = req.body;
  const parsedDisbursedAmount = Number(disbursedAmount);

  if (!Number.isFinite(parsedDisbursedAmount) || parsedDisbursedAmount <= 0) {
    res.status(400).json({ success: false, message: "disbursedAmount must be greater than 0" });
    return;
  }

  const expense = await findExpenseById(req.params.id);

  if (!expense) {
    res.status(404).json({ success: false, message: "Expense not found" });
    return;
  }

  if (expense.status !== "APPROVED") {
    res.status(400).json({ success: false, message: "Only APPROVED expenses can be disbursed" });
    return;
  }

  const disburserId = getValidObjectId(req.user?.id);

  if (!disburserId) {
    res.status(401).json({ success: false, message: "Authentication required" });
    return;
  }

  const disbursedAt = new Date();

  expense.disbursedAmount = parsedDisbursedAmount;
  expense.disbursedBy = disburserId;
  expense.disbursedAt = disbursedAt;
  expense.proofDeadline = new Date(
    disbursedAt.getTime() + PROOF_DEADLINE_HOURS * 60 * 60 * 1000,
  );
  expense.status = "DISBURSED";
  await expense.save();

  res.json({ success: true, data: expense });
};

const updateExpenseStatus: express.RequestHandler = async (req, res): Promise<void> => {
  const { status, approvedAmount, disbursedAmount, notes, proofUrls } = req.body;

  if (!isExpenseStatus(status)) {
    res.status(400).json({ success: false, message: "Invalid expense status" });
    return;
  }

  const expense = await findExpenseById(req.params.id);

  if (!expense) {
    res.status(404).json({ success: false, message: "Expense not found" });
    return;
  }

  const actorId = getValidObjectId(req.user?.id);

  if (!actorId) {
    res.status(401).json({ success: false, message: "Authentication required" });
    return;
  }

  const currentStatus = expense.status;

  if (status === "PENDING") {
    if (currentStatus !== "DRAFT") {
      res.status(400).json({ success: false, message: "Only DRAFT expenses can be submitted" });
      return;
    }

    if (!isOwner(expense, req.user?.id)) {
      res.status(403).json({ success: false, message: "You can only submit your own expense" });
      return;
    }

    expense.status = "PENDING";
  } else if (status === "APPROVED") {
    if (!hasPermission(req, "expenses.approve")) {
      res.status(403).json({ success: false, message: "Access denied" });
      return;
    }

    if (currentStatus !== "PENDING") {
      res.status(400).json({ success: false, message: "Only PENDING expenses can be approved" });
      return;
    }

    if (approvedAmount === undefined || approvedAmount === null || approvedAmount === "") {
      res.status(400).json({ success: false, message: "approvedAmount is required" });
      return;
    }

    const parsedApprovedAmount = Number(approvedAmount);

    if (!Number.isFinite(parsedApprovedAmount) || parsedApprovedAmount <= 0) {
      res.status(400).json({ success: false, message: "approvedAmount must be greater than 0" });
      return;
    }

    expense.status = "APPROVED";
    expense.approvedAmount = Number(parsedApprovedAmount.toFixed(2));
    expense.approvedBy = actorId;
    expense.approvedAt = new Date();
  } else if (status === "REJECTED") {
    if (!hasPermission(req, "expenses.approve")) {
      res.status(403).json({ success: false, message: "Access denied" });
      return;
    }

    if (currentStatus !== "PENDING" && currentStatus !== "APPROVED") {
      res.status(400).json({ success: false, message: "Only PENDING or APPROVED expenses can be rejected" });
      return;
    }

    if (typeof notes !== "string" || !notes.trim()) {
      res.status(400).json({ success: false, message: "remarks are required when rejecting" });
      return;
    }

    expense.status = "REJECTED";
    expense.approvedBy = actorId;
    expense.approvedAt = new Date();
  } else if (status === "DISBURSED") {
    if (!hasPermission(req, "expenses.disburse")) {
      res.status(403).json({ success: false, message: "Access denied" });
      return;
    }

    if (currentStatus !== "APPROVED") {
      res.status(400).json({ success: false, message: "Only APPROVED expenses can be disbursed" });
      return;
    }

    if (disbursedAmount === undefined || disbursedAmount === null || disbursedAmount === "") {
      res.status(400).json({ success: false, message: "disbursedAmount is required" });
      return;
    }

    const parsedDisbursedAmount = Number(disbursedAmount);

    if (!Number.isFinite(parsedDisbursedAmount) || parsedDisbursedAmount <= 0) {
      res.status(400).json({ success: false, message: "disbursedAmount must be greater than 0" });
      return;
    }

    const disbursedAt = new Date();
    expense.disbursedAmount = Number(parsedDisbursedAmount.toFixed(2));
    expense.disbursedBy = actorId;
    expense.disbursedAt = disbursedAt;
    expense.proofDeadline = new Date(
      disbursedAt.getTime() + PROOF_DEADLINE_HOURS * 60 * 60 * 1000,
    );
    expense.status = "DISBURSED";
  } else if (status === "PROOF_PENDING") {
    if (!hasPermission(req, "expenses.disburse")) {
      res.status(403).json({ success: false, message: "Access denied" });
      return;
    }

    if (currentStatus !== "DISBURSED") {
      res.status(400).json({ success: false, message: "Only DISBURSED expenses can move to proof pending" });
      return;
    }

    expense.status = "PROOF_PENDING";
  } else if (status === "AUDIT_PENDING") {
    if (currentStatus !== "PROOF_PENDING") {
      res.status(400).json({ success: false, message: "Only PROOF_PENDING expenses can move to audit pending" });
      return;
    }

    if (!hasPermission(req, "expenses.upload_proof") && !isOwner(expense, req.user?.id)) {
      res.status(403).json({ success: false, message: "You can only upload proof for your own expense" });
      return;
    }

    if (proofUrls !== undefined) {
      if (!isStringArray(proofUrls) || proofUrls.length > 10) {
        res.status(400).json({ success: false, message: "proofUrls must contain up to 10 URL strings" });
        return;
      }

      expense.proofUrls = proofUrls.map((url) => url.trim());
    }

    if (expense.proofUrls.length < 1) {
      res.status(400).json({ success: false, message: "At least one bill proof is required" });
      return;
    }

    expense.proofSubmittedAt = new Date();
    expense.status = "AUDIT_PENDING";
  } else if (status === "SETTLED" || status === "DISCREPANCY") {
    if (!hasPermission(req, "expenses.audit")) {
      res.status(403).json({ success: false, message: "Access denied" });
      return;
    }

    if (currentStatus !== "AUDIT_PENDING") {
      res.status(400).json({ success: false, message: "Only AUDIT_PENDING expenses can be audited" });
      return;
    }

    expense.auditedBy = actorId;
    expense.auditedAt = new Date();
    expense.status = status;

    if (status === "SETTLED") {
      expense.settledAt = new Date();
    }
  } else {
    res.status(400).json({ success: false, message: "Unsupported status transition" });
    return;
  }

  if (typeof notes === "string") {
    expense.notes = notes.trim();
  }

  await expense.save();
  await expense.populate("employeeId", "name email");

  res.json({ success: true, data: expense });
};

const uploadProof: express.RequestHandler = async (req, res): Promise<void> => {
  const { proofUrls } = req.body;

  if (
    !Array.isArray(proofUrls) ||
    proofUrls.length < 1 ||
    proofUrls.length > 10 ||
    !proofUrls.every((url) => typeof url === "string" && url.trim())
  ) {
    res.status(400).json({
      success: false,
      message: "proofUrls must contain 1 to 10 URL strings",
    });
    return;
  }

  const expense = await findExpenseById(req.params.id);

  if (!expense) {
    res.status(404).json({ success: false, message: "Expense not found" });
    return;
  }

  if (!isOwner(expense, req.user?.id)) {
    res.status(403).json({ success: false, message: "You can only upload proof for your own expense" });
    return;
  }

  if (expense.status !== "PROOF_PENDING") {
    res.status(400).json({ success: false, message: "Only PROOF_PENDING expenses can receive proof" });
    return;
  }

  expense.proofUrls = proofUrls.map((url) => url.trim());
  expense.proofSubmittedAt = new Date();
  expense.status = "AUDIT_PENDING";
  await expense.save();

  res.json({ success: true, data: expense });
};

const auditExpense: express.RequestHandler = async (req, res): Promise<void> => {
  const { auditResult, notes } = req.body;

  if (!isAuditResult(auditResult)) {
    res.status(400).json({
      success: false,
      message: 'auditResult must be "SETTLED" or "DISCREPANCY"',
    });
    return;
  }

  if (notes !== undefined && typeof notes !== "string") {
    res.status(400).json({ success: false, message: "notes must be a string" });
    return;
  }

  const expense = await findExpenseById(req.params.id);

  if (!expense) {
    res.status(404).json({ success: false, message: "Expense not found" });
    return;
  }

  if (expense.status !== "AUDIT_PENDING") {
    res.status(400).json({ success: false, message: "Only AUDIT_PENDING expenses can be audited" });
    return;
  }

  const auditorId = getValidObjectId(req.user?.id);

  if (!auditorId) {
    res.status(401).json({ success: false, message: "Authentication required" });
    return;
  }

  expense.auditedBy = auditorId;
  expense.auditedAt = new Date();
  expense.status = auditResult;

  if (auditResult === "SETTLED") {
    expense.settledAt = new Date();
  }

  if (notes !== undefined) {
    expense.notes = notes.trim();
  }

  await expense.save();

  res.json({ success: true, data: expense });
};

const deleteExpense: express.RequestHandler = async (req, res): Promise<void> => {
  const expense = await findExpenseById(req.params.id);

  if (!expense) {
    res.status(404).json({ success: false, message: "Expense not found" });
    return;
  }

  const canDeleteAll = hasPermission(req, "expenses.view_all");

  if (!canDeleteAll && !isOwner(expense, req.user?.id)) {
    res.status(403).json({ success: false, message: "Access denied" });
    return;
  }

  if (!canDeleteAll && expense.status !== "DRAFT") {
    res.status(400).json({ success: false, message: "Only DRAFT expenses can be deleted" });
    return;
  }

  expense.isDeleted = true;
  await expense.save();

  res.json({ success: true, message: "Expense deleted" });
};

export = {
  createExpense,
  submitExpense,
  getExpenses,
  getExpenseById,
  updateExpense,
  approveExpense,
  rejectExpense,
  disburseExpense,
  uploadProof,
  auditExpense,
  updateExpenseStatus,
  deleteExpense,
};

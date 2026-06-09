"use client";

import axios from "axios";
import { useParams, useRouter } from "next/navigation";
import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import AppLayout from "@/components/layout/AppLayout";
import StatusBadge from "@/components/ui/StatusBadge";
import { useAuth } from "@/context/AuthContext";
import {
  approveExpense,
  auditExpense,
  disburseExpense,
  getExpenseById,
  rejectExpense,
  submitExpense,
  updateExpenseStatus,
  uploadFiles,
  uploadProof,
} from "@/lib/expenseApi";
import {
  ExpenseCategory,
  type Expense,
  ExpenseStatus,
} from "@/types/expense";

type ActionType = "approve" | "reject" | "disburse" | "upload" | "audit";

interface ActiveAction {
  type: ActionType;
  auditStatus?: ExpenseStatus.SETTLED | ExpenseStatus.DISCREPANCY;
}

const categoryLabels: Record<ExpenseCategory, string> = {
  [ExpenseCategory.TRAVEL]: "Travel",
  [ExpenseCategory.HOTEL]: "Hotel",
  [ExpenseCategory.FOOD]: "Food",
  [ExpenseCategory.LOCAL_TRANS]: "Local Transport",
  [ExpenseCategory.EQUIP_LOG]: "Equipment Logistics",
  [ExpenseCategory.CONTINGENCY]: "Contingency",
  [ExpenseCategory.PETTY_MISC]: "Petty / Misc",
  [ExpenseCategory.VENDOR_ADV]: "Vendor Advance",
  [ExpenseCategory.REIMBURSE]: "Reimburse",
  [ExpenseCategory.OTHER]: "Others",
};

const allowedProofTypes = ["application/pdf", "image/jpeg", "image/png"];
const maxProofSize = 5 * 1024 * 1024;
const maxProofFiles = 10;

function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<{ message?: string; error?: string }>(error)) {
    return error.response?.data?.message || error.response?.data?.error || fallback;
  }

  return fallback;
}

function formatMoney(amount: number | null): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(amount || 0);
}

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "Not completed";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not completed";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(date);
}

function ExpenseDetailsSkeleton() {
  return (
    <section className="animate-pulse space-y-5">
      <div className="h-11 w-36 rounded bg-ui-border" />
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-ui-border/70">
        <div className="h-8 w-56 rounded bg-ui-border" />
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-20 rounded-xl bg-ui-row-alt" />
          ))}
        </div>
      </div>
      <div className="h-80 rounded-2xl bg-white shadow-sm ring-1 ring-ui-border/70" />
    </section>
  );
}

function AccessDenied() {
  return (
    <section className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-ui-border/70">
      <h2 className="text-2xl font-extrabold text-ui-text-primary">Access Denied</h2>
      <p className="mt-2 text-sm font-medium text-ui-text-muted">
        You do not have permission to view this expense.
      </p>
    </section>
  );
}

function DetailItem({
  label,
  value,
  isMono = false,
}: {
  label: string;
  value: string;
  isMono?: boolean;
}) {
  return (
    <div className="rounded-xl bg-ui-row-alt p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-ui-text-muted">
        {label}
      </p>
      <p
        className={`mt-2 text-sm font-bold text-ui-text-primary ${
          isMono ? "font-mono" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function buildTimeline(expense: Expense) {
  const approvedOrRejectedStatuses = [
    ExpenseStatus.APPROVED,
    ExpenseStatus.REJECTED,
    ExpenseStatus.DISBURSED,
    ExpenseStatus.PROOF_PENDING,
    ExpenseStatus.AUDIT_PENDING,
    ExpenseStatus.SETTLED,
    ExpenseStatus.DISCREPANCY,
  ];
  const disbursedStatuses = [
    ExpenseStatus.DISBURSED,
    ExpenseStatus.PROOF_PENDING,
    ExpenseStatus.AUDIT_PENDING,
    ExpenseStatus.SETTLED,
    ExpenseStatus.DISCREPANCY,
  ];

  return [
    {
      label: "Created",
      isComplete: true,
      timestamp: expense.createdAt,
    },
    {
      label: "Submitted",
      isComplete: expense.status !== ExpenseStatus.DRAFT,
      timestamp: expense.status !== ExpenseStatus.DRAFT ? expense.updatedAt : null,
    },
    {
      label: expense.status === ExpenseStatus.REJECTED ? "Rejected" : "Approved",
      isComplete: approvedOrRejectedStatuses.includes(expense.status),
      timestamp: approvedOrRejectedStatuses.includes(expense.status)
        ? expense.updatedAt
        : null,
    },
    {
      label: "Disbursed",
      isComplete: disbursedStatuses.includes(expense.status),
      timestamp: expense.disbursedAt,
    },
    {
      label: "Proof Uploaded",
      isComplete: [
        ExpenseStatus.AUDIT_PENDING,
        ExpenseStatus.SETTLED,
        ExpenseStatus.DISCREPANCY,
      ].includes(expense.status),
      timestamp: expense.proofSubmittedAt,
    },
    {
      label: "Audited",
      isComplete: [ExpenseStatus.SETTLED, ExpenseStatus.DISCREPANCY].includes(
        expense.status,
      ),
      timestamp:
        expense.status === ExpenseStatus.SETTLED ||
        expense.status === ExpenseStatus.DISCREPANCY
          ? expense.settledAt || expense.updatedAt
          : null,
    },
    {
      label: "Settled",
      isComplete: expense.status === ExpenseStatus.SETTLED,
      timestamp: expense.settledAt,
    },
  ];
}

function Timeline({ expense }: { expense: Expense }) {
  const steps = buildTimeline(expense);

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ui-border/70 sm:p-6">
      <h2 className="text-xl font-extrabold text-ui-text-primary">Timeline</h2>
      <div className="mt-6 space-y-4">
        {steps.map((step, index) => (
          <div key={step.label} className="flex gap-4">
            <div className="flex flex-col items-center">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-extrabold ${
                  step.isComplete
                    ? "bg-status-success text-white"
                    : "bg-ui-border text-ui-text-muted"
                }`}
              >
                {index + 1}
              </span>
              {index < steps.length - 1 ? (
                <span
                  className={`mt-2 h-full min-h-8 w-0.5 ${
                    step.isComplete ? "bg-status-success/40" : "bg-ui-border"
                  }`}
                />
              ) : null}
            </div>
            <div className={step.isComplete ? "" : "opacity-55"}>
              <p className="font-bold text-ui-text-primary">{step.label}</p>
              <p className="mt-1 text-sm font-medium text-ui-text-muted">
                {formatDate(step.timestamp)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

interface ActionModalProps {
  action: ActionType;
  expense: Expense;
  initialAuditStatus?: ExpenseStatus.SETTLED | ExpenseStatus.DISCREPANCY;
  error: string;
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: (updatedExpense: Expense) => void;
  onError: (message: string) => void;
  onSubmittingChange: (isSubmitting: boolean) => void;
}

function ActionModal({
  action,
  expense,
  initialAuditStatus = ExpenseStatus.SETTLED,
  error,
  isSubmitting,
  onCancel,
  onSubmit,
  onError,
  onSubmittingChange,
}: ActionModalProps) {
  const [approvedAmount, setApprovedAmount] = useState(
    String(expense.approvedAmount || expense.requestedAmount),
  );
  const [disbursedAmount, setDisbursedAmount] = useState(
    String(expense.disbursedAmount || expense.approvedAmount || expense.requestedAmount),
  );
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("");
  const [auditStatus, setAuditStatus] = useState<
    ExpenseStatus.SETTLED | ExpenseStatus.DISCREPANCY
  >(initialAuditStatus);
  const [files, setFiles] = useState<File[]>([]);
  const [fieldError, setFieldError] = useState("");

  const modalCopy = {
    approve: {
      title: "Approve Expense",
      submitLabel: "Approve",
      submittingLabel: "Approving...",
    },
    reject: {
      title: "Reject Expense",
      submitLabel: "Reject",
      submittingLabel: "Rejecting...",
    },
    disburse: {
      title: "Disburse Expense",
      submitLabel: "Disburse",
      submittingLabel: "Disbursing...",
    },
    upload: {
      title: "Upload Bills",
      submitLabel: "Upload Bills",
      submittingLabel: "Uploading...",
    },
    audit: {
      title: "Audit Expense",
      submitLabel: auditStatus === ExpenseStatus.SETTLED ? "Mark Settled" : "Flag Discrepancy",
      submittingLabel: "Saving...",
    },
  }[action];

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files || []);
    setFieldError("");

    if (selectedFiles.length > maxProofFiles) {
      setFiles([]);
      setFieldError("Upload a maximum of 10 files.");
      return;
    }

    const invalidFile = selectedFiles.find(
      (file) => !allowedProofTypes.includes(file.type) || file.size > maxProofSize,
    );

    if (invalidFile) {
      setFiles([]);
      setFieldError("Each file must be a PDF, JPG, or PNG and 5 MB or smaller.");
      return;
    }

    setFiles(selectedFiles);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldError("");
    onError("");

    try {
      onSubmittingChange(true);
      let updatedExpense: Expense;

      if (action === "approve") {
        const amount = Number(approvedAmount);

        if (!approvedAmount || Number.isNaN(amount) || amount <= 0) {
          setFieldError("Enter a valid approved amount.");
          return;
        }

        updatedExpense = await approveExpense(expense.id, {
          approvedAmount: Number(amount.toFixed(2)),
          notes: notes.trim(),
        });
      } else if (action === "reject") {
        if (!reason.trim()) {
          setFieldError("Reason is required.");
          return;
        }

        updatedExpense = await rejectExpense(expense.id, {
          reason: reason.trim(),
        });
      } else if (action === "disburse") {
        const amount = Number(disbursedAmount);

        if (!disbursedAmount || Number.isNaN(amount) || amount <= 0) {
          setFieldError("Enter a valid disbursed amount.");
          return;
        }

        updatedExpense = await disburseExpense(expense.id, {
          disbursedAmount: Number(amount.toFixed(2)),
        });
      } else if (action === "upload") {
        if (files.length === 0) {
          setFieldError("Select at least one bill proof file.");
          return;
        }

        updatedExpense = await uploadProof(expense.id, files);
      } else {
        updatedExpense = await auditExpense(expense.id, {
          status: auditStatus,
          notes: notes.trim(),
        });
      }

      onSubmit(updatedExpense);
    } catch (modalError) {
      onError(getErrorMessage(modalError, "Unable to update expense. Please try again."));
    } finally {
      onSubmittingChange(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/50 px-4 py-6">
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="expenseActionTitle"
        className="max-h-full w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
      >
        <h2
          id="expenseActionTitle"
          className="text-xl font-extrabold text-ui-text-primary"
        >
          {modalCopy.title}
        </h2>

        <div className="mt-5 space-y-4">
          {action === "approve" ? (
            <>
              <div>
                <label
                  htmlFor="approvedAmount"
                  className="mb-2 block text-sm font-semibold text-ui-text-primary"
                >
                  Approved Amount <span className="text-status-error">*</span>
                </label>
                <div className="flex rounded-lg border border-ui-border focus-within:border-brand-red focus-within:ring-2 focus-within:ring-brand-red/20">
                  <span className="flex items-center rounded-l-lg bg-ui-row-alt px-4 font-mono text-sm font-bold text-ui-text-muted">
                    ₹
                  </span>
                  <input
                    id="approvedAmount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={approvedAmount}
                    onChange={(event) => setApprovedAmount(event.target.value)}
                    className="w-full rounded-r-lg px-4 py-3 font-mono text-ui-text-primary outline-none"
                  />
                </div>
              </div>
              <NotesField value={notes} onChange={setNotes} />
            </>
          ) : null}

          {action === "reject" ? (
            <div>
              <label
                htmlFor="rejectReason"
                className="mb-2 block text-sm font-semibold text-ui-text-primary"
              >
                Reason <span className="text-status-error">*</span>
              </label>
              <textarea
                id="rejectReason"
                rows={4}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="w-full rounded-lg border border-ui-border px-4 py-3 text-ui-text-primary outline-none transition focus:border-brand-red focus:ring-2 focus:ring-brand-red/20"
                placeholder="Enter rejection reason"
              />
            </div>
          ) : null}

          {action === "disburse" ? (
            <div>
              <label
                htmlFor="disbursedAmount"
                className="mb-2 block text-sm font-semibold text-ui-text-primary"
              >
                Disbursed Amount <span className="text-status-error">*</span>
              </label>
              <div className="flex rounded-lg border border-ui-border focus-within:border-brand-red focus-within:ring-2 focus-within:ring-brand-red/20">
                <span className="flex items-center rounded-l-lg bg-ui-row-alt px-4 font-mono text-sm font-bold text-ui-text-muted">
                  ₹
                </span>
                <input
                  id="disbursedAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={disbursedAmount}
                  onChange={(event) => setDisbursedAmount(event.target.value)}
                  className="w-full rounded-r-lg px-4 py-3 font-mono text-ui-text-primary outline-none"
                />
              </div>
            </div>
          ) : null}

          {action === "upload" ? (
            <div>
              <label
                htmlFor="proofFiles"
                className="mb-2 block text-sm font-semibold text-ui-text-primary"
              >
                Bill Proofs <span className="text-status-error">*</span>
              </label>
              <input
                id="proofFiles"
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                onChange={handleFileChange}
                className="w-full rounded-lg border border-ui-border px-4 py-3 text-sm font-semibold text-ui-text-primary outline-none file:mr-4 file:rounded-lg file:border-0 file:bg-brand-red file:px-4 file:py-2 file:text-sm file:font-bold file:text-white"
              />
              <p className="mt-2 text-xs font-semibold text-ui-text-muted">
                PDF, JPG, or PNG only. Max 5 MB per file and 10 files per request.
              </p>
              {files.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {files.map((file) => (
                    <li
                      key={`${file.name}-${file.size}`}
                      className="flex items-center justify-between gap-3 rounded-lg bg-ui-row-alt px-3 py-2 text-sm font-semibold text-ui-text-muted"
                    >
                      <span className="truncate">{file.name}</span>
                      <span className="font-mono text-xs">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {action === "audit" ? (
            <>
              <fieldset>
                <legend className="mb-3 block text-sm font-semibold text-ui-text-primary">
                  Audit Result
                </legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-ui-border px-4 py-3 text-sm font-bold text-ui-text-primary">
                    <input
                      type="radio"
                      name="auditStatus"
                      value={ExpenseStatus.SETTLED}
                      checked={auditStatus === ExpenseStatus.SETTLED}
                      onChange={() => setAuditStatus(ExpenseStatus.SETTLED)}
                      className="h-4 w-4 accent-brand-red"
                    />
                    Settled
                  </label>
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-ui-border px-4 py-3 text-sm font-bold text-ui-text-primary">
                    <input
                      type="radio"
                      name="auditStatus"
                      value={ExpenseStatus.DISCREPANCY}
                      checked={auditStatus === ExpenseStatus.DISCREPANCY}
                      onChange={() => setAuditStatus(ExpenseStatus.DISCREPANCY)}
                      className="h-4 w-4 accent-brand-red"
                    />
                    Discrepancy
                  </label>
                </div>
              </fieldset>
              <NotesField value={notes} onChange={setNotes} />
            </>
          ) : null}
        </div>

        {fieldError ? (
          <p className="mt-4 rounded-lg bg-status-error/10 px-4 py-3 text-sm font-medium text-status-error">
            {fieldError}
          </p>
        ) : null}

        {error ? (
          <p className="mt-4 rounded-lg bg-status-error/10 px-4 py-3 text-sm font-medium text-status-error">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-lg border border-ui-border px-5 py-3 text-sm font-bold text-ui-text-primary transition hover:border-brand-red hover:text-brand-red disabled:cursor-not-allowed disabled:opacity-70"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center rounded-lg bg-brand-red px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-red/90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? (
              <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : null}
            {isSubmitting ? modalCopy.submittingLabel : modalCopy.submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}

function NotesField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label
        htmlFor="actionNotes"
        className="mb-2 block text-sm font-semibold text-ui-text-primary"
      >
        Notes
      </label>
      <textarea
        id="actionNotes"
        rows={4}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-ui-border px-4 py-3 text-ui-text-primary outline-none transition focus:border-brand-red focus:ring-2 focus:ring-brand-red/20"
        placeholder="Add optional notes"
      />
    </div>
  );
}

function getFileUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/v1\/?$/, "") || "";

  return `${apiBaseUrl}${url.startsWith("/") ? url : `/${url}`}`;
}

function getHandoffMessage(status: ExpenseStatus): string {
  const messages: Record<ExpenseStatus, string> = {
    [ExpenseStatus.DRAFT]: "With Employee to Submit request",
    [ExpenseStatus.PENDING]: "With Admin to Approve expense",
    [ExpenseStatus.APPROVED]: "With Finance to Disburse amount",
    [ExpenseStatus.REJECTED]: "Request rejected",
    [ExpenseStatus.DISBURSED]: "With Finance to move proof pending",
    [ExpenseStatus.PROOF_PENDING]: "With Employee to Upload proof",
    [ExpenseStatus.AUDIT_PENDING]: "With Audit to Settle expense",
    [ExpenseStatus.SETTLED]: "Expense settled",
    [ExpenseStatus.DISCREPANCY]: "With Admin to Resolve discrepancy",
  };

  return messages[status];
}

function getStatusSuccessTitle(status: ExpenseStatus): string {
  const titles: Record<ExpenseStatus, string> = {
    [ExpenseStatus.DRAFT]: "Request Saved as Draft",
    [ExpenseStatus.PENDING]: "Request Submitted",
    [ExpenseStatus.APPROVED]: "Request Approved",
    [ExpenseStatus.REJECTED]: "Request Rejected",
    [ExpenseStatus.DISBURSED]: "Request Disbursed",
    [ExpenseStatus.PROOF_PENDING]: "Proof Pending Started",
    [ExpenseStatus.AUDIT_PENDING]: "Proof Uploaded",
    [ExpenseStatus.SETTLED]: "Request Settled",
    [ExpenseStatus.DISCREPANCY]: "Discrepancy Raised",
  };

  return titles[status];
}

export default function ExpenseDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [expense, setExpense] = useState<Expense | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeAction, setActiveAction] = useState<ActiveAction | null>(null);
  const [actionError, setActionError] = useState("");
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [isSubmittingDraft, setIsSubmittingDraft] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<ExpenseStatus | "">("");
  const [statusAmount, setStatusAmount] = useState("");
  const [statusRemarks, setStatusRemarks] = useState("");
  const [statusProofFiles, setStatusProofFiles] = useState<File[]>([]);
  const [statusFieldError, setStatusFieldError] = useState("");
  const [successTitle, setSuccessTitle] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const permissions = useMemo(() => user?.permissions || [], [user?.permissions]);
  const canViewExpenses =
    permissions.includes("expenses.view_own") ||
    permissions.includes("expenses.view_all");

  const loadExpense = useCallback(async () => {
    if (!canViewExpenses) {
      setIsLoading(false);
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const loadedExpense = await getExpenseById(params.id);
      setExpense(loadedExpense);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Unable to load expense. Please try again."));
    } finally {
      setIsLoading(false);
    }
  }, [canViewExpenses, params.id]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      loadExpense();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadExpense]);

  const statusOptions = useMemo(() => {
    if (!expense) {
      return [];
    }

    const nextOptions: { label: string; status: ExpenseStatus }[] = [];

    if (
      expense.status === ExpenseStatus.DRAFT &&
      permissions.includes("expenses.create")
    ) {
      nextOptions.push({ label: "Submitted", status: ExpenseStatus.PENDING });
    }

    if (
      expense.status === ExpenseStatus.PENDING &&
      permissions.includes("expenses.approve")
    ) {
      nextOptions.push({ label: "Approved", status: ExpenseStatus.APPROVED });
      nextOptions.push({ label: "Rejected", status: ExpenseStatus.REJECTED });
    }

    if (
      expense.status === ExpenseStatus.APPROVED &&
      permissions.includes("expenses.disburse")
    ) {
      nextOptions.push({ label: "Disbursed", status: ExpenseStatus.DISBURSED });
    }

    if (
      expense.status === ExpenseStatus.DISBURSED &&
      permissions.includes("expenses.disburse")
    ) {
      nextOptions.push({ label: "Proof Pending", status: ExpenseStatus.PROOF_PENDING });
    }

    const canUploadProofForExpense =
      permissions.includes("expenses.upload_proof") ||
      user?.role.name.toLowerCase() === "employee";

    if (
      expense.status === ExpenseStatus.PROOF_PENDING &&
      canUploadProofForExpense
    ) {
      nextOptions.push({ label: "Audit Pending", status: ExpenseStatus.AUDIT_PENDING });
    }

    if (
      expense.status === ExpenseStatus.AUDIT_PENDING &&
      permissions.includes("expenses.audit")
    ) {
      nextOptions.push({ label: "Settled", status: ExpenseStatus.SETTLED });
      nextOptions.push({ label: "Discrepancy", status: ExpenseStatus.DISCREPANCY });
    }

    return nextOptions;
  }, [expense, permissions, user?.role]);

  async function handleSubmitDraft() {
    if (!expense) {
      return;
    }

    setActionError("");
    setIsSubmittingDraft(true);

    try {
      const updatedExpense = await submitExpense(expense.id);
      setExpense(updatedExpense);
    } catch (submitError) {
      setActionError(
        getErrorMessage(submitError, "Unable to submit expense. Please try again."),
      );
    } finally {
      setIsSubmittingDraft(false);
    }
  }

  function openAction(
    action: ActionType,
    auditStatus?: ExpenseStatus.SETTLED | ExpenseStatus.DISCREPANCY,
  ) {
    setActionError("");
    setActiveAction({ type: action, auditStatus });
  }

  async function handleStatusUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!expense || !selectedStatus) {
      setStatusFieldError("Select a status to update.");
      return;
    }

    setActionError("");
    setStatusFieldError("");
    setIsSubmittingAction(true);

    try {
      const payload: Parameters<typeof updateExpenseStatus>[1] = {
        status: selectedStatus,
        notes: statusRemarks.trim() || undefined,
      };

      if (selectedStatus === ExpenseStatus.APPROVED) {
        const amount = Number(statusAmount);

        if (!statusAmount.trim()) {
          setStatusFieldError("Approved amount is required.");
          return;
        }

        if (!Number.isFinite(amount) || amount <= 0) {
          setStatusFieldError("Enter a valid approved amount greater than zero.");
          return;
        }

        payload.approvedAmount = Number(amount.toFixed(2));
      }

      if (selectedStatus === ExpenseStatus.DISBURSED) {
        const amount = Number(statusAmount);

        if (!statusAmount.trim()) {
          setStatusFieldError("Disbursed amount is required.");
          return;
        }

        if (!Number.isFinite(amount) || amount <= 0) {
          setStatusFieldError("Enter a valid disbursed amount greater than zero.");
          return;
        }

        payload.disbursedAmount = Number(amount.toFixed(2));
      }

      if (selectedStatus === ExpenseStatus.REJECTED && !statusRemarks.trim()) {
        setStatusFieldError("Remarks are required when rejecting.");
        return;
      }

      if (selectedStatus === ExpenseStatus.AUDIT_PENDING) {
        if (statusProofFiles.length === 0) {
          setStatusFieldError("Upload at least one bill proof.");
          return;
        }

        payload.proofUrls = await uploadFiles(statusProofFiles);
      }

      const updatedExpense = await updateExpenseStatus(expense.id, payload);
      setExpense(updatedExpense);
      setSuccessTitle(getStatusSuccessTitle(updatedExpense.status));
      setSuccessMessage(`Next action: ${getHandoffMessage(updatedExpense.status)}.`);
      setSelectedStatus("");
      setStatusAmount("");
      setStatusRemarks("");
      setStatusProofFiles([]);
    } catch (statusError) {
      setActionError(
        getErrorMessage(statusError, "Unable to update expense status. Please try again."),
      );
    } finally {
      setIsSubmittingAction(false);
    }
  }

  return (
    <AppLayout title="Expense Details">
      {!canViewExpenses ? (
        <AccessDenied />
      ) : isLoading ? (
        <ExpenseDetailsSkeleton />
      ) : error ? (
        <section className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-ui-border/70">
          <h2 className="text-2xl font-extrabold text-ui-text-primary">
            Unable to Load Expense
          </h2>
          <p className="mt-2 text-sm font-medium text-ui-text-muted">{error}</p>
          <button
            type="button"
            onClick={loadExpense}
            className="mt-6 rounded-lg bg-brand-red px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-red/90"
          >
            Retry
          </button>
        </section>
      ) : expense ? (
        <section className="space-y-5">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center rounded-lg border border-ui-border bg-white px-4 py-2 text-sm font-bold text-ui-text-primary shadow-sm transition hover:border-brand-red hover:text-brand-red"
          >
            Back
          </button>

          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ui-border/70 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-red">
                  Expense Management
                </p>
                <h1 className="mt-2 text-3xl font-extrabold text-ui-text-primary">
                  Expense Details
                </h1>
                <p className="mt-2 text-lg font-bold text-ui-text-primary">
                  {expense.eventName}
                </p>
              </div>
              <div className="self-start text-left sm:text-right">
                <StatusBadge status={expense.status} className="px-4 py-2" />
                <p className="mt-3 text-sm font-bold text-ui-text-muted">
                  {getHandoffMessage(expense.status)}
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <DetailItem label="Category" value={categoryLabels[expense.category]} />
              <DetailItem label="Expense ID" value={expense.displayId || expense.id} isMono />
              <DetailItem
                label="Requested Amount"
                value={formatMoney(expense.requestedAmount)}
                isMono
              />
              <DetailItem
                label="Approved Amount"
                value={formatMoney(expense.approvedAmount)}
                isMono
              />
              <DetailItem
                label="Disbursed Amount"
                value={formatMoney(expense.disbursedAmount)}
                isMono
              />
              <DetailItem label="Submitted By" value={expense.employeeId.name} />
              <DetailItem label="Email" value={expense.employeeId.email} isMono />
              <DetailItem
                label="Required Date"
                value={formatDate(expense.requiredDate || expense.createdAt)}
              />
              <DetailItem label="Created" value={formatDate(expense.createdAt)} />
              <DetailItem label="Updated" value={formatDate(expense.updatedAt)} />
              <DetailItem label="Disbursed At" value={formatDate(expense.disbursedAt)} />
              <DetailItem
                label="Proof Submitted At"
                value={formatDate(expense.proofSubmittedAt)}
              />
              <DetailItem label="Settled At" value={formatDate(expense.settledAt)} />
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <section className="rounded-xl bg-ui-row-alt p-4">
                <h2 className="text-xs font-bold uppercase tracking-wide text-ui-text-muted">
                  Purpose
                </h2>
                <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-ui-text-primary">
                  {expense.purpose}
                </p>
              </section>
              <section className="rounded-xl bg-ui-row-alt p-4">
                <h2 className="text-xs font-bold uppercase tracking-wide text-ui-text-muted">
                  Notes
                </h2>
                <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-ui-text-primary">
                  {expense.notes || "No notes added."}
                </p>
              </section>
            </div>

            <section className="mt-6 rounded-xl bg-ui-row-alt p-4">
              <h2 className="text-xs font-bold uppercase tracking-wide text-ui-text-muted">
                Attachments
              </h2>
              {expense.attachmentUrls?.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {expense.attachmentUrls.map((attachmentUrl, index) => (
                    <a
                      key={attachmentUrl}
                      href={getFileUrl(attachmentUrl)}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-ui-border bg-white px-3 py-2 text-sm font-bold text-brand-red transition hover:border-brand-red"
                    >
                      Attachment {index + 1}
                    </a>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm font-semibold text-ui-text-muted">
                  No attachments added.
                </p>
              )}
            </section>

            <section className="mt-6 rounded-xl bg-ui-row-alt p-4">
              <h2 className="text-xs font-bold uppercase tracking-wide text-ui-text-muted">
                Proofs
              </h2>
              {expense.proofUrls.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {expense.proofUrls.map((proofUrl, index) => (
                    <a
                      key={proofUrl}
                      href={getFileUrl(proofUrl)}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-ui-border bg-white px-3 py-2 text-sm font-bold text-brand-red transition hover:border-brand-red"
                    >
                      Proof {index + 1}
                    </a>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm font-semibold text-ui-text-muted">
                  No bill proofs uploaded yet.
                </p>
              )}
            </section>
          </section>

          <Timeline expense={expense} />

          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ui-border/70 sm:p-6">
            <h2 className="text-xl font-extrabold text-ui-text-primary">Actions</h2>
            <p className="mt-2 text-sm font-bold text-ui-text-muted">
              {getHandoffMessage(expense.status)}
            </p>
            {actionError ? (
              <p className="mt-4 rounded-lg bg-status-error/10 px-4 py-3 text-sm font-medium text-status-error">
                {actionError}
              </p>
            ) : null}
            {statusOptions.length > 0 ? (
              <form onSubmit={handleStatusUpdate} className="mt-5 grid gap-4">
                <div>
                  <label
                    htmlFor="expenseStatusUpdate"
                    className="mb-2 block text-sm font-semibold text-ui-text-primary"
                  >
                    Move Status <span className="text-status-error">*</span>
                  </label>
                  <select
                    id="expenseStatusUpdate"
                    value={selectedStatus}
                    onChange={(event) => {
                      const nextStatus = event.target.value as ExpenseStatus | "";
                      setSelectedStatus(nextStatus);
                      setStatusFieldError("");
                      setStatusAmount("");
                      setStatusRemarks("");
                      setStatusProofFiles([]);
                    }}
                    className="w-full rounded-lg border border-ui-border px-4 py-3 text-ui-text-primary outline-none transition focus:border-brand-red focus:ring-2 focus:ring-brand-red/20"
                  >
                    <option value="">Select next status</option>
                    {statusOptions.map((option) => (
                      <option key={option.status} value={option.status}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {[ExpenseStatus.APPROVED, ExpenseStatus.DISBURSED].includes(
                  selectedStatus as ExpenseStatus,
                ) ? (
                  <div>
                    <label
                      htmlFor="statusAmount"
                      className="mb-2 block text-sm font-semibold text-ui-text-primary"
                    >
                      {selectedStatus === ExpenseStatus.APPROVED
                        ? "Approved Amount"
                        : "Disbursed Amount"}{" "}
                      <span className="text-status-error">*</span>
                    </label>
                    <div
                      className={`flex rounded-lg border focus-within:border-brand-red focus-within:ring-2 focus-within:ring-brand-red/20 ${
                        statusFieldError.toLowerCase().includes("amount")
                          ? "border-status-error"
                          : "border-ui-border"
                      }`}
                    >
                      <span className="flex items-center rounded-l-lg bg-ui-row-alt px-4 font-mono text-sm font-bold text-ui-text-muted">
                        ₹
                      </span>
                      <input
                        id="statusAmount"
                        type="number"
                        min="0"
                        step="0.01"
                        value={statusAmount}
                        onChange={(event) => setStatusAmount(event.target.value)}
                        className="w-full rounded-r-lg px-4 py-3 font-mono text-ui-text-primary outline-none"
                        placeholder={
                          selectedStatus === ExpenseStatus.APPROVED
                            ? String(expense.requestedAmount)
                            : String(expense.approvedAmount || expense.requestedAmount)
                        }
                      />
                    </div>
                  </div>
                ) : null}

                {selectedStatus === ExpenseStatus.AUDIT_PENDING ? (
                  <div>
                    <label
                      htmlFor="statusProofFiles"
                      className="mb-2 block text-sm font-semibold text-ui-text-primary"
                    >
                      Bill Proofs <span className="text-status-error">*</span>
                    </label>
                    <input
                      id="statusProofFiles"
                      type="file"
                      multiple
                      accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                      onChange={(event) => {
                        const selectedFiles = Array.from(event.target.files || []);
                        setStatusFieldError("");

                        const invalidFile = selectedFiles.find(
                          (file) =>
                            !allowedProofTypes.includes(file.type) ||
                            file.size > maxProofSize,
                        );

                        if (selectedFiles.length > maxProofFiles) {
                          setStatusProofFiles([]);
                          setStatusFieldError("Upload a maximum of 10 files.");
                          return;
                        }

                        if (invalidFile) {
                          setStatusProofFiles([]);
                          setStatusFieldError(
                            "Each file must be a PDF, JPG, or PNG and 5 MB or smaller.",
                          );
                          return;
                        }

                        setStatusProofFiles(selectedFiles);
                      }}
                      className="w-full rounded-lg border border-ui-border px-4 py-3 text-sm font-semibold text-ui-text-primary outline-none file:mr-4 file:rounded-lg file:border-0 file:bg-brand-red file:px-4 file:py-2 file:text-sm file:font-bold file:text-white"
                    />
                  </div>
                ) : null}

                {[ExpenseStatus.REJECTED, ExpenseStatus.APPROVED, ExpenseStatus.SETTLED, ExpenseStatus.DISCREPANCY].includes(
                  selectedStatus as ExpenseStatus,
                ) ? (
                  <NotesField value={statusRemarks} onChange={setStatusRemarks} />
                ) : null}

                {statusFieldError ? (
                  <p className="rounded-lg bg-status-error/10 px-4 py-3 text-sm font-medium text-status-error">
                    {statusFieldError}
                  </p>
                ) : null}

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSubmittingAction}
                    className="inline-flex items-center justify-center rounded-lg bg-brand-red px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-red/90 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSubmittingAction ? (
                      <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    ) : null}
                    {isSubmittingAction ? "Updating..." : "Submit"}
                  </button>
                </div>
              </form>
            ) : (
              <p className="mt-5 text-sm font-semibold text-ui-text-muted">
                No actions are available for your permissions and this status.
              </p>
            )}
          </section>
        </section>
      ) : null}

      {successMessage ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/50 px-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="statusSuccessTitle"
            className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-2xl"
          >
            <h2 id="statusSuccessTitle" className="text-xl font-extrabold text-ui-text-primary">
              {successTitle}
            </h2>
            <p className="mt-3 text-sm font-semibold text-ui-text-muted">
              {successMessage}
            </p>
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => {
                  setSuccessTitle("");
                  setSuccessMessage("");
                }}
                className="rounded-lg bg-brand-red px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-red/90"
              >
                OK
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </AppLayout>
  );
}

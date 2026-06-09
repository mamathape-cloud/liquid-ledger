"use client";

import axios from "axios";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/context/AuthContext";
import { getAssignedEvents } from "@/lib/eventApi";
import { createExpense, uploadFiles } from "@/lib/expenseApi";
import type { FinanceEvent } from "@/types/event";
import { ExpenseCategory, ExpenseStatus } from "@/types/expense";

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

const allowedAttachmentTypes = ["image/jpeg", "image/png"];
const maxAttachmentSize = 5 * 1024 * 1024;

function formatStatusLabel(status: ExpenseStatus.DRAFT | ExpenseStatus.PENDING): string {
  return status === ExpenseStatus.PENDING ? "Submitted" : "Draft";
}

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError<{ message?: string; error?: string }>(error)) {
    return (
      error.response?.data?.message ||
      error.response?.data?.error ||
      "Unable to submit expense request. Please try again."
    );
  }

  return "Unable to submit expense request. Please try again.";
}

function formatMoney(amount: number | null | undefined): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(amount || 0);
}

function AccessDenied() {
  return (
    <section className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-ui-border/70">
      <h2 className="text-2xl font-extrabold text-ui-text-primary">Access Denied</h2>
      <p className="mt-2 text-sm font-medium text-ui-text-muted">
        You do not have permission to create expense requests.
      </p>
    </section>
  );
}

export default function NewExpensePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [eventId, setEventId] = useState("");
  const [assignedEvents, setAssignedEvents] = useState<FinanceEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [eventsError, setEventsError] = useState("");
  const [category, setCategory] = useState<ExpenseCategory | "">("");
  const [requestedAmount, setRequestedAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [requiredDate, setRequiredDate] = useState("");
  const [remarks, setRemarks] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [submitStatus, setSubmitStatus] = useState<
    ExpenseStatus.DRAFT | ExpenseStatus.PENDING
  >(ExpenseStatus.PENDING);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submissionError, setSubmissionError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const permissions = user?.permissions || [];
  const canCreateExpense =
    permissions.includes("expenses.create") || permissions.includes("expenses.view_own");
  const selectedEvent = useMemo(
    () => assignedEvents.find((event) => event.id === eventId) || null,
    [assignedEvents, eventId],
  );
  const selectedAllocation = selectedEvent?.allocations[0] || null;

  useEffect(() => {
    let isMounted = true;
    const timeout = window.setTimeout(() => {
      if (!canCreateExpense) {
        if (isMounted) {
          setIsLoadingEvents(false);
        }
        return;
      }

      getAssignedEvents()
        .then((events) => {
          if (isMounted) {
            setAssignedEvents(events);
            setEventId(events[0]?.id || "");
          }
        })
        .catch((error) => {
          if (isMounted) {
            setEventsError(getErrorMessage(error));
          }
        })
        .finally(() => {
          if (isMounted) {
            setIsLoadingEvents(false);
          }
        });
    }, 0);

    return () => {
      window.clearTimeout(timeout);
      isMounted = false;
    };
  }, [canCreateExpense]);

  function setFieldError(field: string, message: string) {
    setErrors((currentErrors) => ({ ...currentErrors, [field]: message }));
  }

  function clearFieldError(field: string) {
    setErrors((currentErrors) => {
      if (!currentErrors[field]) {
        return currentErrors;
      }

      const nextErrors = { ...currentErrors };
      delete nextErrors[field];
      return nextErrors;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setSubmissionError("");

    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const selectedStatus =
      submitter?.value === ExpenseStatus.DRAFT ? ExpenseStatus.DRAFT : ExpenseStatus.PENDING;
    setSubmitStatus(selectedStatus);

    const trimmedPurpose = purpose.trim();
    const trimmedRemarks = remarks.trim();
    const amount = Number(requestedAmount);
    let hasError = false;

    if (!eventId) {
      setFieldError("eventId", "Select an assigned event.");
      hasError = true;
    }

    if (!category) {
      setFieldError("category", "Category is required.");
      hasError = true;
    }

    if (!requestedAmount || Number.isNaN(amount) || amount <= 0) {
      setFieldError("requestedAmount", "Enter a valid amount greater than zero.");
      hasError = true;
    }

    if (!requiredDate) {
      setFieldError("requiredDate", "Required date is required.");
      hasError = true;
    }

    if (!trimmedPurpose) {
      setFieldError("purpose", "Purpose is required.");
      hasError = true;
    } else if (trimmedPurpose.length < 10) {
      setFieldError("purpose", "Purpose must be at least 10 characters.");
      hasError = true;
    } else if (trimmedPurpose.length > 300) {
      setFieldError("purpose", "Purpose must be 300 characters or fewer.");
      hasError = true;
    }

    if (hasError || !category) {
      return;
    }

    setIsSubmitting(true);

    try {
      const attachmentUrls = attachments.length > 0 ? await uploadFiles(attachments) : [];

      await createExpense({
        eventId,
        category,
        requestedAmount: Number(amount.toFixed(2)),
        purpose: trimmedPurpose,
        requiredDate,
        remarks: trimmedRemarks || undefined,
        attachmentUrls,
        status: selectedStatus,
      });

      setSuccessMessage(`Status ${formatStatusLabel(selectedStatus)}.`);
    } catch (error) {
      setSubmissionError(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppLayout title="New Expense Request">
      {!canCreateExpense ? (
        <AccessDenied />
      ) : (
        <form
          onSubmit={handleSubmit}
          className="mx-auto max-w-4xl rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ui-border/70 sm:p-6"
        >
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-red">
              Expense Management
            </p>
            <h1 className="mt-2 text-3xl font-extrabold text-ui-text-primary">
              New Expense Request
            </h1>
          </div>

          <div className="mt-7 grid gap-5">
            <div>
              <label
                htmlFor="expenseEventId"
                className="mb-2 block text-sm font-semibold text-ui-text-primary"
              >
                Event Name <span className="text-status-error">*</span>
              </label>
              <select
                id="expenseEventId"
                value={eventId}
                onChange={(event) => {
                  setEventId(event.target.value);
                  clearFieldError("eventId");
                }}
                className={`w-full rounded-lg border px-4 py-3 text-ui-text-primary outline-none transition focus:border-brand-red focus:ring-2 focus:ring-brand-red/20 ${
                  errors.eventId ? "border-status-error" : "border-ui-border"
                }`}
                disabled={isLoadingEvents || assignedEvents.length === 0}
                aria-invalid={Boolean(errors.eventId)}
                aria-describedby={errors.eventId ? "expenseEventIdError" : undefined}
              >
                {isLoadingEvents ? (
                  <option value="">Loading assigned events...</option>
                ) : (
                  <option value="">Select an assigned event</option>
                )}
                {assignedEvents.map((assignedEvent) => (
                  <option key={assignedEvent.id} value={assignedEvent.id}>
                    {assignedEvent.eventName}
                  </option>
                ))}
              </select>
              {eventsError ? (
                <p className="mt-2 text-sm font-medium text-status-error">
                  {eventsError}
                </p>
              ) : null}
              {!isLoadingEvents && assignedEvents.length === 0 && !eventsError ? (
                <p className="mt-2 text-sm font-medium text-status-warning">
                  Finance has not assigned any events to you yet.
                </p>
              ) : null}
              {selectedAllocation ? (
                <div className="mt-3 grid gap-3 rounded-xl bg-ui-row-alt p-4 sm:grid-cols-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-ui-text-muted">
                      Amount Allocated
                    </p>
                    <p className="mt-1 font-mono text-sm font-extrabold text-ui-text-primary">
                      {formatMoney(selectedAllocation.allocatedAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-ui-text-muted">
                      Amount Claimed
                    </p>
                    <p className="mt-1 font-mono text-sm font-extrabold text-ui-text-primary">
                      {formatMoney(selectedAllocation.claimedAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-ui-text-muted">
                      Difference
                    </p>
                    <p
                      className={`mt-1 font-mono text-sm font-extrabold ${
                        selectedAllocation.differenceAmount < 0
                          ? "text-status-error"
                          : "text-status-success"
                      }`}
                    >
                      {selectedAllocation.differenceAmount >= 0 ? "+" : ""}
                      {formatMoney(selectedAllocation.differenceAmount)}
                    </p>
                  </div>
                </div>
              ) : null}
              {errors.eventId ? (
                <p
                  id="expenseEventIdError"
                  className="mt-2 text-sm font-medium text-status-error"
                >
                  {errors.eventId}
                </p>
              ) : null}
            </div>

            <div>
              <label
                htmlFor="expensePurpose"
                className="mb-2 block text-sm font-semibold text-ui-text-primary"
              >
                Purpose <span className="text-status-error">*</span>
              </label>
              <div className="mb-2 flex justify-end">
                <span
                  className={`text-xs font-bold ${
                    purpose.length > 300 ? "text-status-error" : "text-ui-text-muted"
                  }`}
                >
                  {purpose.length}/300
                </span>
              </div>
              <textarea
                id="expensePurpose"
                value={purpose}
                onChange={(event) => {
                  setPurpose(event.target.value);
                  clearFieldError("purpose");
                }}
                rows={4}
                maxLength={300}
                className={`w-full rounded-lg border px-4 py-3 text-ui-text-primary outline-none transition focus:border-brand-red focus:ring-2 focus:ring-brand-red/20 ${
                  errors.purpose ? "border-status-error" : "border-ui-border"
                }`}
                placeholder="Explain the purpose of this expense request"
                aria-invalid={Boolean(errors.purpose)}
                aria-describedby={errors.purpose ? "expensePurposeError" : undefined}
              />
              {errors.purpose ? (
                <p
                  id="expensePurposeError"
                  className="mt-2 text-sm font-medium text-status-error"
                >
                  {errors.purpose}
                </p>
              ) : null}
            </div>

            <div>
              <label
                htmlFor="expenseRequestedAmount"
                className="mb-2 block text-sm font-semibold text-ui-text-primary"
              >
                Amount Required <span className="text-status-error">*</span>
              </label>
              <div
                className={`flex rounded-lg border transition focus-within:border-brand-red focus-within:ring-2 focus-within:ring-brand-red/20 ${
                  errors.requestedAmount ? "border-status-error" : "border-ui-border"
                }`}
              >
                <span className="flex items-center rounded-l-lg bg-ui-row-alt px-4 font-mono text-sm font-bold text-ui-text-muted">
                  ₹
                </span>
                <input
                  id="expenseRequestedAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={requestedAmount}
                  onChange={(event) => {
                    setRequestedAmount(event.target.value);
                    clearFieldError("requestedAmount");
                  }}
                  className="w-full rounded-r-lg px-4 py-3 font-mono text-ui-text-primary outline-none"
                  placeholder="0.00"
                  aria-invalid={Boolean(errors.requestedAmount)}
                  aria-describedby={
                    errors.requestedAmount ? "expenseRequestedAmountError" : undefined
                  }
                />
              </div>
              {errors.requestedAmount ? (
                <p
                  id="expenseRequestedAmountError"
                  className="mt-2 text-sm font-medium text-status-error"
                >
                  {errors.requestedAmount}
                </p>
              ) : null}
            </div>

            <div>
              <label
                htmlFor="expenseCategory"
                className="mb-2 block text-sm font-semibold text-ui-text-primary"
              >
                Expense Category <span className="text-status-error">*</span>
              </label>
              <select
                id="expenseCategory"
                value={category}
                onChange={(event) => {
                  setCategory(event.target.value as ExpenseCategory | "");
                  clearFieldError("category");
                }}
                className={`w-full rounded-lg border px-4 py-3 text-ui-text-primary outline-none transition focus:border-brand-red focus:ring-2 focus:ring-brand-red/20 ${
                  errors.category ? "border-status-error" : "border-ui-border"
                }`}
                aria-invalid={Boolean(errors.category)}
                aria-describedby={errors.category ? "expenseCategoryError" : undefined}
              >
                <option value="">Select a category</option>
                {Object.values(ExpenseCategory).map((expenseCategory) => (
                  <option key={expenseCategory} value={expenseCategory}>
                    {categoryLabels[expenseCategory]}
                  </option>
                ))}
              </select>
              {errors.category ? (
                <p
                  id="expenseCategoryError"
                  className="mt-2 text-sm font-medium text-status-error"
                >
                  {errors.category}
                </p>
              ) : null}
            </div>

            <div>
              <label
                htmlFor="expenseRequiredDate"
                className="mb-2 block text-sm font-semibold text-ui-text-primary"
              >
                Required Date <span className="text-status-error">*</span>
              </label>
              <input
                id="expenseRequiredDate"
                type="date"
                value={requiredDate}
                onChange={(event) => {
                  setRequiredDate(event.target.value);
                  clearFieldError("requiredDate");
                }}
                className={`w-full rounded-lg border px-4 py-3 text-ui-text-primary outline-none transition focus:border-brand-red focus:ring-2 focus:ring-brand-red/20 ${
                  errors.requiredDate ? "border-status-error" : "border-ui-border"
                }`}
                aria-invalid={Boolean(errors.requiredDate)}
                aria-describedby={errors.requiredDate ? "expenseRequiredDateError" : undefined}
              />
              {errors.requiredDate ? (
                <p
                  id="expenseRequiredDateError"
                  className="mt-2 text-sm font-medium text-status-error"
                >
                  {errors.requiredDate}
                </p>
              ) : null}
            </div>

            <div>
              <label
                htmlFor="expenseRemarks"
                className="mb-2 block text-sm font-semibold text-ui-text-primary"
              >
                Remarks
              </label>
              <textarea
                id="expenseRemarks"
                value={remarks}
                onChange={(event) => {
                  setRemarks(event.target.value);
                }}
                rows={4}
                maxLength={300}
                className="w-full rounded-lg border border-ui-border px-4 py-3 text-ui-text-primary outline-none transition focus:border-brand-red focus:ring-2 focus:ring-brand-red/20"
                placeholder="Add optional remarks"
              />
            </div>

            <div>
              <label
                htmlFor="expenseAttachments"
                className="mb-2 block text-sm font-semibold text-ui-text-primary"
              >
                Attachment <span className="text-ui-text-muted">(optional)</span>
              </label>
              <input
                id="expenseAttachments"
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                onChange={(event) => {
                  const selectedFiles = Array.from(event.target.files || []);
                  clearFieldError("attachments");

                  const invalidFile = selectedFiles.find(
                    (file) =>
                      !allowedAttachmentTypes.includes(file.type) ||
                      file.size > maxAttachmentSize,
                  );

                  if (invalidFile) {
                    setAttachments([]);
                    setFieldError("attachments", "Images must be JPG or PNG and 5 MB or smaller.");
                    return;
                  }

                  setAttachments(selectedFiles);
                }}
                className={`w-full rounded-lg border px-4 py-3 text-sm font-semibold text-ui-text-primary outline-none file:mr-4 file:rounded-lg file:border-0 file:bg-brand-red file:px-4 file:py-2 file:text-sm file:font-bold file:text-white ${
                  errors.attachments ? "border-status-error" : "border-ui-border"
                }`}
              />
              <p className="mt-2 text-xs font-semibold text-ui-text-muted">
                JPG or PNG only. Max 5 MB per image.
              </p>
              {attachments.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {attachments.map((file) => (
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
              {errors.attachments ? (
                <p
                  id="expenseAttachmentsError"
                  className="mt-2 text-sm font-medium text-status-error"
                >
                  {errors.attachments}
                </p>
              ) : null}
            </div>
          </div>

          {submissionError ? (
            <p className="mt-6 rounded-lg bg-status-error/10 px-4 py-3 text-sm font-medium text-status-error">
              {submissionError}
            </p>
          ) : null}

          <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Link
              href="/expenses"
              className="inline-flex items-center justify-center rounded-lg border border-ui-border px-5 py-3 text-sm font-bold text-ui-text-primary transition hover:border-brand-red hover:text-brand-red"
            >
              Cancel
            </Link>
            <button
              type="submit"
              value={ExpenseStatus.DRAFT}
              onClick={() => setSubmitStatus(ExpenseStatus.DRAFT)}
              disabled={isSubmitting || !eventId}
              className="inline-flex items-center justify-center rounded-lg border border-brand-red px-5 py-3 text-sm font-bold text-brand-red transition hover:bg-brand-red hover:text-white disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting && submitStatus === ExpenseStatus.DRAFT ? (
                <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-brand-red/40 border-t-brand-red" />
              ) : null}
              {isSubmitting && submitStatus === ExpenseStatus.DRAFT ? "Saving..." : "Draft"}
            </button>
            <button
              type="submit"
              value={ExpenseStatus.PENDING}
              onClick={() => setSubmitStatus(ExpenseStatus.PENDING)}
              disabled={isSubmitting || !eventId}
              className="inline-flex items-center justify-center rounded-lg bg-brand-red px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand-red/90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting && submitStatus === ExpenseStatus.PENDING ? (
                <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              ) : null}
              {isSubmitting && submitStatus === ExpenseStatus.PENDING ? "Submitting..." : "Submit"}
            </button>
          </div>
        </form>
      )}

      {successMessage ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/50 px-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="expenseRequestSuccessTitle"
            className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-2xl"
          >
            <h2
              id="expenseRequestSuccessTitle"
              className="text-xl font-extrabold text-ui-text-primary"
            >
              Request Saved
            </h2>
            <p className="mt-3 text-sm font-semibold text-ui-text-muted">
              {successMessage}
            </p>
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => router.replace("/expenses")}
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

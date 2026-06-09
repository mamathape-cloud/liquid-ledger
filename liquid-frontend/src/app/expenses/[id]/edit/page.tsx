"use client";

import axios from "axios";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { getExpenseById, updateExpense, uploadFiles } from "@/lib/expenseApi";
import { ExpenseCategory, type Expense } from "@/types/expense";

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

function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<{ message?: string; error?: string }>(error)) {
    return error.response?.data?.message || error.response?.data?.error || fallback;
  }

  return fallback;
}

function toDateInputValue(value: string | null | undefined, fallback?: string): string {
  const candidate = value || fallback || "";

  if (!candidate) {
    return "";
  }

  const date = new Date(candidate);

  if (Number.isNaN(date.getTime())) {
    return fallback ? toDateInputValue(fallback) : "";
  }

  return date.toISOString().slice(0, 10);
}

function ExpenseEditSkeleton() {
  return (
    <section className="mx-auto max-w-4xl animate-pulse rounded-2xl bg-white p-6 shadow-sm ring-1 ring-ui-border/70">
      <div className="h-8 w-52 rounded bg-ui-border" />
      <div className="mt-7 grid gap-5">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-20 rounded-xl bg-ui-row-alt" />
        ))}
      </div>
    </section>
  );
}

export default function EditExpensePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [expense, setExpense] = useState<Expense | null>(null);
  const [eventName, setEventName] = useState("");
  const [category, setCategory] = useState<ExpenseCategory | "">("");
  const [requestedAmount, setRequestedAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [requiredDate, setRequiredDate] = useState("");
  const [remarks, setRemarks] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState("");
  const [submissionError, setSubmissionError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadExpense = useCallback(async () => {
    setLoadError("");
    setIsLoading(true);

    try {
      const loadedExpense = await getExpenseById(params.id);
      setExpense(loadedExpense);
      setEventName(loadedExpense.eventName);
      setCategory(loadedExpense.category);
      setRequestedAmount(String(loadedExpense.requestedAmount));
      setPurpose(loadedExpense.purpose);
      setRequiredDate(toDateInputValue(loadedExpense.requiredDate, loadedExpense.createdAt));
      setRemarks(loadedExpense.notes || "");
    } catch (error) {
      setLoadError(getErrorMessage(error, "Unable to load expense. Please try again."));
    } finally {
      setIsLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void loadExpense();
  }, [loadExpense]);

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

    if (!expense) {
      return;
    }

    setErrors({});
    setSubmissionError("");

    const trimmedEventName = eventName.trim();
    const trimmedPurpose = purpose.trim();
    const trimmedRemarks = remarks.trim();
    const amount = Number(requestedAmount);
    let hasError = false;

    if (!trimmedEventName) {
      setFieldError("eventName", "Event name is required.");
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
      setFieldError("requiredDate", "Requested date is required.");
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
      const attachmentUrls =
        attachments.length > 0 ? await uploadFiles(attachments) : expense.attachmentUrls;

      const updatedExpense = await updateExpense(expense.id, {
        eventName: trimmedEventName,
        category,
        requestedAmount: Number(amount.toFixed(2)),
        purpose: trimmedPurpose,
        requiredDate,
        remarks: trimmedRemarks || undefined,
        attachmentUrls,
      });

      router.replace(`/expenses/${updatedExpense.id}`);
    } catch (error) {
      setSubmissionError(getErrorMessage(error, "Unable to update expense. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppLayout title="Edit Expense">
      {isLoading ? (
        <ExpenseEditSkeleton />
      ) : loadError ? (
        <section className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-ui-border/70">
          <h2 className="text-2xl font-extrabold text-ui-text-primary">
            Unable to Load Expense
          </h2>
          <p className="mt-2 text-sm font-medium text-ui-text-muted">{loadError}</p>
          <button
            type="button"
            onClick={loadExpense}
            className="mt-6 rounded-lg bg-brand-red px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-red/90"
          >
            Retry
          </button>
        </section>
      ) : expense ? (
        <form
          onSubmit={handleSubmit}
          className="mx-auto max-w-4xl rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ui-border/70 sm:p-6"
        >
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-red">
              Expense Management
            </p>
            <h1 className="mt-2 text-3xl font-extrabold text-ui-text-primary">
              Edit Expense
            </h1>
          </div>

          <div className="mt-7 grid gap-5">
            <div>
              <label
                htmlFor="expenseEventName"
                className="mb-2 block text-sm font-semibold text-ui-text-primary"
              >
                Event Name <span className="text-status-error">*</span>
              </label>
              <input
                id="expenseEventName"
                type="text"
                value={eventName}
                onChange={(event) => {
                  setEventName(event.target.value);
                  clearFieldError("eventName");
                }}
                className={`w-full rounded-lg border px-4 py-3 text-ui-text-primary outline-none transition focus:border-brand-red focus:ring-2 focus:ring-brand-red/20 ${
                  errors.eventName ? "border-status-error" : "border-ui-border"
                }`}
              />
              {errors.eventName ? (
                <p className="mt-2 text-sm font-medium text-status-error">
                  {errors.eventName}
                </p>
              ) : null}
            </div>

            <div>
              <label
                htmlFor="expenseRequiredDate"
                className="mb-2 block text-sm font-semibold text-ui-text-primary"
              >
                Requested Date <span className="text-status-error">*</span>
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
              />
              {errors.requiredDate ? (
                <p className="mt-2 text-sm font-medium text-status-error">
                  {errors.requiredDate}
                </p>
              ) : null}
            </div>

            <div>
              <label
                htmlFor="expenseRequestedAmount"
                className="mb-2 block text-sm font-semibold text-ui-text-primary"
              >
                Requested Amount <span className="text-status-error">*</span>
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
                />
              </div>
              {errors.requestedAmount ? (
                <p className="mt-2 text-sm font-medium text-status-error">
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
              >
                <option value="">Select a category</option>
                {Object.values(ExpenseCategory).map((expenseCategory) => (
                  <option key={expenseCategory} value={expenseCategory}>
                    {categoryLabels[expenseCategory]}
                  </option>
                ))}
              </select>
              {errors.category ? (
                <p className="mt-2 text-sm font-medium text-status-error">
                  {errors.category}
                </p>
              ) : null}
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label
                  htmlFor="expensePurpose"
                  className="block text-sm font-semibold text-ui-text-primary"
                >
                  Purpose <span className="text-status-error">*</span>
                </label>
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
              />
              {errors.purpose ? (
                <p className="mt-2 text-sm font-medium text-status-error">
                  {errors.purpose}
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
                onChange={(event) => setRemarks(event.target.value)}
                rows={4}
                maxLength={300}
                className="w-full rounded-lg border border-ui-border px-4 py-3 text-ui-text-primary outline-none transition focus:border-brand-red focus:ring-2 focus:ring-brand-red/20"
              />
            </div>

            <div>
              <label
                htmlFor="expenseAttachments"
                className="mb-2 block text-sm font-semibold text-ui-text-primary"
              >
                Replace Attachments <span className="text-ui-text-muted">(optional)</span>
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
                Leave empty to keep existing attachments.
              </p>
              {errors.attachments ? (
                <p className="mt-2 text-sm font-medium text-status-error">
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
              href={`/expenses/${expense.id}`}
              className="inline-flex items-center justify-center rounded-lg border border-ui-border px-5 py-3 text-sm font-bold text-ui-text-primary transition hover:border-brand-red hover:text-brand-red"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center justify-center rounded-lg bg-brand-red px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand-red/90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? (
                <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              ) : null}
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      ) : null}
    </AppLayout>
  );
}

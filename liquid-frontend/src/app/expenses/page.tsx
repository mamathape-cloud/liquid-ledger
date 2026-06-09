"use client";

import axios from "axios";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import StatusBadge from "@/components/ui/StatusBadge";
import { useAuth } from "@/context/AuthContext";
import { getAssignedEvents, getEvents } from "@/lib/eventApi";
import { deleteExpense, getExpenses } from "@/lib/expenseApi";
import type { FinanceEvent } from "@/types/event";
import {
  ExpenseCategory,
  type Expense,
  ExpenseStatus,
} from "@/types/expense";

const PAGE_SIZE = 20;

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

function getRequestDate(expense: Expense): string {
  return expense.requiredDate || expense.createdAt;
}

function formatDateOnly(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(date);
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

function getSettledAmount(expense: Expense): number {
  if (expense.status !== ExpenseStatus.SETTLED) {
    return 0;
  }

  return expense.disbursedAmount || expense.approvedAmount || expense.requestedAmount;
}

function ExpensesSkeleton() {
  return (
    <section className="animate-pulse rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ui-border/70">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="h-8 w-48 rounded bg-ui-border" />
        <div className="h-11 w-36 rounded bg-ui-border" />
      </div>
      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <div className="h-12 rounded bg-ui-row-alt" />
        <div className="h-12 rounded bg-ui-row-alt" />
        <div className="h-12 rounded bg-ui-row-alt" />
      </div>
      <div className="mt-6 space-y-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-16 rounded-lg bg-ui-row-alt" />
        ))}
      </div>
    </section>
  );
}

function EmptyState() {
  return (
    <section className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-ui-border/70">
      <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-brand-red/10">
        <svg
          aria-hidden="true"
          viewBox="0 0 120 120"
          className="h-16 w-16 text-brand-red"
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M35 20h50v80l-12-8-13 8-13-8-12 8V20Z" />
          <path d="M48 45h24" />
          <path d="M48 62h24" />
          <path d="M48 79h13" />
        </svg>
      </div>
      <h2 className="mt-5 text-2xl font-extrabold text-ui-text-primary">
        No expenses found
      </h2>
      <p className="mt-2 text-sm font-medium text-ui-text-muted">
        Try changing the filters or create a new expense request.
      </p>
    </section>
  );
}

function AccessDenied() {
  return (
    <section className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-ui-border/70">
      <h2 className="text-2xl font-extrabold text-ui-text-primary">Access Denied</h2>
      <p className="mt-2 text-sm font-medium text-ui-text-muted">
        You do not have permission to view expenses.
      </p>
    </section>
  );
}

export default function ExpensesPage() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [statusFilter, setStatusFilter] = useState<ExpenseStatus | "">("");
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | "">("");
  const [eventNameFilter, setEventNameFilter] = useState("");
  const [availableEvents, setAvailableEvents] = useState<FinanceEvent[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const permissions = user?.permissions || [];
  const canViewExpenses =
    permissions.includes("expenses.view_own") ||
    permissions.includes("expenses.view_all");
  const canCreateExpense =
    permissions.includes("expenses.create") || permissions.includes("expenses.view_own");
  const isEmployee = user?.role.name.toLowerCase() === "employee";

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const eventSummaries = useMemo(
    () =>
      availableEvents.flatMap((event) => {
        const allocation = event.allocations[0];

        if (!allocation) {
          return [];
        }

        return [{
          eventName: event.eventName,
          allocatedAmount: allocation.allocatedAmount,
          claimedAmount: allocation.claimedAmount,
          differenceAmount: allocation.differenceAmount,
        }];
      }),
    [availableEvents],
  );

  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      const matchesStatus = !statusFilter || expense.status === statusFilter;
      const matchesCategory = !categoryFilter || expense.category === categoryFilter;
      const matchesEvent =
        !eventNameFilter || expense.eventName === eventNameFilter;

      return matchesEvent && matchesStatus && matchesCategory;
    });
  }, [categoryFilter, eventNameFilter, expenses, statusFilter]);

  const loadExpenses = useCallback(async () => {
    if (!canViewExpenses) {
      setIsLoading(false);
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const response = await getExpenses({
        eventName: eventNameFilter,
        status: statusFilter,
        category: categoryFilter,
        page,
        limit: PAGE_SIZE,
      });

      setExpenses(response.expenses);
      setTotal(response.total);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Unable to load expenses. Please try again."));
    } finally {
      setIsLoading(false);
    }
  }, [canViewExpenses, categoryFilter, eventNameFilter, page, statusFilter]);

  useEffect(() => {
    if (!canViewExpenses) {
      return;
    }

    let isMounted = true;
    const loadEvents = isEmployee ? getAssignedEvents : getEvents;

    loadEvents()
      .then((events) => {
        if (isMounted) {
          setAvailableEvents(events);
        }
      })
      .catch(() => {
        if (isMounted) {
          setAvailableEvents([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [canViewExpenses, isEmployee]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      loadExpenses();
    }, 200);

    return () => window.clearTimeout(timeout);
  }, [loadExpenses]);

  async function handleDeleteExpense() {
    if (!deleteTarget) {
      return;
    }

    setDeleteError("");
    setIsDeleting(true);

    try {
      await deleteExpense(deleteTarget.id);
      setExpenses((currentExpenses) =>
        currentExpenses.filter((expense) => expense.id !== deleteTarget.id),
      );
      setTotal((currentTotal) => Math.max(0, currentTotal - 1));
      setDeleteTarget(null);
    } catch (deleteFailure) {
      setDeleteError(
        getErrorMessage(deleteFailure, "Unable to delete expense. Please try again."),
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <AppLayout title="Expenses">
      {!canViewExpenses ? (
        <AccessDenied />
      ) : isLoading ? (
        <ExpensesSkeleton />
      ) : error ? (
        <section className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-ui-border/70">
          <h2 className="text-2xl font-extrabold text-ui-text-primary">
            Unable to Load Expenses
          </h2>
          <p className="mt-2 text-sm font-medium text-ui-text-muted">{error}</p>
          <button
            type="button"
            onClick={loadExpenses}
            className="mt-6 rounded-lg bg-brand-red px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-red/90"
          >
            Retry
          </button>
        </section>
      ) : (
        <section className="space-y-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-red">
                Expense Management
              </p>
              <h1 className="mt-2 text-3xl font-extrabold text-ui-text-primary">
                Expenses
              </h1>
            </div>
            {canCreateExpense ? (
              <Link
                href="/expenses/new"
                className="inline-flex items-center justify-center rounded-lg bg-brand-red px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand-red/90 sm:self-end"
              >
                New Request
              </Link>
            ) : null}
          </div>

          {isEmployee && eventSummaries.length > 0 ? (
            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ui-border/70">
              <h2 className="text-xl font-extrabold text-ui-text-primary">
                Event Advances
              </h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {eventSummaries.map((summary) => (
                  <article
                    key={summary.eventName}
                    className="rounded-xl border border-ui-border p-4"
                  >
                    <h3 className="text-base font-extrabold text-ui-text-primary">
                      {summary.eventName}
                    </h3>
                    <div className="mt-4 grid gap-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-bold uppercase tracking-wide text-ui-text-muted">
                          Amount Allocated
                        </span>
                        <span className="font-mono text-sm font-bold text-ui-text-primary">
                          {formatMoney(summary.allocatedAmount)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-bold uppercase tracking-wide text-ui-text-muted">
                          Amount Claimed
                        </span>
                        <span className="font-mono text-sm font-bold text-ui-text-primary">
                          {formatMoney(summary.claimedAmount)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-bold uppercase tracking-wide text-ui-text-muted">
                          Difference Amount
                        </span>
                        <span
                          className={`font-mono text-sm font-extrabold ${
                            summary.differenceAmount < 0
                              ? "text-status-error"
                              : "text-status-success"
                          }`}
                        >
                          {summary.differenceAmount >= 0 ? "+" : ""}
                          {formatMoney(summary.differenceAmount)}
                        </span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <section className="grid gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ui-border/70 md:grid-cols-3">
            <div>
              <label
                htmlFor="expenseEventFilter"
                className="mb-2 block text-xs font-bold uppercase tracking-wide text-ui-text-muted"
              >
                Event Name
              </label>
              <select
                id="expenseEventFilter"
                value={eventNameFilter}
                onChange={(event) => {
                  setEventNameFilter(event.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-ui-border px-3 py-2.5 text-sm font-semibold text-ui-text-primary outline-none transition focus:border-brand-red focus:ring-2 focus:ring-brand-red/20"
              >
                <option value="">All events</option>
                {availableEvents.map((event) => (
                  <option key={event.id} value={event.eventName}>
                    {event.eventName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="expenseStatusFilter"
                className="mb-2 block text-xs font-bold uppercase tracking-wide text-ui-text-muted"
              >
                Status
              </label>
              <select
                id="expenseStatusFilter"
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value as ExpenseStatus | "");
                  setPage(1);
                }}
                className="w-full rounded-lg border border-ui-border px-3 py-2.5 text-sm font-semibold text-ui-text-primary outline-none transition focus:border-brand-red focus:ring-2 focus:ring-brand-red/20"
              >
                <option value="">All statuses</option>
                {Object.values(ExpenseStatus).map((status) => (
                  <option key={status} value={status}>
                    {status.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="expenseCategoryFilter"
                className="mb-2 block text-xs font-bold uppercase tracking-wide text-ui-text-muted"
              >
                Category
              </label>
              <select
                id="expenseCategoryFilter"
                value={categoryFilter}
                onChange={(event) => {
                  setCategoryFilter(event.target.value as ExpenseCategory | "");
                  setPage(1);
                }}
                className="w-full rounded-lg border border-ui-border px-3 py-2.5 text-sm font-semibold text-ui-text-primary outline-none transition focus:border-brand-red focus:ring-2 focus:ring-brand-red/20"
              >
                <option value="">All categories</option>
                {Object.values(ExpenseCategory).map((category) => (
                  <option key={category} value={category}>
                    {categoryLabels[category]}
                  </option>
                ))}
              </select>
            </div>
          </section>

          {filteredExpenses.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              <div className="hidden overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-ui-border/70 md:block">
                <table className="w-full border-collapse">
                  <thead className="bg-brand-navy text-white">
                    {isEmployee ? (
                      <tr>
                        <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide">
                          Event Name
                        </th>
                        <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide">
                          Requested Date
                        </th>
                        <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide">
                          Requested Amount
                        </th>
                        <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide">
                          Settled Amount
                        </th>
                        <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide">
                          Status
                        </th>
                        <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide">
                          Actions
                        </th>
                      </tr>
                    ) : (
                      <tr>
                        <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide">
                          Submitted By
                        </th>
                        <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide">
                          Request Date
                        </th>
                        <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide">
                          Event Name
                        </th>
                        <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide">
                          Requested Amount
                        </th>
                        <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide">
                          Settled Amount
                        </th>
                        <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide">
                          Status
                        </th>
                        <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide">
                          Actions
                        </th>
                      </tr>
                    )}
                  </thead>
                  <tbody>
                    {filteredExpenses.map((expense, index) => (
                      <tr
                        key={expense.id}
                        className={index % 2 === 0 ? "bg-white" : "bg-ui-row-alt"}
                      >
                        {isEmployee ? (
                          <>
                            <td className="px-5 py-4 text-sm font-bold text-ui-text-primary">
                              {expense.eventName}
                            </td>
                            <td className="px-5 py-4 text-sm font-semibold text-ui-text-muted">
                              {formatDateOnly(getRequestDate(expense))}
                            </td>
                            <td className="px-5 py-4 text-right font-mono text-sm font-semibold text-ui-text-primary">
                              {formatMoney(expense.requestedAmount)}
                            </td>
                            <td className="px-5 py-4 text-right font-mono text-sm font-semibold text-ui-text-primary">
                              {formatMoney(getSettledAmount(expense))}
                            </td>
                            <td className="px-5 py-4">
                              <StatusBadge status={expense.status} />
                              <p className="mt-2 text-xs font-semibold text-ui-text-muted">
                                {getHandoffMessage(expense.status)}
                              </p>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-5 py-4 text-sm font-semibold text-ui-text-muted">
                              {expense.employeeId.name}
                            </td>
                            <td className="px-5 py-4 text-sm font-semibold text-ui-text-muted">
                              {formatDateOnly(getRequestDate(expense))}
                            </td>
                            <td className="px-5 py-4 text-sm font-bold text-ui-text-primary">
                              {expense.eventName}
                            </td>
                            <td className="px-5 py-4 text-right font-mono text-sm font-semibold text-ui-text-primary">
                              {formatMoney(expense.requestedAmount)}
                            </td>
                            <td className="px-5 py-4 text-right font-mono text-sm font-semibold text-ui-text-primary">
                              {formatMoney(getSettledAmount(expense))}
                            </td>
                            <td className="px-5 py-4">
                              <StatusBadge status={expense.status} />
                              <p className="mt-2 text-xs font-semibold text-ui-text-muted">
                                {getHandoffMessage(expense.status)}
                              </p>
                            </td>
                          </>
                        )}
                        <td className="px-5 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <Link
                              href={`/expenses/${expense.id}/edit`}
                              className="rounded-lg border border-ui-border px-3 py-2 text-xs font-bold text-ui-text-primary transition hover:border-brand-red hover:text-brand-red"
                            >
                              Edit
                            </Link>
                            <Link
                              href={`/expenses/${expense.id}`}
                              className="rounded-lg border border-ui-border px-3 py-2 text-xs font-bold text-ui-text-primary transition hover:border-brand-red hover:text-brand-red"
                            >
                              View
                            </Link>
                            <button
                              type="button"
                              onClick={() => {
                                setDeleteError("");
                                setDeleteTarget(expense);
                              }}
                              className="rounded-lg border border-status-error px-3 py-2 text-xs font-bold text-status-error transition hover:bg-status-error hover:text-white"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-4 md:hidden">
                {filteredExpenses.map((expense) => (
                  <article
                    key={expense.id}
                    className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ui-border/70"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-extrabold text-ui-text-primary">
                          {expense.eventName}
                        </h2>
                        <p className="mt-2 text-sm font-semibold text-ui-text-muted">
                          {categoryLabels[expense.category]}
                        </p>
                        {!isEmployee ? (
                          <p className="mt-2 text-sm font-semibold text-ui-text-muted">
                            Submitted by: {expense.employeeId.name}
                          </p>
                        ) : null}
                      </div>
                      <StatusBadge status={expense.status} />
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg bg-ui-row-alt p-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-ui-text-muted">
                          Requested Date
                        </p>
                        <p className="mt-1 text-sm font-bold text-ui-text-primary">
                          {formatDateOnly(getRequestDate(expense))}
                        </p>
                      </div>
                      <div className="rounded-lg bg-ui-row-alt p-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-ui-text-muted">
                          Requested Amount
                        </p>
                        <p className="mt-1 font-mono text-sm font-bold text-ui-text-primary">
                          {formatMoney(expense.requestedAmount)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-ui-row-alt p-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-ui-text-muted">
                          Settled Amount
                        </p>
                        <p className="mt-1 font-mono text-sm font-bold text-ui-text-primary">
                          {formatMoney(getSettledAmount(expense))}
                        </p>
                      </div>
                      <div className="rounded-lg bg-ui-row-alt p-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-ui-text-muted">
                          Next
                        </p>
                        <p className="mt-1 text-sm font-bold text-ui-text-primary">
                          {getHandoffMessage(expense.status)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-5 grid gap-2 sm:grid-cols-3">
                      <Link
                        href={`/expenses/${expense.id}/edit`}
                        className="rounded-lg border border-ui-border px-4 py-2 text-center text-sm font-bold text-ui-text-primary transition hover:border-brand-red hover:text-brand-red"
                      >
                        Edit
                      </Link>
                      <Link
                        href={`/expenses/${expense.id}`}
                        className="rounded-lg border border-ui-border px-4 py-2 text-center text-sm font-bold text-ui-text-primary transition hover:border-brand-red hover:text-brand-red"
                      >
                        View
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteError("");
                          setDeleteTarget(expense);
                        }}
                        className="rounded-lg border border-status-error px-4 py-2 text-sm font-bold text-status-error transition hover:bg-status-error hover:text-white"
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                ))}
              </div>

              <div className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ui-border/70 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold text-ui-text-muted">
                  Showing {filteredExpenses.length} of {total} expenses
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
                    disabled={page === 1}
                    className="rounded-lg border border-ui-border px-4 py-2 text-sm font-bold text-ui-text-primary transition hover:border-brand-red hover:text-brand-red disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="px-2 text-sm font-bold text-ui-text-primary">
                    {page} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setPage((currentPage) => Math.min(totalPages, currentPage + 1))
                    }
                    disabled={page === totalPages}
                    className="rounded-lg border border-ui-border px-4 py-2 text-sm font-bold text-ui-text-primary transition hover:border-brand-red hover:text-brand-red disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      )}
      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/50 px-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="deleteExpenseTitle"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <h2 id="deleteExpenseTitle" className="text-xl font-extrabold text-ui-text-primary">
              Delete Expense
            </h2>
            <p className="mt-3 text-sm font-medium text-ui-text-muted">
              Are you sure you want to delete {deleteTarget.eventName}? This will remove it from
              expense lists.
            </p>
            {deleteError ? (
              <p className="mt-4 rounded-lg bg-status-error/10 px-4 py-3 text-sm font-medium text-status-error">
                {deleteError}
              </p>
            ) : null}
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  if (!isDeleting) {
                    setDeleteTarget(null);
                    setDeleteError("");
                  }
                }}
                disabled={isDeleting}
                className="rounded-lg border border-ui-border px-5 py-3 text-sm font-bold text-ui-text-primary transition hover:border-brand-red hover:text-brand-red disabled:cursor-not-allowed disabled:opacity-70"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteExpense}
                disabled={isDeleting}
                className="inline-flex items-center justify-center rounded-lg bg-status-error px-5 py-3 text-sm font-bold text-white transition hover:bg-status-error/90 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isDeleting ? (
                  <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                ) : null}
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </AppLayout>
  );
}

"use client";

import axios from "axios";
import { useCallback, useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import StatusBadge, { statusLabels } from "@/components/ui/StatusBadge";
import { useAuth } from "@/context/AuthContext";
import { getEvents } from "@/lib/eventApi";
import { getExpenses } from "@/lib/expenseApi";
import type { FinanceEvent } from "@/types/event";
import { ExpenseCategory, type Expense, ExpenseStatus } from "@/types/expense";

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

const orderedStatuses = [
  ExpenseStatus.DRAFT,
  ExpenseStatus.PENDING,
  ExpenseStatus.APPROVED,
  ExpenseStatus.REJECTED,
  ExpenseStatus.DISBURSED,
  ExpenseStatus.PROOF_PENDING,
  ExpenseStatus.AUDIT_PENDING,
  ExpenseStatus.SETTLED,
  ExpenseStatus.DISCREPANCY,
];

function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<{ message?: string; error?: string }>(error)) {
    return error.response?.data?.message || error.response?.data?.error || fallback;
  }

  return fallback;
}

function formatMoney(amount: number | null | undefined): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(amount || 0);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

function getDateRangeBoundary(value: string, boundary: "start" | "end") {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);

  if (boundary === "end") {
    date.setHours(23, 59, 59, 999);
  }

  return date;
}

function escapeCsvValue(value: string | number | null | undefined): string {
  const text = String(value ?? "");

  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

function downloadCsv(expenses: Expense[]) {
  const headers = [
    "Employee Name",
    "Event Name",
    "Category",
    "Advance Amount",
    "Requested Amount",
    "Approved Amount",
    "Disbursed Amount",
    "Status",
    "Date",
  ];
  const rows = expenses.map((expense) => [
    expense.employeeId.name,
    expense.eventName,
    categoryLabels[expense.category],
    (expense.advanceAmount || 0).toFixed(2),
    expense.requestedAmount.toFixed(2),
    (expense.approvedAmount || 0).toFixed(2),
    (expense.disbursedAmount || 0).toFixed(2),
    statusLabels[expense.status],
    formatDate(expense.createdAt),
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map(escapeCsvValue).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const fileDate = new Date().toISOString().slice(0, 10);

  anchor.href = url;
  anchor.download = `liquid-ledger-expenses-${fileDate}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function AccessDenied() {
  return (
    <section className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-ui-border/70">
      <h1 className="text-2xl font-extrabold text-ui-text-primary">Access Denied</h1>
      <p className="mt-2 text-sm font-medium text-ui-text-muted">
        You do not have permission to view reports.
      </p>
    </section>
  );
}

function ReportsSkeleton() {
  return (
    <section className="space-y-5 animate-pulse">
      <div className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ui-border/70 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="h-4 w-36 rounded bg-ui-border" />
          <div className="mt-3 h-9 w-44 rounded bg-ui-border" />
        </div>
        <div className="h-11 w-32 rounded bg-ui-border" />
      </div>
      <div className="grid gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ui-border/70 md:grid-cols-3">
        <div className="h-16 rounded bg-ui-row-alt" />
        <div className="h-16 rounded bg-ui-row-alt" />
        <div className="h-16 rounded bg-ui-row-alt" />
      </div>
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ui-border/70">
        <div className="h-7 w-56 rounded bg-ui-border" />
        <div className="mt-5 space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-14 rounded-lg bg-ui-row-alt" />
          ))}
        </div>
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
          <path d="M25 92h70" />
          <path d="M38 82V52" />
          <path d="M58 82V32" />
          <path d="M78 82V62" />
        </svg>
      </div>
      <h2 className="mt-5 text-2xl font-extrabold text-ui-text-primary">
        No report data found
      </h2>
      <p className="mt-2 text-sm font-medium text-ui-text-muted">
        Try widening the date range or check again after expenses are submitted.
      </p>
    </section>
  );
}

export default function ReportsPage() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [events, setEvents] = useState<FinanceEvent[]>([]);
  const [eventName, setEventName] = useState("");
  const [appliedEventName, setAppliedEventName] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [appliedFromDate, setAppliedFromDate] = useState("");
  const [appliedToDate, setAppliedToDate] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const canViewReports = Boolean(user?.permissions.includes("reports.view"));

  const loadExpenses = useCallback(async () => {
    if (!canViewReports) {
      setIsLoading(false);
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const [response, loadedEvents] = await Promise.all([
        getExpenses(),
        getEvents(),
      ]);

      setExpenses(response.expenses);
      setEvents(loadedEvents);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Unable to load reports. Please try again."));
    } finally {
      setIsLoading(false);
    }
  }, [canViewReports]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      loadExpenses();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadExpenses]);

  const filteredExpenses = useMemo(() => {
    const fromBoundary = getDateRangeBoundary(appliedFromDate, "start");
    const toBoundary = getDateRangeBoundary(appliedToDate, "end");

    return expenses.filter((expense) => {
      const createdAt = new Date(expense.createdAt);

      if (appliedEventName && expense.eventName !== appliedEventName) {
        return false;
      }

      if (fromBoundary && createdAt < fromBoundary) {
        return false;
      }

      if (toBoundary && createdAt > toBoundary) {
        return false;
      }

      return true;
    });
  }, [appliedEventName, appliedFromDate, appliedToDate, expenses]);

  const totals = useMemo(
    () =>
      filteredExpenses.reduce(
        (currentTotals, expense) => ({
          advanceAmount: currentTotals.advanceAmount + (expense.advanceAmount || 0),
          requestedAmount: currentTotals.requestedAmount + expense.requestedAmount,
          approvedAmount: currentTotals.approvedAmount + (expense.approvedAmount || 0),
          disbursedAmount: currentTotals.disbursedAmount + (expense.disbursedAmount || 0),
        }),
        {
          advanceAmount: 0,
          requestedAmount: 0,
          approvedAmount: 0,
          disbursedAmount: 0,
        },
      ),
    [filteredExpenses],
  );

  const statusCounts = useMemo(() => {
    const counts = Object.fromEntries(
      orderedStatuses.map((status) => [status, 0]),
    ) as Record<ExpenseStatus, number>;

    filteredExpenses.forEach((expense) => {
      counts[expense.status] += 1;
    });

    return counts;
  }, [filteredExpenses]);

  const categoryBreakdown = useMemo(
    () =>
      Object.values(ExpenseCategory)
        .map((category) => {
          const categoryExpenses = filteredExpenses.filter(
            (expense) => expense.category === category,
          );

          return {
            category,
            count: categoryExpenses.length,
            totalAmount: categoryExpenses.reduce(
              (total, expense) => total + expense.requestedAmount,
              0,
            ),
          };
        })
        .filter((item) => item.count > 0),
    [filteredExpenses],
  );

  function handleFilter() {
    setAppliedEventName(eventName);
    setAppliedFromDate(fromDate);
    setAppliedToDate(toDate);
  }

  return (
    <AppLayout title="Reports">
      {!canViewReports ? (
        <AccessDenied />
      ) : isLoading ? (
        <ReportsSkeleton />
      ) : error ? (
        <section className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-ui-border/70">
          <h1 className="text-2xl font-extrabold text-ui-text-primary">
            Unable to Load Reports
          </h1>
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
                Expense Analytics
              </p>
              <h1 className="mt-2 text-3xl font-extrabold text-ui-text-primary">
                Reports
              </h1>
            </div>
            <button
              type="button"
              onClick={() => downloadCsv(filteredExpenses)}
              disabled={filteredExpenses.length === 0}
              className="inline-flex items-center justify-center rounded-lg bg-brand-red px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand-red/90 disabled:cursor-not-allowed disabled:opacity-60 sm:self-end"
            >
              Export CSV
            </button>
          </div>

          <section className="grid gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ui-border/70 md:grid-cols-[1fr_1fr_1fr_auto]">
            <div>
              <label
                htmlFor="reportsEventName"
                className="mb-2 block text-xs font-bold uppercase tracking-wide text-ui-text-muted"
              >
                Event
              </label>
              <select
                id="reportsEventName"
                value={eventName}
                onChange={(event) => setEventName(event.target.value)}
                className="w-full rounded-lg border border-ui-border px-3 py-2.5 text-sm font-semibold text-ui-text-primary outline-none transition focus:border-brand-red focus:ring-2 focus:ring-brand-red/20"
              >
                <option value="">All events</option>
                {events.map((financeEvent) => (
                  <option key={financeEvent.id} value={financeEvent.eventName}>
                    {financeEvent.eventName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="reportsFromDate"
                className="mb-2 block text-xs font-bold uppercase tracking-wide text-ui-text-muted"
              >
                From Date
              </label>
              <input
                id="reportsFromDate"
                type="date"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
                className="w-full rounded-lg border border-ui-border px-3 py-2.5 text-sm font-semibold text-ui-text-primary outline-none transition focus:border-brand-red focus:ring-2 focus:ring-brand-red/20"
              />
            </div>

            <div>
              <label
                htmlFor="reportsToDate"
                className="mb-2 block text-xs font-bold uppercase tracking-wide text-ui-text-muted"
              >
                To Date
              </label>
              <input
                id="reportsToDate"
                type="date"
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
                className="w-full rounded-lg border border-ui-border px-3 py-2.5 text-sm font-semibold text-ui-text-primary outline-none transition focus:border-brand-red focus:ring-2 focus:ring-brand-red/20"
              />
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={handleFilter}
                className="w-full rounded-lg bg-brand-navy px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-dark md:w-auto"
              >
                Filter
              </button>
            </div>
          </section>

          {filteredExpenses.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              <section className="space-y-4">
                <div>
                  <h2 className="text-2xl font-extrabold text-ui-text-primary">
                    Expense Summary
                  </h2>
                  <p className="mt-1 text-sm font-medium text-ui-text-muted">
                    Showing {filteredExpenses.length} expense
                    {filteredExpenses.length === 1 ? "" : "s"}.
                  </p>
                </div>

                <div className="hidden overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-ui-border/70 md:block">
                  <table className="w-full border-collapse">
                    <thead className="bg-brand-navy text-white">
                      <tr>
                        <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide">
                          Employee Name
                        </th>
                        <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide">
                          Event Name
                        </th>
                        <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide">
                          Category
                        </th>
                        <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide">
                          Advance Amount
                        </th>
                        <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide">
                          Req. Amount
                        </th>
                        <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide">
                          Approved Amount
                        </th>
                        <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide">
                          Disbursed Amount
                        </th>
                        <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide">
                          Status
                        </th>
                        <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide">
                          Date
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredExpenses.map((expense, index) => (
                        <tr
                          key={expense.id}
                          className={index % 2 === 0 ? "bg-white" : "bg-ui-row-alt"}
                        >
                          <td className="px-5 py-4 text-sm font-semibold text-ui-text-primary">
                            {expense.employeeId.name}
                          </td>
                          <td className="px-5 py-4 text-sm font-bold text-ui-text-primary">
                            {expense.eventName}
                          </td>
                          <td className="px-5 py-4 text-sm font-semibold text-ui-text-muted">
                            {categoryLabels[expense.category]}
                          </td>
                          <td className="px-5 py-4 text-right font-mono text-sm font-semibold text-ui-text-primary">
                            {formatMoney(expense.advanceAmount)}
                          </td>
                          <td className="px-5 py-4 text-right font-mono text-sm font-semibold text-ui-text-primary">
                            {formatMoney(expense.requestedAmount)}
                          </td>
                          <td className="px-5 py-4 text-right font-mono text-sm font-semibold text-ui-text-primary">
                            {formatMoney(expense.approvedAmount)}
                          </td>
                          <td className="px-5 py-4 text-right font-mono text-sm font-semibold text-ui-text-primary">
                            {formatMoney(expense.disbursedAmount)}
                          </td>
                          <td className="px-5 py-4">
                            <StatusBadge status={expense.status} />
                          </td>
                          <td className="px-5 py-4 text-sm font-semibold text-ui-text-muted">
                            {formatDate(expense.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-ui-border bg-ui-row-alt">
                        <td
                          colSpan={3}
                          className="px-5 py-4 text-sm font-extrabold uppercase tracking-wide text-ui-text-primary"
                        >
                          Total
                        </td>
                        <td className="px-5 py-4 text-right font-mono text-sm font-extrabold text-ui-text-primary">
                          {formatMoney(totals.advanceAmount)}
                        </td>
                        <td className="px-5 py-4 text-right font-mono text-sm font-extrabold text-ui-text-primary">
                          {formatMoney(totals.requestedAmount)}
                        </td>
                        <td className="px-5 py-4 text-right font-mono text-sm font-extrabold text-ui-text-primary">
                          {formatMoney(totals.approvedAmount)}
                        </td>
                        <td className="px-5 py-4 text-right font-mono text-sm font-extrabold text-ui-text-primary">
                          {formatMoney(totals.disbursedAmount)}
                        </td>
                        <td colSpan={2} className="px-5 py-4" />
                      </tr>
                    </tfoot>
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
                          <p className="text-sm font-bold text-ui-text-primary">
                            {expense.employeeId.name}
                          </p>
                          <h3 className="mt-2 text-lg font-extrabold text-ui-text-primary">
                            {expense.eventName}
                          </h3>
                          <p className="mt-1 text-sm font-semibold text-ui-text-muted">
                            {categoryLabels[expense.category]}
                          </p>
                        </div>
                        <StatusBadge status={expense.status} />
                      </div>
                      <div className="mt-4 grid grid-cols-1 gap-3 rounded-xl bg-ui-row-alt p-4">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-bold uppercase tracking-wide text-ui-text-muted">
                            Advance
                          </span>
                          <span className="font-mono text-sm font-bold text-ui-text-primary">
                            {formatMoney(expense.advanceAmount)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-bold uppercase tracking-wide text-ui-text-muted">
                            Requested
                          </span>
                          <span className="font-mono text-sm font-bold text-ui-text-primary">
                            {formatMoney(expense.requestedAmount)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-bold uppercase tracking-wide text-ui-text-muted">
                            Approved
                          </span>
                          <span className="font-mono text-sm font-bold text-ui-text-primary">
                            {formatMoney(expense.approvedAmount)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-bold uppercase tracking-wide text-ui-text-muted">
                            Disbursed
                          </span>
                          <span className="font-mono text-sm font-bold text-ui-text-primary">
                            {formatMoney(expense.disbursedAmount)}
                          </span>
                        </div>
                      </div>
                      <p className="mt-3 text-xs font-semibold text-ui-text-muted">
                        {formatDate(expense.createdAt)}
                      </p>
                    </article>
                  ))}

                  <article className="rounded-2xl bg-brand-navy p-5 text-white shadow-sm">
                    <h3 className="text-sm font-extrabold uppercase tracking-wide">
                      Total
                    </h3>
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-bold uppercase tracking-wide text-white/65">
                          Advance
                        </span>
                        <span className="font-mono text-sm font-bold">
                          {formatMoney(totals.advanceAmount)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-bold uppercase tracking-wide text-white/65">
                          Requested
                        </span>
                        <span className="font-mono text-sm font-bold">
                          {formatMoney(totals.requestedAmount)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-bold uppercase tracking-wide text-white/65">
                          Approved
                        </span>
                        <span className="font-mono text-sm font-bold">
                          {formatMoney(totals.approvedAmount)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-bold uppercase tracking-wide text-white/65">
                          Disbursed
                        </span>
                        <span className="font-mono text-sm font-bold">
                          {formatMoney(totals.disbursedAmount)}
                        </span>
                      </div>
                    </div>
                  </article>
                </div>
              </section>

              <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ui-border/70">
                <h2 className="text-2xl font-extrabold text-ui-text-primary">
                  Status Breakdown
                </h2>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {orderedStatuses.map((status) => (
                    <div
                      key={status}
                      className="flex items-center justify-between gap-3 rounded-xl border border-ui-border p-4"
                    >
                      <StatusBadge status={status} />
                      <span className="font-mono text-lg font-extrabold text-ui-text-primary">
                        {statusCounts[status]}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-4">
                <div>
                  <h2 className="text-2xl font-extrabold text-ui-text-primary">
                    Category Breakdown
                  </h2>
                  <p className="mt-1 text-sm font-medium text-ui-text-muted">
                    Total amount is based on requested amounts.
                  </p>
                </div>
                <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-ui-border/70">
                  <table className="w-full border-collapse">
                    <thead className="bg-brand-navy text-white">
                      <tr>
                        <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide">
                          Category
                        </th>
                        <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide">
                          Count
                        </th>
                        <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide">
                          Total Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {categoryBreakdown.map((item, index) => (
                        <tr
                          key={item.category}
                          className={index % 2 === 0 ? "bg-white" : "bg-ui-row-alt"}
                        >
                          <td className="px-5 py-4 text-sm font-bold text-ui-text-primary">
                            {categoryLabels[item.category]}
                          </td>
                          <td className="px-5 py-4 text-right font-mono text-sm font-semibold text-ui-text-primary">
                            {item.count}
                          </td>
                          <td className="px-5 py-4 text-right font-mono text-sm font-semibold text-ui-text-primary">
                            {formatMoney(item.totalAmount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </section>
      )}
    </AppLayout>
  );
}

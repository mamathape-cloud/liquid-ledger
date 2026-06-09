"use client";

import axios from "axios";
import { useCallback, useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/context/AuthContext";
import { getExpenses } from "@/lib/expenseApi";
import { type Expense, ExpenseStatus } from "@/types/expense";

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError<{ message?: string; error?: string }>(error)) {
    return (
      error.response?.data?.message ||
      error.response?.data?.error ||
      "Unable to load dashboard metrics. Please try again."
    );
  }

  return "Unable to load dashboard metrics. Please try again.";
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(amount);
}

function isCurrentMonth(value: string | null): boolean {
  if (!value) {
    return false;
  }

  const date = new Date(value);
  const now = new Date();

  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <article
          key={index}
          className="h-24 animate-pulse rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ui-border/70"
        >
          <div className="h-8 w-20 rounded bg-ui-border" />
          <div className="mt-4 h-4 w-28 rounded bg-ui-row-alt" />
        </article>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const permissions = user?.permissions || [];
  const canViewExpenses =
    permissions.includes("expenses.view_own") ||
    permissions.includes("expenses.view_all");

  const loadDashboard = useCallback(async () => {
    if (!canViewExpenses) {
      setExpenses([]);
      setTotalExpenses(0);
      setIsLoading(false);
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const response = await getExpenses({ page: 1, limit: 1000 });
      setExpenses(response.expenses);
      setTotalExpenses(response.total);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [canViewExpenses]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const kpiCards = useMemo(() => {
    const pendingApproval = expenses.filter(
      (expense) => expense.status === ExpenseStatus.PENDING,
    ).length;
    const disbursedThisMonth = expenses.reduce((total, expense) => {
      if (!isCurrentMonth(expense.disbursedAt)) {
        return total;
      }

      return total + (expense.disbursedAmount || 0);
    }, 0);
    const settledThisMonth = expenses.filter(
      (expense) =>
        expense.status === ExpenseStatus.SETTLED && isCurrentMonth(expense.settledAt),
    ).length;

    return [
      {
        label: "Total Expenses",
        value: String(totalExpenses),
      },
      {
        label: "Pending Approval",
        value: String(pendingApproval),
      },
      {
        label: "Disbursed This Month",
        value: formatMoney(disbursedThisMonth),
      },
      {
        label: "Settled This Month",
        value: String(settledThisMonth),
      },
    ];
  }, [expenses, totalExpenses]);

  return (
    <AppLayout title="Dashboard">
      <section>
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-red">
            Overview
          </p>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-ui-text-primary">
            Expense Summary
          </h2>
          <p className="mt-2 text-sm font-medium text-ui-text-muted">
            Metrics reflect the expenses available to your role.
          </p>
        </div>

        {isLoading ? (
          <DashboardSkeleton />
        ) : error ? (
          <section className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-ui-border/70">
            <h2 className="text-2xl font-extrabold text-ui-text-primary">
              Unable to Load Dashboard
            </h2>
            <p className="mt-2 text-sm font-medium text-ui-text-muted">{error}</p>
            <button
              type="button"
              onClick={loadDashboard}
              className="mt-6 rounded-lg bg-brand-red px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-red/90"
            >
              Retry
            </button>
          </section>
        ) : (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {kpiCards.map((card) => (
              <article
                key={card.label}
                className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ui-border/70"
              >
                <p className="font-mono text-3xl font-extrabold tracking-tight text-brand-navy">
                  {card.value}
                </p>
                <p className="mt-3 text-sm font-semibold text-ui-text-muted">
                  {card.label}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </AppLayout>
  );
}

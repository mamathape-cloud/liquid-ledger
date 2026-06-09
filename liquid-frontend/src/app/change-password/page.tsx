"use client";

import axios from "axios";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";

interface PasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError<{ message?: string; error?: string }>(error)) {
    return (
      error.response?.data?.message ||
      error.response?.data?.error ||
      "Password change failed. Please try again."
    );
  }

  return "Password change failed. Please try again.";
}

export default function ChangePasswordPage() {
  const router = useRouter();
  const { user, setUser } = useAuth();
  const [form, setForm] = useState<PasswordForm>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const requirements = useMemo(
    () => [
      {
        label: "Minimum 8 characters",
        met: form.newPassword.length >= 8,
      },
      {
        label: "At least 1 uppercase letter",
        met: /[A-Z]/.test(form.newPassword),
      },
      {
        label: "At least 1 number",
        met: /\d/.test(form.newPassword),
      },
      {
        label: "At least 1 special character",
        met: /[^A-Za-z0-9]/.test(form.newPassword),
      },
    ],
    [form.newPassword],
  );

  const allRequirementsMet = requirements.every((requirement) => requirement.met);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!form.currentPassword) {
      setError("Current password is required. If your password was reset, use Welcome@1234.");
      return;
    }

    if (!allRequirementsMet) {
      setError("New password does not meet all requirements.");
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      setError("Confirm password must match the new password.");
      return;
    }

    setIsSubmitting(true);

    try {
      await api.post("/auth/change-password", {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });

      if (user) {
        setUser({ ...user, mustChangePassword: false });
      }

      router.replace("/dashboard");
    } catch (submissionError) {
      setError(getErrorMessage(submissionError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-navy px-4 py-10 sm:px-6">
      <section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-red">
            Liquid Ledger
          </p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-ui-text-primary">
            Change Password
          </h1>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label
              htmlFor="currentPassword"
              className="mb-2 block text-sm font-semibold text-ui-text-primary"
            >
              Current Password <span className="text-status-error">*</span>
            </label>
            <input
              id="currentPassword"
              type="password"
              required
              autoComplete="current-password"
              value={form.currentPassword}
              onChange={(event) =>
                setForm((currentForm) => ({
                  ...currentForm,
                  currentPassword: event.target.value,
                }))
              }
              className="w-full rounded-lg border border-ui-border px-4 py-3 text-ui-text-primary outline-none transition focus:border-brand-red focus:ring-2 focus:ring-brand-red/20"
              placeholder="Enter current password"
            />
          </div>

          <div>
            <label
              htmlFor="newPassword"
              className="mb-2 block text-sm font-semibold text-ui-text-primary"
            >
              New Password <span className="text-status-error">*</span>
            </label>
            <input
              id="newPassword"
              type="password"
              required
              autoComplete="new-password"
              value={form.newPassword}
              onChange={(event) =>
                setForm((currentForm) => ({
                  ...currentForm,
                  newPassword: event.target.value,
                }))
              }
              className="w-full rounded-lg border border-ui-border px-4 py-3 text-ui-text-primary outline-none transition focus:border-brand-red focus:ring-2 focus:ring-brand-red/20"
              placeholder="Create new password"
            />

            <ul className="mt-3 space-y-2 text-sm font-medium">
              {requirements.map((requirement) => (
                <li
                  key={requirement.label}
                  className={
                    requirement.met ? "text-status-success" : "text-ui-text-muted"
                  }
                >
                  <span className="mr-2">✓</span>
                  {requirement.label}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="mb-2 block text-sm font-semibold text-ui-text-primary"
            >
              Confirm New Password <span className="text-status-error">*</span>
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={(event) =>
                setForm((currentForm) => ({
                  ...currentForm,
                  confirmPassword: event.target.value,
                }))
              }
              className="w-full rounded-lg border border-ui-border px-4 py-3 text-ui-text-primary outline-none transition focus:border-brand-red focus:ring-2 focus:ring-brand-red/20"
              placeholder="Re-enter new password"
            />
          </div>

          {error ? (
            <p className="rounded-lg bg-status-error/10 px-4 py-3 text-sm font-medium text-status-error">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center rounded-lg bg-brand-red px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-brand-red/90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? (
              <span className="mr-2 h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : null}
            {isSubmitting ? "Changing Password..." : "Change Password"}
          </button>
        </form>
      </section>
    </main>
  );
}

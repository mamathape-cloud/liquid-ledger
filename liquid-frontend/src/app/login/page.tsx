"use client";

import axios from "axios";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import type { LoginForm } from "@/types/auth";

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError<{ message?: string; error?: string }>(error)) {
    return (
      error.response?.data?.message ||
      error.response?.data?.error ||
      "Login failed. Please check your credentials and try again."
    );
  }

  return "Login failed. Please try again.";
}

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [form, setForm] = useState<LoginForm>({ usernameOrEmail: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const user = await login(form);

      router.replace(user.mustChangePassword ? "/change-password" : "/dashboard");
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
          <h1 className="text-3xl font-extrabold tracking-tight text-brand-red">
            Liquid Ledger
          </h1>
          <p className="mt-2 text-sm font-medium text-ui-text-muted">Liquid Stage</p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label
              htmlFor="usernameOrEmail"
              className="mb-2 block text-sm font-semibold text-ui-text-primary"
            >
              Username/Email <span className="text-status-error">*</span>
            </label>
            <input
              id="usernameOrEmail"
              type="text"
              required
              autoComplete="username"
              value={form.usernameOrEmail}
              onChange={(event) =>
                setForm((currentForm) => ({
                  ...currentForm,
                  usernameOrEmail: event.target.value,
                }))
              }
              className="w-full rounded-lg border border-ui-border px-4 py-3 text-ui-text-primary outline-none transition focus:border-brand-red focus:ring-2 focus:ring-brand-red/20"
              placeholder="username or you@liquidstage.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-semibold text-ui-text-primary"
            >
              Password <span className="text-status-error">*</span>
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                value={form.password}
                onChange={(event) =>
                  setForm((currentForm) => ({
                    ...currentForm,
                    password: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-ui-border px-4 py-3 pr-12 text-ui-text-primary outline-none transition focus:border-brand-red focus:ring-2 focus:ring-brand-red/20"
                placeholder="Enter password"
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((isVisible) => !isVisible)}
                className="absolute inset-y-0 right-3 flex items-center text-ui-text-muted transition hover:text-ui-text-primary"
              >
                {showPassword ? (
                  <svg
                    aria-hidden="true"
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M3 3l18 18" />
                    <path d="M10.58 10.58A2 2 0 0012 14a2 2 0 001.42-3.42" />
                    <path d="M9.88 4.24A10.77 10.77 0 0112 4c5 0 9 5 9 8a9.3 9.3 0 01-2.15 3.58" />
                    <path d="M6.61 6.61C4.42 8.04 3 10.26 3 12c0 3 4 8 9 8a10.7 10.7 0 005.39-1.61" />
                  </svg>
                ) : (
                  <svg
                    aria-hidden="true"
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm font-semibold">
            <Link href="/forgot-password" className="text-brand-red transition hover:text-brand-red/80">
              Forgot Password?
            </Link>
            <Link href="/register" className="text-brand-red transition hover:text-brand-red/80">
              Register User
            </Link>
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
            {isSubmitting ? "Signing In..." : "Login"}
          </button>
        </form>
      </section>
    </main>
  );
}

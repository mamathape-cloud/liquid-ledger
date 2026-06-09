"use client";

import axios from "axios";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import api from "@/lib/api";

interface RegisterForm {
  name: string;
  username: string;
  email: string;
  phone: string;
}

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError<{ message?: string; error?: string }>(error)) {
    return (
      error.response?.data?.message ||
      error.response?.data?.error ||
      "Unable to register user. Please try again."
    );
  }

  return "Unable to register user. Please try again.";
}

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState<RegisterForm>({
    name: "",
    username: "",
    email: "",
    phone: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submissionError, setSubmissionError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTemporaryPasswordPopup, setShowTemporaryPasswordPopup] = useState(false);

  function updateField(field: keyof RegisterForm, value: string) {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
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

    const trimmedForm = {
      name: form.name.trim(),
      username: form.username.trim().toLowerCase(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
    };
    const nextErrors: Record<string, string> = {};

    if (!trimmedForm.name) {
      nextErrors.name = "Full name is required.";
    }

    if (!trimmedForm.username) {
      nextErrors.username = "Username is required.";
    }

    if (!trimmedForm.email) {
      nextErrors.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedForm.email)) {
      nextErrors.email = "Enter a valid email address.";
    }

    if (!trimmedForm.phone) {
      nextErrors.phone = "Phone is required.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      await api.post("/auth/register", trimmedForm);
      setShowTemporaryPasswordPopup(true);
    } catch (error) {
      setSubmissionError(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-navy px-4 py-10 sm:px-6">
      <section className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-brand-red">
            Register User
          </h1>
          <p className="mt-2 text-sm font-medium text-ui-text-muted">
            New users are registered with the Employee role.
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <TextField
            id="registerName"
            label="Full Name"
            value={form.name}
            error={errors.name}
            onChange={(value) => updateField("name", value)}
            placeholder="Enter full name"
          />
          <TextField
            id="registerUsername"
            label="Username"
            value={form.username}
            error={errors.username}
            onChange={(value) => updateField("username", value)}
            placeholder="Enter username"
          />
          <TextField
            id="registerEmail"
            label="Email"
            type="email"
            value={form.email}
            error={errors.email}
            onChange={(value) => updateField("email", value)}
            placeholder="you@liquidstage.com"
          />
          <TextField
            id="registerPhone"
            label="Phone"
            type="tel"
            value={form.phone}
            error={errors.phone}
            onChange={(value) => updateField("phone", value)}
            placeholder="Enter phone number"
          />

          <div>
            <label
              htmlFor="registerRole"
              className="mb-2 block text-sm font-semibold text-ui-text-primary"
            >
              Role <span className="text-status-error">*</span>
            </label>
            <input
              id="registerRole"
              type="text"
              readOnly
              value="Employee"
              className="w-full rounded-lg border border-ui-border bg-ui-row-alt px-4 py-3 text-ui-text-muted outline-none"
            />
          </div>

          {submissionError ? (
            <p className="rounded-lg bg-status-error/10 px-4 py-3 text-sm font-medium text-status-error">
              {submissionError}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Link
              href="/login"
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
              {isSubmitting ? "Registering..." : "Register User"}
            </button>
          </div>
        </form>
      </section>

      {showTemporaryPasswordPopup ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/50 px-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="temporaryPasswordTitle"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <h2 id="temporaryPasswordTitle" className="text-xl font-extrabold text-ui-text-primary">
              Registration Submitted
            </h2>
            <p className="mt-3 text-sm font-semibold text-ui-text-muted">
              A temporary password Welcome@1234 will be assigned.
            </p>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => router.replace("/login")}
                className="rounded-lg bg-brand-red px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-red/90"
              >
                Back to Login
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  error,
  placeholder,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder: string;
  type?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-ui-text-primary">
        {label} <span className="text-status-error">*</span>
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`w-full rounded-lg border px-4 py-3 text-ui-text-primary outline-none transition focus:border-brand-red focus:ring-2 focus:ring-brand-red/20 ${
          error ? "border-status-error" : "border-ui-border"
        }`}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}Error` : undefined}
      />
      {error ? (
        <p id={`${id}Error`} className="mt-2 text-sm font-medium text-status-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

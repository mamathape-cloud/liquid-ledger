"use client";

import Link from "next/link";

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-navy px-4 py-10 sm:px-6">
      <section className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-2xl sm:p-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-brand-red">
          Forgot Password
        </h1>
        <p className="mt-4 text-sm font-semibold leading-6 text-ui-text-muted">
          Please contact your administrator to reset your password. The reset password will be
          Welcome@1234 and must be changed after login.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-brand-red px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-red/90"
        >
          Back to Login
        </Link>
      </section>
    </main>
  );
}

"use client";

import axios from "axios";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getRoles } from "@/lib/roleApi";
import { createUser, updateUser } from "@/lib/userApi";
import type { Role } from "@/types/role";
import type { User } from "@/types/user";

interface UserFormProps {
  mode: "create" | "edit";
  initialUser?: User;
}

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError<{ message?: string; error?: string }>(error)) {
    return (
      error.response?.data?.message ||
      error.response?.data?.error ||
      "Unable to save user. Please try again."
    );
  }

  return "Unable to save user. Please try again.";
}

export default function UserForm({ mode, initialUser }: UserFormProps) {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const [name, setName] = useState(initialUser?.name || "");
  const [username, setUsername] = useState(initialUser?.username || "");
  const [email, setEmail] = useState(initialUser?.email || "");
  const [phone, setPhone] = useState(initialUser?.phone || "");
  const [roleId, setRoleId] = useState(initialUser?.role.id || "");
  const [roles, setRoles] = useState<Role[]>([]);
  const [nameError, setNameError] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [roleError, setRoleError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [submissionError, setSubmissionError] = useState("");
  const [showTemporaryPasswordPopup, setShowTemporaryPasswordPopup] = useState(false);
  const [isLoadingRoles, setIsLoadingRoles] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = mode === "edit";
  const isEditingSelf = Boolean(isEditing && initialUser?.id === currentUser?.id);
  const submitLabel = isEditing ? "Save Changes" : "Add User";
  const submittingLabel = isEditing ? "Saving Changes..." : "Adding User...";

  useEffect(() => {
    let isMounted = true;

    getRoles()
      .then((loadedRoles) => {
        if (isMounted) {
          setRoles(loadedRoles);
        }
      })
      .catch((error) => {
        if (isMounted) {
          setLoadError(getErrorMessage(error));
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingRoles(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNameError("");
    setUsernameError("");
    setEmailError("");
    setPhoneError("");
    setRoleError("");
    setSubmissionError("");

    const trimmedName = name.trim();
    const trimmedUsername = username.trim().toLowerCase();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPhone = phone.trim();
    let hasError = false;

    if (!trimmedName) {
      setNameError("Full name is required.");
      hasError = true;
    }

    if (!trimmedUsername) {
      setUsernameError("Username is required.");
      hasError = true;
    }

    if (!isEditing && !trimmedEmail) {
      setEmailError("Email is required.");
      hasError = true;
    } else if (!isEditing && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setEmailError("Enter a valid email address.");
      hasError = true;
    }

    if (!trimmedPhone) {
      setPhoneError("Phone is required.");
      hasError = true;
    }

    if (!roleId) {
      setRoleError("Role is required.");
      hasError = true;
    }

    if (hasError) {
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEditing && initialUser) {
        await updateUser(initialUser.id, {
          name: trimmedName,
          username: trimmedUsername,
          phone: trimmedPhone,
          ...(!isEditingSelf ? { roleId } : {}),
        });
      } else {
        await createUser({
          name: trimmedName,
          username: trimmedUsername,
          email: trimmedEmail,
          phone: trimmedPhone,
          roleId,
        });
      }

      if (isEditing) {
        router.replace("/users");
      } else {
        setShowTemporaryPasswordPopup(true);
      }
    } catch (error) {
      setSubmissionError(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto max-w-4xl rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ui-border/70 sm:p-6"
    >
      <div className="grid gap-5">
        <div>
          <label
            htmlFor="userName"
            className="mb-2 block text-sm font-semibold text-ui-text-primary"
          >
            Full Name <span className="text-status-error">*</span>
          </label>
          <input
            id="userName"
            type="text"
            value={name}
            onChange={(event) => {
              setName(event.target.value);

              if (nameError) {
                setNameError("");
              }
            }}
            className={`w-full rounded-lg border px-4 py-3 text-ui-text-primary outline-none transition focus:border-brand-red focus:ring-2 focus:ring-brand-red/20 ${
              nameError ? "border-status-error" : "border-ui-border"
            }`}
            placeholder="Enter full name"
            aria-invalid={Boolean(nameError)}
            aria-describedby={nameError ? "userNameError" : undefined}
          />
          {nameError ? (
            <p id="userNameError" className="mt-2 text-sm font-medium text-status-error">
              {nameError}
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="userUsername"
            className="mb-2 block text-sm font-semibold text-ui-text-primary"
          >
            Username <span className="text-status-error">*</span>
          </label>
          <input
            id="userUsername"
            type="text"
            value={username}
            onChange={(event) => {
              setUsername(event.target.value);

              if (usernameError) {
                setUsernameError("");
              }
            }}
            className={`w-full rounded-lg border px-4 py-3 text-ui-text-primary outline-none transition focus:border-brand-red focus:ring-2 focus:ring-brand-red/20 ${
              usernameError ? "border-status-error" : "border-ui-border"
            }`}
            placeholder="Enter username"
            aria-invalid={Boolean(usernameError)}
            aria-describedby={usernameError ? "userUsernameError" : undefined}
          />
          {usernameError ? (
            <p id="userUsernameError" className="mt-2 text-sm font-medium text-status-error">
              {usernameError}
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="userEmail"
            className="mb-2 block text-sm font-semibold text-ui-text-primary"
          >
            Email <span className="text-status-error">*</span>
          </label>
          <input
            id="userEmail"
            type="email"
            value={email}
            readOnly={isEditing}
            onChange={(event) => {
              setEmail(event.target.value);

              if (emailError) {
                setEmailError("");
              }
            }}
            className={`w-full rounded-lg border px-4 py-3 text-ui-text-primary outline-none transition focus:border-brand-red focus:ring-2 focus:ring-brand-red/20 ${
              emailError ? "border-status-error" : "border-ui-border"
            } ${isEditing ? "bg-ui-row-alt text-ui-text-muted" : ""}`}
            placeholder="Enter email address"
            aria-invalid={Boolean(emailError)}
            aria-describedby={emailError ? "userEmailError" : undefined}
          />
          {emailError ? (
            <p id="userEmailError" className="mt-2 text-sm font-medium text-status-error">
              {emailError}
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="userPhone"
            className="mb-2 block text-sm font-semibold text-ui-text-primary"
          >
            Phone <span className="text-status-error">*</span>
          </label>
          <input
            id="userPhone"
            type="tel"
            value={phone}
            onChange={(event) => {
              setPhone(event.target.value);

              if (phoneError) {
                setPhoneError("");
              }
            }}
            className={`w-full rounded-lg border px-4 py-3 text-ui-text-primary outline-none transition focus:border-brand-red focus:ring-2 focus:ring-brand-red/20 ${
              phoneError ? "border-status-error" : "border-ui-border"
            }`}
            placeholder="Enter phone number"
            aria-invalid={Boolean(phoneError)}
            aria-describedby={phoneError ? "userPhoneError" : undefined}
          />
          {phoneError ? (
            <p id="userPhoneError" className="mt-2 text-sm font-medium text-status-error">
              {phoneError}
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="userRole"
            className="mb-2 block text-sm font-semibold text-ui-text-primary"
          >
            Role <span className="text-status-error">*</span>
          </label>
          <select
            id="userRole"
            value={roleId}
            disabled={isLoadingRoles || isEditingSelf}
            onChange={(event) => {
              setRoleId(event.target.value);

              if (roleError) {
                setRoleError("");
              }
            }}
            className={`w-full rounded-lg border px-4 py-3 text-ui-text-primary outline-none transition focus:border-brand-red focus:ring-2 focus:ring-brand-red/20 disabled:cursor-not-allowed disabled:bg-ui-row-alt disabled:text-ui-text-muted ${
              roleError ? "border-status-error" : "border-ui-border"
            }`}
            aria-invalid={Boolean(roleError)}
            aria-describedby={roleError ? "userRoleError" : undefined}
          >
            <option value="">
              {isLoadingRoles ? "Loading roles..." : "Select a role"}
            </option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
          {roleError ? (
            <p id="userRoleError" className="mt-2 text-sm font-medium text-status-error">
              {roleError}
            </p>
          ) : null}
          {isEditingSelf ? (
            <p className="mt-3 rounded-lg bg-status-info/10 px-4 py-3 text-sm font-medium text-status-info">
              You cannot edit your own role. Ask another administrator to change it.
            </p>
          ) : null}
          {loadError ? (
            <p className="mt-3 rounded-lg bg-status-error/10 px-4 py-3 text-sm font-medium text-status-error">
              {loadError}
            </p>
          ) : null}
        </div>
      </div>

      {!isEditing ? (
        <section className="mt-6 rounded-xl bg-status-info/10 px-4 py-4 text-sm font-semibold text-status-info">
          <p>A temporary password Welcome@1234 will be assigned.</p>
          <p className="mt-1">
            The user will be asked to change it on first login.
          </p>
        </section>
      ) : null}

      {submissionError ? (
        <p className="mt-6 rounded-lg bg-status-error/10 px-4 py-3 text-sm font-medium text-status-error">
          {submissionError}
        </p>
      ) : null}

      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link
          href="/users"
          className="inline-flex items-center justify-center rounded-lg border border-ui-border px-5 py-3 text-sm font-bold text-ui-text-primary transition hover:border-brand-red hover:text-brand-red"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isSubmitting || isLoadingRoles}
          className="inline-flex items-center justify-center rounded-lg bg-brand-red px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand-red/90 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? (
            <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          ) : null}
          {isSubmitting ? submittingLabel : submitLabel}
        </button>
      </div>

      {showTemporaryPasswordPopup ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/50 px-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="temporaryPasswordTitle"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <h2 id="temporaryPasswordTitle" className="text-xl font-extrabold text-ui-text-primary">
              User Created
            </h2>
            <p className="mt-3 text-sm font-semibold text-ui-text-muted">
              A temporary password Welcome@1234 will be assigned.
            </p>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => router.replace("/users")}
                className="rounded-lg bg-brand-red px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-red/90"
              >
                Done
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </form>
  );
}

"use client";

import axios from "axios";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { createRole, updateRole } from "@/lib/roleApi";
import { PERMISSIONS, type Role } from "@/types/role";

const PERMISSION_GROUPS = ["Expenses", "Administration"] as const;
const AVAILABLE_PERMISSION_VALUES = new Set(
  PERMISSIONS.map((permission) => permission.value),
);

interface RoleFormProps {
  mode: "create" | "edit";
  initialRole?: Role;
}

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError<{ message?: string; error?: string }>(error)) {
    return (
      error.response?.data?.message ||
      error.response?.data?.error ||
      "Unable to save role. Please try again."
    );
  }

  return "Unable to save role. Please try again.";
}

export default function RoleForm({ mode, initialRole }: RoleFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialRole?.name || "");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(
    initialRole?.permissions.filter((permission) =>
      AVAILABLE_PERMISSION_VALUES.has(permission),
    ) || [],
  );
  const [nameError, setNameError] = useState("");
  const [submissionError, setSubmissionError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = mode === "edit";
  const submitLabel = isEditing ? "Save Changes" : "Create Role";
  const submittingLabel = isEditing ? "Saving Changes..." : "Creating Role...";

  function togglePermission(permission: string) {
    setSelectedPermissions((currentPermissions) =>
      currentPermissions.includes(permission)
        ? currentPermissions.filter((currentPermission) => currentPermission !== permission)
        : [...currentPermissions, permission],
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNameError("");
    setSubmissionError("");

    const trimmedName = name.trim();

    if (!trimmedName) {
      setNameError("Role name is required.");
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEditing && initialRole) {
        await updateRole(initialRole.id, {
          name: trimmedName,
          permissions: selectedPermissions,
        });
      } else {
        await createRole({
          name: trimmedName,
          permissions: selectedPermissions,
        });
      }

      router.replace("/roles");
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
      <div>
        <label
          htmlFor="roleName"
          className="mb-2 block text-sm font-semibold text-ui-text-primary"
        >
          Role Name <span className="text-status-error">*</span>
        </label>
        <input
          id="roleName"
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
          placeholder="Enter role name"
          aria-invalid={Boolean(nameError)}
          aria-describedby={nameError ? "roleNameError" : undefined}
        />
        {nameError ? (
          <p id="roleNameError" className="mt-2 text-sm font-medium text-status-error">
            {nameError}
          </p>
        ) : null}
      </div>

      <section className="mt-8">
        <div className="mb-5">
          <h2 className="text-lg font-extrabold text-ui-text-primary">
            Permissions
          </h2>
          <p className="mt-1 text-sm font-medium text-ui-text-muted">
            Select the capabilities available to this role.
          </p>
        </div>

        <div className="space-y-6">
          {PERMISSION_GROUPS.map((group) => (
            <fieldset key={group} className="rounded-xl border border-ui-border p-4">
              <legend className="px-2 text-xs font-bold uppercase tracking-[0.18em] text-brand-red">
                {group}
              </legend>

              <div className="grid gap-3 pt-2 sm:grid-cols-2">
                {PERMISSIONS.filter((permission) => permission.group === group).map(
                  (permission) => {
                    const isChecked = selectedPermissions.includes(permission.value);

                    return (
                      <label
                        key={permission.value}
                        className="flex cursor-pointer items-center gap-3 rounded-lg border border-ui-border px-4 py-3 transition hover:border-brand-red/60 hover:bg-brand-red/5"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => togglePermission(permission.value)}
                          className="h-4 w-4 rounded border-ui-border accent-brand-red"
                        />
                        <span className="text-sm font-semibold text-ui-text-primary">
                          {permission.label}
                        </span>
                      </label>
                    );
                  },
                )}
              </div>
            </fieldset>
          ))}
        </div>
      </section>

      {submissionError ? (
        <p className="mt-6 rounded-lg bg-status-error/10 px-4 py-3 text-sm font-medium text-status-error">
          {submissionError}
        </p>
      ) : null}

      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link
          href="/roles"
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
          {isSubmitting ? submittingLabel : submitLabel}
        </button>
      </div>
    </form>
  );
}

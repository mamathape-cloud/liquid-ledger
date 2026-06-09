"use client";

import axios from "axios";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/context/AuthContext";
import { deleteUser, getUsers, resetPassword } from "@/lib/userApi";
import type { User } from "@/types/user";

type ConfirmationAction = "delete" | "reset";

interface ConfirmationState {
  action: ConfirmationAction;
  user: User;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<{ message?: string; error?: string }>(error)) {
    return error.response?.data?.message || error.response?.data?.error || fallback;
  }

  return fallback;
}

function AccessDenied() {
  return (
    <section className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-ui-border/70">
      <h2 className="text-2xl font-extrabold text-ui-text-primary">
        Access Denied
      </h2>
      <p className="mt-2 text-sm font-medium text-ui-text-muted">
        You do not have permission to manage users.
      </p>
    </section>
  );
}

function UsersSkeleton() {
  return (
    <section className="animate-pulse rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ui-border/70">
      <div className="flex items-center justify-between">
        <div className="h-8 w-40 rounded bg-ui-border" />
        <div className="h-11 w-28 rounded bg-ui-border" />
      </div>
      <div className="mt-6 space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-16 rounded-lg bg-ui-row-alt" />
        ))}
      </div>
    </section>
  );
}

interface ConfirmationModalProps {
  state: ConfirmationState;
  isSubmitting: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: () => void;
}

function ConfirmationModal({
  state,
  isSubmitting,
  error,
  onCancel,
  onConfirm,
}: ConfirmationModalProps) {
  const isDelete = state.action === "delete";
  const title = isDelete ? "Delete User" : "Reset Password";
  const confirmLabel = isDelete ? "Delete" : "Reset Password";
  const submittingLabel = isDelete ? "Deleting..." : "Resetting...";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/50 px-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="userConfirmationTitle"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
      >
        <h2
          id="userConfirmationTitle"
          className="text-xl font-extrabold text-ui-text-primary"
        >
          {title}
        </h2>
        {isDelete ? (
          <p className="mt-3 text-sm font-medium text-ui-text-muted">
            Are you sure you want to delete {state.user.name}?
          </p>
        ) : (
          <p className="mt-3 text-sm font-medium text-ui-text-muted">
            Reset password for {state.user.name}? They will be asked to change it
            on next login.
          </p>
        )}

        {error ? (
          <p className="mt-4 rounded-lg bg-status-error/10 px-4 py-3 text-sm font-medium text-status-error">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-lg border border-ui-border px-5 py-3 text-sm font-bold text-ui-text-primary transition hover:border-brand-red hover:text-brand-red disabled:cursor-not-allowed disabled:opacity-70"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="inline-flex items-center justify-center rounded-lg bg-status-error px-5 py-3 text-sm font-bold text-white transition hover:bg-status-error/90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? (
              <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : null}
            {isSubmitting ? submittingLabel : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

function PasswordFlag({ mustChangePassword }: { mustChangePassword: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase ${
        mustChangePassword
          ? "bg-status-warning/10 text-status-warning"
          : "bg-status-success/10 text-status-success"
      }`}
    >
      {mustChangePassword ? "Yes" : "No"}
    </span>
  );
}

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(null);
  const [confirmationError, setConfirmationError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  const canManageUsers = Boolean(currentUser?.permissions.includes("users.manage"));

  const loadUsers = useCallback(async () => {
    setError("");
    setIsLoading(true);

    try {
      const loadedUsers = await getUsers();
      setUsers(loadedUsers);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Unable to load users. Please try again."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canManageUsers) {
      return;
    }

    let isMounted = true;

    getUsers()
      .then((loadedUsers) => {
        if (isMounted) {
          setUsers(loadedUsers);
        }
      })
      .catch((loadError) => {
        if (isMounted) {
          setError(getErrorMessage(loadError, "Unable to load users. Please try again."));
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [canManageUsers]);

  async function handleConfirmAction() {
    if (!confirmation) {
      return;
    }

    setConfirmationError("");
    setSuccessMessage("");
    setIsSubmittingAction(true);

    try {
      if (confirmation.action === "delete") {
        await deleteUser(confirmation.user.id);
        setUsers((currentUsers) =>
          currentUsers.filter((user) => user.id !== confirmation.user.id),
        );
        setSuccessMessage(`Deleted user ${confirmation.user.name}.`);
      } else {
        const resetResult = await resetPassword(confirmation.user.id);
        setUsers((currentUsers) =>
          currentUsers.map((user) =>
            user.id === confirmation.user.id
              ? { ...user, mustChangePassword: true }
              : user,
          ),
        );
        setSuccessMessage(
          `Password reset for ${resetResult.name} (${resetResult.email}). Temporary password: ${resetResult.temporaryPassword}`,
        );
      }

      setConfirmation(null);
    } catch (actionError) {
      const fallback =
        confirmation.action === "delete"
          ? "Unable to delete user. Please try again."
          : "Unable to reset password. Please try again.";

      setConfirmationError(getErrorMessage(actionError, fallback));
    } finally {
      setIsSubmittingAction(false);
    }
  }

  function openConfirmation(action: ConfirmationAction, selectedUser: User) {
    setConfirmationError("");
    setSuccessMessage("");
    setConfirmation({ action, user: selectedUser });
  }

  return (
    <AppLayout title="Users">
      {!canManageUsers ? (
        <AccessDenied />
      ) : isLoading ? (
        <UsersSkeleton />
      ) : error ? (
        <section className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-ui-border/70">
          <h2 className="text-2xl font-extrabold text-ui-text-primary">
            Unable to Load Users
          </h2>
          <p className="mt-2 text-sm font-medium text-ui-text-muted">{error}</p>
          <button
            type="button"
            onClick={loadUsers}
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
                Administration
              </p>
              <h2 className="mt-2 text-2xl font-extrabold text-ui-text-primary">
                User Management
              </h2>
            </div>
            <Link
              href="/users/new"
              className="inline-flex items-center justify-center rounded-lg bg-brand-red px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand-red/90"
            >
              Add User
            </Link>
          </div>

          {successMessage ? (
            <p className="rounded-lg bg-status-success/10 px-4 py-3 text-sm font-semibold text-status-success">
              {successMessage}
            </p>
          ) : null}

          {users.length === 0 ? (
            <section className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-ui-border/70">
              <h2 className="text-2xl font-extrabold text-ui-text-primary">
                No users found
              </h2>
            </section>
          ) : (
            <>
              <div className="hidden overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-ui-border/70 md:block">
                <table className="w-full border-collapse">
                  <thead className="bg-brand-navy text-white">
                    <tr>
                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide">
                        Name
                      </th>
                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide">
                        Email
                      </th>
                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide">
                        Role
                      </th>
                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide">
                        Must Change Password
                      </th>
                      <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((managedUser, index) => {
                      const isSelf = managedUser.id === currentUser?.id;

                      return (
                        <tr
                          key={managedUser.id}
                          className={index % 2 === 0 ? "bg-white" : "bg-ui-row-alt"}
                        >
                          <td className="px-5 py-4 text-sm font-bold text-ui-text-primary">
                            {managedUser.name}
                          </td>
                          <td className="px-5 py-4 font-mono text-sm text-ui-text-muted">
                            {managedUser.email}
                          </td>
                          <td className="px-5 py-4 text-sm font-semibold text-ui-text-muted">
                            {managedUser.role.name}
                          </td>
                          <td className="px-5 py-4">
                            <PasswordFlag
                              mustChangePassword={managedUser.mustChangePassword}
                            />
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex justify-end gap-2">
                              <Link
                                href={`/users/${managedUser.id}/edit`}
                                className="rounded-lg border border-ui-border px-3 py-2 text-xs font-bold text-ui-text-primary transition hover:border-brand-red hover:text-brand-red"
                              >
                                Edit
                              </Link>
                              <button
                                type="button"
                                onClick={() => openConfirmation("delete", managedUser)}
                                disabled={isSelf}
                                className="rounded-lg border border-status-error px-3 py-2 text-xs font-bold text-status-error transition hover:bg-status-error hover:text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-status-error"
                              >
                                Delete
                              </button>
                              <button
                                type="button"
                                onClick={() => openConfirmation("reset", managedUser)}
                                disabled={isSelf}
                                className="rounded-lg border border-brand-red px-3 py-2 text-xs font-bold text-brand-red transition hover:bg-brand-red hover:text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-brand-red"
                              >
                                Reset Password
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="space-y-4 md:hidden">
                {users.map((managedUser) => {
                  const isSelf = managedUser.id === currentUser?.id;

                  return (
                    <article
                      key={managedUser.id}
                      className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ui-border/70"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h2 className="text-lg font-extrabold text-ui-text-primary">
                            {managedUser.name}
                          </h2>
                          <p className="mt-2 font-mono text-sm font-semibold text-ui-text-muted">
                            {managedUser.email}
                          </p>
                          <p className="mt-2 text-sm font-semibold text-ui-text-muted">
                            Role: {managedUser.role.name}
                          </p>
                        </div>
                        <PasswordFlag
                          mustChangePassword={managedUser.mustChangePassword}
                        />
                      </div>

                      <div className="mt-5 grid gap-2">
                        <Link
                          href={`/users/${managedUser.id}/edit`}
                          className="rounded-lg border border-ui-border px-3 py-2 text-center text-sm font-bold text-ui-text-primary transition hover:border-brand-red hover:text-brand-red"
                        >
                          Edit
                        </Link>
                        <button
                          type="button"
                          onClick={() => openConfirmation("delete", managedUser)}
                          disabled={isSelf}
                          className="rounded-lg border border-status-error px-3 py-2 text-sm font-bold text-status-error transition hover:bg-status-error hover:text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-status-error"
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => openConfirmation("reset", managedUser)}
                          disabled={isSelf}
                          className="rounded-lg border border-brand-red px-3 py-2 text-sm font-bold text-brand-red transition hover:bg-brand-red hover:text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-brand-red"
                        >
                          Reset Password
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </section>
      )}

      {confirmation ? (
        <ConfirmationModal
          state={confirmation}
          isSubmitting={isSubmittingAction}
          error={confirmationError}
          onCancel={() => {
            if (!isSubmittingAction) {
              setConfirmation(null);
            }
          }}
          onConfirm={handleConfirmAction}
        />
      ) : null}
    </AppLayout>
  );
}

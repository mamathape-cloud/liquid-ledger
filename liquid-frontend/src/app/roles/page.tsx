"use client";

import axios from "axios";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/context/AuthContext";
import { deleteRole, getRoles } from "@/lib/roleApi";
import type { Role } from "@/types/role";

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError<{ message?: string; error?: string }>(error)) {
    return (
      error.response?.data?.message ||
      error.response?.data?.error ||
      "Unable to load roles. Please try again."
    );
  }

  return "Unable to load roles. Please try again.";
}

function AccessDenied() {
  return (
    <section className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-ui-border/70">
      <h2 className="text-2xl font-extrabold text-ui-text-primary">
        Access Denied
      </h2>
      <p className="mt-2 text-sm font-medium text-ui-text-muted">
        You do not have permission to manage roles.
      </p>
    </section>
  );
}

function RolesSkeleton() {
  return (
    <section className="animate-pulse rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ui-border/70">
      <div className="flex items-center justify-between">
        <div className="h-8 w-36 rounded bg-ui-border" />
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

interface DeleteRoleModalProps {
  role: Role;
  isDeleting: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: () => void;
}

function DeleteRoleModal({
  role,
  isDeleting,
  error,
  onCancel,
  onConfirm,
}: DeleteRoleModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/50 px-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="deleteRoleTitle"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
      >
        <h2 id="deleteRoleTitle" className="text-xl font-extrabold text-ui-text-primary">
          Delete Role
        </h2>
        <p className="mt-3 text-sm font-medium text-ui-text-muted">
          Are you sure you want to delete {role.name}?
        </p>

        {error ? (
          <p className="mt-4 rounded-lg bg-status-error/10 px-4 py-3 text-sm font-medium text-status-error">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="rounded-lg border border-ui-border px-5 py-3 text-sm font-bold text-ui-text-primary transition hover:border-brand-red hover:text-brand-red disabled:cursor-not-allowed disabled:opacity-70"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
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
  );
}

export default function RolesPage() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const canManageRoles = Boolean(user?.permissions.includes("roles.manage"));

  const loadRoles = useCallback(async () => {
    setError("");
    setIsLoading(true);

    try {
      const loadedRoles = await getRoles();
      setRoles(loadedRoles);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canManageRoles) {
      return;
    }

    let isMounted = true;

    getRoles()
      .then((loadedRoles) => {
        if (isMounted) {
          setRoles(loadedRoles);
        }
      })
      .catch((loadError) => {
        if (isMounted) {
          setError(getErrorMessage(loadError));
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
  }, [canManageRoles]);

  async function handleDeleteRole() {
    if (!roleToDelete) {
      return;
    }

    setDeleteError("");
    setIsDeleting(true);

    try {
      await deleteRole(roleToDelete.id);
      setRoles((currentRoles) =>
        currentRoles.filter((role) => role.id !== roleToDelete.id),
      );
      setRoleToDelete(null);
    } catch (deleteFailure) {
      setDeleteError(getErrorMessage(deleteFailure));
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <AppLayout title="Roles">
      {!canManageRoles ? (
        <AccessDenied />
      ) : isLoading ? (
        <RolesSkeleton />
      ) : error ? (
        <section className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-ui-border/70">
          <h2 className="text-2xl font-extrabold text-ui-text-primary">
            Unable to Load Roles
          </h2>
          <p className="mt-2 text-sm font-medium text-ui-text-muted">{error}</p>
          <button
            type="button"
            onClick={loadRoles}
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
                Role Management
              </h2>
            </div>
            <Link
              href="/roles/new"
              className="inline-flex items-center justify-center rounded-lg bg-brand-red px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand-red/90"
            >
              Add Role
            </Link>
          </div>

          {roles.length === 0 ? (
            <section className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-ui-border/70">
              <h2 className="text-2xl font-extrabold text-ui-text-primary">
                No roles found
              </h2>
              <p className="mt-2 text-sm font-medium text-ui-text-muted">
                Create a custom role to start assigning permissions.
              </p>
            </section>
          ) : (
            <>
              <div className="hidden overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-ui-border/70 md:block">
                <table className="w-full border-collapse">
                  <thead className="bg-brand-navy text-white">
                    <tr>
                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide">
                        Role Name
                      </th>
                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide">
                        Permissions
                      </th>
                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide">
                        System Role
                      </th>
                      <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {roles.map((role, index) => (
                      <tr
                        key={role.id}
                        className={index % 2 === 0 ? "bg-white" : "bg-ui-row-alt"}
                      >
                        <td className="px-5 py-4 text-sm font-bold text-ui-text-primary">
                          {role.name}
                        </td>
                        <td className="px-5 py-4">
                          <span className="inline-flex rounded-full bg-brand-red/10 px-3 py-1 font-mono text-xs font-bold text-brand-red">
                            {role.permissions.length}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm font-semibold text-ui-text-muted">
                          {role.isSystemRole ? "Yes" : "No"}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2">
                            {!role.isSystemRole ? (
                              <>
                                <Link
                                  href={`/roles/${role.id}/edit`}
                                  className="rounded-lg border border-ui-border px-3 py-2 text-xs font-bold text-ui-text-primary transition hover:border-brand-red hover:text-brand-red"
                                >
                                  Edit
                                </Link>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDeleteError("");
                                    setRoleToDelete(role);
                                  }}
                                  className="rounded-lg border border-status-error px-3 py-2 text-xs font-bold text-status-error transition hover:bg-status-error hover:text-white"
                                >
                                  Delete
                                </button>
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-4 md:hidden">
                {roles.map((role) => (
                  <article
                    key={role.id}
                    className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ui-border/70"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-extrabold text-ui-text-primary">
                          {role.name}
                        </h2>
                        <p className="mt-2 text-sm font-semibold text-ui-text-muted">
                          System Role: {role.isSystemRole ? "Yes" : "No"}
                        </p>
                      </div>
                      <span className="rounded-full bg-brand-red/10 px-3 py-1 font-mono text-xs font-bold text-brand-red">
                        {role.permissions.length}
                      </span>
                    </div>

                    {!role.isSystemRole ? (
                      <div className="mt-5 flex gap-2">
                        <Link
                          href={`/roles/${role.id}/edit`}
                          className="flex-1 rounded-lg border border-ui-border px-3 py-2 text-center text-sm font-bold text-ui-text-primary transition hover:border-brand-red hover:text-brand-red"
                        >
                          Edit
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteError("");
                            setRoleToDelete(role);
                          }}
                          className="flex-1 rounded-lg border border-status-error px-3 py-2 text-sm font-bold text-status-error transition hover:bg-status-error hover:text-white"
                        >
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {roleToDelete ? (
        <DeleteRoleModal
          role={roleToDelete}
          isDeleting={isDeleting}
          error={deleteError}
          onCancel={() => {
            if (!isDeleting) {
              setRoleToDelete(null);
            }
          }}
          onConfirm={handleDeleteRole}
        />
      ) : null}
    </AppLayout>
  );
}

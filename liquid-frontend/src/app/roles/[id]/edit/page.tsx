"use client";

import axios from "axios";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import RoleForm from "@/components/roles/RoleForm";
import { useAuth } from "@/context/AuthContext";
import { getRoleById } from "@/lib/roleApi";
import type { Role } from "@/types/role";

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError<{ message?: string; error?: string }>(error)) {
    return (
      error.response?.data?.message ||
      error.response?.data?.error ||
      "Unable to load role. Please try again."
    );
  }

  return "Unable to load role. Please try again.";
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

function EditRoleSkeleton() {
  return (
    <section className="mx-auto max-w-4xl animate-pulse rounded-2xl bg-white p-6 shadow-sm ring-1 ring-ui-border/70">
      <div className="h-20 rounded-lg bg-ui-row-alt" />
      <div className="mt-8 space-y-5">
        <div className="h-32 rounded-xl bg-ui-row-alt" />
        <div className="h-24 rounded-xl bg-ui-row-alt" />
        <div className="h-32 rounded-xl bg-ui-row-alt" />
      </div>
    </section>
  );
}

export default function EditRolePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [role, setRole] = useState<Role | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const canManageRoles = Boolean(user?.permissions.includes("roles.manage"));
  const roleId = params.id;

  const loadRole = useCallback(async () => {
    setError("");
    setIsLoading(true);

    try {
      const loadedRole = await getRoleById(roleId);

      if (loadedRole.isSystemRole) {
        router.replace("/roles");
        return;
      }

      setRole(loadedRole);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [roleId, router]);

  useEffect(() => {
    if (!canManageRoles) {
      return;
    }

    let isMounted = true;

    getRoleById(roleId)
      .then((loadedRole) => {
        if (!isMounted) {
          return;
        }

        if (loadedRole.isSystemRole) {
          router.replace("/roles");
          return;
        }

        setRole(loadedRole);
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
  }, [canManageRoles, roleId, router]);

  return (
    <AppLayout title="Edit Role">
      {!canManageRoles ? (
        <AccessDenied />
      ) : isLoading ? (
        <EditRoleSkeleton />
      ) : error ? (
        <section className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-ui-border/70">
          <h2 className="text-2xl font-extrabold text-ui-text-primary">
            Unable to Load Role
          </h2>
          <p className="mt-2 text-sm font-medium text-ui-text-muted">{error}</p>
          <button
            type="button"
            onClick={loadRole}
            className="mt-6 rounded-lg bg-brand-red px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-red/90"
          >
            Retry
          </button>
        </section>
      ) : role ? (
        <RoleForm mode="edit" initialRole={role} />
      ) : null}
    </AppLayout>
  );
}

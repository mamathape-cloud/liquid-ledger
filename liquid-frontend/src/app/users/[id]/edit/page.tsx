"use client";

import axios from "axios";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import UserForm from "@/components/users/UserForm";
import { useAuth } from "@/context/AuthContext";
import { getUserById } from "@/lib/userApi";
import type { User } from "@/types/user";

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError<{ message?: string; error?: string }>(error)) {
    return (
      error.response?.data?.message ||
      error.response?.data?.error ||
      "Unable to load user. Please try again."
    );
  }

  return "Unable to load user. Please try again.";
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

function EditUserSkeleton() {
  return (
    <section className="mx-auto max-w-4xl animate-pulse rounded-2xl bg-white p-6 shadow-sm ring-1 ring-ui-border/70">
      <div className="space-y-5">
        <div className="h-20 rounded-lg bg-ui-row-alt" />
        <div className="h-20 rounded-lg bg-ui-row-alt" />
        <div className="h-20 rounded-lg bg-ui-row-alt" />
      </div>
      <div className="mt-8 h-12 rounded-lg bg-ui-row-alt" />
    </section>
  );
}

export default function EditUserPage() {
  const params = useParams<{ id: string }>();
  const { user: currentUser } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const canManageUsers = Boolean(currentUser?.permissions.includes("users.manage"));
  const userId = params.id;

  const loadUser = useCallback(async () => {
    setError("");
    setIsLoading(true);

    try {
      const loadedUser = await getUserById(userId);
      setUser(loadedUser);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!canManageUsers) {
      return;
    }

    let isMounted = true;

    getUserById(userId)
      .then((loadedUser) => {
        if (isMounted) {
          setUser(loadedUser);
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
  }, [canManageUsers, userId]);

  return (
    <AppLayout title="Edit User">
      {!canManageUsers ? (
        <AccessDenied />
      ) : isLoading ? (
        <EditUserSkeleton />
      ) : error ? (
        <section className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-ui-border/70">
          <h2 className="text-2xl font-extrabold text-ui-text-primary">
            Unable to Load User
          </h2>
          <p className="mt-2 text-sm font-medium text-ui-text-muted">{error}</p>
          <button
            type="button"
            onClick={loadUser}
            className="mt-6 rounded-lg bg-brand-red px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-red/90"
          >
            Retry
          </button>
        </section>
      ) : user ? (
        <UserForm mode="edit" initialUser={user} />
      ) : null}
    </AppLayout>
  );
}

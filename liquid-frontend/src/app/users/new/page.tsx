"use client";

import AppLayout from "@/components/layout/AppLayout";
import UserForm from "@/components/users/UserForm";
import { useAuth } from "@/context/AuthContext";

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

export default function CreateUserPage() {
  const { user } = useAuth();
  const canManageUsers = Boolean(user?.permissions.includes("users.manage"));

  return (
    <AppLayout title="Add User">
      {canManageUsers ? <UserForm mode="create" /> : <AccessDenied />}
    </AppLayout>
  );
}

"use client";

import AppLayout from "@/components/layout/AppLayout";
import RoleForm from "@/components/roles/RoleForm";
import { useAuth } from "@/context/AuthContext";

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

export default function CreateRolePage() {
  const { user } = useAuth();
  const canManageRoles = Boolean(user?.permissions.includes("roles.manage"));

  return (
    <AppLayout title="Create Role">
      {canManageRoles ? <RoleForm mode="create" /> : <AccessDenied />}
    </AppLayout>
  );
}

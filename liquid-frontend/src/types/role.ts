export interface Role {
  id: string;
  name: string;
  permissions: string[];
  isSystemRole: boolean;
  createdAt: string;
}

export interface PermissionOption {
  value: string;
  label: string;
  group: "Expenses" | "Administration";
}

export const PERMISSIONS: PermissionOption[] = [
  {
    value: "expenses.create",
    label: "Create Expense Request",
    group: "Expenses",
  },
  {
    value: "expenses.approve",
    label: "Approve / Reject Expenses",
    group: "Expenses",
  },
  {
    value: "expenses.disburse",
    label: "Disburse Payment",
    group: "Expenses",
  },
  {
    value: "expenses.upload_proof",
    label: "Upload Bill Proof",
    group: "Expenses",
  },
  {
    value: "expenses.audit",
    label: "Audit & Settle Expenses",
    group: "Expenses",
  },
  {
    value: "expenses.view_all",
    label: "View All Expenses",
    group: "Expenses",
  },
  {
    value: "expenses.view_own",
    label: "View Own Expenses",
    group: "Expenses",
  },
  {
    value: "users.manage",
    label: "Manage Users",
    group: "Administration",
  },
  {
    value: "roles.manage",
    label: "Manage Roles",
    group: "Administration",
  },
  {
    value: "reports.view",
    label: "View Reports",
    group: "Administration",
  },
];

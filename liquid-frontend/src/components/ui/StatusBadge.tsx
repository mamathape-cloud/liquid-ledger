import { ExpenseStatus } from "@/types/expense";

const statusStyles: Record<ExpenseStatus, string> = {
  [ExpenseStatus.DRAFT]: "bg-ui-text-muted/10 text-ui-text-muted",
  [ExpenseStatus.PENDING]: "bg-status-warning/10 text-status-warning",
  [ExpenseStatus.APPROVED]: "bg-status-info/10 text-status-info",
  [ExpenseStatus.REJECTED]: "bg-status-error/10 text-status-error",
  [ExpenseStatus.DISBURSED]: "bg-status-purple/10 text-status-purple",
  [ExpenseStatus.PROOF_PENDING]: "bg-brand-amber/10 text-brand-amber",
  [ExpenseStatus.AUDIT_PENDING]: "bg-status-teal/10 text-status-teal",
  [ExpenseStatus.SETTLED]: "bg-status-success/10 text-status-success",
  [ExpenseStatus.DISCREPANCY]: "bg-brand-red/10 text-brand-red",
};

const statusLabels: Record<ExpenseStatus, string> = {
  [ExpenseStatus.DRAFT]: "Draft",
  [ExpenseStatus.PENDING]: "Pending",
  [ExpenseStatus.APPROVED]: "Approved",
  [ExpenseStatus.REJECTED]: "Rejected",
  [ExpenseStatus.DISBURSED]: "Disbursed",
  [ExpenseStatus.PROOF_PENDING]: "Proof Pending",
  [ExpenseStatus.AUDIT_PENDING]: "Audit Pending",
  [ExpenseStatus.SETTLED]: "Settled",
  [ExpenseStatus.DISCREPANCY]: "Discrepancy",
};

interface StatusBadgeProps {
  status: ExpenseStatus;
  className?: string;
}

export default function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${statusStyles[status]} ${className}`}
    >
      {status === ExpenseStatus.PROOF_PENDING ? (
        <span
          aria-hidden="true"
          className="relative mr-1 h-3 w-3 rounded-full border-2 border-current before:absolute before:left-1/2 before:top-1/2 before:h-1 before:w-0.5 before:-translate-x-1/2 before:-translate-y-full before:bg-current after:absolute after:left-1/2 after:top-1/2 after:h-0.5 after:w-1 after:-translate-y-1/2 after:bg-current"
        />
      ) : null}
      {statusLabels[status]}
    </span>
  );
}

export { statusLabels };

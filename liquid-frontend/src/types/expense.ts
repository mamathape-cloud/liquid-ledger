export enum ExpenseStatus {
  DRAFT = "DRAFT",
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  DISBURSED = "DISBURSED",
  PROOF_PENDING = "PROOF_PENDING",
  AUDIT_PENDING = "AUDIT_PENDING",
  SETTLED = "SETTLED",
  DISCREPANCY = "DISCREPANCY",
}

export enum ExpenseCategory {
  TRAVEL = "TRAVEL",
  HOTEL = "HOTEL",
  FOOD = "FOOD",
  LOCAL_TRANS = "LOCAL_TRANS",
  EQUIP_LOG = "EQUIP_LOG",
  CONTINGENCY = "CONTINGENCY",
  PETTY_MISC = "PETTY_MISC",
  VENDOR_ADV = "VENDOR_ADV",
  REIMBURSE = "REIMBURSE",
  OTHER = "OTHER",
}

export interface ExpenseEmployee {
  name: string;
  email: string;
}

export interface Expense {
  id: string;
  displayId: string;
  eventId?: string;
  eventName: string;
  category: ExpenseCategory;
  advanceAmount: number | null;
  requestedAmount: number;
  approvedAmount: number | null;
  disbursedAmount: number | null;
  purpose: string;
  requiredDate?: string;
  status: ExpenseStatus;
  employeeId: ExpenseEmployee;
  proofUrls: string[];
  attachmentUrls: string[];
  proofSubmittedAt: string | null;
  disbursedAt: string | null;
  settledAt: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

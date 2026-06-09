import api from "@/lib/api";
import type { Expense, ExpenseCategory, ExpenseStatus } from "@/types/expense";

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export interface CreateExpensePayload {
  eventId: string;
  category: ExpenseCategory;
  requestedAmount: number;
  purpose: string;
  requiredDate: string;
  remarks?: string;
  attachmentUrls?: string[];
  status: ExpenseStatus.DRAFT | ExpenseStatus.PENDING;
}

export interface UpdateExpensePayload {
  eventName: string;
  category: ExpenseCategory;
  requestedAmount: number;
  purpose: string;
  requiredDate: string;
  remarks?: string;
  attachmentUrls?: string[];
}

export interface ExpenseFilters {
  status?: ExpenseStatus | "";
  category?: ExpenseCategory | "";
  search?: string;
  eventId?: string;
  eventName?: string;
  page?: number;
  limit?: number;
}

export interface ExpenseListResponse {
  expenses: Expense[];
  total: number;
  page: number;
  limit: number;
}

export interface ApproveExpensePayload {
  approvedAmount: number;
  notes?: string;
}

export interface RejectExpensePayload {
  reason: string;
}

export interface DisburseExpensePayload {
  disbursedAmount: number;
}

export interface AuditExpensePayload {
  status: ExpenseStatus.SETTLED | ExpenseStatus.DISCREPANCY;
  notes?: string;
}

export interface UpdateExpenseStatusPayload {
  status: ExpenseStatus;
  approvedAmount?: number;
  disbursedAmount?: number;
  notes?: string;
  proofUrls?: string[];
}

export async function createExpense(
  payload: CreateExpensePayload,
): Promise<Expense> {
  const response = await api.post<ApiResponse<Expense>>("/expenses", payload);

  return response.data.data;
}

export async function submitExpense(id: string): Promise<Expense> {
  const response = await api.patch<ApiResponse<Expense>>(`/expenses/${id}/submit`);

  return response.data.data;
}

export async function updateExpenseStatus(
  id: string,
  payload: UpdateExpenseStatusPayload,
): Promise<Expense> {
  const response = await api.patch<ApiResponse<Expense>>(
    `/expenses/${id}/status`,
    payload,
  );

  return response.data.data;
}

export async function getExpenses(
  filters: ExpenseFilters = {},
): Promise<ExpenseListResponse> {
  const response = await api.get<
    ApiResponse<ExpenseListResponse | Expense[]>
  >("/expenses", {
    params: filters,
  });
  const payload = response.data.data;

  if (Array.isArray(payload)) {
    return {
      expenses: payload,
      total: payload.length,
      page: filters.page || 1,
      limit: filters.limit || payload.length,
    };
  }

  return payload;
}

export async function getExpenseById(id: string): Promise<Expense> {
  const response = await api.get<ApiResponse<Expense>>(`/expenses/${id}`);

  return response.data.data;
}

export async function updateExpense(
  id: string,
  payload: UpdateExpensePayload,
): Promise<Expense> {
  const response = await api.put<ApiResponse<Expense>>(`/expenses/${id}`, payload);

  return response.data.data;
}

export async function approveExpense(
  id: string,
  payload: ApproveExpensePayload,
): Promise<Expense> {
  const response = await api.patch<ApiResponse<Expense>>(
    `/expenses/${id}/approve`,
    payload,
  );

  return response.data.data;
}

export async function rejectExpense(
  id: string,
  payload: RejectExpensePayload,
): Promise<Expense> {
  const response = await api.patch<ApiResponse<Expense>>(
    `/expenses/${id}/reject`,
    payload,
  );

  return response.data.data;
}

export async function disburseExpense(
  id: string,
  payload: DisburseExpensePayload,
): Promise<Expense> {
  const response = await api.patch<ApiResponse<Expense>>(
    `/expenses/${id}/disburse`,
    payload,
  );

  return response.data.data;
}

export async function uploadProof(id: string, files: File[]): Promise<Expense> {
  const uploadedProofUrls = await uploadFiles(files);

  const response = await api.patch<ApiResponse<Expense>>(`/expenses/${id}/proof`, {
    proofUrls: uploadedProofUrls,
  });

  return response.data.data;
}

export async function uploadFiles(files: File[]): Promise<string[]> {
  const formData = new FormData();

  files.forEach((file) => {
    formData.append("files", file);
  });

  const response = await api.post<ApiResponse<{ urls: string[] }>>(
    "/upload/proof",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    },
  );

  return response.data.data.urls;
}

export async function auditExpense(
  id: string,
  payload: AuditExpensePayload,
): Promise<Expense> {
  const response = await api.patch<ApiResponse<Expense>>(
    `/expenses/${id}/audit`,
    payload,
  );

  return response.data.data;
}

export async function deleteExpense(id: string): Promise<void> {
  await api.delete(`/expenses/${id}`);
}

import api from "@/lib/api";
import type { Role } from "@/types/role";

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export interface RolePayload {
  name: string;
  permissions: string[];
}

export async function getRoles(): Promise<Role[]> {
  const response = await api.get<ApiResponse<Role[]>>("/roles");

  return response.data.data;
}

export async function getRoleById(id: string): Promise<Role> {
  const response = await api.get<ApiResponse<Role>>(`/roles/${id}`);

  return response.data.data;
}

export async function createRole(payload: RolePayload): Promise<Role> {
  const response = await api.post<ApiResponse<Role>>("/roles", payload);

  return response.data.data;
}

export async function updateRole(
  id: string,
  payload: RolePayload,
): Promise<Role> {
  const response = await api.put<ApiResponse<Role>>(`/roles/${id}`, payload);

  return response.data.data;
}

export async function deleteRole(id: string): Promise<void> {
  await api.delete(`/roles/${id}`);
}

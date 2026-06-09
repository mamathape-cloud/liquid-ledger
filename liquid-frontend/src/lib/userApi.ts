import api from "@/lib/api";
import type { User } from "@/types/user";

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export interface CreateUserPayload {
  name: string;
  username: string;
  email: string;
  phone: string;
  roleId: string;
}

export interface UpdateUserPayload {
  name?: string;
  username?: string;
  phone?: string;
  roleId?: string;
}

export interface ResetPasswordResult {
  id: string;
  name: string;
  email: string;
  username: string;
  temporaryPassword: string;
}

export async function getUsers(): Promise<User[]> {
  const response = await api.get<ApiResponse<User[]>>("/users");

  return response.data.data;
}

export async function getUserById(id: string): Promise<User> {
  const response = await api.get<ApiResponse<User>>(`/users/${id}`);

  return response.data.data;
}

export async function createUser(payload: CreateUserPayload): Promise<User> {
  const response = await api.post<ApiResponse<User>>("/users", payload);

  return response.data.data;
}

export async function updateUser(
  id: string,
  payload: UpdateUserPayload,
): Promise<User> {
  const response = await api.put<ApiResponse<User>>(`/users/${id}`, payload);

  return response.data.data;
}

export async function deleteUser(id: string): Promise<void> {
  await api.delete(`/users/${id}`);
}

export async function resetPassword(id: string): Promise<ResetPasswordResult> {
  const response = await api.post<ApiResponse<ResetPasswordResult>>(
    `/users/${id}/reset-password`,
  );

  return response.data.data;
}

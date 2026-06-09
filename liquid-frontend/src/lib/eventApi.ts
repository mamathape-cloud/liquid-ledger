import api from "@/lib/api";
import type { EventEmployeeOption, FinanceEvent } from "@/types/event";

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export interface EventAllocationPayload {
  employeeId: string;
  allocatedAmount: number;
}

export interface UpsertEventPayload {
  eventName: string;
  description?: string;
  allocations: EventAllocationPayload[];
}

export async function getEvents(): Promise<FinanceEvent[]> {
  const response = await api.get<ApiResponse<FinanceEvent[]>>("/events");

  return response.data.data;
}

export async function getAssignedEvents(): Promise<FinanceEvent[]> {
  const response = await api.get<ApiResponse<FinanceEvent[]>>("/events/assigned");

  return response.data.data;
}

export async function getEventEmployees(): Promise<EventEmployeeOption[]> {
  const response = await api.get<ApiResponse<EventEmployeeOption[]>>(
    "/events/employees",
  );

  return response.data.data;
}

export async function createEvent(payload: UpsertEventPayload): Promise<FinanceEvent> {
  const response = await api.post<ApiResponse<FinanceEvent>>("/events", payload);

  return response.data.data;
}

export async function updateEvent(
  id: string,
  payload: UpsertEventPayload,
): Promise<FinanceEvent> {
  const response = await api.put<ApiResponse<FinanceEvent>>(`/events/${id}`, payload);

  return response.data.data;
}

export async function deleteEvent(id: string): Promise<void> {
  await api.delete(`/events/${id}`);
}

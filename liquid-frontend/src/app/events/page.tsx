"use client";

import axios from "axios";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/context/AuthContext";
import {
  createEvent,
  deleteEvent,
  getEventEmployees,
  getEvents,
  updateEvent,
} from "@/lib/eventApi";
import type { EventEmployeeOption, FinanceEvent } from "@/types/event";

interface AllocationDraft {
  employeeId: string;
  allocatedAmount: string;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<{ message?: string; error?: string }>(error)) {
    return error.response?.data?.message || error.response?.data?.error || fallback;
  }

  return fallback;
}

function formatMoney(amount: number | null | undefined): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(amount || 0);
}

function EventsSkeleton() {
  return (
    <section className="animate-pulse rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ui-border/70">
      <div className="h-9 w-48 rounded bg-ui-border" />
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="h-80 rounded bg-ui-row-alt" />
        <div className="h-80 rounded bg-ui-row-alt" />
      </div>
    </section>
  );
}

function AccessDenied() {
  return (
    <section className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-ui-border/70">
      <h2 className="text-2xl font-extrabold text-ui-text-primary">Access Denied</h2>
      <p className="mt-2 text-sm font-medium text-ui-text-muted">
        You do not have permission to manage finance events.
      </p>
    </section>
  );
}

function EmptyState() {
  return (
    <section className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-ui-border/70">
      <h2 className="text-2xl font-extrabold text-ui-text-primary">
        No events created yet
      </h2>
      <p className="mt-2 text-sm font-medium text-ui-text-muted">
        Create an event and assign employees with an advance amount.
      </p>
    </section>
  );
}

export default function EventsPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<FinanceEvent[]>([]);
  const [employees, setEmployees] = useState<EventEmployeeOption[]>([]);
  const [eventName, setEventName] = useState("");
  const [description, setDescription] = useState("");
  const [allocations, setAllocations] = useState<AllocationDraft[]>([
    { employeeId: "", allocatedAmount: "" },
  ]);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FinanceEvent | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const permissions = user?.permissions || [];
  const canManageEvents =
    permissions.includes("expenses.view_all") ||
    permissions.includes("expenses.disburse");
  const availableEmployees = useMemo(
    () =>
      employees.filter(
        (employee) =>
          !allocations.some((allocation) => allocation.employeeId === employee.id),
      ),
    [allocations, employees],
  );

  const loadPageData = useCallback(async () => {
    if (!canManageEvents) {
      setIsLoading(false);
      return;
    }

    setLoadError("");
    setIsLoading(true);

    try {
      const [loadedEvents, loadedEmployees] = await Promise.all([
        getEvents(),
        getEventEmployees(),
      ]);

      setEvents(loadedEvents);
      setEmployees(loadedEmployees);
    } catch (error) {
      setLoadError(getErrorMessage(error, "Unable to load events. Please try again."));
    } finally {
      setIsLoading(false);
    }
  }, [canManageEvents]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadPageData();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadPageData]);

  function resetForm() {
    setEventName("");
    setDescription("");
    setAllocations([{ employeeId: "", allocatedAmount: "" }]);
    setEditingEventId(null);
    setErrors({});
    setSubmitError("");
  }

  function handleAllocationChange(
    index: number,
    field: keyof AllocationDraft,
    value: string,
  ) {
    setAllocations((currentAllocations) =>
      currentAllocations.map((allocation, currentIndex) =>
        currentIndex === index ? { ...allocation, [field]: value } : allocation,
      ),
    );
  }

  function addAllocationRow() {
    setAllocations((currentAllocations) => [
      ...currentAllocations,
      { employeeId: "", allocatedAmount: "" },
    ]);
  }

  function removeAllocationRow(index: number) {
    setAllocations((currentAllocations) =>
      currentAllocations.length === 1
        ? currentAllocations
        : currentAllocations.filter((_, currentIndex) => currentIndex !== index),
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setSubmitError("");

    const nextErrors: Record<string, string> = {};
    const trimmedEventName = eventName.trim();
    const selectedEmployeeIds = new Set<string>();
    const payloadAllocations = allocations
      .filter((allocation) => allocation.employeeId || allocation.allocatedAmount)
      .map((allocation) => ({
        employeeId: allocation.employeeId,
        allocatedAmount: Number(allocation.allocatedAmount),
      }));

    if (!trimmedEventName) {
      nextErrors.eventName = "Event name is required.";
    }

    if (payloadAllocations.length === 0) {
      nextErrors.allocations = "Add at least one employee allocation.";
    }

    payloadAllocations.forEach((allocation, index) => {
      if (!allocation.employeeId) {
        nextErrors[`employee-${index}`] = "Select an employee.";
      }

      if (
        !Number.isFinite(allocation.allocatedAmount) ||
        allocation.allocatedAmount <= 0
      ) {
        nextErrors[`amount-${index}`] = "Enter an amount greater than zero.";
      }

      if (selectedEmployeeIds.has(allocation.employeeId)) {
        nextErrors.allocations = "Each employee can be assigned only once.";
      }

      selectedEmployeeIds.add(allocation.employeeId);
    });

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        eventName: trimmedEventName,
        description: description.trim() || undefined,
        allocations: payloadAllocations.map((allocation) => ({
          employeeId: allocation.employeeId,
          allocatedAmount: Number(allocation.allocatedAmount.toFixed(2)),
        })),
      };
      const savedEvent = editingEventId
        ? await updateEvent(editingEventId, payload)
        : await createEvent(payload);

      setEvents((currentEvents) =>
        editingEventId
          ? currentEvents.map((financeEvent) =>
              financeEvent.id === savedEvent.id ? savedEvent : financeEvent,
            )
          : [savedEvent, ...currentEvents],
      );
      resetForm();
    } catch (error) {
      setSubmitError(getErrorMessage(error, "Unable to save event. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  }

  function startEditing(financeEvent: FinanceEvent) {
    setEventName(financeEvent.eventName);
    setDescription(financeEvent.description);
    setAllocations(
      financeEvent.allocations.map((allocation) => ({
        employeeId: allocation.employee.id,
        allocatedAmount: String(allocation.allocatedAmount),
      })),
    );
    setEditingEventId(financeEvent.id);
    setErrors({});
    setSubmitError("");
  }

  async function handleDeleteEvent() {
    if (!deleteTarget) {
      return;
    }

    setDeleteError("");
    setIsDeleting(true);

    try {
      await deleteEvent(deleteTarget.id);
      setEvents((currentEvents) =>
        currentEvents.filter((financeEvent) => financeEvent.id !== deleteTarget.id),
      );
      setDeleteTarget(null);
      if (editingEventId === deleteTarget.id) {
        resetForm();
      }
    } catch (error) {
      setDeleteError(getErrorMessage(error, "Unable to delete event. Please try again."));
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <AppLayout title="Events">
      {!canManageEvents ? (
        <AccessDenied />
      ) : isLoading ? (
        <EventsSkeleton />
      ) : loadError ? (
        <section className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-ui-border/70">
          <h1 className="text-2xl font-extrabold text-ui-text-primary">
            Unable to Load Events
          </h1>
          <p className="mt-2 text-sm font-medium text-ui-text-muted">{loadError}</p>
          <button
            type="button"
            onClick={loadPageData}
            className="mt-6 rounded-lg bg-brand-red px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-red/90"
          >
            Retry
          </button>
        </section>
      ) : (
        <section className="space-y-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-red">
              Finance
            </p>
            <h1 className="mt-2 text-3xl font-extrabold text-ui-text-primary">
              Events
            </h1>
          </div>

          <form
            onSubmit={handleSubmit}
            className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ui-border/70"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-extrabold text-ui-text-primary">
                  {editingEventId ? "Edit Event" : "Create Event"}
                </h2>
                <p className="mt-1 text-sm font-medium text-ui-text-muted">
                  Assign employees and allocate an amount to spend.
                </p>
              </div>
              {editingEventId ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg border border-ui-border px-4 py-2 text-sm font-bold text-ui-text-primary transition hover:border-brand-red hover:text-brand-red"
                >
                  Cancel Edit
                </button>
              ) : null}
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <label
                  htmlFor="eventName"
                  className="mb-2 block text-sm font-semibold text-ui-text-primary"
                >
                  Event Name <span className="text-status-error">*</span>
                </label>
                <input
                  id="eventName"
                  type="text"
                  value={eventName}
                  onChange={(event) => setEventName(event.target.value)}
                  className={`w-full rounded-lg border px-4 py-3 text-ui-text-primary outline-none transition focus:border-brand-red focus:ring-2 focus:ring-brand-red/20 ${
                    errors.eventName ? "border-status-error" : "border-ui-border"
                  }`}
                  placeholder="Enter event name"
                />
                {errors.eventName ? (
                  <p className="mt-2 text-sm font-medium text-status-error">
                    {errors.eventName}
                  </p>
                ) : null}
              </div>

              <div>
                <label
                  htmlFor="eventDescription"
                  className="mb-2 block text-sm font-semibold text-ui-text-primary"
                >
                  Description
                </label>
                <input
                  id="eventDescription"
                  type="text"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="w-full rounded-lg border border-ui-border px-4 py-3 text-ui-text-primary outline-none transition focus:border-brand-red focus:ring-2 focus:ring-brand-red/20"
                  placeholder="Optional event note"
                />
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-extrabold uppercase tracking-wide text-ui-text-muted">
                  Employee Allocations
                </h3>
                <button
                  type="button"
                  onClick={addAllocationRow}
                  disabled={availableEmployees.length === 0}
                  className="rounded-lg border border-brand-red px-3 py-2 text-xs font-bold text-brand-red transition hover:bg-brand-red hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Add Employee
                </button>
              </div>

              {allocations.map((allocation, index) => (
                <div
                  key={`${allocation.employeeId}-${index}`}
                  className="grid gap-3 rounded-xl bg-ui-row-alt p-3 md:grid-cols-[1fr_220px_auto]"
                >
                  <div>
                    <select
                      value={allocation.employeeId}
                      onChange={(event) =>
                        handleAllocationChange(index, "employeeId", event.target.value)
                      }
                      className={`w-full rounded-lg border px-3 py-2.5 text-sm font-semibold text-ui-text-primary outline-none transition focus:border-brand-red focus:ring-2 focus:ring-brand-red/20 ${
                        errors[`employee-${index}`]
                          ? "border-status-error"
                          : "border-ui-border"
                      }`}
                    >
                      <option value="">Select employee</option>
                      {employees
                        .filter(
                          (employee) =>
                            employee.id === allocation.employeeId ||
                            !allocations.some(
                              (currentAllocation, currentIndex) =>
                                currentIndex !== index &&
                                currentAllocation.employeeId === employee.id,
                            ),
                        )
                        .map((employee) => (
                          <option key={employee.id} value={employee.id}>
                            {employee.name} ({employee.email})
                          </option>
                        ))}
                    </select>
                    {errors[`employee-${index}`] ? (
                      <p className="mt-2 text-sm font-medium text-status-error">
                        {errors[`employee-${index}`]}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <div
                      className={`flex rounded-lg border bg-white transition focus-within:border-brand-red focus-within:ring-2 focus-within:ring-brand-red/20 ${
                        errors[`amount-${index}`]
                          ? "border-status-error"
                          : "border-ui-border"
                      }`}
                    >
                      <span className="flex items-center rounded-l-lg bg-ui-row-alt px-3 font-mono text-sm font-bold text-ui-text-muted">
                        ₹
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={allocation.allocatedAmount}
                        onChange={(event) =>
                          handleAllocationChange(
                            index,
                            "allocatedAmount",
                            event.target.value,
                          )
                        }
                        className="w-full rounded-r-lg px-3 py-2.5 font-mono text-sm text-ui-text-primary outline-none"
                        placeholder="0.00"
                      />
                    </div>
                    {errors[`amount-${index}`] ? (
                      <p className="mt-2 text-sm font-medium text-status-error">
                        {errors[`amount-${index}`]}
                      </p>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={() => removeAllocationRow(index)}
                    disabled={allocations.length === 1}
                    className="rounded-lg border border-status-error px-3 py-2 text-sm font-bold text-status-error transition hover:bg-status-error hover:text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-status-error"
                  >
                    Remove
                  </button>
                </div>
              ))}

              {errors.allocations ? (
                <p className="text-sm font-medium text-status-error">
                  {errors.allocations}
                </p>
              ) : null}
            </div>

            {submitError ? (
              <p className="mt-5 rounded-lg bg-status-error/10 px-4 py-3 text-sm font-medium text-status-error">
                {submitError}
              </p>
            ) : null}

            <div className="mt-6 flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting || employees.length === 0}
                className="inline-flex items-center justify-center rounded-lg bg-brand-red px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand-red/90 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? (
                  <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                ) : null}
                {isSubmitting ? "Saving..." : editingEventId ? "Update Event" : "Create Event"}
              </button>
            </div>
          </form>

          {events.length === 0 ? (
            <EmptyState />
          ) : (
            <section className="grid gap-4 xl:grid-cols-2">
              {events.map((financeEvent) => (
                <article
                  key={financeEvent.id}
                  className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ui-border/70"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-xl font-extrabold text-ui-text-primary">
                        {financeEvent.eventName}
                      </h2>
                      {financeEvent.description ? (
                        <p className="mt-1 text-sm font-medium text-ui-text-muted">
                          {financeEvent.description}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => startEditing(financeEvent)}
                        className="rounded-lg border border-ui-border px-3 py-2 text-xs font-bold text-ui-text-primary transition hover:border-brand-red hover:text-brand-red"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteError("");
                          setDeleteTarget(financeEvent);
                        }}
                        className="rounded-lg border border-status-error px-3 py-2 text-xs font-bold text-status-error transition hover:bg-status-error hover:text-white"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 overflow-hidden rounded-xl border border-ui-border">
                    <table className="w-full border-collapse">
                      <thead className="bg-brand-navy text-white">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                            Employee
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide">
                            Allocated
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide">
                            Claimed
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide">
                            Difference
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {financeEvent.allocations.map((allocation, index) => (
                          <tr
                            key={allocation.employee.id}
                            className={index % 2 === 0 ? "bg-white" : "bg-ui-row-alt"}
                          >
                            <td className="px-4 py-3">
                              <p className="text-sm font-bold text-ui-text-primary">
                                {allocation.employee.name}
                              </p>
                              <p className="font-mono text-xs text-ui-text-muted">
                                {allocation.employee.email}
                              </p>
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-sm font-semibold text-ui-text-primary">
                              {formatMoney(allocation.allocatedAmount)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-sm font-semibold text-ui-text-primary">
                              {formatMoney(allocation.claimedAmount)}
                            </td>
                            <td
                              className={`px-4 py-3 text-right font-mono text-sm font-extrabold ${
                                allocation.differenceAmount < 0
                                  ? "text-status-error"
                                  : "text-status-success"
                              }`}
                            >
                              {allocation.differenceAmount >= 0 ? "+" : ""}
                              {formatMoney(allocation.differenceAmount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </article>
              ))}
            </section>
          )}
        </section>
      )}

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/50 px-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="deleteEventTitle"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <h2 id="deleteEventTitle" className="text-xl font-extrabold text-ui-text-primary">
              Delete Event
            </h2>
            <p className="mt-3 text-sm font-medium text-ui-text-muted">
              Are you sure you want to delete {deleteTarget.eventName}? Existing
              expenses will remain in reports.
            </p>
            {deleteError ? (
              <p className="mt-4 rounded-lg bg-status-error/10 px-4 py-3 text-sm font-medium text-status-error">
                {deleteError}
              </p>
            ) : null}
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  if (!isDeleting) {
                    setDeleteTarget(null);
                  }
                }}
                disabled={isDeleting}
                className="rounded-lg border border-ui-border px-5 py-3 text-sm font-bold text-ui-text-primary transition hover:border-brand-red hover:text-brand-red disabled:cursor-not-allowed disabled:opacity-70"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteEvent}
                disabled={isDeleting}
                className="inline-flex items-center justify-center rounded-lg bg-status-error px-5 py-3 text-sm font-bold text-white transition hover:bg-status-error/90 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isDeleting ? (
                  <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                ) : null}
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </AppLayout>
  );
}

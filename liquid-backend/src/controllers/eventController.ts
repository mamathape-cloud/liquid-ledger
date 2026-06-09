import express = require("express");
import mongoose = require("mongoose");
import Event = require("../models/Event");
import Expense = require("../models/Expense");
import Role = require("../models/Role");
import User = require("../models/User");

interface AllocationInput {
  employeeId: string;
  allocatedAmount: number;
}

interface ClaimedSummary {
  _id: {
    eventId: mongoose.Types.ObjectId;
    employeeId: mongoose.Types.ObjectId;
  };
  claimedAmount: number;
}

function getValidObjectId(id: unknown): mongoose.Types.ObjectId | null {
  if (typeof id !== "string" || !mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }

  return new mongoose.Types.ObjectId(id);
}

function formatEmployee(employee: any) {
  return {
    id: employee._id.toString(),
    name: employee.name,
    email: employee.email,
    role: employee.roleId
      ? {
          id: employee.roleId._id.toString(),
          name: employee.roleId.name,
        }
      : undefined,
  };
}

async function getClaimedAmountMap(
  eventIds: mongoose.Types.ObjectId[],
): Promise<Map<string, number>> {
  if (eventIds.length === 0) {
    return new Map();
  }

  const summaries = await Expense.aggregate<ClaimedSummary>([
    {
      $match: {
        eventId: { $in: eventIds },
        isDeleted: false,
        status: { $ne: "REJECTED" },
      },
    },
    {
      $group: {
        _id: {
          eventId: "$eventId",
          employeeId: "$employeeId",
        },
        claimedAmount: { $sum: "$requestedAmount" },
      },
    },
  ]);

  return new Map(
    summaries.map((summary) => [
      `${summary._id.eventId.toString()}:${summary._id.employeeId.toString()}`,
      Number(summary.claimedAmount.toFixed(2)),
    ]),
  );
}

function formatEvent(event: any, claimedAmountMap: Map<string, number>) {
  return {
    id: event._id.toString(),
    eventName: event.eventName,
    description: event.description || "",
    allocations: event.allocations.map((allocation: any) => {
      const employee = allocation.employeeId;
      const employeeId =
        typeof employee === "object" && employee?._id
          ? employee._id.toString()
          : employee.toString();
      const claimedAmount =
        claimedAmountMap.get(`${event._id.toString()}:${employeeId}`) || 0;
      const allocatedAmount = Number(allocation.allocatedAmount || 0);

      return {
        employee:
          typeof employee === "object" && employee?._id
            ? {
                id: employee._id.toString(),
                name: employee.name,
                email: employee.email,
              }
            : { id: employeeId, name: "Employee", email: "" },
        allocatedAmount,
        claimedAmount,
        differenceAmount: Number((allocatedAmount - claimedAmount).toFixed(2)),
      };
    }),
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
  };
}

function parseAllocations(value: unknown): AllocationInput[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const seenEmployeeIds = new Set<string>();
  const allocations: AllocationInput[] = [];

  for (const item of value) {
    if (
      !item ||
      typeof item !== "object" ||
      typeof (item as { employeeId?: unknown }).employeeId !== "string"
    ) {
      return null;
    }

    const employeeId = (item as { employeeId: string }).employeeId;
    const allocatedAmount = Number(
      (item as { allocatedAmount?: unknown }).allocatedAmount,
    );

    if (
      !mongoose.Types.ObjectId.isValid(employeeId) ||
      !Number.isFinite(allocatedAmount) ||
      allocatedAmount <= 0 ||
      seenEmployeeIds.has(employeeId)
    ) {
      return null;
    }

    seenEmployeeIds.add(employeeId);
    allocations.push({
      employeeId,
      allocatedAmount: Number(allocatedAmount.toFixed(2)),
    });
  }

  return allocations;
}

async function validateEmployees(allocations: AllocationInput[]): Promise<boolean> {
  const employeeIds = allocations.map(
    (allocation) => new mongoose.Types.ObjectId(allocation.employeeId),
  );
  const employeeCount = await User.countDocuments({
    _id: { $in: employeeIds },
    isDeleted: false,
  });

  return employeeCount === employeeIds.length;
}

const getEvents: express.RequestHandler = async (_req, res): Promise<void> => {
  const events = await Event.find({ isDeleted: false })
    .populate("allocations.employeeId", "name email")
    .sort({ createdAt: -1 });
  const claimedAmountMap = await getClaimedAmountMap(
    events.map((event) => event._id as mongoose.Types.ObjectId),
  );

  res.json({
    success: true,
    data: events.map((event) => formatEvent(event, claimedAmountMap)),
  });
};

const getAssignedEvents: express.RequestHandler = async (req, res): Promise<void> => {
  const employeeId = getValidObjectId(req.user?.id);

  if (!employeeId) {
    res.status(401).json({ success: false, message: "Authentication required" });
    return;
  }

  const events = await Event.find({
    isDeleted: false,
    "allocations.employeeId": employeeId,
  })
    .populate("allocations.employeeId", "name email")
    .sort({ eventName: 1 });
  const claimedAmountMap = await getClaimedAmountMap(
    events.map((event) => event._id as mongoose.Types.ObjectId),
  );

  res.json({
    success: true,
    data: events
      .map((event) => formatEvent(event, claimedAmountMap))
      .map((event) => ({
        ...event,
        allocations: event.allocations.filter(
          (allocation: { employee: { id: string } }) =>
            allocation.employee.id === employeeId.toString(),
        ),
      })),
  });
};

const createEvent: express.RequestHandler = async (req, res): Promise<void> => {
  try {
    const { eventName, description, allocations } = req.body;

    if (typeof eventName !== "string" || !eventName.trim()) {
      res.status(400).json({ success: false, message: "Event name is required" });
      return;
    }

    if (description !== undefined && typeof description !== "string") {
      res.status(400).json({ success: false, message: "Description must be a string" });
      return;
    }

    const parsedAllocations = parseAllocations(allocations);

    if (!parsedAllocations) {
      res.status(400).json({
        success: false,
        message: "At least one employee allocation with an amount greater than 0 is required",
      });
      return;
    }

    if (!(await validateEmployees(parsedAllocations))) {
      res.status(400).json({ success: false, message: "One or more employees were not found" });
      return;
    }

    const event = await Event.create({
      eventName: eventName.trim(),
      description: description?.trim(),
      allocations: parsedAllocations.map((allocation) => ({
        employeeId: new mongoose.Types.ObjectId(allocation.employeeId),
        allocatedAmount: allocation.allocatedAmount,
      })),
    });

    await event.populate("allocations.employeeId", "name email");

    res.status(201).json({
      success: true,
      data: formatEvent(event, new Map()),
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes("duplicate")
        ? "Event name already exists"
        : "Unable to create event";

    res.status(400).json({ success: false, message });
  }
};

const updateEvent: express.RequestHandler = async (req, res): Promise<void> => {
  try {
    const eventId = getValidObjectId(req.params.id);
    const { eventName, description, allocations } = req.body;

    if (!eventId) {
      res.status(404).json({ success: false, message: "Event not found" });
      return;
    }

    const event = await Event.findOne({ _id: eventId, isDeleted: false });

    if (!event) {
      res.status(404).json({ success: false, message: "Event not found" });
      return;
    }

    if (eventName !== undefined) {
      if (typeof eventName !== "string" || !eventName.trim()) {
        res.status(400).json({ success: false, message: "Event name is required" });
        return;
      }

      event.eventName = eventName.trim();
    }

    if (description !== undefined) {
      if (typeof description !== "string") {
        res.status(400).json({ success: false, message: "Description must be a string" });
        return;
      }

      event.description = description.trim();
    }

    if (allocations !== undefined) {
      const parsedAllocations = parseAllocations(allocations);

      if (!parsedAllocations) {
        res.status(400).json({
          success: false,
          message: "At least one employee allocation with an amount greater than 0 is required",
        });
        return;
      }

      if (!(await validateEmployees(parsedAllocations))) {
        res.status(400).json({ success: false, message: "One or more employees were not found" });
        return;
      }

      event.allocations = parsedAllocations.map((allocation) => ({
        employeeId: new mongoose.Types.ObjectId(allocation.employeeId),
        allocatedAmount: allocation.allocatedAmount,
      }));
    }

    await event.save();
    await event.populate("allocations.employeeId", "name email");

    const claimedAmountMap = await getClaimedAmountMap([event._id as mongoose.Types.ObjectId]);

    res.json({ success: true, data: formatEvent(event, claimedAmountMap) });
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes("duplicate")
        ? "Event name already exists"
        : "Unable to update event";

    res.status(400).json({ success: false, message });
  }
};

const deleteEvent: express.RequestHandler = async (req, res): Promise<void> => {
  const eventId = getValidObjectId(req.params.id);

  if (!eventId) {
    res.status(404).json({ success: false, message: "Event not found" });
    return;
  }

  const event = await Event.findOne({ _id: eventId, isDeleted: false });

  if (!event) {
    res.status(404).json({ success: false, message: "Event not found" });
    return;
  }

  event.isDeleted = true;
  await event.save();

  res.json({ success: true, message: "Event deleted" });
};

const getEmployees: express.RequestHandler = async (_req, res): Promise<void> => {
  const employeeRole = await Role.findOne({ name: "Employee", isDeleted: false });
  const filters: Record<string, unknown> = { isDeleted: false };

  if (employeeRole) {
    filters.roleId = employeeRole._id;
  }

  const employees = await User.find(filters)
    .select("-password")
    .populate("roleId", "name")
    .sort({ name: 1 });

  res.json({ success: true, data: employees.map(formatEmployee) });
};

export = {
  getEvents,
  getAssignedEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  getEmployees,
};

import mongoose = require("mongoose");

interface IEventAllocation {
  employeeId: mongoose.Types.ObjectId;
  allocatedAmount: number;
}

interface IEvent extends mongoose.Document {
  eventName: string;
  description?: string;
  allocations: IEventAllocation[];
  isDeleted: boolean;
}

const eventAllocationSchema = new mongoose.Schema<IEventAllocation>(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    allocatedAmount: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    _id: false,
  },
);

const eventSchema = new mongoose.Schema<IEvent>(
  {
    eventName: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    allocations: {
      type: [eventAllocationSchema],
      default: [],
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    strict: true,
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        const event = ret as Record<string, unknown>;
        delete event._id;
        delete event.__v;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: (_doc, ret) => {
        const event = ret as Record<string, unknown>;
        delete event._id;
        delete event.__v;
        return ret;
      },
    },
  },
);

eventSchema.virtual("id").get(function (this: IEvent) {
  return this._id.toString();
});

eventSchema.index(
  { eventName: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);

function excludeDeleted(this: mongoose.Query<unknown, unknown>): void {
  this.where({ isDeleted: { $ne: true } });
}

eventSchema.pre("find", excludeDeleted);
eventSchema.pre("findOne", excludeDeleted);
eventSchema.pre("findOneAndUpdate", excludeDeleted);

const Event = mongoose.model<IEvent>("Event", eventSchema);

export = Event;

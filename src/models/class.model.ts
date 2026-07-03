import { Schema, model, Types } from "mongoose";

export type RecurrenceType = "none" | "daily" | "weekly" | "monthly";

export type DayOfWeek =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export interface IClass {
  name: string;
  description?: string;
  schedule: Date;
  duration: number;
  recurrence: RecurrenceType;
  recurrenceDays?: DayOfWeek[]; // ✅
  trainer?: Types.ObjectId;
  members: Types.ObjectId[];
  pricing: {
    oneTime?: number;
    weekly?: number;
    monthly?: number;
    quarterly?: number;
    biannual?: number;
    yearly?: number;
  };
  capacity?: number;
}

const classSchema = new Schema<IClass>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String },
    schedule: { type: Date, required: true },
    duration: { type: Number, required: true, default: 60 },
    recurrence: {
      type: String,
      enum: ["none", "daily", "weekly", "monthly"],
      default: "none",
      required: true,
    },
    recurrenceDays: [
      {
        // ✅
        type: String,
        enum: [
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
          "saturday",
          "sunday",
        ],
      },
    ],
    pricing: {
      oneTime: { type: Number, min: 0 },
      weekly: { type: Number, min: 0 },
      monthly: { type: Number, min: 0 },
      quarterly: { type: Number, min: 0 },
      biannual: { type: Number, min: 0 },
      yearly: { type: Number, min: 0 },
    },
    capacity: {
      type: Number,
      min: 1,
      default: null,
    },
    trainer: {
      type: Schema.Types.ObjectId,
      ref: "TrainerProfile",
    },
    members: [
      {
        type: Schema.Types.ObjectId,
        ref: "MemberProfile",
      },
    ],
  },
  { timestamps: true },
);

classSchema.index(
  { _id: 1, members: 1 },
  { unique: true, partialFilterExpression: { members: { $exists: true } } },
);

export default model<IClass>("Class", classSchema);

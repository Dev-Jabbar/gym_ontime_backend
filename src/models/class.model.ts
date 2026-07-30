import { Schema, model, Types } from "mongoose";

export type RecurrenceType = "none" | "daily" | "weekly" | "monthly";

export interface IPendingMember {
  member: Types.ObjectId; // MemberProfile id — same as `members` uses
  expiresAt: Date; // hold auto-releases after this time
}

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
  pendingMembers?: IPendingMember[];
  pricing: {
    oneTime?: number;
    weekly?: number;
    monthly?: number;
    threeMonths?: number;
  };
  capacity?: number;
  // ✅ Optional banner image (Cloudinary URL). A class card shows a
  // compact banner at the top only when this is set — no image means
  // the card renders exactly as before, no empty space.
  image?: string;
  // Tracks the last calendar day a "class starting soon" reminder was
  // sent for this class. Needed because the reminder job runs every
  // 15 minutes and a session's "starting within the hour" window
  // spans multiple ticks — without this, a recurring class would get
  // re-reminded 3-4 times during that same hour.
  lastReminderSentAt?: Date;
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
      threeMonths: { type: Number, min: 0 },
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
    pendingMembers: [
      {
        member: {
          type: Schema.Types.ObjectId,
          ref: "MemberProfile",
        },
        expiresAt: {
          type: Date,
          required: true,
        },
      },
    ],
    image: {
      type: String,
      default: null,
    },
    lastReminderSentAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

// Prevents the same member being added to the same class twice (data
// integrity guard — see findByIdAndUpdate $addToSet usage in the repo,
// this is the DB-level backstop for that).
classSchema.index(
  { _id: 1, members: 1 },
  { unique: true, partialFilterExpression: { members: { $exists: true } } },
);

// ✅ speeds up findClassesByTrainerId({ trainer })
classSchema.index({ trainer: 1 });

// ✅ speeds up findClassesByMemberId({ members }); the compound
// index above can't serve this since it's keyed on { _id, members },
// not { members } alone.
classSchema.index({ members: 1 });

export default model<IClass>("Class", classSchema);

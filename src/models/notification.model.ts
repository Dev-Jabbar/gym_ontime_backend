import { Schema, model, Types } from "mongoose";

export type NotificationType =
  | "payment_confirmed"
  | "payment_needs_review"
  | "class_reminder"
  | "trainer_assigned";

export interface INotification {
  user: Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  // Optional links to the thing this notification is about — lets the
  // frontend deep-link (e.g. clicking a "class_booked" notification
  // could jump to that class).
  relatedClass?: Types.ObjectId;
  relatedPayment?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      // index moved to compound indexes below — see bottom of file
    },

    type: {
      type: String,
      enum: [
        "payment_confirmed",
        "payment_needs_review",
        "class_booked",
        "class_reminder",
        "trainer_assigned",
      ],
      required: true,
    },

    title: {
      type: String,
      required: true,
    },

    message: {
      type: String,
      required: true,
    },

    read: {
      type: Boolean,
      default: false,
      // index moved to compound indexes below — see bottom of file
    },

    relatedClass: {
      type: Schema.Types.ObjectId,
      ref: "Class",
    },

    relatedPayment: {
      type: Schema.Types.ObjectId,
      ref: "Payment",
    },
  },
  { timestamps: true },
);

// ✅ CHANGED — covers findByUserId({ user }).sort({ createdAt: -1 }),
// avoids an in-memory sort since createdAt is part of the index
notificationSchema.index({ user: 1, createdAt: -1 });

// ✅ CHANGED — covers countUnread({ user, read: false }) and
// markAllAsRead({ user, read: false }) as one compound lookup instead
// of two separate single-field indexes
notificationSchema.index({ user: 1, read: 1 });

export default model<INotification>("Notification", notificationSchema);

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
    },

    type: {
      type: String,
      enum: [
        "payment_confirmed",
        "payment_needs_review",
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

// Covers findByUserId({ user }).sort({ createdAt: -1 }), avoids an
// in-memory sort since createdAt is part of the index.
notificationSchema.index({ user: 1, createdAt: -1 });

// Covers countUnread({ user, read: false }) and
// markAllAsRead({ user, read: false }) as one compound lookup.
notificationSchema.index({ user: 1, read: 1 });

export default model<INotification>("Notification", notificationSchema);

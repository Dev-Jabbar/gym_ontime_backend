import { Schema, model, Types } from "mongoose";

export type NotificationType =
  | "payment_confirmed"
  | "class_booked"
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
      index: true, // every query here filters by user — index it
    },

    type: {
      type: String,
      enum: [
        "payment_confirmed",
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
      index: true, // "unread count" queries filter on this constantly
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

export default model<INotification>("Notification", notificationSchema);

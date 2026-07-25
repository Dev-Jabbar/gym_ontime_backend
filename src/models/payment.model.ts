import { Schema, model, Types } from "mongoose";

export interface IPayment {
  user: Types.ObjectId;
  class?: Types.ObjectId;

  amount: number;
  currency: string;

  provider: "stripe" | "paystack";
  method: "card";

  status: "pending" | "completed" | "failed";

  paymentType: "one-time" | "subscription";

  subscriptionInterval?: "weekly" | "monthly" | "threeMonths";

  stripeSessionId?: string;
  stripePaymentIntentId?: string;

  paystackReference?: string;
  paystackAccessCode?: string;

  subscription?: Types.ObjectId;

  // Added by { timestamps: true } in the schema
  createdAt: Date;
  updatedAt: Date;
}
const paymentSchema = new Schema<IPayment>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    class: {
      type: Schema.Types.ObjectId,
      ref: "Class",
    },

    amount: {
      type: Number,
      required: true,
    },

    currency: {
      type: String,
      default: "NGN",
    },

    provider: {
      type: String,
      enum: ["stripe", "paystack"],
      default: "paystack",
    },

    method: {
      type: String,
      enum: ["card"],
      default: "card",
    },

    status: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "pending",
    },

    // ✅ NEW: Payment type
    paymentType: {
      type: String,
      enum: ["one-time", "subscription"],
      default: "one-time",
      required: true,
    },

    // ✅ NEW: Subscription interval
    subscriptionInterval: {
      type: String,
      enum: ["weekly", "monthly", "threeMonths"],
    },

    // Stripe
    stripeSessionId: String,
    stripePaymentIntentId: String,

    // Paystack
    paystackReference: String,
    paystackAccessCode: String,

    // ✅ NEW: Link to subscription
    subscription: {
      type: Schema.Types.ObjectId,
      ref: "ClassSubscription",
    },
  },
  { timestamps: true },
);

export default model<IPayment>("Payment", paymentSchema);

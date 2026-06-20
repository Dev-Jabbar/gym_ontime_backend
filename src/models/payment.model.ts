import { Schema, model, Types } from "mongoose";

export interface IPayment {
  user: Types.ObjectId;
  class?: Types.ObjectId;

  amount: number;
  currency: string;

  provider: "stripe" | "paystack";
  method: "card";

  status: "pending" | "completed" | "failed";

  // ✅ NEW: Payment type
  paymentType: "one-time" | "subscription";

  // ✅ NEW: Subscription interval (only if paymentType = "subscription")
  subscriptionInterval?:
    | "weekly"
    | "monthly"
    | "quarterly"
    | "biannual"
    | "yearly";

  // Stripe fields
  stripeSessionId?: string;
  stripePaymentIntentId?: string;

  // Paystack fields
  paystackReference?: string;
  paystackAccessCode?: string;

  // ✅ NEW: Link to subscription (if applicable)
  subscription?: Types.ObjectId;
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
      enum: ["weekly", "monthly", "quarterly", "biannual", "yearly"],
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

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

// ✅ NEW — covers findPaymentByReference/updatePaymentByReference, hit
// on every Paystack webhook. unique + sparse: a given reference maps
// to exactly one payment, and sparse skips documents where the field
// doesn't exist (e.g. Stripe-only payments).
// ⚠️ Before deploying, verify no existing duplicate non-null values:
//   db.payments.aggregate([
//     { $match: { paystackReference: { $ne: null } } },
//     { $group: { _id: "$paystackReference", count: { $sum: 1 } } },
//     { $match: { count: { $gt: 1 } } }
//   ])
paymentSchema.index({ paystackReference: 1 }, { unique: true, sparse: true });

// ✅ NEW — covers findPaymentByStripeSessionId, hit on every Stripe
// webhook. Same duplicate check applies for stripeSessionId.
paymentSchema.index({ stripeSessionId: 1 }, { unique: true, sparse: true });

// ✅ NEW — covers findPaymentsByUserId({ user }).sort({ createdAt: -1 })
paymentSchema.index({ user: 1, createdAt: -1 });

// ✅ NEW — covers findCompletedPayment({ user, class, status })
paymentSchema.index({ user: 1, class: 1, status: 1 });

// ✅ NEW — covers findPaymentsByClassId({ class, status: "completed" })
paymentSchema.index({ class: 1, status: 1 });

// ✅ NEW — covers findStalePendingPayments({ status: "pending", createdAt }),
// used by the scheduled cleanup job
paymentSchema.index({ status: 1, createdAt: 1 });

export default model<IPayment>("Payment", paymentSchema);

import { Schema, model, Types } from "mongoose";

export interface IPayment {
  user: Types.ObjectId;
  class?: Types.ObjectId;

  amount: number;
  currency: string;

  provider: "stripe" | "paystack";
  method: "card";

  status: "pending" | "completed" | "failed";

  // ✅ NEW: set when verifyPayment claims the seat and finds the hold
  // expired or the class full — money was charged but the seat isn't
  // secured, so the payment is held back from "completed" pending a
  // human decision (refund vs. manual enroll).
  needsReview: boolean;

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

    // ✅ NEW: flags a charged payment whose seat hold expired or lost
    // its spot before verifyPayment could confirm it. Kept separate
    // from `status` so these don't get silently swept up by anything
    // filtering on status: "pending" or "failed" — they need a human
    // to look at them specifically.
    needsReview: {
      type: Boolean,
      default: false,
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

// ✅ NEW — lets an admin dashboard pull every payment awaiting manual
// review without a full collection scan.
paymentSchema.index({ needsReview: 1, createdAt: -1 });

export default model<IPayment>("Payment", paymentSchema);

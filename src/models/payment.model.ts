import { Schema, model, Types } from "mongoose";

export interface IPayment {
  user: Types.ObjectId;
  class?: Types.ObjectId;

  amount: number;
  currency: string;

  provider: "stripe" | "paystack";
  method: "card";

  status: "pending" | "completed" | "failed";

  // Set when verifyPayment finds the hold expired or the class full after a
  // charge: the money was taken but the seat is not secured, so the payment
  // is held back from "completed" until a person decides (refund or manual
  // enrollment).
  needsReview: boolean;

  paymentType: "one-time" | "subscription";

  subscriptionInterval?: "weekly" | "monthly" | "threeMonths";

  stripeSessionId?: string;
  stripePaymentIntentId?: string;

  paystackReference?: string;
  paystackAccessCode?: string;

  subscription?: Types.ObjectId;

  // Added by { timestamps: true } in the schema.
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

    // Flags a charged payment whose seat hold expired or whose spot was lost
    // before verifyPayment could confirm it. Kept separate from `status` so
    // these payments are not swept up by anything filtering on "pending" or
    // "failed": they need a person to look at them specifically.
    needsReview: {
      type: Boolean,
      default: false,
    },

    // Payment type.
    paymentType: {
      type: String,
      enum: ["one-time", "subscription"],
      default: "one-time",
      required: true,
    },

    // Subscription interval.
    subscriptionInterval: {
      type: String,
      enum: ["weekly", "monthly", "threeMonths"],
    },

    // Stripe (legacy provider fields).
    stripeSessionId: String,
    stripePaymentIntentId: String,

    // Paystack
    paystackReference: String,
    paystackAccessCode: String,

    // Link to the subscription.
    subscription: {
      type: Schema.Types.ObjectId,
      ref: "ClassSubscription",
    },
  },
  { timestamps: true },
);

// Serves findPaymentByReference and updatePaymentByReference, which run on
// every Paystack webhook. unique + sparse: a reference maps to exactly one
// payment, and sparse skips documents without the field (for example
// Stripe-only payments).
// Before creating this index on existing data, check for duplicate non-null
// values:
//   db.payments.aggregate([
//     { $match: { paystackReference: { $ne: null } } },
//     { $group: { _id: "$paystackReference", count: { $sum: 1 } } },
//     { $match: { count: { $gt: 1 } } }
//   ])
paymentSchema.index({ paystackReference: 1 }, { unique: true, sparse: true });

// Serves findPaymentByStripeSessionId. The same duplicate check applies to
// stripeSessionId.
paymentSchema.index({ stripeSessionId: 1 }, { unique: true, sparse: true });

// Serves findPaymentsByUserId({ user }).sort({ createdAt: -1 }).
paymentSchema.index({ user: 1, createdAt: -1 });

// Serves findCompletedPayment({ user, class, status }).
paymentSchema.index({ user: 1, class: 1, status: 1 });

// Serves findPaymentsByClassId({ class, status: "completed" }).
paymentSchema.index({ class: 1, status: 1 });

// Serves findStalePendingPayments({ status: "pending", createdAt }), used by
// the scheduled cleanup job.
paymentSchema.index({ status: 1, createdAt: 1 });

// Lets an admin dashboard list every payment awaiting manual review without
// a full collection scan.
paymentSchema.index({ needsReview: 1, createdAt: -1 });

export default model<IPayment>("Payment", paymentSchema);

import PaymentModel, { IPayment } from "../models/payment.model";
import mongoose from "mongoose";

/** Creates a payment. */
export const createPayment = async (
  data: Partial<IPayment>,
  session?: mongoose.ClientSession,
) => {
  const result = await PaymentModel.create(
    [data],
    session ? { session } : undefined,
  );
  return result[0];
};

/** Lists all payments (admin). */
export const findAllPayments = async () => {
  return PaymentModel.find()
    .populate("user", "name email")
    .populate("class", "name price")
    .sort({ createdAt: -1 });
};

/** Finds a payment by id. */
export const findPaymentById = async (id: string) => {
  return PaymentModel.findById(id)
    .populate("user", "name email")
    .populate("class", "name price");
};

/** Finds a payment by its Paystack reference. */
export const findPaymentByReference = async (reference: string) => {
  return PaymentModel.findOne({ paystackReference: reference });
};

/** Finds a payment by its Stripe session id (legacy provider field). */
export const findPaymentByStripeSessionId = async (sessionId: string) => {
  return PaymentModel.findOne({ stripeSessionId: sessionId });
};

/** Lists a user's payments. */
export const findPaymentsByUserId = async (userId: string) => {
  return PaymentModel.find({ user: userId })
    .populate("class", "name price schedule")
    .populate("subscription", "status startDate endDate interval")
    .sort({ createdAt: -1 });
};

/** Finds a completed payment for a user and class, used for the duplicate-booking check. */
export const findCompletedPayment = async (userId: string, classId: string) => {
  return PaymentModel.findOne({
    user: userId,
    class: classId,
    status: "completed",
  });
};

/** Lists the payments for a class. */
export const findPaymentsByClassId = async (classId: string) => {
  return PaymentModel.find({ class: classId, status: "completed" })
    .populate("user", "name email")
    .sort({ createdAt: -1 });
};

/** Updates a payment by id. */
export const updatePayment = async (
  id: string,
  data: Partial<IPayment>,
  session?: mongoose.ClientSession,
) => {
  return PaymentModel.findByIdAndUpdate(id, data, {
    new: true,
    session,
  });
};

/** Updates a payment by its Paystack reference. */
export const updatePaymentByReference = async (
  reference: string,
  data: Partial<IPayment>,
  session?: mongoose.ClientSession,
) => {
  return PaymentModel.findOneAndUpdate({ paystackReference: reference }, data, {
    new: true,
    session,
  });
};

/** Deletes a payment. */
export const deletePayment = async (
  id: string,
  session?: mongoose.ClientSession,
) => {
  return PaymentModel.findByIdAndDelete(id, { session });
};

/** Aggregates payment statistics for the admin dashboard. */
export const getPaymentStats = async () => {
  return PaymentModel.aggregate([
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalAmount: { $sum: "$amount" },
      },
    },
  ]);
};

/** Totals a user's spending. */
export const getUserTotalSpending = async (userId: string) => {
  const result = await PaymentModel.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId),
        status: "completed",
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
  ]);

  return result[0] || { total: 0, count: 0 };
};

/**
 * Finds `pending` payments older than a cutoff. Used by the scheduled
 * cleanup job to catch payments that never received a webhook or a verify
 * call (for example an abandoned checkout).
 */
export const findStalePendingPayments = async (olderThan: Date) => {
  return PaymentModel.find({
    status: "pending",
    createdAt: { $lt: olderThan },
  });
};

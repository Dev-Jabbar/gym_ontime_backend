import PaymentModel, { IPayment } from "../models/payment.model";
import mongoose from "mongoose";

/**
 * CREATE PAYMENT
 */
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

/**
 * FIND ALL PAYMENTS
 */
export const findAllPayments = async () => {
  return PaymentModel.find()
    .populate("user", "name email")
    .populate("class", "name price")
    .sort({ createdAt: -1 });
};

/**
 * FIND PAYMENT BY ID
 */
export const findPaymentById = async (id: string) => {
  return PaymentModel.findById(id)
    .populate("user", "name email")
    .populate("class", "name price");
};

/**
 * FIND PAYMENT BY PAYSTACK REFERENCE
 */
export const findPaymentByReference = async (reference: string) => {
  return PaymentModel.findOne({ paystackReference: reference });
};

/**
 * FIND PAYMENT BY STRIPE SESSION ID
 */
export const findPaymentByStripeSessionId = async (sessionId: string) => {
  return PaymentModel.findOne({ stripeSessionId: sessionId });
};

/**
 * FIND USER PAYMENTS
 */
export const findPaymentsByUserId = async (userId: string) => {
  return PaymentModel.find({ user: userId })
    .populate("class", "name price schedule")
    .populate("subscription", "status startDate endDate interval")
    .sort({ createdAt: -1 });
};

/**
 * FIND EXISTING COMPLETED PAYMENT (for duplicate check)
 */
export const findCompletedPayment = async (userId: string, classId: string) => {
  return PaymentModel.findOne({
    user: userId,
    class: classId,
    status: "completed",
  });
};

/**
 * FIND PAYMENTS BY CLASS
 */
export const findPaymentsByClassId = async (classId: string) => {
  return PaymentModel.find({ class: classId, status: "completed" })
    .populate("user", "name email")
    .sort({ createdAt: -1 });
};

/**
 * UPDATE PAYMENT
 */
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

/**
 * UPDATE PAYMENT BY REFERENCE
 */
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

/**
 * DELETE PAYMENT (if needed)
 */
export const deletePayment = async (
  id: string,
  session?: mongoose.ClientSession,
) => {
  return PaymentModel.findByIdAndDelete(id, { session });
};

/**
 * GET PAYMENT STATISTICS (optional - for admin dashboard)
 */
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

/**
 * GET USER'S TOTAL SPENDING
 */
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

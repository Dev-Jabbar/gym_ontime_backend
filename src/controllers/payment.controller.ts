import { Request, Response } from "express";
import {
  createCheckoutSession,
  verifyPayment,
  getUserPayments,
  getClassPayments,
  getPaymentById,
  getAllPayments,
} from "../services/payment.service";
import { handlePaystackWebhook } from "../webhooks/payment.webhook";
import {
  initiatePaymentSchema,
  verifyPaymentSchema,
  paymentIdParamSchema,
  classIdParamSchema,
} from "../validations/payment.validation";

/**
 * INITIATE PAYMENT
 * POST /api/payments/initiate
 */
export const initiatePayment = async (req: Request, res: Response) => {
  try {
    // ✅ UPDATED: Now includes paymentType and subscriptionInterval
    const { classId, paymentType, subscriptionInterval } =
      initiatePaymentSchema.parse(req.body);
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // ✅ UPDATED: Pass new parameters to service
    const result = await createCheckoutSession({
      userId,
      classId,
      paymentType,
      subscriptionInterval,
    });

    res.status(200).json({
      success: true,
      message: "Checkout session created",
      data: result,
    });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.errors,
      });
    }

    res.status(400).json({
      success: false,
      message: error.message || "Payment initiation failed",
    });
  }
};

/**
 * VERIFY PAYMENT
 * GET /api/payments/verify?reference=xxx
 */
export const verifyPaymentController = async (req: Request, res: Response) => {
  try {
    const { reference } = verifyPaymentSchema.parse(req.query);

    const result = await verifyPayment(reference);

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.errors,
      });
    }

    res.status(400).json({
      success: false,
      message: error.message || "Payment verification failed",
    });
  }
};

/**
 * GET MY PAYMENTS
 * GET /api/payments/my-payments
 */
export const getMyPayments = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const payments = await getUserPayments(userId);

    res.status(200).json({
      success: true,
      data: payments,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch payments",
    });
  }
};

/**
 * GET ALL PAYMENTS (Admin only)
 * GET /api/payments
 */
export const getAllPaymentsController = async (req: Request, res: Response) => {
  try {
    const payments = await getAllPayments();

    res.status(200).json({
      success: true,
      data: payments,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch payments",
    });
  }
};

/**
 * GET PAYMENT BY ID (Admin only)
 * GET /api/payments/:id
 */
export const getPaymentByIdController = async (req: Request, res: Response) => {
  try {
    const { id } = paymentIdParamSchema.parse(req.params);

    const payment = await getPaymentById(id);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    res.status(200).json({
      success: true,
      data: payment,
    });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch payment",
    });
  }
};

/**
 * GET CLASS PAYMENTS (Admin only - financial data)
 * GET /api/payments/class/:classId
 */
export const getClassPaymentsController = async (
  req: Request,
  res: Response,
) => {
  try {
    const { classId } = classIdParamSchema.parse(req.params);

    const payments = await getClassPayments(classId);

    res.status(200).json({
      success: true,
      data: payments,
    });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch class payments",
    });
  }
};

/**
 * PAYSTACK WEBHOOK
 * POST /api/payments/webhook
 */
export const paystackWebhookController = async (
  req: Request,
  res: Response,
) => {
  try {
    const signature = req.headers["x-paystack-signature"] as string;

    if (!signature) {
      return res.status(400).json({
        success: false,
        message: "No signature provided",
      });
    }

    const payload = JSON.stringify(req.body);

    await handlePaystackWebhook(signature, payload);

    res.status(200).json({
      success: true,
      message: "Webhook processed",
    });
  } catch (error: any) {
    console.error("Webhook error:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

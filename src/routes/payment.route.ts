import express from "express";
import * as paymentController from "../controllers/payment.controller";
import { protect } from "../middleware/auth.middleware";

const router = express.Router();

/**
 * PUBLIC - Paystack Webhook
 */
router.post("/webhook", paymentController.paystackWebhookController);

/**
 * MEMBER ONLY - Payment actions
 * (Only members pay for classes)
 */
router.post(
  "/initiate",
  protect(["member"]),
  paymentController.initiatePayment,
);

router.get(
  "/verify",
  protect(["member"]),
  paymentController.verifyPaymentController,
);

router.get(
  "/my-payments",
  protect(["member"]),
  paymentController.getMyPayments,
);

/**
 * ADMIN ONLY - Financial data
 * (Trainers should NOT see payment amounts)
 */
router.get(
  "/class/:classId",
  protect(["admin"]),
  paymentController.getClassPaymentsController,
);

router.get("/", protect(["admin"]), paymentController.getAllPaymentsController);

router.get(
  "/:id",
  protect(["admin"]),
  paymentController.getPaymentByIdController,
);

export default router;

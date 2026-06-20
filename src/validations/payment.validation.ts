import { z } from "zod";

/**
 * 🔹 Reusable Mongo ObjectId validation
 */
export const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid MongoDB ObjectId");

/**
 * 🔹 Initiate payment (UPDATED with subscription support)
 */
export const initiatePaymentSchema = z
  .object({
    classId: objectIdSchema,
    paymentType: z.enum(["one-time", "subscription"]),
    subscriptionInterval: z
      .enum(["weekly", "monthly", "quarterly", "biannual", "yearly"])
      .optional(),
  })
  .refine(
    (data) => {
      // If subscription, interval is required
      if (data.paymentType === "subscription" && !data.subscriptionInterval) {
        return false;
      }
      return true;
    },
    {
      message:
        "Subscription interval is required when payment type is subscription",
      path: ["subscriptionInterval"],
    },
  );

/**
 * 🔹 Verify payment (query params)
 */
export const verifyPaymentSchema = z.object({
  reference: z.string().min(1, "Payment reference is required"),
});

/**
 * 🔹 Payment ID param validation
 */
export const paymentIdParamSchema = z.object({
  id: objectIdSchema,
});

/**
 * 🔹 Class ID param validation (for getting class payments)
 */
export const classIdParamSchema = z.object({
  classId: objectIdSchema,
});

/**
 * 🔹 Webhook payload validation (optional but good practice)
 */
export const paystackWebhookSchema = z.object({
  event: z.string(),
  data: z.object({
    reference: z.string(),
    status: z.string(),
    amount: z.number().optional(),
    currency: z.string().optional(),
    metadata: z.any().optional(),
  }),
});

/**
 * 🔹 Payment status filter (for queries)
 */
export const paymentStatusSchema = z.object({
  status: z.enum(["pending", "completed", "failed"]).optional(),
  provider: z.enum(["stripe", "paystack"]).optional(),
});

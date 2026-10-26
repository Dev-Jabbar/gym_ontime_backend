import { z } from "zod";

/** Reusable MongoDB ObjectId validation. */
export const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid MongoDB ObjectId");

/** Body for starting a checkout, including subscription options. */
export const initiatePaymentSchema = z
  .object({
    classId: objectIdSchema,
    paymentType: z.enum(["one-time", "subscription"]),
    subscriptionInterval: z
      .enum(["weekly", "monthly", "threeMonths"])
      .optional(),
  })
  .refine(
    (data) => {
      // A subscription requires an interval.
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

/** Query params for verifying a payment. */
export const verifyPaymentSchema = z.object({
  reference: z.string().min(1, "Payment reference is required"),
});

/** Route params: payment id. */
export const paymentIdParamSchema = z.object({
  id: objectIdSchema,
});

/** Route params: class id (for listing a class's payments). */
export const classIdParamSchema = z.object({
  classId: objectIdSchema,
});

/** Shape of the Paystack webhook payload. */
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

/** Payment status filter for queries. */
export const paymentStatusSchema = z.object({
  status: z.enum(["pending", "completed", "failed"]).optional(),
  provider: z.enum(["stripe", "paystack"]).optional(),
});

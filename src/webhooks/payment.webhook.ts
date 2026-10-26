import crypto from "crypto";
import * as PaymentRepo from "../repositories/payment.repository";
import { verifyPayment } from "../services/payment.service";

export const handlePaystackWebhook = async (
  signature: string,
  payload: string,
) => {
  const hash = crypto
    .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY as string)
    .update(payload)
    .digest("hex");

  if (hash !== signature) {
    throw new Error("Invalid signature");
  }

  const event = JSON.parse(payload);

  if (event.event === "charge.success") {
    const { reference } = event.data;

    const payment = await PaymentRepo.findPaymentByReference(reference);
    if (!payment) return; // unknown reference, nothing to do
    if (payment.status === "completed") return; // already processed elsewhere

    try {
      // Delegates entirely to verifyPayment(), the same function used by the
      // user's /payment-success redirect and the scheduled cleanup sweep. The
      // webhook path therefore gets seat claiming, subscription creation and
      // notifications from a single source of truth instead of a second
      // implementation that can drift out of sync.
      //
      // It is also safer than trusting event.data.status: verifyPayment
      // re-confirms the charge with Paystack's API instead of believing the
      // webhook payload.
      await verifyPayment(reference);
    } catch (err) {
      // verifyPayment throws when Paystack reports the charge failed or the
      // re-verification request itself errors. In the failure case it has
      // already persisted "failed" and released the seat hold, so this catch
      // only stops an uncaught rejection from escaping the webhook handler.
      console.log(
        `Webhook verifyPayment could not complete for ${reference}:`,
        err,
      );
    }
  }
};

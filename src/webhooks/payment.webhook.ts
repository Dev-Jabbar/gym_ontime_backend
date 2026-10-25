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
      // Delegates entirely to verifyPayment() — the same function the
      // user's own /payment-success redirect and the scheduled cleanup
      // sweep both already use. This means the webhook path gets
      // claimSeat(), subscription creation, and notifications for
      // free, with a single source of truth instead of a second
      // implementation that can drift out of sync — which is exactly
      // what had happened here (this file previously reimplemented
      // the seat-claim logic separately and had already fallen behind
      // on subscription creation).
      //
      // Also more secure than trusting event.data.status directly:
      // verifyPayment re-confirms the charge with Paystack's API
      // rather than trusting whatever the webhook payload claims.
      await verifyPayment(reference);
    } catch (err) {
      // verifyPayment throws when Paystack reports the charge failed
      // or the re-verification request itself errors — but it already
      // persists "failed" and releases the seat hold before throwing
      // in the failure case, so this catch just stops an uncaught
      // rejection from bubbling out of the webhook handler.
      console.log(
        `Webhook verifyPayment could not complete for ${reference}:`,
        err,
      );
    }
  }
};

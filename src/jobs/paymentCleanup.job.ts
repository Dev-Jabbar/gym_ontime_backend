import cron from "node-cron";
import * as PaymentRepo from "../repositories/payment.repository";
import { verifyPayment } from "../services/payment.service";
import * as ClassRepo from "../repositories/class.repository";

// How old a "pending" payment must be before it is re-checked. This gives a
// normal checkout flow (redirect, verify) time to complete on its own first.
const STALE_THRESHOLD_MINUTES = 30;

// Absolute cutoff: a payment still unresolved after this long (Paystack
// cannot confirm it either way, for example a bad reference or a checkout
// abandoned before reaching Paystack) is forced to "failed" instead of
// staying "pending" indefinitely.
const HARD_EXPIRY_HOURS = 24;

export const runPaymentCleanup = async () => {
  console.log("🧹 Running stale payment cleanup...");

  const staleThreshold = new Date(
    Date.now() - STALE_THRESHOLD_MINUTES * 60 * 1000,
  );
  const hardExpiry = new Date(Date.now() - HARD_EXPIRY_HOURS * 60 * 60 * 1000);

  const stalePayments =
    await PaymentRepo.findStalePendingPayments(staleThreshold);

  for (const payment of stalePayments) {
    try {
      // verifyPayment() already persists "completed" or "failed" from
      // Paystack's real answer and runs subscription creation and class
      // enrollment on success. Reusing it makes the sweep behave exactly like
      // a user-triggered verification, with no parallel code path that could
      // drift out of sync.
      await verifyPayment(payment.paystackReference as string);
      console.log(`✅ Resolved stale payment ${payment.paystackReference}`);
    } catch (err) {
      // verifyPayment throws when Paystack reports a failure or the request
      // itself errors. In the "Paystack confirmed failure" case it has already
      // persisted "failed" before throwing. This catch makes one bad reference
      // not stop the rest of the sweep.
      console.log(
        `⚠️ Could not resolve ${payment.paystackReference} this pass.`,
      );

      // Safety net for references Paystack cannot confirm (for example a
      // network error mid-check, or a reference that never finished
      // initialization): do not let them stay pending forever.
      if (new Date(payment.createdAt) < hardExpiry) {
        await PaymentRepo.updatePaymentByReference(
          payment.paystackReference as string,
          { status: "failed" },
        );
        console.log(
          `⏰ Hard-expired payment ${payment.paystackReference} after ${HARD_EXPIRY_HOURS}h unresolved`,
        );
      }
    }
  }
  const releaseResult = await ClassRepo.releaseExpiredHolds();
  console.log(
    `🪑 Released expired seat holds on ${releaseResult.modifiedCount} class(es)`,
  );

  console.log(
    `🧹 Cleanup complete — checked ${stalePayments.length} stale payment(s)`,
  );
};

/**
 * Schedules the sweep to run every 15 minutes. Call it once at server
 * startup (see index.ts).
 */
export const startPaymentCleanupJob = () => {
  cron.schedule("*/15 * * * *", runPaymentCleanup);
  console.log("🕐 Payment cleanup job scheduled (every 15 minutes)");
};

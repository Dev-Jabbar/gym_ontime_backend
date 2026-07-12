import cron from "node-cron";
import * as PaymentRepo from "../repositories/payment.repository";
import { verifyPayment } from "../services/payment.service";

// How old a "pending" payment must be before we bother re-checking it —
// gives a normal checkout flow (redirect, verify) plenty of time to
// complete on its own first.
const STALE_THRESHOLD_MINUTES = 30;

// Absolute cutoff: if a payment is still unresolved after this long
// (Paystack can't confirm it either way — bad reference, truly
// abandoned before reaching Paystack at all, etc.), force it to
// "failed" rather than let it sit as "pending" indefinitely.
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
      // verifyPayment() already persists "completed" or "failed" based
      // on Paystack's real answer, plus runs subscription creation /
      // class enrollment on success — reusing it here means this sweep
      // behaves identically to a normal user-triggered verification,
      // not a separate parallel code path that could drift out of sync.
      await verifyPayment(payment.paystackReference as string);
      console.log(`✅ Resolved stale payment ${payment.paystackReference}`);
    } catch (err) {
      // verifyPayment throws when Paystack reports failure or the
      // request itself errors — but per the fix in payment.service.ts,
      // it already persisted "failed" to the DB before throwing in the
      // "Paystack confirmed failure" case. This catch exists so one
      // bad reference doesn't halt the rest of the sweep.
      console.log(
        `⚠️ Could not resolve ${payment.paystackReference} this pass.`,
      );

      // Safety net for references Paystack genuinely can't confirm
      // (e.g. network error mid-check, or the reference never
      // completed initialization) — don't let these sit forever.
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

  console.log(
    `🧹 Cleanup complete — checked ${stalePayments.length} stale payment(s)`,
  );
};

/**
 * Schedules the sweep to run every 15 minutes. Call this once at
 * server startup (see index.ts).
 */
export const startPaymentCleanupJob = () => {
  cron.schedule("*/15 * * * *", runPaymentCleanup);
  console.log("🕐 Payment cleanup job scheduled (every 15 minutes)");
};

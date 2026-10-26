import cron from "node-cron";
import * as classSubscriptionRepository from "../repositories/class-subscription.repository";
import * as classRepository from "../repositories/class.repository";

export const runSubscriptionExpiry = async () => {
  console.log("🧹 Running subscription expiry sweep...");

  const now = new Date();
  const expiredSubscriptions =
    await classSubscriptionRepository.findExpiredActiveSubscriptions(now);

  for (const subscription of expiredSubscriptions) {
    try {
      // Flip the status first: even if the class-removal step below fails, the
      // subscription is correctly marked expired and is not treated as
      // "active" anywhere else (for example the Booked indicator, which
      // checks status and endDate).
      await classSubscriptionRepository.updateSubscriptionStatus(
        subscription._id.toString(),
        "expired",
      );

      // Remove the member from the class's members array; otherwise they
      // would stay enrolled, and count toward capacity, after their
      // subscription lapsed.
      await classRepository.removeMemberFromClass(
        subscription.class.toString(),
        subscription.memberProfile.toString(),
      );

      console.log(
        `⏰ Expired subscription ${subscription._id} — removed member from class ${subscription.class}`,
      );
    } catch (err) {
      // One failing subscription must not stop the rest of the sweep.
      console.log(
        `⚠️ Could not fully process expired subscription ${subscription._id}:`,
        err,
      );
    }
  }

  console.log(
    `🧹 Subscription expiry sweep complete — processed ${expiredSubscriptions.length} subscription(s)`,
  );
};

/**
 * Runs every hour. Subscription expiry is less urgent than the payment
 * cleanup: a subscription lapsing an hour late is not a meaningful problem,
 * so this runs less often to reduce load.
 */
export const startSubscriptionExpiryJob = () => {
  cron.schedule("0 * * * *", runSubscriptionExpiry);
  console.log("🕐 Subscription expiry job scheduled (every hour)");
};

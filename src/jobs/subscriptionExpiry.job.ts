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
      // Flip status first — even if the class-removal step below fails
      // for some reason, the subscription itself is correctly marked
      // expired and won't be picked up as "active" anywhere else
      // (e.g. the Booked indicator, which checks status + endDate).
      await classSubscriptionRepository.updateSubscriptionStatus(
        subscription._id.toString(),
        "expired",
      );

      // Pull the member out of the class's members array — otherwise
      // they'd stay enrolled (and counted toward capacity) forever
      // after their subscription lapsed.
      await classRepository.removeMemberFromClass(
        subscription.class.toString(),
        subscription.memberProfile.toString(),
      );

      console.log(
        `⏰ Expired subscription ${subscription._id} — removed member from class ${subscription.class}`,
      );
    } catch (err) {
      // One bad subscription shouldn't halt the rest of the sweep.
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
 * Runs every hour. Subscriptions don't need the same 15-minute
 * urgency as the payment cleanup job — a subscription lapsing an
 * hour "late" isn't a meaningful problem, so this runs less
 * frequently to reduce unnecessary load.
 */
export const startSubscriptionExpiryJob = () => {
  cron.schedule("0 * * * *", runSubscriptionExpiry);
  console.log("🕐 Subscription expiry job scheduled (every hour)");
};

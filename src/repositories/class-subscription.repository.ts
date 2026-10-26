import ClassSubscription from "../models/class-subscription.model";

export const createSubscription = async (data: any) => {
  return ClassSubscription.create(data);
};

export const findActiveSubscription = async (
  userId: string,
  classId: string,
) => {
  return ClassSubscription.findOne({
    user: userId,
    class: classId,
    status: "active",
  });
};

/**
 * Finds subscriptions still marked "active" whose endDate has passed. The
 * scheduled expiry job flips them to "expired" and removes the member from
 * the class.
 */
export const findExpiredActiveSubscriptions = async (now: Date) => {
  return ClassSubscription.find({
    status: "active",
    endDate: { $lt: now },
  });
};

/** Sets a subscription's status. */
export const updateSubscriptionStatus = async (
  subscriptionId: string,
  status: "active" | "expired" | "cancelled",
) => {
  return ClassSubscription.findByIdAndUpdate(
    subscriptionId,
    { status },
    { new: true },
  );
};

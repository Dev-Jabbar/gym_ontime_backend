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
 * FIND EXPIRED ACTIVE SUBSCRIPTIONS
 * Used by the scheduled expiry job — any subscription still marked
 * "active" whose endDate has already passed needs to be flipped to
 * "expired" and have the member removed from the class.
 */
export const findExpiredActiveSubscriptions = async (now: Date) => {
  return ClassSubscription.find({
    status: "active",
    endDate: { $lt: now },
  });
};

/**
 * UPDATE SUBSCRIPTION STATUS
 */
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

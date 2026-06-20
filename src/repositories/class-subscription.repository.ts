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

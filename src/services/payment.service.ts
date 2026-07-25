import axios from "axios";
import * as PaymentRepo from "../repositories/payment.repository";
import * as UserRepo from "../repositories/user.repository";
import * as ClassRepo from "../repositories/class.repository";
import * as MemberProfileRepo from "../repositories/member-profile.repository";
import * as SubscriptionRepo from "../repositories/class-subscription.repository";
import * as NotificationService from "./notification.service";

const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY as string;
const paystackBaseUrl = "https://api.paystack.co";

interface PaystackInitializeResponse {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data: {
    status: string;
    reference: string;
    amount: number;
    currency: string;
    metadata: any;
  };
}

type SubscriptionInterval = "weekly" | "monthly" | "threeMonths";

const calculateEndDate = (
  startDate: Date,
  interval: SubscriptionInterval,
): Date => {
  const endDate = new Date(startDate);

  switch (interval) {
    case "weekly":
      endDate.setDate(endDate.getDate() + 7);
      break;
    case "monthly":
      endDate.setMonth(endDate.getMonth() + 1);
      break;
    case "threeMonths":
      endDate.setMonth(endDate.getMonth() + 3);
      break;
  }

  return endDate;
};

export const createCheckoutSession = async ({
  userId,
  classId,
  paymentType,
  subscriptionInterval,
}: {
  userId: string;
  classId: string;
  paymentType: "one-time" | "subscription";
  subscriptionInterval?: SubscriptionInterval;
}) => {
  console.log("Creating checkout session with:", {
    userId,
    classId,
    paymentType,
    subscriptionInterval,
  });
  const user = await UserRepo.findUserById(userId);
  if (!user) throw new Error("User not found");

  if (user.role !== "member") {
    throw new Error("Only members can enroll in paid classes");
  }

  const classItem = await ClassRepo.findClassById(classId);
  if (!classItem) throw new Error("Class not found");
  console.log("Class item:", classItem); // Log the class item for debugging
  // ✅ Block subscriptions for one-off classes
  if (
    paymentType === "subscription" &&
    (classItem as any).recurrence === "none"
  ) {
    throw new Error(
      "Subscriptions are not available for one-off classes. Please use one-time payment.",
    );
  }

  let amount: number;

  if (paymentType === "one-time") {
    if (!classItem.pricing.oneTime || classItem.pricing.oneTime === 0) {
      throw new Error("This class does not support one-time payments");
    }
    amount = classItem.pricing.oneTime;
  } else {
    if (!subscriptionInterval) {
      throw new Error(
        "Subscription interval is required for subscription payments",
      );
    }

    const price = classItem.pricing[subscriptionInterval];

    console.log(`Price for ${subscriptionInterval} subscription:`, price); // Log the price for debugging
    if (!price || price === 0) {
      throw new Error(
        `This class does not support ${subscriptionInterval} subscriptions`,
      );
    }
    amount = price;
  }

  if (classItem.capacity && classItem.members.length >= classItem.capacity) {
    throw new Error("Class is full. No spots available.");
  }

  if (paymentType === "one-time") {
    const existingPayment = await PaymentRepo.findCompletedPayment(
      userId,
      classId,
    );

    console.log("Existing payment check:", existingPayment); // Log the existing payment for debugging
    if (existingPayment) {
      throw new Error("You are already enrolled in this class");
    }
  } else {
    const existingSubscription = await SubscriptionRepo.findActiveSubscription(
      userId,
      classId,
    );
    if (existingSubscription) {
      throw new Error("You already have an active subscription for this class");
    }
  }

  const { data } = await axios.post<PaystackInitializeResponse>(
    `${paystackBaseUrl}/transaction/initialize`,
    {
      email: user.email,
      amount: amount * 100,
      currency: "NGN",
      callback_url: `${process.env.FRONTEND_URL}/payment-success`,
      metadata: {
        userId,
        classId,
        userName: user.name,
        className: classItem.name,
        paymentType,
        subscriptionInterval,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${paystackSecretKey}`,
        "Content-Type": "application/json",
      },
    },
  );

  await PaymentRepo.createPayment({
    user: userId as any,
    class: classId as any,
    amount,
    currency: "NGN",
    paystackReference: data.data.reference,
    paystackAccessCode: data.data.access_code,
    status: "pending",
    provider: "paystack",
    method: "card",
    paymentType,
    subscriptionInterval,
  });

  return {
    checkoutUrl: data.data.authorization_url,
    reference: data.data.reference,
  };
};

export const verifyPayment = async (reference: string) => {
  const { data } = await axios.get<PaystackVerifyResponse>(
    `${paystackBaseUrl}/transaction/verify/${reference}`,
    {
      headers: {
        Authorization: `Bearer ${paystackSecretKey}`,
      },
    },
  );

  // ⚠️ This is the fix. Paystack does not send a webhook event for a
  // failed/declined charge — per their own docs, webhooks only fire
  // "for a successful charge." This verify() call is the ONLY place
  // in the whole flow that ever finds out about a failure. Previously
  // this branch just threw an error and returned, leaving the payment
  // record at status: "pending" forever — the exact bug that was
  // reported (pending payments never resolving after a failed charge).
  // Now it persists "failed" before throwing, so the record reflects
  // reality and the Payments page's Pending/Failed counts are accurate.
  if (data.data.status !== "success") {
    const payment = await PaymentRepo.findPaymentByReference(reference);
    if (payment && payment.status === "pending") {
      await PaymentRepo.updatePaymentByReference(reference, {
        status: "failed",
      });
    }
    throw new Error("Payment verification failed");
  }

  const payment = await PaymentRepo.findPaymentByReference(reference);

  if (!payment) {
    throw new Error("Payment record not found");
  }

  if (payment.status === "completed") {
    return { message: "Payment already processed", payment };
  }

  const memberProfile = await MemberProfileRepo.findMemberProfileByUserId(
    payment.user.toString(),
  );

  if (!memberProfile) {
    throw new Error("Member profile not found for this user");
  }

  if (payment.paymentType === "subscription" && payment.subscriptionInterval) {
    const startDate = new Date();
    const endDate = calculateEndDate(startDate, payment.subscriptionInterval);

    const subscription = await SubscriptionRepo.createSubscription({
      user: payment.user,
      memberProfile: memberProfile._id,
      class: payment.class,
      interval: payment.subscriptionInterval,
      startDate,
      endDate,
      status: "active",
      payment: payment._id,
    });

    await PaymentRepo.updatePaymentByReference(reference, {
      status: "completed",
      subscription: subscription._id,
    });
  } else {
    await PaymentRepo.updatePaymentByReference(reference, {
      status: "completed",
    });
  }

  if (payment.class) {
    await ClassRepo.addMemberToClass(
      payment.class.toString(),
      memberProfile._id.toString(),
    );
  }

  // ✅ Notify the member their payment went through. Fetching the class
  // name for a friendlier message — falls back to a generic message if
  // the class lookup fails for any reason, since a notification isn't
  // worth failing the whole verification over.
  let className: string | null = null;
  if (payment.class) {
    try {
      const classDoc = await ClassRepo.findClassById(payment.class.toString());
      className = classDoc?.name ?? null;
    } catch {
      className = null;
    }
  }

  await NotificationService.notify({
    userId: payment.user.toString(),
    type: "payment_confirmed",
    title: "Payment Confirmed",
    message: className
      ? `Your payment for "${className}" was successful.`
      : "Your payment was successful.",
    classId: payment.class?.toString(),
    paymentId: payment._id.toString(),
  });

  return { message: "Payment verified successfully", payment };
};

export const getUserPayments = async (userId: string) => {
  return PaymentRepo.findPaymentsByUserId(userId);
};

export const getClassPayments = async (classId: string) => {
  return PaymentRepo.findPaymentsByClassId(classId);
};

export const getPaymentById = async (paymentId: string) => {
  const payment = await PaymentRepo.findPaymentById(paymentId);
  if (!payment) {
    throw new Error("Payment not found");
  }
  return payment;
};

export const getAllPayments = async () => {
  return PaymentRepo.findAllPayments();
};

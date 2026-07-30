import axios from "axios";
import * as PaymentRepo from "../repositories/payment.repository";
import * as UserRepo from "../repositories/user.repository";
import * as ClassRepo from "../repositories/class.repository";
import * as MemberProfileRepo from "../repositories/member-profile.repository";
import * as SubscriptionRepo from "../repositories/class-subscription.repository";
import * as NotificationService from "./notification.service";
import { IClass } from "../models/class.model";

const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY as string;
const paystackBaseUrl = "https://api.paystack.co";

// How long we hold a seat for someone who's started checkout but hasn't
// paid yet. 15 minutes: long enough for a normal checkout, short enough
// that an abandoned cart doesn't block the seat for long.
const SEAT_HOLD_MINUTES = 15;

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

const SUBSCRIPTION_INTERVALS: SubscriptionInterval[] = [
  "weekly",
  "monthly",
  "threeMonths",
];

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
  if (!paystackSecretKey) {
    throw new Error("Server misconfiguration: PAYSTACK_SECRET_KEY is not set");
  }
  if (!process.env.FRONTEND_URL) {
    throw new Error("Server misconfiguration: FRONTEND_URL is not set");
  }

  if (paymentType === "subscription") {
    if (!subscriptionInterval) {
      throw new Error(
        "Subscription interval is required for subscription payments",
      );
    }
    if (!SUBSCRIPTION_INTERVALS.includes(subscriptionInterval)) {
      throw new Error(`Invalid subscription interval: ${subscriptionInterval}`);
    }
  }

  const user = await UserRepo.findUserById(userId);
  if (!user) throw new Error("User not found");

  if (user.role !== "member") {
    throw new Error("Only members can enroll in paid classes");
  }

  const memberProfile =
    await MemberProfileRepo.findMemberProfileByUserId(userId);
  if (!memberProfile) throw new Error("Member profile not found");

  const classItem = (await ClassRepo.findClassById(classId)) as IClass | null;
  if (!classItem) throw new Error("Class not found");

  if (paymentType === "subscription" && classItem.recurrence === "none") {
    throw new Error(
      "Subscriptions are not available for one-off classes. Please use one-time payment.",
    );
  }

  let amount: number;

  if (paymentType === "one-time") {
    const price = classItem.pricing.oneTime;
    if (!price) {
      throw new Error("This class does not support one-time payments");
    }
    amount = price;
  } else {
    const price = classItem.pricing[subscriptionInterval!];
    if (!price) {
      throw new Error(
        `This class does not support ${subscriptionInterval} subscriptions`,
      );
    }
    amount = price;
  }

  if (paymentType === "one-time") {
    const existingPayment = await PaymentRepo.findCompletedPayment(
      userId,
      classId,
    );
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

  // --- Reserve the seat NOW, not just check-and-hope. This is the real
  // capacity gate — it atomically holds the seat for SEAT_HOLD_MINUTES,
  // so a second person starting checkout for the last spot gets turned
  // away here instead of after they've already paid. ---
  const reserved = await ClassRepo.reserveSeat(
    classId,
    memberProfile._id.toString(),
    SEAT_HOLD_MINUTES,
  );
  if (!reserved) {
    throw new Error("Class is full. No spots available.");
  }

  let paystackData: PaystackInitializeResponse["data"];
  try {
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
          subscriptionInterval: subscriptionInterval ?? null,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`,
          "Content-Type": "application/json",
        },
      },
    );
    paystackData = data.data;
  } catch (err) {
    // Paystack init failed — give the seat back immediately rather than
    // making someone else wait 15 minutes for a hold that will never
    // turn into a payment.
    await ClassRepo.releaseSeat(classId, memberProfile._id.toString());
    throw new Error(
      `Failed to initialize payment with Paystack: ${
        err instanceof Error ? err.message : "unknown error"
      }`,
    );
  }

  try {
    await PaymentRepo.createPayment({
      user: userId as any,
      class: classId as any,
      amount,
      currency: "NGN",
      paystackReference: paystackData.reference,
      paystackAccessCode: paystackData.access_code,
      status: "pending",
      provider: "paystack",
      method: "card",
      paymentType,
      subscriptionInterval,
    });
  } catch (err) {
    // Same logic — Paystack has a session, but we couldn't record it, so
    // there's no way this ever gets verified/confirmed. Release the seat
    // rather than leave it locked for 15 minutes for nothing.
    await ClassRepo.releaseSeat(classId, memberProfile._id.toString());
    console.error(
      `Orphaned Paystack session (no local payment record): reference=${paystackData.reference}`,
      err,
    );
    throw new Error(
      "Payment was initialized but could not be recorded. Please contact support with reference: " +
        paystackData.reference,
    );
  }

  return {
    checkoutUrl: paystackData.authorization_url,
    reference: paystackData.reference,
  };
};

// Shared by verifyPayment() and the webhook handler. Turns an active seat
// hold into a real member. Returns:
//   "enrolled"          -> proceed with marking payment/subscription complete
//   "already-enrolled"  -> not an error, treat as success (idempotent retry)
//   "hold-expired"      -> the 15-min hold ran out before payment confirmed;
//                          seat may have gone to someone else
//   "class-full"        -> shouldn't normally happen given the hold system,
//                          but kept as a fallback signal
//   "error"             -> unexpected state, log for investigation
export const claimSeat = async (
  classId: string,
  memberProfileId: string,
): Promise<
  "enrolled" | "already-enrolled" | "hold-expired" | "class-full" | "error"
> => {
  const updatedClass = await ClassRepo.confirmSeat(classId, memberProfileId);
  if (updatedClass) return "enrolled";

  const reason = await ClassRepo.getClassEnrollmentStatus(
    classId,
    memberProfileId,
  );

  if (
    reason === "already-enrolled" ||
    reason === "hold-expired" ||
    reason === "class-full"
  ) {
    return reason;
  }
  return "error";
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

  if (data.data.status !== "success") {
    const payment = await PaymentRepo.findPaymentByReference(reference);
    if (payment && payment.status === "pending") {
      await PaymentRepo.updatePaymentByReference(reference, {
        status: "failed",
      });

      // Payment failed — release the seat hold right away instead of
      // making someone else wait out the full 15 minutes.
      const memberProfile = await MemberProfileRepo.findMemberProfileByUserId(
        payment.user.toString(),
      );
      if (memberProfile && payment.class) {
        await ClassRepo.releaseSeat(
          payment.class.toString(),
          memberProfile._id.toString(),
        );
      }
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

  let seatResult:
    | "enrolled"
    | "already-enrolled"
    | "hold-expired"
    | "class-full"
    | "error" = "enrolled";

  if (payment.class) {
    seatResult = await claimSeat(
      payment.class.toString(),
      memberProfile._id.toString(),
    );
  }

  if (seatResult === "hold-expired" || seatResult === "class-full") {
    await PaymentRepo.updatePaymentByReference(reference, {
      needsReview: true,
    } as any); // requires `needsReview?: boolean` on IPayment

    await NotificationService.notify({
      userId: payment.user.toString(),
      type: "payment_needs_review",
      title: "Payment received, seat unavailable",
      message:
        seatResult === "hold-expired"
          ? "Your payment took longer than your reserved spot allowed, and the seat may no longer be available. Our team will follow up shortly."
          : "Your payment went through, but the class filled up before we could confirm your spot. Our team will follow up shortly.",
      classId: payment.class?.toString(),
      paymentId: payment._id.toString(),
    });

    return { message: "Payment received, seat unavailable", payment };
  }

  if (seatResult === "error") {
    console.error(
      `claimSeat returned "error" for payment ${payment._id} (class ${payment.class})`,
    );
    throw new Error(
      "Payment verified but enrollment could not be confirmed. Please contact support.",
    );
  }

  // seatResult is "enrolled" or "already-enrolled" — safe to finalize.
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

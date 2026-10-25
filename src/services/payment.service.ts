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
    throw new Error("Paystack secret key is not configured");
  }
  if (!process.env.FRONTEND_URL) {
    throw new Error("FRONTEND_URL is not configured");
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
    const price = classItem.pricing.oneTime;
    if (!price)
      throw new Error("This class does not support one-time payments");
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

  // Atomically claim a seat and hold it under this member's profile for
  // SEAT_HOLD_MINUTES. Counts confirmed members AND other people's
  // active holds, so two people can't both be sent to pay for the last
  // spot.
  const reserved = await ClassRepo.reserveSeat(
    classId,
    memberProfile._id.toString(),
    SEAT_HOLD_MINUTES,
  );
  if (!reserved) {
    throw new Error("Class is full. No spots available.");
  }

  let data: PaystackInitializeResponse;
  try {
    const response = await axios.post<PaystackInitializeResponse>(
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
    data = response.data;
  } catch (err) {
    // Paystack init failed — don't leave this seat locked for 15
    // minutes over a checkout that never actually started.
    await ClassRepo.releaseSeat(classId, memberProfile._id.toString());
    throw err;
  }

  try {
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
  } catch (err) {
    // Paystack already has a live session, but we failed to save our own
    // record of it — release the hold rather than lock the seat for 15
    // minutes with no record verifyPayment could ever find.
    await ClassRepo.releaseSeat(classId, memberProfile._id.toString());
    throw new Error(
      `Failed to save payment record. Please contact support with reference: ${data.data.reference}`,
    );
  }

  return {
    checkoutUrl: data.data.authorization_url,
    reference: data.data.reference,
  };
};

/**
 * Attempts to convert a member's seat hold into a confirmed seat, and
 * reports back exactly why if it can't.
 *
 * Called internally by `verifyPayment()` only — there is deliberately
 * no other path in the codebase that calls this, so both the webhook
 * and manual-verification flows end up here through the exact same
 * function rather than two implementations that could drift apart.
 *
 * @returns One of:
 *  - `"enrolled"` — the hold was valid and is now a confirmed seat
 *  - `"already-enrolled"` — this member was already a confirmed member
 *  - `"hold-expired"` — their hold lapsed before payment came through
 *  - `"class-full"` — no hold existed and the class has no room
 *  - `"error"` — an unexpected state (e.g. class no longer exists)
 */
export const claimSeat = async (classId: string, memberProfileId: string) => {
  const updatedClass = await ClassRepo.confirmSeat(classId, memberProfileId);
  if (updatedClass) return "enrolled" as const;

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
  return "error" as const;
};

/**
 * The single source of truth for "did this payment actually happen,
 * and if so, does the member get their seat." Both the Paystack
 * webhook and the frontend's own manual "did it work" check call this
 * exact function — there is no separate implementation for either
 * path.
 *
 * Re-verifies the charge directly against Paystack's API (never trusts
 * a status the caller merely claims), then on success calls
 * `claimSeat()` to convert the hold into a real seat. If the seat can
 * no longer be granted (hold expired, class filled up in the
 * meantime), the payment is flagged `needsReview` rather than silently
 * treated as a failure or a success — that's a business decision
 * (refund vs. offer another slot), not something safe to guess in code.
 *
 * Idempotent: calling this twice for an already-`completed` payment is
 * a no-op that returns early, so it's safe for the webhook and a
 * manual check to both fire for the same payment.
 *
 * @param reference - The Paystack transaction reference to verify.
 * @throws If Paystack reports the charge failed, or the request to
 *   Paystack itself errors. In the failure case, this also persists
 *   `status: "failed"` and releases the seat hold before throwing —
 *   see the comment inline below for why that matters.
 */
export const verifyPayment = async (reference: string) => {
  const { data } = await axios.get<PaystackVerifyResponse>(
    `${paystackBaseUrl}/transaction/verify/${reference}`,
    {
      headers: {
        Authorization: `Bearer ${paystackSecretKey}`,
      },
    },
  );

  // Paystack does not send a webhook event for a failed/declined charge —
  // per their own docs, webhooks only fire for a successful charge. This
  // verify() call is the ONLY place in the flow that ever finds out about
  // a failure, so it persists "failed" (instead of leaving the record
  // stuck at "pending" forever) and releases the seat hold right away.
  if (data.data.status !== "success") {
    const payment = await PaymentRepo.findPaymentByReference(reference);
    if (payment && payment.status === "pending") {
      await PaymentRepo.updatePaymentByReference(reference, {
        status: "failed",
      });

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
  if (!payment) throw new Error("Payment record not found");
  if (payment.status === "completed") {
    return { message: "Payment already processed", payment };
  }

  const memberProfile = await MemberProfileRepo.findMemberProfileByUserId(
    payment.user.toString(),
  );
  if (!memberProfile) throw new Error("Member profile not found for this user");

  if (!payment.class) {
    throw new Error("Payment has no associated class");
  }

  // Claim the seat before marking anything complete, so a "completed"
  // payment can never exist without a genuinely secured seat behind it.
  const seatResult = await claimSeat(
    payment.class.toString(),
    memberProfile._id.toString(),
  );

  if (seatResult === "hold-expired" || seatResult === "class-full") {
    // Money was charged but the seat is no longer available. Flag for
    // manual review instead of guessing whether to refund or bump
    // someone — that's a business decision, not a code decision.
    await PaymentRepo.updatePaymentByReference(reference, {
      needsReview: true,
    });

    await NotificationService.notify({
      userId: payment.user.toString(),
      type: "payment_needs_review",
      title: "We're Looking Into Your Payment",
      message:
        "Your payment went through, but we weren't able to confirm your spot automatically. A team member will follow up shortly.",
      classId: payment.class?.toString(),
      paymentId: payment._id.toString(),
    });

    return { message: "Payment received, pending manual review", payment };
  }

  if (seatResult === "error") {
    throw new Error(`Unexpected error claiming seat for payment ${reference}`);
  }

  // "enrolled" or "already-enrolled" — safe to continue.
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

  // Fetch the class name for a friendlier message — falls back to a
  // generic one if the lookup fails, since a notification isn't worth
  // failing the whole verification over.
  let className: string | null = null;
  try {
    const classDoc = await ClassRepo.findClassById(payment.class.toString());
    className = classDoc?.name ?? null;
  } catch {
    className = null;
  }

  await NotificationService.notify({
    userId: payment.user.toString(),
    type: "payment_confirmed",
    title: "You're All Set!",
    message: className
      ? `Payment confirmed — you're booked into "${className}"!`
      : "Payment confirmed — you're booked in!",
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

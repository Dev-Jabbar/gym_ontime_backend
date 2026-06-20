import axios from "axios";
import * as PaymentRepo from "../repositories/payment.repository";
import * as UserRepo from "../repositories/user.repository";
import * as ClassRepo from "../repositories/class.repository";
import * as MemberProfileRepo from "../repositories/member-profile.repository";
import * as SubscriptionRepo from "../repositories/class-subscription.repository";

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

type SubscriptionInterval =
  | "weekly"
  | "monthly"
  | "quarterly"
  | "biannual"
  | "yearly";

// ✅ Helper function to calculate end date
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
    case "quarterly":
      endDate.setMonth(endDate.getMonth() + 3);
      break;
    case "biannual":
      endDate.setMonth(endDate.getMonth() + 6);
      break;
    case "yearly":
      endDate.setFullYear(endDate.getFullYear() + 1);
      break;
  }

  return endDate;
};

// ✅ NEW: Create checkout session with subscription support
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
  const user = await UserRepo.findUserById(userId);
  if (!user) throw new Error("User not found");

  if (user.role !== "member") {
    throw new Error("Only members can enroll in paid classes");
  }

  const classItem = await ClassRepo.findClassById(classId);
  if (!classItem) throw new Error("Class not found");

  // ✅ Determine price based on payment type
  let amount: number;

  if (paymentType === "one-time") {
    if (!classItem.pricing.oneTime || classItem.pricing.oneTime === 0) {
      throw new Error("This class does not support one-time payments");
    }
    amount = classItem.pricing.oneTime;
  } else {
    // Subscription
    if (!subscriptionInterval) {
      throw new Error(
        "Subscription interval is required for subscription payments",
      );
    }

    const price = classItem.pricing[subscriptionInterval];
    if (!price || price === 0) {
      throw new Error(
        `This class does not support ${subscriptionInterval} subscriptions`,
      );
    }
    amount = price;
  }

  // ✅ Check if class is full
  if (classItem.capacity && classItem.members.length >= classItem.capacity) {
    throw new Error("Class is full. No spots available.");
  }

  // ✅ Check for existing enrollment
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

  // ✅ Initialize Paystack transaction
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

  // ✅ Save payment record
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

// ✅ UPDATED: Verify payment with subscription support
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
    throw new Error("Payment verification failed");
  }

  const payment = await PaymentRepo.findPaymentByReference(reference);

  if (!payment) {
    throw new Error("Payment record not found");
  }

  if (payment.status === "completed") {
    return { message: "Payment already processed", payment };
  }

  // ✅ Get member profile
  const memberProfile = await MemberProfileRepo.findMemberProfileByUserId(
    payment.user.toString(),
  );

  if (!memberProfile) {
    throw new Error("Member profile not found for this user");
  }

  // ✅ Handle subscription vs one-time
  if (payment.paymentType === "subscription" && payment.subscriptionInterval) {
    // Create subscription
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

    // Update payment with subscription link
    await PaymentRepo.updatePaymentByReference(reference, {
      status: "completed",
      subscription: subscription._id,
    });
  } else {
    // One-time payment
    await PaymentRepo.updatePaymentByReference(reference, {
      status: "completed",
    });
  }

  // ✅ Add member to class
  if (payment.class) {
    await ClassRepo.addMemberToClass(
      payment.class.toString(),
      memberProfile._id.toString(),
    );
  }

  return { message: "Payment verified successfully", payment };
};

// ... rest of your service functions (getUserPayments, etc.)
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

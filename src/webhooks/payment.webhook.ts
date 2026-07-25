import crypto from "crypto";
import * as PaymentRepo from "../repositories/payment.repository";
import * as ClassRepo from "../repositories/class.repository";
import * as MemberProfileRepo from "../repositories/member-profile.repository";
import * as NotificationService from "../services/notification.service";

export const handlePaystackWebhook = async (
  signature: string,
  payload: string,
) => {
  const hash = crypto
    .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY as string)
    .update(payload)
    .digest("hex");

  if (hash !== signature) {
    throw new Error("Invalid signature");
  }

  const event = JSON.parse(payload);

  if (event.event === "charge.success") {
    const { reference, status } = event.data;

    const payment = await PaymentRepo.findPaymentByReference(reference);

    if (!payment) return;

    if (payment.status === "completed") return;

    await PaymentRepo.updatePaymentByReference(reference, {
      status: status === "success" ? "completed" : "failed",
    });

    // ✅ FIX: Get member profile ID from user ID
    if (status === "success" && payment.class) {
      const memberProfile = await MemberProfileRepo.findMemberProfileByUserId(
        payment.user.toString(),
      );

      if (memberProfile) {
        await ClassRepo.addMemberToClass(
          payment.class.toString(),
          memberProfile._id.toString(), // ✅ Use MEMBER PROFILE ID
        );
      }

      // ✅ Same notification trigger as verifyPayment() — this webhook
      // is a SEPARATE path to "completed" (Paystack calling back
      // directly rather than the user's own redirect), so it needs its
      // own trigger. Both are idempotent against double-notifying: the
      // `if (payment.status === "completed") return;` guard above
      // means whichever path processes completion FIRST is the only
      // one that ever reaches this point.
      let className: string | null = null;
      try {
        const classDoc = await ClassRepo.findClassById(
          payment.class.toString(),
        );
        className = classDoc?.name ?? null;
      } catch {
        className = null;
      }

      await NotificationService.notify({
        userId: payment.user.toString(),
        type: "payment_confirmed",
        title: "Payment Confirmed",
        message: className
          ? `Your payment for "${className}" was successful.`
          : "Your payment was successful.",
        classId: payment.class.toString(),
        paymentId: payment._id.toString(),
      });
    }
  }
};

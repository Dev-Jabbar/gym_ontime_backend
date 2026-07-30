import crypto from "crypto";
import * as PaymentRepo from "../repositories/payment.repository";
import * as ClassRepo from "../repositories/class.repository";
import * as MemberProfileRepo from "../repositories/member-profile.repository";
import * as NotificationService from "../services/notification.service";
import { claimSeat } from "../services/payment.service";

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

    if (status !== "success") {
      // Release the hold immediately rather than waiting out the full
      // reservation window for a payment that already failed.
      const memberProfile = await MemberProfileRepo.findMemberProfileByUserId(
        payment.user.toString(),
      );
      if (memberProfile && payment.class) {
        await ClassRepo.releaseSeat(
          payment.class.toString(),
          memberProfile._id.toString(),
        );
      }
      return;
    }

    if (payment.class) {
      const memberProfile = await MemberProfileRepo.findMemberProfileByUserId(
        payment.user.toString(),
      );

      let enrolled = false;

      if (memberProfile) {
        const seatResult = await claimSeat(
          payment.class.toString(),
          memberProfile._id.toString(),
        );

        if (seatResult === "enrolled" || seatResult === "already-enrolled") {
          enrolled = true;
        } else if (
          seatResult === "hold-expired" ||
          seatResult === "class-full"
        ) {
          await PaymentRepo.updatePaymentByReference(reference, {
            needsReview: true,
          } as any);

          await NotificationService.notify({
            userId: payment.user.toString(),
            type: "payment_needs_review",
            title: "Payment received, seat unavailable",
            message:
              seatResult === "hold-expired"
                ? "Your payment took longer than your reserved spot allowed, and the seat may no longer be available. Our team will follow up shortly."
                : "Your payment went through, but the class filled up before we could confirm your spot. Our team will follow up shortly.",
            classId: payment.class.toString(),
            paymentId: payment._id.toString(),
          });
        } else {
          console.error(
            `claimSeat returned "error" for payment ${payment._id} (webhook path)`,
          );
        }
      }

      if (enrolled) {
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
  }
};

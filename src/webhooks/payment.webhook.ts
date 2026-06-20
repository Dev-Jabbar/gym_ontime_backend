import crypto from "crypto";
import * as PaymentRepo from "../repositories/payment.repository";
import * as ClassRepo from "../repositories/class.repository";
import * as MemberProfileRepo from "../repositories/member-profile.repository"; // ✅ Add this

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
    }
  }
};

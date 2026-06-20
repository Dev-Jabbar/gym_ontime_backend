import { Schema, model, Types } from "mongoose";

export interface IClassSubscription {
  user: Types.ObjectId;
  memberProfile: Types.ObjectId;
  class: Types.ObjectId;

  interval: "weekly" | "monthly" | "quarterly" | "biannual" | "yearly";
  startDate: Date;
  endDate: Date;

  status: "active" | "expired" | "cancelled";
  payment: Types.ObjectId;
}

const schema = new Schema<IClassSubscription>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    memberProfile: {
      type: Schema.Types.ObjectId,
      ref: "MemberProfile",
      required: true,
    },
    class: { type: Schema.Types.ObjectId, ref: "Class", required: true },

    interval: {
      type: String,
      enum: ["weekly", "monthly", "quarterly", "biannual", "yearly"],
      required: true,
    },

    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },

    status: {
      type: String,
      enum: ["active", "expired", "cancelled"],
      default: "active",
    },

    payment: {
      type: Schema.Types.ObjectId,
      ref: "Payment",
      required: true,
    },
  },
  { timestamps: true },
);

export default model("ClassSubscription", schema);

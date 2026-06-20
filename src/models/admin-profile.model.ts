import { Schema, model, Types } from "mongoose";

export interface IAdminProfile {
  userId: Types.ObjectId;
  avatar?: string;
}

const adminSchema = new Schema<IAdminProfile>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    avatar: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

export default model<IAdminProfile>("AdminProfile", adminSchema);

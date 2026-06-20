import { Schema, model, Types } from "mongoose";

export type TrainerGender = "male" | "female" | "prefer_not_to_say";

export interface ITrainerProfile {
  userId: Types.ObjectId;
  avatar?: string;
  bio?: string;
  specialty?: string;
  phone?: string;
  experience?: number; // years
  certifications?: string[];
  availability?: string;
  dateOfBirth?: Date;
  gender?: TrainerGender;
  isActive: boolean;
}

const trainerSchema = new Schema<ITrainerProfile>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    avatar: String,
    bio: String,
    specialty: String,
    phone: String,
    experience: { type: Number, min: 0 },
    certifications: [{ type: String }],
    availability: String,
    dateOfBirth: Date,
    gender: {
      type: String,
      enum: ["male", "female", "prefer_not_to_say"],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true },
);

export default model<ITrainerProfile>("TrainerProfile", trainerSchema);

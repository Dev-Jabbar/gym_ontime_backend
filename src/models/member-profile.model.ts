import { Schema, model, Types } from "mongoose";

export type FitnessGoal =
  | "weight_loss"
  | "muscle_gain"
  | "endurance"
  | "flexibility"
  | "general_fitness";

export type Gender = "male" | "female" | "prefer_not_to_say";

export interface IEmergencyContact {
  name: string;
  phone: string;
}

export interface IMemberProfile {
  userId: Types.ObjectId;
  avatar?: string;
  phone?: string;
  dateOfBirth?: Date;
  gender?: Gender;
  fitnessGoal?: FitnessGoal;
  healthNotes?: string;
  emergencyContact?: IEmergencyContact;
  isActive: boolean;
}

const memberSchema = new Schema<IMemberProfile>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    avatar: {
      type: String,
    },
    phone: {
      type: String,
    },
    dateOfBirth: {
      type: Date,
    },
    gender: {
      type: String,
      enum: ["male", "female", "prefer_not_to_say"],
    },
    fitnessGoal: {
      type: String,
      enum: [
        "weight_loss",
        "muscle_gain",
        "endurance",
        "flexibility",
        "general_fitness",
      ],
    },
    healthNotes: {
      type: String,
    },
    emergencyContact: {
      name: { type: String },
      phone: { type: String },
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true },
);

export default model<IMemberProfile>("MemberProfile", memberSchema);

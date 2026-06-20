import TrainerModel, { ITrainerProfile } from "../models/trainer-profile.model";
import mongoose from "mongoose";

/**
 * CREATE (✅ supports transactions)
 */
export const createTrainerProfile = async (
  data: Partial<ITrainerProfile>,
  session?: mongoose.ClientSession,
) => {
  const result = await TrainerModel.create([{ ...data, isActive: true }], {
    session,
  });
  return result[0];
};

/**
 * FIND ALL ACTIVE PROFILES
 */
export const findAllTrainerProfiles = async () => {
  return TrainerModel.find({ isActive: true });
};

/**
 * FIND PROFILE BY ID (ONLY ACTIVE)
 */
export const findTrainerProfileById = async (id: string) => {
  return TrainerModel.findOne({ _id: id, isActive: true });
};

/**
 * FIND PROFILE BY USER ID (ONLY ACTIVE, supports session)
 */
export const findTrainerProfileByUserId = async (
  userId: string,
  session?: mongoose.ClientSession,
) => {
  const query = TrainerModel.findOne({ userId, isActive: true });
  if (session) query.session(session);
  return query;
};

/**
 * UPDATE PROFILE BY PROFILE ID
 */
export const updateTrainerProfile = async (
  id: string,
  data: Partial<ITrainerProfile>,
  session?: mongoose.ClientSession,
) => {
  return TrainerModel.findByIdAndUpdate(id, data, { new: true, session });
};

/**
 * 🔥 UPDATE PROFILE BY USER ID (SOFT DELETE / REACTIVATE)
 */
export const updateTrainerProfileByUserId = async (
  userId: string,
  data: Partial<ITrainerProfile>,
  session?: mongoose.ClientSession,
) => {
  return TrainerModel.findOneAndUpdate(
    { userId },
    { $set: data },
    { new: true, session },
  );
};

/**
 * ❌ HARD DELETE BY PROFILE ID (INTERNAL ONLY)
 */
export const deleteTrainerProfile = async (id: string) => {
  return TrainerModel.findByIdAndDelete(id);
};

/**
 * ✅ SOFT DELETE BY USER ID (sets isActive: false)
 */
export const deleteTrainerProfileByUserId = (
  userId: string,
  session?: mongoose.ClientSession,
) => {
  return TrainerModel.findOneAndUpdate(
    { userId },
    { $set: { isActive: false } },
    { new: true, session },
  );
};

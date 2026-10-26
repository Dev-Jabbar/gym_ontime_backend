import TrainerModel, { ITrainerProfile } from "../models/trainer-profile.model";
import mongoose from "mongoose";

/** Creates a trainer profile (supports transactions). */
export const createTrainerProfile = async (
  data: Partial<ITrainerProfile>,
  session?: mongoose.ClientSession,
) => {
  const result = await TrainerModel.create([{ ...data, isActive: true }], {
    session,
  });
  return result[0];
};

/** Lists all active trainer profiles. */
export const findAllTrainerProfiles = async () => {
  return TrainerModel.find({ isActive: true });
};

/** Finds an active trainer profile by id. */
export const findTrainerProfileById = async (id: string) => {
  return TrainerModel.findOne({ _id: id, isActive: true });
};

/** Finds the active trainer profile of a user (supports transactions). */
export const findTrainerProfileByUserId = async (
  userId: string,
  session?: mongoose.ClientSession,
) => {
  const query = TrainerModel.findOne({ userId, isActive: true });
  if (session) query.session(session);
  return query;
};

/** Updates a trainer profile by id. */
export const updateTrainerProfile = async (
  id: string,
  data: Partial<ITrainerProfile>,
  session?: mongoose.ClientSession,
) => {
  return TrainerModel.findByIdAndUpdate(id, data, { new: true, session });
};

/** Updates a trainer profile by user id (used for soft delete and reactivation). */
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

/** Permanently deletes a trainer profile. Internal use only. */
export const deleteTrainerProfile = async (id: string) => {
  return TrainerModel.findByIdAndDelete(id);
};

/** Soft-deletes the trainer profile of a user (sets isActive to false). */
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

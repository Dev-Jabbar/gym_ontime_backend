import UserModel, { IUser } from "../models/user.model";
import mongoose from "mongoose";

/** Creates a user. */
export const createUser = async (data: Partial<IUser>) => {
  return UserModel.create({
    ...data,
    isActive: true,
    deletedAt: null,
  });
};

/** Lists all active users. */
export const findAllUsers = async () => {
  return UserModel.find({ isActive: true }).select("-password");
};

/** Finds an active user by id (supports transactions). */
export const findUserById = async (
  id: string,
  session?: mongoose.ClientSession,
) => {
  return UserModel.findOne({ _id: id, isActive: true })
    .session(session ?? null)
    .select("-password");
};

/** Finds an active user by email. */
export const findUserByEmail = async (email: string) => {
  return UserModel.findOne({ email, isActive: true });
};

/** Finds a user by email, including soft-deleted users. */
export const findUserByEmailIncludingDeleted = async (email: string) => {
  return UserModel.findOne({ email }); // No isActive filter
};

/** Updates a user (supports transactions). */
export const updateUser = async (
  id: string,
  data: Partial<IUser>,
  session?: mongoose.ClientSession,
) => {
  return UserModel.findByIdAndUpdate(id, data, {
    new: true,
    session,
    select: "-password",
  });
};

/** Soft-deletes a user: the normal way a user is removed. */
export const softDeleteUser = async (
  userId: string,
  session?: mongoose.ClientSession,
) => {
  return UserModel.findByIdAndUpdate(
    userId,
    {
      isActive: false,
      deletedAt: new Date(),
    },
    { new: true, session },
  );
};

/** Permanently deletes a user. Internal and cleanup use only. */
export const deleteUser = (
  userId: string,
  session?: mongoose.ClientSession,
) => {
  return UserModel.findByIdAndDelete(userId, { session });
};

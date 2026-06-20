import UserModel, { IUser } from "../models/user.model";
import mongoose from "mongoose";

/**
 * CREATE
 */
export const createUser = async (data: Partial<IUser>) => {
  return UserModel.create({
    ...data,
    isActive: true,
    deletedAt: null,
  });
};

/**
 * FIND ALL (ONLY ACTIVE)
 */
export const findAllUsers = async () => {
  return UserModel.find({ isActive: true }).select("-password");
};

/**
 * FIND BY ID (ONLY ACTIVE, supports transactions)
 */
export const findUserById = async (
  id: string,
  session?: mongoose.ClientSession,
) => {
  return UserModel.findOne({ _id: id, isActive: true })
    .session(session ?? null)
    .select("-password");
};

/**
 * FIND BY EMAIL (ONLY ACTIVE)
 */
export const findUserByEmail = async (email: string) => {
  return UserModel.findOne({ email, isActive: true });
};

/**
 * FIND BY EMAIL (INCLUDING DELETED) ✅ ADD THIS
 */
export const findUserByEmailIncludingDeleted = async (email: string) => {
  return UserModel.findOne({ email }); // No isActive filter
};

/**
 * UPDATE (supports transactions)
 */
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

/**
 * 🔥 SOFT DELETE USER (MAIN DELETE FLOW)
 */
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

/**
 * ❌ HARD DELETE USER (INTERNAL / CLEANUP ONLY)
 */
export const deleteUser = (
  userId: string,
  session?: mongoose.ClientSession,
) => {
  return UserModel.findByIdAndDelete(userId, { session });
};

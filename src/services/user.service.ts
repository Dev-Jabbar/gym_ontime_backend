import * as userRepository from "../repositories/user.repository";
import * as memberProfileRepository from "../repositories/member-profile.repository";
import * as trainerRepository from "../repositories/trainer-profile.repository";
import * as classRepository from "../repositories/class.repository";

import mongoose, { Types } from "mongoose";
import { AppError } from "../errors/AppError";
import { signToken } from "../utils/jwt";

// REGISTER USER
export const registerUser = async (data: {
  name: string;
  email: string;
  password: string;
}) => {
  const existing = await userRepository.findUserByEmailIncludingDeleted(
    data.email,
  );

  if (existing && existing.isActive) {
    throw new AppError("Email already in use", 409);
  }

  // Restore deleted account
  if (existing && !existing.isActive) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const restoredUser = await userRepository.updateUser(
        existing._id.toString(),
        {
          isActive: true,
          deletedAt: null,
          role: "member",
          password: data.password,
          name: data.name,
        },
        session,
      );

      if (!restoredUser) throw new AppError("Failed to restore user", 500);

      // Restore member profile if exists
      const memberProfile =
        await memberProfileRepository.findMemberProfileByUserIdIncludingInactive(
          existing._id.toString(),
          session,
        );

      if (memberProfile) {
        await memberProfileRepository.updateMemberProfileByUserId(
          existing._id.toString(),
          { isActive: true },
          session,
        );
      } else {
        // ✅ Create if somehow missing
        await memberProfileRepository.createMemberProfile({
          userId: new Types.ObjectId(existing._id.toString()),
          isActive: true,
        });
      }

      await session.commitTransaction();

      return {
        id: restoredUser._id,
        name: restoredUser.name,
        email: restoredUser.email,
        role: restoredUser.role,
      };
    } catch (e) {
      await session.abortTransaction();
      throw e;
    } finally {
      session.endSession();
    }
  }

  // New user
  const user = await userRepository.createUser({
    name: data.name,
    email: data.email,
    password: data.password,
    role: "member",
  });

  // ✅ Auto-create minimal member profile
  await memberProfileRepository.createMemberProfile({
    userId: new Types.ObjectId(user._id.toString()),
    isActive: true,
  });

  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
};

// LOGIN USER
export const loginUser = async (email: string, password: string) => {
  const user = await userRepository.findUserByEmail(email);
  if (!user) throw new AppError("Invalid email or password", 401);

  const isMatch = await user.comparePassword(password);
  if (!isMatch) throw new AppError("Invalid email or password", 401);

  const token = signToken({
    id: user._id.toString(),
    role: user.role,
    email: user.email,
  });

  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    token,
  };
};

// GET ALL USERS (admin)
export const getAllUsers = async () => {
  return userRepository.findAllUsers();
};

// GET USER BY ID
export const getUserById = async (id: string) => {
  const user = await userRepository.findUserById(id);
  if (!user) throw new AppError("User not found", 404);
  return user;
};

// UPDATE USER
export const updateUser = async (
  id: string,
  data: {
    name?: string;
    email?: string;
    role?: "member" | "trainer" | "admin";
  },
) => {
  const user = await userRepository.findUserById(id);
  if (!user) throw new AppError("User not found", 404);

  const roleChanged = data.role && data.role !== user.role;
  const emailChanged = data.email && data.email !== user.email;

  const updatedUser = await userRepository.updateUser(id, {
    ...(data.name && { name: data.name }),
    ...(data.email && { email: data.email }),
    ...(data.role && { role: data.role }),
  });

  if (!updatedUser) throw new AppError("User update failed", 500);

  let token: string | undefined;
  if (roleChanged || emailChanged) {
    token = signToken({
      id: updatedUser._id.toString(),
      role: updatedUser.role,
      email: updatedUser.email,
    });
  }

  return {
    id: updatedUser._id,
    name: updatedUser.name,
    email: updatedUser.email,
    role: updatedUser.role,
    ...(token && { token }),
  };
};

// UPGRADE USER TO TRAINER (ADMIN)
export const upgradeToTrainer = async (id: string) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const user = await userRepository.findUserById(id);
    if (!user) throw new AppError("User not found", 404);

    if (user.role === "trainer") {
      throw new AppError("User is already a trainer", 409);
    }

    // Update role to trainer
    const updatedUser = await userRepository.updateUser(
      id,
      { role: "trainer" },
      session,
    );
    if (!updatedUser) throw new AppError("Failed to upgrade user", 500);

    // Deactivate member profile if exists
    const memberProfile =
      await memberProfileRepository.findMemberProfileByUserId(id);
    if (memberProfile) {
      await memberProfileRepository.updateMemberProfileByUserId(
        id,
        { isActive: false },
        session,
      );
    }

    // Create or reactivate trainer profile
    const existingTrainer =
      await trainerRepository.findTrainerProfileByUserId(id);
    if (existingTrainer) {
      await trainerRepository.updateTrainerProfileByUserId(
        id,
        { isActive: true },
        session,
      );
    } else {
      await trainerRepository.createTrainerProfile({
        userId: new Types.ObjectId(id),
        isActive: true,
      });
    }

    await session.commitTransaction();

    return {
      id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
    };
  } catch (e) {
    await session.abortTransaction();
    throw e;
  } finally {
    session.endSession();
  }
};

// SOFT DELETE USER (CASCADING CLEANUP)
export const deleteUser = async (id: string) => {
  const user = await userRepository.findUserById(id);
  if (!user) throw new AppError("User not found", 404);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = user._id.toString();

    const memberProfile =
      await memberProfileRepository.findMemberProfileByUserId(userId);
    const trainerProfile = await trainerRepository.findTrainerProfileByUserId(
      userId,
      session,
    );

    if (memberProfile) {
      await memberProfileRepository.updateMemberProfileByUserId(
        userId,
        { isActive: false },
        session,
      );

      // Remove member from all classes
      await classRepository.removeMemberFromClasses(
        memberProfile._id.toString(),
        session,
      );
    }

    if (trainerProfile) {
      await trainerRepository.updateTrainerProfileByUserId(
        userId,
        { isActive: false },
        session,
      );

      // Remove trainer from all classes
      await classRepository.removeTrainerFromClassesByUser(
        trainerProfile._id.toString(),
        session,
      );
    }

    await userRepository.softDeleteUser(userId, session);

    await session.commitTransaction();
  } catch (e) {
    await session.abortTransaction();
    throw e;
  } finally {
    session.endSession();
  }
};

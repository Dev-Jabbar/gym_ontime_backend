import * as userRepository from "../repositories/user.repository";
import * as memberProfileRepository from "../repositories/member-profile.repository";
import * as trainerRepository from "../repositories/trainer-profile.repository";
import * as classRepository from "../repositories/class.repository";

import mongoose, { Types } from "mongoose";
import { AppError } from "../errors/AppError";
import { signToken } from "../utils/jwt";

// ============================================================
// REGISTER USER
// Handles three distinct scenarios:
//   1. Email already belongs to an active account -> reject
//   2. Email belongs to a soft-deleted account -> restore it
//   3. Email is brand new -> create a fresh user + member profile
// ============================================================
export const registerUser = async (data: {
  name: string;
  email: string;
  password: string;
}) => {
  // Look up the user even if they were previously soft-deleted,
  // since we need to distinguish "in use" from "reusable" emails.
  const existing = await userRepository.findUserByEmailIncludingDeleted(
    data.email,
  );

  // Case 1: An active user already owns this email -> block registration.
  if (existing && existing.isActive) {
    throw new AppError("Email already in use", 409);
  }

  // Case 2: A soft-deleted user owns this email -> reactivate their account
  // instead of creating a duplicate. This is done inside a transaction
  // because it touches both the user document and their member profile,
  // and both must succeed or fail together.
  if (existing && !existing.isActive) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Flip the user back to active, clear the deletion timestamp,
      // reset their role to "member" (in case they were a trainer/admin
      // before deletion), and overwrite name/password with the new
      // registration data.
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

      // Check whether the old member profile still exists (it may have
      // been soft-deleted/deactivated alongside the user).
      const memberProfile =
        await memberProfileRepository.findMemberProfileByUserIdIncludingInactive(
          existing._id.toString(),
          session,
        );

      if (memberProfile) {
        // Reactivate the existing profile rather than creating a new one.
        await memberProfileRepository.updateMemberProfileByUserId(
          existing._id.toString(),
          { isActive: true },
          session,
        );
      } else {
        // ✅ Edge case safety net: if no member profile exists at all
        // (e.g. data inconsistency), create one so the restored user
        // isn't left without a profile.
        await memberProfileRepository.createMemberProfile({
          userId: new Types.ObjectId(existing._id.toString()),
          isActive: true,
        });
      }

      // Both the user restore and profile restore succeeded -> commit.
      await session.commitTransaction();

      return {
        id: restoredUser._id,
        name: restoredUser.name,
        email: restoredUser.email,
        role: restoredUser.role,
      };
    } catch (e) {
      // Roll back both the user update and profile update if anything failed.
      await session.abortTransaction();
      throw e;
    } finally {
      // Always release the session, whether commit or abort happened.
      session.endSession();
    }
  }

  // Case 3: Completely new email -> create a brand new user record.
  const user = await userRepository.createUser({
    name: data.name,
    email: data.email,
    password: data.password,
    role: "member",
  });

  // ✅ Every new member-role user automatically gets a minimal member
  // profile created alongside their account, so downstream features
  // (bookings, classes, etc.) always have a profile to attach to.
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

// ============================================================
// LOGIN USER
// Verifies credentials and issues a signed JWT on success.
// ============================================================
export const loginUser = async (email: string, password: string) => {
  // Only active users can be found via this lookup (soft-deleted users
  // are excluded), so a deleted account effectively can't log in.
  const user = await userRepository.findUserByEmail(email);
  if (!user) throw new AppError("Invalid email or password", 401);

  // Compare the plaintext password against the stored hash.
  // Note: error message is intentionally generic ("Invalid email or
  // password") for both "no such user" and "wrong password" cases,
  // to avoid leaking which one was wrong (prevents user enumeration).
  const isMatch = await user.comparePassword(password);
  if (!isMatch) throw new AppError("Invalid email or password", 401);

  // Generate a JWT embedding the user's id, role, and email so
  // subsequent requests can be authenticated/authorized without
  // hitting the database every time.
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

// ============================================================
// GET ALL USERS (admin-only endpoint, authorization assumed
// to be enforced at the route/controller layer)
// ============================================================
export const getAllUsers = async () => {
  return userRepository.findAllUsers();
};

// ============================================================
// GET USER BY ID
// ============================================================
export const getUserById = async (id: string) => {
  const user = await userRepository.findUserById(id);
  if (!user) throw new AppError("User not found", 404);
  return user;
};

// ============================================================
// UPDATE USER
// Updates basic profile fields (name/email/role). If the role or
// email changes, a new JWT is issued since the old token would now
// contain stale claims (e.g. outdated role for authorization checks).
// ============================================================
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

  // Determine before updating whether sensitive claims (role/email)
  // are actually changing, so we know whether to reissue the token.
  const roleChanged = data.role && data.role !== user.role;
  const emailChanged = data.email && data.email !== user.email;

  // Only include fields that were actually provided (partial update),
  // so omitted fields aren't accidentally overwritten with undefined.
  const updatedUser = await userRepository.updateUser(id, {
    ...(data.name && { name: data.name }),
    ...(data.email && { email: data.email }),
    ...(data.role && { role: data.role }),
  });

  if (!updatedUser) throw new AppError("User update failed", 500);

  // If role or email changed, the previously issued JWT is now stale
  // (e.g. it may grant outdated permissions), so mint a fresh one.
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
    // Token is only included in the response if it was actually reissued.
    ...(token && { token }),
  };
};

// ============================================================
// UPGRADE USER TO TRAINER (ADMIN ACTION)
// Promotes a member to a trainer: switches their role, deactivates
// their member profile, and creates/reactivates a trainer profile.
// All steps run in a single transaction since a partial upgrade
// would leave the account in an inconsistent state.
// ============================================================
export const upgradeToTrainer = async (id: string) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const user = await userRepository.findUserById(id);
    if (!user) throw new AppError("User not found", 404);

    // Guard against redundant upgrades.
    if (user.role === "trainer") {
      throw new AppError("User is already a trainer", 409);
    }

    // Step 1: Flip the user's role to "trainer".
    const updatedUser = await userRepository.updateUser(
      id,
      { role: "trainer" },
      session,
    );
    if (!updatedUser) throw new AppError("Failed to upgrade user", 500);

    // Step 2: If they had a member profile, deactivate it (they're no
    // longer operating as a member, but the profile/history is kept
    // rather than deleted, in case they're ever downgraded back).
    const memberProfile =
      await memberProfileRepository.findMemberProfileByUserId(id);
    if (memberProfile) {
      await memberProfileRepository.updateMemberProfileByUserId(
        id,
        { isActive: false },
        session,
      );
    }

    // Step 3: Set up their trainer profile. If one already exists
    // (e.g. they were a trainer before and got downgraded), reactivate
    // it to preserve history; otherwise create a new one from scratch.
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

    // All three steps succeeded -> persist the changes together.
    await session.commitTransaction();

    return {
      id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
    };
  } catch (e) {
    // If any step fails (e.g. profile creation errors out), undo the
    // role change too, so we don't end up with a "trainer" who has
    // no trainer profile.
    await session.abortTransaction();
    throw e;
  } finally {
    session.endSession();
  }
};

// ============================================================
// SOFT DELETE USER (CASCADING CLEANUP)
// Deactivates the user and any associated member/trainer profiles,
// and removes them from any classes they're enrolled in or teaching.
// Nothing is hard-deleted — everything is flagged inactive — so data
// can be restored later (see registerUser's restore-on-reuse logic).
// ============================================================
export const deleteUser = async (id: string) => {
  const user = await userRepository.findUserById(id);
  if (!user) throw new AppError("User not found", 404);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = user._id.toString();

    // Look up both profile types up front — a user could in theory
    // have either or both (though current upgrade logic suggests only
    // one is active at a time).
    const memberProfile =
      await memberProfileRepository.findMemberProfileByUserId(userId);
    const trainerProfile = await trainerRepository.findTrainerProfileByUserId(
      userId,
      session,
    );

    // If they have a member profile: deactivate it and pull them out
    // of every class they're enrolled in as a member.
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

    // If they have a trainer profile: deactivate it and remove them
    // from every class they're assigned to teach.
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

    // Finally, mark the user record itself as soft-deleted
    // (sets isActive: false / deletedAt timestamp internally).
    await userRepository.softDeleteUser(userId, session);

    // All cascading cleanup succeeded -> commit as one atomic operation.
    await session.commitTransaction();
  } catch (e) {
    // Roll back everything if any part of the cascade fails, so we
    // never end up with a half-deleted user (e.g. deactivated profile
    // but still enrolled in classes).
    await session.abortTransaction();
    throw e;
  } finally {
    session.endSession();
  }
};

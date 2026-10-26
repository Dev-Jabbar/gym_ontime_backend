import * as userRepository from "../repositories/user.repository";
import * as memberProfileRepository from "../repositories/member-profile.repository";
import * as trainerRepository from "../repositories/trainer-profile.repository";
import * as classRepository from "../repositories/class.repository";

import mongoose, { Types } from "mongoose";
import { AppError } from "../errors/AppError";
import { signToken } from "../utils/jwt";

/**
 * Registers a user. Three cases:
 *   1. The email belongs to an active account: reject.
 *   2. The email belongs to a soft-deleted account: restore it.
 *   3. The email is new: create a user and a member profile.
 */
export const registerUser = async (data: {
  name: string;
  email: string;
  password: string;
}) => {
  // Look the user up even if soft-deleted, to tell an email that is "in use"
  // from one that can be reused.
  const existing = await userRepository.findUserByEmailIncludingDeleted(
    data.email,
  );

  // Case 1: an active user owns this email, so block registration.
  if (existing && existing.isActive) {
    throw new AppError("Email already in use", 409);
  }

  // Case 2: a soft-deleted user owns this email. Reactivate the account
  // instead of creating a duplicate. This runs in a transaction because it
  // touches both the user and the member profile, and both must succeed or
  // fail together.
  if (existing && !existing.isActive) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Reactivate the user, clear the deletion timestamp, reset the role to
      // "member" (they may have been a trainer or admin before deletion) and
      // overwrite name and password with the new registration data.
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

      // Check whether the old member profile still exists (it may have been
      // deactivated together with the user).
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
        // Safety net for inconsistent data: if no member profile exists at
        // all, create one so the restored user is not left without a profile.
        await memberProfileRepository.createMemberProfile({
          userId: new Types.ObjectId(existing._id.toString()),
          isActive: true,
        });
      }

      // The user restore and the profile restore both succeeded: commit.
      await session.commitTransaction();

      return {
        id: restoredUser._id,
        name: restoredUser.name,
        email: restoredUser.email,
        role: restoredUser.role,
      };
    } catch (e) {
      // Roll back both writes if either failed.
      await session.abortTransaction();
      throw e;
    } finally {
      // Always release the session, whether the transaction committed or aborted.
      session.endSession();
    }
  }

  // Case 3: a new email. Create a new user.
  const user = await userRepository.createUser({
    name: data.name,
    email: data.email,
    password: data.password,
    role: "member",
  });

  // Every new member gets a minimal member profile alongside the account, so
  // bookings and classes always have a profile to attach to.
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

/**
 * Verifies credentials and issues a signed JWT on success.
 */
export const loginUser = async (email: string, password: string) => {
  // Only active users are found by this lookup, so a soft-deleted account
  // cannot log in.
  const user = await userRepository.findUserByEmail(email);
  if (!user) throw new AppError("Invalid email or password", 401);

  // Compare the plaintext password against the stored hash. The error is
  // deliberately generic ("Invalid email or password") for both "no such
  // user" and "wrong password", so the response cannot be used to find out
  // which accounts exist.
  const isMatch = await user.comparePassword(password);
  if (!isMatch) throw new AppError("Invalid email or password", 401);

  // The token carries the user's id, role and email, so later requests can
  // be authenticated and authorized without a database lookup.
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

/**
 * Lists all active users. Authorization (admin only) is enforced at the
 * route layer.
 */
export const getAllUsers = async () => {
  return userRepository.findAllUsers();
};

/** Finds an active user by id. */
export const getUserById = async (id: string) => {
  const user = await userRepository.findUserById(id);
  if (!user) throw new AppError("User not found", 404);
  return user;
};

/**
 * Updates a user's name, email or role. If the role or email changes, a new
 * JWT is issued, because the old token would carry stale claims (for
 * example an outdated role for authorization checks).
 */
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

  // Work out before updating whether the claims in the token (role, email)
  // are changing, to know whether the token must be reissued.
  const roleChanged = data.role && data.role !== user.role;
  const emailChanged = data.email && data.email !== user.email;

  // Include only the fields that were provided (partial update), so omitted
  // fields are not overwritten with undefined.
  const updatedUser = await userRepository.updateUser(id, {
    ...(data.name && { name: data.name }),
    ...(data.email && { email: data.email }),
    ...(data.role && { role: data.role }),
  });

  if (!updatedUser) throw new AppError("User update failed", 500);

  // A changed role or email makes the previously issued JWT stale (it may
  // grant outdated permissions), so mint a fresh one.
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
    // The token is included in the response only if it was reissued.
    ...(token && { token }),
  };
};

/**
 * Promotes a member to trainer (admin action): switches the role,
 * deactivates the member profile and creates or reactivates a trainer
 * profile. Everything runs in one transaction, because a partial upgrade
 * would leave the account inconsistent.
 */
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

    // 1. Switch the role to "trainer".
    const updatedUser = await userRepository.updateUser(
      id,
      { role: "trainer" },
      session,
    );
    if (!updatedUser) throw new AppError("Failed to upgrade user", 500);

    // 2. Deactivate the member profile if there is one. The user is no longer
    // a member, but the profile and its history are kept in case they are
    // ever downgraded.
    const memberProfile =
      await memberProfileRepository.findMemberProfileByUserId(id);
    if (memberProfile) {
      await memberProfileRepository.updateMemberProfileByUserId(
        id,
        { isActive: false },
        session,
      );
    }

    // 3. Set up the trainer profile: reactivate an existing one (for example
    // after a downgrade) to preserve history, otherwise create a new one.
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

    // All three steps succeeded: persist the changes together.
    await session.commitTransaction();

    return {
      id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
    };
  } catch (e) {
    // If any step fails, undo the role change too, so there is never a
    // "trainer" without a trainer profile.
    await session.abortTransaction();
    throw e;
  } finally {
    session.endSession();
  }
};

/**
 * Soft-deletes a user: deactivates the user and any member or trainer
 * profile, and removes them from the classes they attend or teach. Nothing
 * is hard-deleted, so the data can be restored later (see the
 * restore-on-reuse case in registerUser).
 */
export const deleteUser = async (id: string) => {
  const user = await userRepository.findUserById(id);
  if (!user) throw new AppError("User not found", 404);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = user._id.toString();

    // Look up both profile types up front. A user could in theory have
    // either or both, although the upgrade logic keeps only one active.
    const memberProfile =
      await memberProfileRepository.findMemberProfileByUserId(userId);
    const trainerProfile = await trainerRepository.findTrainerProfileByUserId(
      userId,
      session,
    );

    // A member profile: deactivate it and remove the user from every class
    // they are enrolled in.
    if (memberProfile) {
      await memberProfileRepository.updateMemberProfileByUserId(
        userId,
        { isActive: false },
        session,
      );

      // Remove the member from all classes.
      await classRepository.removeMemberFromClasses(
        memberProfile._id.toString(),
        session,
      );
    }

    // A trainer profile: deactivate it and unassign the user from every class
    // they teach.
    if (trainerProfile) {
      await trainerRepository.updateTrainerProfileByUserId(
        userId,
        { isActive: false },
        session,
      );

      // Remove the trainer from all classes.
      await classRepository.removeTrainerFromClassesByUser(
        trainerProfile._id.toString(),
        session,
      );
    }

    // Finally, soft-delete the user record itself (sets isActive to false
    // and a deletedAt timestamp).
    await userRepository.softDeleteUser(userId, session);

    // The whole cascade succeeded: commit as one atomic operation.
    await session.commitTransaction();
  } catch (e) {
    // Roll back everything if any part of the cascade fails, so a user is
    // never left half-deleted (for example a deactivated profile but still
    // enrolled in classes).
    await session.abortTransaction();
    throw e;
  } finally {
    session.endSession();
  }
};

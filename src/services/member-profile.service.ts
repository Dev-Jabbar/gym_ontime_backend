import * as memberRepository from "../repositories/member-profile.repository";
import * as classRepository from "../repositories/class.repository";
import { AppError } from "../errors/AppError";
import { IUser } from "../models/user.model";
import { FitnessGoal, Gender } from "../models/member-profile.model";
import { Types } from "mongoose";
import mongoose from "mongoose";

interface MemberProfileData {
  avatar?: string;
  phone?: string;
  dateOfBirth?: Date;
  gender?: Gender;
  fitnessGoal?: FitnessGoal;
  healthNotes?: string;
  emergencyContact?: {
    name: string;
    phone: string;
  };
}

/**
 * Creates a member profile for a user, or, if one already exists but was
 * soft-deleted (`isActive: false`), reactivates it with the new data instead
 * of creating a second profile.
 *
 * `deleteMyMemberProfile` never hard-deletes a profile, so a returning member
 * keeps their history. Without this check, a user who deleted and later
 * recreated their profile would end up with two documents for one account.
 */
export const createMemberProfile = async (
  user: IUser,
  data?: MemberProfileData,
) => {
  const userObjectId = new Types.ObjectId(user._id);

  const existingProfile =
    await memberRepository.findMemberProfileByUserIdIncludingInactive(
      userObjectId.toString(),
    );

  if (existingProfile) {
    return memberRepository.updateMemberProfile(
      existingProfile._id.toString(),
      {
        avatar: data?.avatar,
        phone: data?.phone,
        dateOfBirth: data?.dateOfBirth,
        gender: data?.gender,
        fitnessGoal: data?.fitnessGoal,
        healthNotes: data?.healthNotes,
        emergencyContact: data?.emergencyContact,
        isActive: true,
      },
    );
  }

  return memberRepository.createMemberProfile({
    userId: userObjectId,
    avatar: data?.avatar,
    phone: data?.phone,
    dateOfBirth: data?.dateOfBirth,
    gender: data?.gender,
    fitnessGoal: data?.fitnessGoal,
    healthNotes: data?.healthNotes,
    emergencyContact: data?.emergencyContact,
    isActive: true,
  });
};

/** Returns a member's own profile. */
export const getMyMemberProfile = async (userId: string) => {
  const memberProfile =
    await memberRepository.findMemberProfileByUserId(userId);

  if (!memberProfile) {
    throw new AppError("Member profile not found", 404);
  }

  return memberProfile;
};

export const getMemberAvatar = async (userId: string) => {
  const profile = await memberRepository.findMemberProfileByUserId(userId);
  return profile?.avatar ?? null;
};

/** Updates a member's own profile. */
export const updateMyMemberProfile = async (
  userId: string,
  data: MemberProfileData,
) => {
  const memberProfile =
    await memberRepository.findMemberProfileByUserId(userId);

  if (!memberProfile) {
    throw new AppError("Member profile not found", 404);
  }

  return memberRepository.updateMemberProfile(
    memberProfile._id.toString(),
    data,
  );
};

/**
 * Soft-deletes a member's profile. It runs in a MongoDB transaction because
 * two separate writes must succeed or fail together: removing the member from
 * every class they are enrolled in, and marking the profile inactive. Without
 * a transaction, a crash between the two could leave a "ghost" member still
 * counted toward a class's capacity with no profile behind it.
 */
export const deleteMyMemberProfile = async (userId: string) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const memberProfile = await memberRepository.findMemberProfileByUserId(
      userId,
      session,
    );

    if (!memberProfile) {
      throw new AppError("Member profile not found", 404);
    }

    await classRepository.removeMemberFromClasses(
      memberProfile._id.toString(),
      session,
    );

    await memberRepository.deleteMemberProfileByUserId(userId, session);

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/** Lists all member profiles. */
export const getAllMemberProfiles = async () => {
  return memberRepository.findAllMemberProfiles();
};

/** Returns one member profile. */
export const getMemberProfileById = async (id: string) => {
  const memberProfile = await memberRepository.findMemberProfileById(id);

  if (!memberProfile) {
    throw new AppError("Member profile not found", 404);
  }

  return memberProfile;
};

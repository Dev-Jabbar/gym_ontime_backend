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
 * Creates a member profile for a user — or, if one already exists but
 * was previously soft-deleted (`isActive: false`), reactivates it with
 * the newly supplied data instead of creating a second profile.
 *
 * This matters because `deleteMyMemberProfile` below never hard-deletes
 * a profile document; it's kept around (inactive) so a returning member
 * doesn't lose their history. Without this check, a user who deleted
 * and later recreated their profile would end up with two documents
 * for the same account.
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

/**
 * GET MY MEMBER PROFILE
 */
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

/**
 * UPDATE MY MEMBER PROFILE
 */
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
 * Deletes a member's profile — really a soft delete: everything below
 * runs inside a MongoDB transaction because it's two separate writes
 * that must succeed or fail together. Removing the member from every
 * class they're enrolled in, and marking their profile inactive
 * (`memberRepository.deleteMemberProfileByUserId` flips `isActive` to
 * `false` rather than removing the document — see that function's own
 * comment), are not atomic on their own. Without a transaction, a
 * crash between the two steps could leave a "ghost" member still
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

/**
 * PUBLIC: GET ALL MEMBER PROFILES
 */
export const getAllMemberProfiles = async () => {
  return memberRepository.findAllMemberProfiles();
};

/**
 * PUBLIC: GET MEMBER PROFILE BY ID
 */
export const getMemberProfileById = async (id: string) => {
  const memberProfile = await memberRepository.findMemberProfileById(id);

  if (!memberProfile) {
    throw new AppError("Member profile not found", 404);
  }

  return memberProfile;
};

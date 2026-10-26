import MemberProfileModel, {
  IMemberProfile,
} from "../models/member-profile.model";
import mongoose from "mongoose";

/** Creates a member profile. */
export const createMemberProfile = async (
  data: Partial<IMemberProfile>,
  session?: mongoose.ClientSession,
) => {
  const result = await MemberProfileModel.create(
    [{ ...data, isActive: true }],
    session ? { session } : undefined,
  );

  return result[0];
};

/** Lists all active member profiles. */
export const findAllMemberProfiles = async () => {
  return MemberProfileModel.find({ isActive: true });
};

/** Finds a member profile by id. */
export const findMemberProfileById = async (id: string) => {
  return MemberProfileModel.findOne({ _id: id, isActive: true });
};

/** Finds the active member profile of a user. */
export const findMemberProfileByUserId = async (
  userId: string,
  session?: mongoose.ClientSession,
) => {
  const query = MemberProfileModel.findOne({ userId, isActive: true });
  if (session) query.session(session);
  return query;
};

/** Updates a member profile by id. */
export const updateMemberProfile = async (
  id: string,
  data: Partial<IMemberProfile>,
  session?: mongoose.ClientSession,
) => {
  return MemberProfileModel.findByIdAndUpdate(id, data, {
    new: true,
    session,
  });
};

/** Updates a member profile by user id (used for soft delete and reactivation). */
export const updateMemberProfileByUserId = async (
  userId: string,
  data: Partial<IMemberProfile>,
  session?: mongoose.ClientSession,
) => {
  return MemberProfileModel.findOneAndUpdate(
    { userId },
    { $set: data },
    { new: true, session },
  );
};

/**
 * Soft-deletes the member profile of a user. Despite the name it flips
 * `isActive` to `false` instead of removing the document, so a returning
 * member's history is preserved (`createMemberProfile` in the service layer
 * reactivates the profile instead of duplicating it).
 */
export const deleteMemberProfileByUserId = (
  userId: string,
  session?: mongoose.ClientSession,
) => {
  return MemberProfileModel.findOneAndUpdate(
    { userId },
    { $set: { isActive: false } },
    { new: true, session },
  );
};

/** Finds the member profile of a user, including inactive ones. */
export const findMemberProfileByUserIdIncludingInactive = async (
  userId: string,
  session?: mongoose.ClientSession,
) => {
  const query = MemberProfileModel.findOne({ userId });
  if (session) query.session(session);
  return query;
};

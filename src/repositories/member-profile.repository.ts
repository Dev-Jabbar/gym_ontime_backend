import MemberProfileModel, {
  IMemberProfile,
} from "../models/member-profile.model";
import mongoose from "mongoose";

/**
 * CREATE MEMBER PROFILE
 */
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

/**
 * FIND ALL ACTIVE MEMBER PROFILES
 */
export const findAllMemberProfiles = async () => {
  return MemberProfileModel.find({ isActive: true });
};

/**
 * FIND MEMBER PROFILE BY ID
 */
export const findMemberProfileById = async (id: string) => {
  return MemberProfileModel.findOne({ _id: id, isActive: true });
};

/**
 * FIND MEMBER PROFILE BY USER ID
 */
export const findMemberProfileByUserId = async (
  userId: string,
  session?: mongoose.ClientSession,
) => {
  const query = MemberProfileModel.findOne({ userId, isActive: true });
  if (session) query.session(session);
  return query;
};

/**
 * UPDATE MEMBER PROFILE BY ID
 */
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

/**
 * SOFT DELETE / UPDATE BY USER ID
 */
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
 * ✅ SOFT DELETE BY USER ID (sets isActive: false)
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

/**
 * FIND MEMBER PROFILE BY USER ID (INCLUDING INACTIVE)
 */
export const findMemberProfileByUserIdIncludingInactive = async (
  userId: string,
  session?: mongoose.ClientSession,
) => {
  const query = MemberProfileModel.findOne({ userId });
  if (session) query.session(session);
  return query;
};

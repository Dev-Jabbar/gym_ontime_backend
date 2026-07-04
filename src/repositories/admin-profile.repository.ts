import AdminProfile, { IAdminProfile } from "../models/admin-profile.model";

export const findAdminProfileByUserId = async (userId: string) => {
  return AdminProfile.findOne({ userId });
};

/**
 * Upsert rather than a plain update — admin accounts are created via
 * the seed script (see package.json's seed:admin), not the public
 * register flow, so there's no guarantee an AdminProfile document
 * exists yet the first time an admin saves their avatar.
 */
export const upsertAdminProfileByUserId = async (
  userId: string,
  data: Partial<IAdminProfile>,
) => {
  return AdminProfile.findOneAndUpdate(
    { userId },
    { $set: data },
    { upsert: true, new: true },
  );
};

import AdminProfile, { IAdminProfile } from "../models/admin-profile.model";

export const findAdminProfileByUserId = async (userId: string) => {
  return AdminProfile.findOne({ userId });
};

/**
 * Upsert rather than a plain update: admin accounts are created by the seed
 * script (see `seed:admin` in package.json), not the public register flow,
 * so an AdminProfile document may not exist yet the first time an admin
 * saves their avatar.
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

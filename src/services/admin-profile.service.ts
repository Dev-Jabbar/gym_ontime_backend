import * as adminProfileRepository from "../repositories/admin-profile.repository";

export const getAdminAvatar = async (userId: string) => {
  const profile = await adminProfileRepository.findAdminProfileByUserId(userId);
  return profile?.avatar ?? null;
};

import * as adminProfileRepository from "../repositories/admin-profile.repository";

export const getAdminAvatar = async (userId: string) => {
  const profile = await adminProfileRepository.findAdminProfileByUserId(userId);
  return profile?.avatar ?? null;
};

// ✅ New — used by the /admins/me GET route so the profile page can
// show the admin's saved avatar (or a graceful default if none saved
// yet, since admins are seeded rather than self-registered and may
// not have a profile doc at all until their first upload).
export const getMyAdminProfile = async (userId: string) => {
  const profile = await adminProfileRepository.findAdminProfileByUserId(userId);
  return profile ?? { avatar: null };
};

// ✅ New — used by the /admins/me PUT route.
export const updateMyAdminProfile = async (
  userId: string,
  data: { avatar?: string },
) => {
  return adminProfileRepository.upsertAdminProfileByUserId(userId, data);
};

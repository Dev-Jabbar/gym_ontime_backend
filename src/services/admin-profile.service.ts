import * as adminProfileRepository from "../repositories/admin-profile.repository";

export const getAdminAvatar = async (userId: string) => {
  const profile = await adminProfileRepository.findAdminProfileByUserId(userId);
  return profile?.avatar ?? null;
};

// Used by GET /admins/me so the profile page can show the admin's saved
// avatar. Returns a default when none is saved yet: admins are seeded rather
// than self-registered, so there may be no profile document until their
// first upload.
export const getMyAdminProfile = async (userId: string) => {
  const profile = await adminProfileRepository.findAdminProfileByUserId(userId);
  return profile ?? { avatar: null };
};

// Used by PUT /admins/me.
export const updateMyAdminProfile = async (
  userId: string,
  data: { avatar?: string },
) => {
  return adminProfileRepository.upsertAdminProfileByUserId(userId, data);
};

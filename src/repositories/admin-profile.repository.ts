import AdminProfile from "../models/admin-profile.model";

export const findAdminProfileByUserId = async (userId: string) => {
  return AdminProfile.findOne({ userId });
};

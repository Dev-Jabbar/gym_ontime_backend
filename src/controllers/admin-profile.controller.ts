import { Request, Response } from "express";
import * as adminProfileService from "../services/admin-profile.service";

export const getMyAdminProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const profile = await adminProfileService.getMyAdminProfile(userId);
    res.json(profile);
  } catch (error) {
    console.error("Get admin profile error:", error);
    res.status(500).json({ message: "Failed to fetch admin profile" });
  }
};

export const updateMyAdminProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const updated = await adminProfileService.updateMyAdminProfile(
      userId,
      req.body,
    );
    res.json(updated);
  } catch (error) {
    console.error("Update admin profile error:", error);
    res.status(500).json({ message: "Failed to update admin profile" });
  }
};

import { Request, Response } from "express";
import { ZodError } from "zod";
import * as memberService from "../services/member-profile.service";
import * as userRepository from "../repositories/user.repository";
import { AppError } from "../errors/AppError";
import {
  createMemberSchema,
  updateMemberSchema,
  memberIdParamSchema,
} from "../validations/member-profile.validation";

/**
 * CREATE MY MEMBER PROFILE
 */
export const createMemberProfile = async (req: Request, res: Response) => {
  try {
    const userPayload = req.user;
    if (!userPayload) throw new AppError("Unauthorized", 401);

    const fullUser = await userRepository.findUserById(userPayload.id);
    if (!fullUser) throw new AppError("User not found", 404);

    const data = createMemberSchema.parse(req.body); // ✅ validate all fields

    const memberProfile = await memberService.createMemberProfile(fullUser, {
      avatar: data.avatar,
      phone: data.phone,
      dateOfBirth: data.dateOfBirth,
      gender: data.gender,
      fitnessGoal: data.fitnessGoal,
      healthNotes: data.healthNotes,
      emergencyContact: data.emergencyContact,
    });

    res.status(201).json(memberProfile);
  } catch (error) {
    if (error instanceof ZodError)
      return res
        .status(400)
        .json({ message: "Validation failed", errors: error.issues });

    if (error instanceof AppError)
      return res.status(error.statusCode).json({ message: error.message });

    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * GET MY MEMBER PROFILE
 */
export const getMyMemberProfile = async (req: Request, res: Response) => {
  try {
    const userPayload = req.user;
    if (!userPayload) throw new AppError("Unauthorized", 401);

    const memberProfile = await memberService.getMyMemberProfile(
      userPayload.id,
    );

    res.json(memberProfile);
  } catch (error) {
    if (error instanceof AppError)
      return res.status(error.statusCode).json({ message: error.message });

    console.error(error);
    res.status(500).json({ message: "Failed to fetch member profile" });
  }
};

/**
 * UPDATE MY MEMBER PROFILE
 */
export const updateMyMemberProfile = async (req: Request, res: Response) => {
  try {
    const userPayload = req.user;
    if (!userPayload) throw new AppError("Unauthorized", 401);

    const body = updateMemberSchema.parse(req.body);

    const updatedProfile = await memberService.updateMyMemberProfile(
      userPayload.id,
      body,
    );

    res.json(updatedProfile);
  } catch (error) {
    if (error instanceof ZodError)
      return res
        .status(400)
        .json({ message: "Validation failed", errors: error.issues });

    if (error instanceof AppError)
      return res.status(error.statusCode).json({ message: error.message });

    console.error(error);
    res.status(500).json({ message: "Failed to update member profile" });
  }
};

/**
 * DELETE MY MEMBER PROFILE
 */
export const deleteMyMemberProfile = async (req: Request, res: Response) => {
  try {
    const userPayload = req.user;
    if (!userPayload) throw new AppError("Unauthorized", 401);

    await memberService.deleteMyMemberProfile(userPayload.id);

    res.json({ message: "Member profile deleted successfully" });
  } catch (error) {
    if (error instanceof AppError)
      return res.status(error.statusCode).json({ message: error.message });

    console.error(error);
    res.status(500).json({ message: "Failed to delete member profile" });
  }
};

/**
 * PUBLIC: GET ALL MEMBER PROFILES
 */
export const getAllMemberProfiles = async (_req: Request, res: Response) => {
  try {
    const memberProfiles = await memberService.getAllMemberProfiles();

    res.json(memberProfiles);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch member profiles" });
  }
};

/**
 * PUBLIC: GET MEMBER PROFILE BY ID
 */
export const getMemberProfileById = async (req: Request, res: Response) => {
  try {
    const { id } = memberIdParamSchema.parse(req.params);

    const memberProfile = await memberService.getMemberProfileById(id);

    res.json(memberProfile);
  } catch (error) {
    if (error instanceof ZodError)
      return res.status(400).json({ message: "Invalid member profile ID" });

    console.error(error);
    res.status(500).json({ message: "Failed to fetch member profile" });
  }
};

import { Request, Response } from "express";
import { ZodError } from "zod";
import * as trainerProfileService from "../services/trainer-profile.service";
import * as userRepository from "../repositories/user.repository";
import { AppError } from "../errors/AppError";
import {
  createTrainerSchema,
  updateTrainerSchema,
  trainerIdParamSchema,
} from "../validations/trainer-profile.validation";

/**
 * CREATE MY TRAINER PROFILE
 */
export const createTrainerProfile = async (req: Request, res: Response) => {
  try {
    const userPayload = req.user;
    if (!userPayload) throw new AppError("Unauthorized", 401);

    const fullUser = await userRepository.findUserById(userPayload.id);
    if (!fullUser) throw new AppError("User not found", 404);

    const body = createTrainerSchema.parse(req.body);

    const trainerProfile = await trainerProfileService.createTrainerProfile(
      fullUser,
      {
        avatar: body.avatar,
        bio: body.bio,
        specialty: body.specialty,
        phone: body.phone,
        experience: body.experience,
        certifications: body.certifications,
        availability: body.availability,
        dateOfBirth: body.dateOfBirth,
        gender: body.gender,
      },
    );

    res.status(201).json(trainerProfile);
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
 * GET MY TRAINER PROFILE
 */
export const getMyTrainerProfile = async (req: Request, res: Response) => {
  try {
    const userPayload = req.user;
    if (!userPayload) throw new AppError("Unauthorized", 401);

    const trainerProfile = await trainerProfileService.getMyTrainerProfile(
      userPayload.id,
    );
    res.json(trainerProfile);
  } catch (error) {
    if (error instanceof AppError)
      return res.status(error.statusCode).json({ message: error.message });

    console.error(error);
    res.status(500).json({ message: "Failed to fetch trainer profile" });
  }
};

/**
 * UPDATE MY TRAINER PROFILE
 */
export const updateMyTrainerProfile = async (req: Request, res: Response) => {
  try {
    const userPayload = req.user;
    if (!userPayload) throw new AppError("Unauthorized", 401);

    const body = updateTrainerSchema.parse(req.body);

    const updatedProfile = await trainerProfileService.updateMyTrainerProfile(
      userPayload.id,
      {
        avatar: body.avatar,
        bio: body.bio,
        specialty: body.specialty,
        phone: body.phone,
        experience: body.experience,
        certifications: body.certifications,
        availability: body.availability,
        dateOfBirth: body.dateOfBirth,
        gender: body.gender,
      },
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
    res.status(500).json({ message: "Failed to update trainer profile" });
  }
};

/**
 * DELETE MY TRAINER PROFILE
 */
export const deleteMyTrainerProfile = async (req: Request, res: Response) => {
  try {
    const userPayload = req.user;
    if (!userPayload) throw new AppError("Unauthorized", 401);

    await trainerProfileService.deleteMyTrainerProfile(userPayload.id);

    res.json({ message: "Trainer profile deleted successfully" });
  } catch (error) {
    if (error instanceof AppError)
      return res.status(error.statusCode).json({ message: error.message });

    console.error(error);
    res.status(500).json({ message: "Failed to delete trainer profile" });
  }
};

/**
 * PUBLIC: GET ALL TRAINER PROFILES
 */
export const getAllTrainerProfiles = async (_: Request, res: Response) => {
  try {
    const trainerProfiles = await trainerProfileService.getAllTrainerProfiles();
    res.json(trainerProfiles);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch trainer profiles" });
  }
};

/**
 * PUBLIC: GET TRAINER PROFILE BY ID
 */
export const getTrainerProfileById = async (req: Request, res: Response) => {
  try {
    const { id } = trainerIdParamSchema.parse(req.params);
    const trainerProfile =
      await trainerProfileService.getTrainerProfileById(id);
    res.json(trainerProfile);
  } catch (error) {
    if (error instanceof ZodError)
      return res.status(400).json({ message: "Invalid trainer profile ID" });

    if (error instanceof AppError)
      return res.status(error.statusCode).json({ message: error.message });

    console.error(error);
    res.status(500).json({ message: "Failed to fetch trainer profile" });
  }
};

/**
 * UPGRADE TO TRAINER (kept for backward compatibility)
 */
export const upgradeToTrainer = async (req: Request, res: Response) => {
  try {
    const userPayload = req.user;
    if (!userPayload) throw new AppError("Unauthorized", 401);

    const updatedUser = await trainerProfileService.upgradeMemberToTrainer(
      userPayload.id,
    );

    res.status(200).json({
      message: "You are now a trainer",
      user: updatedUser,
    });
  } catch (error) {
    if (error instanceof AppError)
      return res.status(error.statusCode).json({ message: error.message });

    console.error(error);
    res.status(500).json({ message: "Failed to upgrade to trainer" });
  }
};

/**
 * GET MY CLASSES (TRAINER)
 */
export const getMyClasses = async (req: Request, res: Response) => {
  try {
    const userPayload = req.user;
    if (!userPayload) throw new AppError("Unauthorized", 401);

    const classes = await trainerProfileService.getMyClasses(userPayload.id);

    res.json({ success: true, data: classes });
  } catch (error) {
    if (error instanceof AppError)
      return res.status(error.statusCode).json({ message: error.message });

    console.error(error);
    res.status(500).json({ message: "Failed to fetch trainer classes" });
  }
};

import { Types } from "mongoose";
import mongoose from "mongoose";
import * as trainerProfileRepository from "../repositories/trainer-profile.repository";
import * as userRepository from "../repositories/user.repository";
import * as classRepository from "../repositories/class.repository";
import * as memberProfileRepository from "../repositories/member-profile.repository";
import { AppError } from "../errors/AppError";
import { IUser } from "../models/user.model";
import { signToken } from "../utils/jwt";
import { TrainerGender } from "../models/trainer-profile.model";

interface TrainerProfileData {
  avatar?: string;
  bio?: string;
  specialty?: string;
  phone?: string;
  experience?: number;
  certifications?: string[];
  availability?: string;
  dateOfBirth?: Date;
  gender?: TrainerGender;
}

const transformClass = (cls: any) => {
  const now = new Date();
  const scheduleDate = new Date(cls.schedule);
  const endTime = new Date(scheduleDate.getTime() + cls.duration * 60000);

  let status: "upcoming" | "ongoing" | "completed";
  if (now < scheduleDate) {
    status = "upcoming";
  } else if (now >= scheduleDate && now <= endTime) {
    status = "ongoing";
  } else {
    status = "completed";
  }

  const trainer = cls.trainer
    ? {
        id: cls.trainer._id?.toString() ?? "",
        name: cls.trainer.userId?.name ?? "Unknown Trainer",
        avatar:
          cls.trainer.avatar ??
          `https://ui-avatars.com/api/?name=${encodeURIComponent(
            cls.trainer.userId?.name ?? "Trainer",
          )}&background=random&color=fff`,
      }
    : {
        id: "",
        name: "Unassigned",
        avatar: `https://ui-avatars.com/api/?name=Unassigned&background=random&color=fff`,
      };

  return {
    id: cls._id.toString(),
    name: cls.name,
    description: cls.description ?? "",
    schedule: cls.schedule,
    duration: `${cls.duration} min`,
    trainer,
    pricing: cls.pricing,
    capacity: cls.capacity ?? 0,
    enrolled: cls.members?.length ?? 0,
    memberIds: cls.members?.map((m: any) => m.toString()) ?? [],
    status,
  };
};

/**
 * GET MY CLASSES (TRAINER)
 */
export const getMyClasses = async (userId: string) => {
  const profile =
    await trainerProfileRepository.findTrainerProfileByUserId(userId);
  if (!profile) throw new AppError("Trainer profile not found", 404);

  const classes = await classRepository.findClassesByTrainerId(
    profile._id.toString(),
  );
  return classes.map(transformClass); // ✅ transform applied
};

/**
 * CREATE TRAINER PROFILE
 */
export const createTrainerProfile = async (
  user: IUser,
  data?: TrainerProfileData,
) => {
  const userObjectId = new Types.ObjectId(user._id);
  const existingProfile =
    await trainerProfileRepository.findTrainerProfileByUserId(
      userObjectId.toString(),
    );

  if (existingProfile) {
    return trainerProfileRepository.updateTrainerProfile(
      existingProfile._id.toString(),
      {
        avatar: data?.avatar,
        bio: data?.bio,
        specialty: data?.specialty,
        phone: data?.phone,
        experience: data?.experience,
        certifications: data?.certifications,
        availability: data?.availability,
        dateOfBirth: data?.dateOfBirth,
        gender: data?.gender,
        isActive: true,
      },
    );
  }

  return trainerProfileRepository.createTrainerProfile({
    userId: userObjectId,
    avatar: data?.avatar,
    bio: data?.bio,
    specialty: data?.specialty,
    phone: data?.phone,
    experience: data?.experience,
    certifications: data?.certifications,
    availability: data?.availability,
    dateOfBirth: data?.dateOfBirth,
    gender: data?.gender,
    isActive: true,
  });
};

/**
 * GET MY TRAINER PROFILE
 */
export const getMyTrainerProfile = async (userId: string) => {
  const profile =
    await trainerProfileRepository.findTrainerProfileByUserId(userId);
  if (!profile) throw new AppError("Trainer profile not found", 404);
  return profile;
};

export const getTrainerAvatar = async (userId: string) => {
  const profile =
    await trainerProfileRepository.findTrainerProfileByUserId(userId);
  return profile?.avatar ?? null;
};

/**
 * UPDATE MY TRAINER PROFILE
 */
export const updateMyTrainerProfile = async (
  userId: string,
  data: TrainerProfileData & { name?: string },
) => {
  const profile =
    await trainerProfileRepository.findTrainerProfileByUserId(userId);
  if (!profile) throw new AppError("Trainer profile not found", 404);

  await trainerProfileRepository.updateTrainerProfile(profile._id.toString(), {
    avatar: data.avatar,
    bio: data.bio,
    specialty: data.specialty,
    phone: data.phone,
    experience: data.experience,
    certifications: data.certifications,
    availability: data.availability,
    dateOfBirth: data.dateOfBirth,
    gender: data.gender,
  });

  if (data.name) {
    await userRepository.updateUser(userId, { name: data.name });
  }

  return trainerProfileRepository.findTrainerProfileByUserId(userId);
};

/**
 * DELETE MY TRAINER PROFILE
 */
export const deleteMyTrainerProfile = async (userId: string) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const profile =
      await trainerProfileRepository.findTrainerProfileByUserId(userId);
    if (!profile) throw new AppError("Trainer profile not found", 404);

    await classRepository.removeTrainerFromClasses(
      profile._id.toString(),
      session,
    );
    await trainerProfileRepository.deleteTrainerProfileByUserId(
      userId,
      session,
    );

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * GET ALL TRAINER PROFILES
 */
export const getAllTrainerProfiles = async () => {
  return trainerProfileRepository.findAllTrainerProfiles();
};

/**
 * GET TRAINER PROFILE BY ID
 */
export const getTrainerProfileById = async (id: string) => {
  const profile = await trainerProfileRepository.findTrainerProfileById(id);
  if (!profile) throw new AppError("Trainer profile not found", 404);
  return profile;
};

/**
 * UPGRADE MEMBER TO TRAINER
 */
export const upgradeMemberToTrainer = async (userId: string) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const user = await userRepository.findUserById(userId, session);
    if (!user || user.role !== "member") {
      throw new AppError("Only members can upgrade to trainer", 400);
    }

    const memberProfile =
      await memberProfileRepository.findMemberProfileByUserId(userId, session);

    if (memberProfile) {
      await classRepository.removeMemberFromClasses(
        memberProfile._id.toString(),
        session,
      );

      await memberProfileRepository.updateMemberProfileByUserId(
        userId,
        { isActive: false },
        session,
      );
    }

    const updatedUser = await userRepository.updateUser(
      userId,
      { role: "trainer" },
      session,
    );

    const token = signToken({
      id: updatedUser!._id,
      role: "trainer",
      email: updatedUser!.email,
    });

    await session.commitTransaction();

    return {
      id: updatedUser!._id,
      name: updatedUser!.name,
      email: updatedUser!.email,
      role: updatedUser!.role,
      token,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

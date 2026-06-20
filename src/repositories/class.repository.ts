import ClassModel, { IClass } from "../models/class.model";
import { Types } from "mongoose";

import mongoose from "mongoose";

const TRAINER_POPULATE = {
  path: "trainer",
  select: "avatar userId",
  populate: {
    path: "userId",
    select: "name",
  },
};

// Create
export const createClass = async (data: Partial<IClass>) => {
  return ClassModel.create(data);
};

// Find all
export const findAllClasses = async () => {
  return ClassModel.find().populate(TRAINER_POPULATE);
};

// Find by ID
export const findClassById = async (id: string) => {
  return ClassModel.findById(id).populate(TRAINER_POPULATE);
};

// Find by name + schedule
export const findByNameAndSchedule = async (name: string, schedule: Date) => {
  return ClassModel.findOne({ name, schedule });
};

// Update
export const updateClass = async (id: string, data: Partial<IClass>) => {
  return ClassModel.findByIdAndUpdate(id, data, { new: true });
};

// Delete
export const deleteClass = async (id: string) => {
  return ClassModel.findByIdAndDelete(id);
};

// ✅ ADD MEMBER
export const addMemberToClass = async (classId: string, memberId: string) => {
  return ClassModel.findByIdAndUpdate(
    classId,
    { $addToSet: { members: memberId } },
    { new: true },
  );
};

// ✅ REMOVE MEMBER
export const removeMemberFromClass = async (
  classId: string,
  memberId: string,
) => {
  return ClassModel.findByIdAndUpdate(
    classId,
    { $pull: { members: memberId } },
    { new: true },
  );
};

// ✅ REMOVE MEMBER FROM ALL CLASSES (for profile deletion)
export const removeMemberFromClasses = async (
  memberId: string,
  session?: mongoose.ClientSession,
) => {
  return ClassModel.updateMany(
    { members: memberId },
    { $pull: { members: memberId } },
    session ? { session } : undefined,
  );
};

// ✅ ASSIGN / CHANGE TRAINER
export const assignTrainerToClass = async (
  classId: string,
  trainerId: string,
) => {
  return ClassModel.findByIdAndUpdate(
    classId,
    { trainer: new Types.ObjectId(trainerId) },
    { new: true },
  );
};

export const removeTrainerFromClasses = async (
  trainerId: string,
  session?: mongoose.ClientSession,
) => {
  return ClassModel.updateMany(
    { trainer: trainerId },
    { $unset: { trainer: "" } },
    session ? { session } : undefined,
  );
};

export const removeTrainerFromClassesByUser = async (
  trainerId: string,
  session?: mongoose.ClientSession,
) => {
  return ClassModel.updateMany(
    { trainer: trainerId },
    { $unset: { trainer: "" } },
    session ? { session } : undefined,
  );
};

// Find classes by trainer ID
export const findClassesByTrainerId = async (trainerId: string) => {
  return ClassModel.find({ trainer: trainerId }).populate({
    path: "trainer",
    select: "avatar userId",
    populate: {
      path: "userId",
      select: "name",
    },
  });
};

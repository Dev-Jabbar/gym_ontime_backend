import { Types } from "mongoose";
import * as classRepository from "../repositories/class.repository";
import * as memberProfileRepository from "../repositories/member-profile.repository";
import * as userRepository from "../repositories/user.repository";
import * as trainerProfileRepository from "../repositories/trainer-profile.repository";
import { AppError } from "../errors/AppError";
import { DayOfWeek } from "../models/class.model"; // ✅ import
import { getAvatarFallback } from "../utils/avatarFallback";

// ------------------------
// STATUS FOR RECURRING CLASSES (daily/weekly)
// ------------------------
// "Completed" doesn't make sense for a class that happens again next
// week — the series itself doesn't end, only individual sessions do.
// So recurring classes only ever get "upcoming" or "ongoing": ongoing
// while today's session window is active, upcoming the rest of the
// time (including in between sessions on non-class days, and on class
// days before/after today's specific window).
const getRecurringStatus = (
  scheduleAnchor: Date,
  durationMinutes: number,
  recurrence: string,
  recurrenceDays: string[],
  now: Date,
): "upcoming" | "ongoing" => {
  // The series hasn't had its first occurrence yet at all.
  if (now < scheduleAnchor) return "upcoming";

  const dayNames = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  const todayName = dayNames[now.getDay()];

  // Daily classes run every day; weekly classes only run on their
  // selected recurrenceDays. ("monthly" recurrence exists on the model
  // but isn't currently offered in the create/edit UI — treated like
  // daily as a safe fallback since it's not actually reachable today.)
  const isValidDayToday =
    recurrence === "daily" ||
    recurrence === "monthly" ||
    (recurrence === "weekly" && recurrenceDays.includes(todayName));

  if (!isValidDayToday) return "upcoming";

  // Build today's session window using the anchor's time-of-day
  // (schedule stores a full datetime — we reuse its hour/minute, just
  // applied to today's date instead of the original anchor date).
  const todaysSessionStart = new Date(now);
  todaysSessionStart.setHours(
    scheduleAnchor.getHours(),
    scheduleAnchor.getMinutes(),
    scheduleAnchor.getSeconds(),
    0,
  );
  const todaysSessionEnd = new Date(
    todaysSessionStart.getTime() + durationMinutes * 60000,
  );

  if (now >= todaysSessionStart && now <= todaysSessionEnd) {
    return "ongoing";
  }

  return "upcoming";
};

// ------------------------
// TRANSFORM CLASS FOR FRONTEND
// ------------------------
const transformClass = (cls: any) => {
  const now = new Date();
  const scheduleDate = new Date(cls.schedule);
  const endTime = new Date(scheduleDate.getTime() + cls.duration * 60000);

  let status: "upcoming" | "ongoing" | "completed";

  if (cls.recurrence === "none" || !cls.recurrence) {
    // One-off classes — unchanged, this is the exact original logic.
    if (now < scheduleDate) {
      status = "upcoming";
    } else if (now >= scheduleDate && now <= endTime) {
      status = "ongoing";
    } else {
      status = "completed";
    }
  } else {
    status = getRecurringStatus(
      scheduleDate,
      cls.duration,
      cls.recurrence,
      cls.recurrenceDays ?? [],
      now,
    );
  }

  const trainer = cls.trainer
    ? {
        id: cls.trainer._id?.toString() ?? "",
        // The dropdown in Create/Edit modals is keyed by User._id (since
        // that's what the admin trainer list is built on), while `id`
        // above is the TrainerProfile._id. Exposing both avoids a
        // mismatch when pre-selecting the current trainer in a <select>.
        userId: cls.trainer.userId?._id?.toString() ?? "",
        name: cls.trainer.userId?.name ?? "Unknown Trainer",
        avatar:
          cls.trainer.avatar ??
          getAvatarFallback(cls.trainer.userId?.name ?? "Trainer"),
        // Extra profile fields for the class-details modal's expandable
        // trainer view — undefined if not set, not an error.
        bio: cls.trainer.bio ?? null,
        specialty: cls.trainer.specialty ?? null,
        phone: cls.trainer.phone ?? null,
        experience: cls.trainer.experience ?? null,
        certifications: cls.trainer.certifications ?? [],
        availability: cls.trainer.availability ?? null,
      }
    : {
        id: "",
        userId: "",
        name: "Unassigned",
        avatar: getAvatarFallback("Unassigned"),
        bio: null,
        specialty: null,
        phone: null,
        experience: null,
        certifications: [],
        availability: null,
      };

  return {
    id: cls._id.toString(),
    name: cls.name,
    description: cls.description ?? "",
    schedule: cls.schedule,
    duration: `${cls.duration} min`,
    recurrence: cls.recurrence ?? "none",
    recurrenceDays: cls.recurrenceDays ?? [],
    trainer,
    pricing: cls.pricing,
    capacity: cls.capacity ?? 0,
    enrolled: cls.members?.length ?? 0,
    status,
    image: cls.image ?? null,
  };
};

// ------------------------
// CREATE CLASS
// ------------------------
export const createClass = async (data: {
  name: string;
  schedule: Date;
  duration: number;
  recurrence: "none" | "daily" | "weekly" | "monthly";
  recurrenceDays?: string[];
  description?: string;
  pricing: {
    oneTime?: number;
    weekly?: number;
    monthly?: number;
    threeMonths?: number;
  };
  capacity?: number;
  // A User._id — same convention as assignTrainerToClass's userId param.
  trainer: string;
  image?: string;
}) => {
  const existing = await classRepository.findByNameAndSchedule(
    data.name,
    data.schedule,
  );

  if (existing) {
    throw new AppError("Class with same name and schedule already exists", 409);
  }

  // Resolve the trainer's User._id -> TrainerProfile._id, exactly the
  // same validation + lookup assignTrainerToClass already does. Doing
  // this in the service (not just the Zod schema) means an invalid or
  // non-trainer userId is rejected with a clear error, not silently
  // saved as a broken reference.
  const trainerUser = await userRepository.findUserById(data.trainer);
  if (!trainerUser) throw new AppError("Trainer user not found", 404);
  if (trainerUser.role !== "trainer") {
    throw new AppError("Assigned user is not a trainer", 400);
  }

  const trainerProfile =
    await trainerProfileRepository.findTrainerProfileByUserId(data.trainer);
  if (!trainerProfile) {
    throw new AppError("Trainer profile not found for this user", 404);
  }

  return classRepository.createClass({
    name: data.name,
    schedule: data.schedule,
    duration: data.duration,
    recurrence: data.recurrence,
    recurrenceDays: data.recurrenceDays as DayOfWeek[], // ✅
    description: data.description,
    pricing: data.pricing,
    capacity: data.capacity,
    image: data.image,
    trainer: new Types.ObjectId(trainerProfile._id.toString()),
    members: [],
  });
};

// ------------------------
// GET ALL CLASSES
// ------------------------
export const getAllClasses = async () => {
  const classes = await classRepository.findAllClasses();
  return classes.map(transformClass);
};

// ------------------------
// GET CLASSES BY MEMBER ID
// Used by the admin member-details view to show "classes joined".
// ------------------------
export const getClassesByMemberId = async (memberProfileId: string) => {
  const classes = await classRepository.findClassesByMemberId(memberProfileId);
  return classes.map(transformClass);
};

// ------------------------
// GET CLASS BY ID
// ------------------------
export const getClassById = async (id: string) => {
  const foundClass = await classRepository.findClassById(id);
  if (!foundClass) throw new AppError("Class not found", 404);
  return transformClass(foundClass);
};

// ------------------------
// UPDATE CLASS
// ------------------------
export const updateClass = async (
  id: string,
  data: {
    name?: string;
    description?: string;
    schedule?: Date;
    duration?: number;
    recurrence?: "none" | "daily" | "weekly" | "monthly";
    recurrenceDays?: string[];
    pricing?: {
      oneTime?: number;
      weekly?: number;
      monthly?: number;
      threeMonths?: number;
    };
    capacity?: number;
    trainer?: string;
    members?: string[];
    image?: string;
  },
) => {
  const foundClass = await classRepository.findClassById(id);
  if (!foundClass) throw new AppError("Class not found", 404);

  // A recurring class's series doesn't end just because its original
  // anchor date has passed — it's still actively happening on its
  // recurrenceDays. This check only makes sense for one-off classes,
  // where the single scheduled date genuinely is the whole event.
  if (foundClass.recurrence === "none" && foundClass.schedule < new Date()) {
    throw new AppError("Cannot update a class that already happened", 400);
  }

  // ⚠️ data.trainer, like createClass's, is a User._id — resolve it to
  // the matching TrainerProfile._id before saving. Previously this just
  // did `new Types.ObjectId(data.trainer)` directly, which silently
  // stored the wrong ID type if a User._id was passed in (as the Edit
  // modal now does, to stay consistent with the Create modal and the
  // rest of the admin trainer-selection UI).
  let resolvedTrainerId: Types.ObjectId | undefined;
  if (data.trainer) {
    const trainerUser = await userRepository.findUserById(data.trainer);
    if (!trainerUser) throw new AppError("Trainer user not found", 404);
    if (trainerUser.role !== "trainer") {
      throw new AppError("Assigned user is not a trainer", 400);
    }

    const trainerProfile =
      await trainerProfileRepository.findTrainerProfileByUserId(data.trainer);
    if (!trainerProfile) {
      throw new AppError("Trainer profile not found for this user", 404);
    }

    resolvedTrainerId = new Types.ObjectId(trainerProfile._id.toString());
  }

  return classRepository.updateClass(id, {
    ...(data.name && { name: data.name }),
    ...(data.description && { description: data.description }),
    ...(data.schedule && { schedule: data.schedule }),
    ...(data.duration !== undefined && { duration: data.duration }),
    ...(data.recurrence && { recurrence: data.recurrence }),
    ...(data.recurrenceDays && {
      recurrenceDays: data.recurrenceDays as DayOfWeek[], // ✅
    }),
    ...(data.pricing && { pricing: data.pricing }),
    ...(data.capacity !== undefined && { capacity: data.capacity }),
    ...(data.image !== undefined && { image: data.image }),
    ...(resolvedTrainerId && { trainer: resolvedTrainerId }),
    ...(data.members && {
      members: data.members.map((id: string) => new Types.ObjectId(id)),
    }),
  });
};

// ------------------------
// DELETE CLASS
// ------------------------
export const deleteClass = async (id: string) => {
  const foundClass = await classRepository.findClassById(id);
  if (!foundClass) throw new AppError("Class not found", 404);

  const now = new Date();
  const scheduleDate = new Date(foundClass.schedule);
  const isCompleted = scheduleDate < now;

  if (!isCompleted && foundClass.members.length > 0) {
    throw new AppError(
      "Cannot delete a class with enrolled members. Please remove all members first.",
      400,
    );
  }

  return classRepository.deleteClass(id);
};

// ------------------------
// ADD MEMBER TO CLASS
// ------------------------
export const addMemberToClass = async (classId: string, userId: string) => {
  const foundClass = await classRepository.findClassById(classId);
  if (!foundClass) throw new AppError("Class not found", 404);

  // Same reasoning as updateClass — a recurring class keeps having new
  // sessions, so its original anchor date being in the past doesn't
  // mean there's nothing left to join.
  if (foundClass.recurrence === "none" && foundClass.schedule < new Date()) {
    throw new AppError("Cannot join a past class", 400);
  }

  if (foundClass.capacity && foundClass.members.length >= foundClass.capacity) {
    throw new AppError("Class is full", 400);
  }

  const user = await userRepository.findUserById(userId);
  if (!user) throw new AppError("User not found", 404);
  if (user.role !== "member") throw new AppError("User is not a member", 400);

  const member =
    await memberProfileRepository.findMemberProfileByUserId(userId);
  if (!member) throw new AppError("Member profile not found", 404);

  if (
    foundClass.members.some(
      (m: Types.ObjectId) => m.toString() === member._id.toString(),
    )
  ) {
    throw new AppError("This member is already enrolled in this class", 400);
  }

  await classRepository.addMemberToClass(classId, member._id.toString());

  return { message: "Member added to class successfully" };
};

// ------------------------
// REMOVE MEMBER FROM CLASS
// ------------------------
export const removeMemberFromClass = async (
  classId: string,
  userId: string,
) => {
  const foundClass = await classRepository.findClassById(classId);
  if (!foundClass) throw new AppError("Class not found", 404);

  const user = await userRepository.findUserById(userId);
  if (!user) throw new AppError("User not found", 404);
  if (user.role !== "member") throw new AppError("User is not a member", 400);

  const member =
    await memberProfileRepository.findMemberProfileByUserId(userId);
  if (!member) throw new AppError("Member profile not found", 404);

  if (
    !foundClass.members.some(
      (m: Types.ObjectId) => m.toString() === member._id.toString(),
    )
  ) {
    throw new AppError("Member is not enrolled in this class", 400);
  }

  await classRepository.removeMemberFromClass(classId, member._id.toString());

  return { message: "Member removed from class successfully" };
};

// ------------------------
// ASSIGN / CHANGE TRAINER
// ------------------------
export const assignTrainerToClass = async (classId: string, userId: string) => {
  const foundClass = await classRepository.findClassById(classId);
  if (!foundClass) throw new AppError("Class not found", 404);

  // Same reasoning again — assigning/changing a trainer for an
  // actively-recurring class should work regardless of its original
  // anchor date.
  if (foundClass.recurrence === "none" && foundClass.schedule < new Date()) {
    throw new AppError("Cannot assign trainer to past class", 400);
  }

  const user = await userRepository.findUserById(userId);
  if (!user) throw new AppError("User not found", 404);
  if (user.role !== "trainer") throw new AppError("User is not a trainer", 400);

  const trainer =
    await trainerProfileRepository.findTrainerProfileByUserId(userId);
  if (!trainer) throw new AppError("Trainer profile not found", 404);

  if (foundClass.trainer?.toString() === trainer._id.toString()) {
    throw new AppError("This trainer is already assigned to this class", 400);
  }

  return classRepository.assignTrainerToClass(classId, trainer._id.toString());
};

// ------------------------
// GET CLASS MEMBERS (for trainers)
// ------------------------
export const getClassMembers = async (
  classId: string,
  requestingUserId: string,
  userRole: string,
) => {
  const foundClass = await classRepository.findClassById(classId);
  if (!foundClass) throw new AppError("Class not found", 404);

  if (userRole === "trainer") {
    const trainerProfile =
      await trainerProfileRepository.findTrainerProfileByUserId(
        requestingUserId,
      );

    const classDoc = foundClass as any;
    const classTrainerId =
      classDoc.trainer?._id?.toString() ?? classDoc.trainer?.toString();

    if (!trainerProfile || classTrainerId !== trainerProfile._id.toString()) {
      throw new AppError(
        "You can only view members for classes you teach",
        403,
      );
    }
  }

  const classWithMembers = await classRepository.findClassById(classId);
  await classWithMembers?.populate({
    path: "members",
    select: "userId avatar phone gender fitnessGoal isActive",
    populate: {
      path: "userId",
      select: "name email role",
    },
  });

  const membersOnly =
    (classWithMembers?.members as any[])?.filter(
      (m: any) => m.userId?.role === "member",
    ) ?? [];

  return {
    classId: foundClass._id,
    className: foundClass.name,
    schedule: foundClass.schedule,
    totalMembers: membersOnly.length,
    members: membersOnly,
  };
};

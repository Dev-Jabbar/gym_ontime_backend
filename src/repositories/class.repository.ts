import ClassModel, { IClass } from "../models/class.model";
import { Types } from "mongoose";

import mongoose from "mongoose";

const TRAINER_POPULATE = {
  path: "trainer",
  select:
    "avatar userId bio specialty phone experience certifications availability",
  populate: {
    path: "userId",
    select: "name",
  },
};

export const createClass = async (data: Partial<IClass>) => {
  return ClassModel.create(data);
};

export const findAllClasses = async () => {
  return ClassModel.find().populate(TRAINER_POPULATE);
};

export const findClassById = async (id: string) => {
  return ClassModel.findById(id).populate(TRAINER_POPULATE);
};

export const findByNameAndSchedule = async (name: string, schedule: Date) => {
  return ClassModel.findOne({ name, schedule });
};

export const addMemberToClass = async (classId: string, memberId: string) => {
  return ClassModel.findByIdAndUpdate(
    classId,
    { $addToSet: { members: memberId } },
    { new: true },
  );
};

export const updateClass = async (id: string, data: Partial<IClass>) => {
  return ClassModel.findByIdAndUpdate(id, data, { new: true });
};

export const deleteClass = async (id: string) => {
  return ClassModel.findByIdAndDelete(id);
};

/**
 * Atomically reserves a temporary seat hold for a class, if one is
 * available. Called when a member starts checkout; the hold is what stops
 * two people paying for the same last seat.
 *
 * The capacity check and the write are a single MongoDB `findOneAndUpdate`,
 * not a "check, then write" pair of queries. With two separate steps, two
 * concurrent requests could both pass the check before either one writes (a
 * race condition). One atomic operation closes that gap: only one caller's
 * filter can still match by the time the write happens.
 *
 * Available capacity is confirmed `members` plus other people's unexpired
 * `pendingMembers`. A class with unlimited capacity (`capacity: null`) skips
 * the check.
 *
 * @param classId - The class being booked.
 * @param memberId - The member attempting to book.
 * @param ttlMinutes - How long the hold lasts before it expires.
 * @returns The updated class document if the hold was placed, or `null` if
 *   the class is full or does not exist.
 */
export const reserveSeat = async (
  classId: string,
  memberId: string,
  ttlMinutes: number,
) => {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);

  // Clear this member's own expired holds first, so a retry after a lapsed
  // hold is not blocked by their leftover entry.
  await ClassModel.updateOne(
    { _id: classId },
    {
      $pull: {
        pendingMembers: { member: memberId, expiresAt: { $lte: now } },
      },
    },
  );

  const classDoc = await ClassModel.findById(classId).select("capacity");
  if (!classDoc) return null;

  const filter: any = {
    _id: classId,
    members: { $ne: memberId },
    "pendingMembers.member": { $ne: memberId },
  };

  // Only classes with a set capacity need the seat-counting condition;
  // unlimited-capacity classes (capacity: null) always have room.
  if (classDoc.capacity != null) {
    filter.$expr = {
      $lt: [
        {
          $add: [
            { $size: "$members" },
            {
              $size: {
                $filter: {
                  input: { $ifNull: ["$pendingMembers", []] },
                  as: "p",
                  cond: { $gt: ["$$p.expiresAt", now] },
                },
              },
            },
          ],
        },
        "$capacity",
      ],
    };
  }

  return ClassModel.findOneAndUpdate(
    filter,
    { $push: { pendingMembers: { member: memberId, expiresAt } } },
    { new: true },
  );
};

/**
 * Immediately releases a member's seat hold instead of waiting for it to
 * expire. Called when payment fails, checkout is abandoned, or Paystack
 * initialization fails after a hold was placed; keeping the seat locked any
 * longer would only block someone else.
 */
export const releaseSeat = async (classId: string, memberId: string) => {
  return ClassModel.findByIdAndUpdate(
    classId,
    { $pull: { pendingMembers: { member: memberId } } },
    { new: true },
  );
};

/**
 * Converts a member's temporary hold into a confirmed seat once payment has
 * succeeded. It only matches if the member still has an unexpired hold
 * (`expiresAt` in the future), which stops a late payment from confirming
 * into a seat that may already have been given to someone else.
 *
 * @returns The updated class document if the hold was valid and is now
 *   confirmed, or `null` if the hold had expired or never existed. Callers
 *   must treat `null` as "seat no longer available" and flag the payment for
 *   review rather than assume success.
 */
export const confirmSeat = async (classId: string, memberId: string) => {
  const now = new Date();
  return ClassModel.findOneAndUpdate(
    {
      _id: classId,
      pendingMembers: {
        $elemMatch: { member: memberId, expiresAt: { $gt: now } },
      },
    },
    {
      $addToSet: { members: memberId },
      $pull: { pendingMembers: { member: memberId } },
    },
    { new: true },
  );
};

/**
 * Removes every hold whose `expiresAt` has passed, across all classes. This
 * is the safety net for holds nobody confirmed or released (for example the
 * user closed the browser mid-checkout). Run on a schedule by the payment
 * cleanup job, never from a request path.
 */
export const releaseExpiredHolds = async () => {
  const now = new Date();
  return ClassModel.updateMany(
    { "pendingMembers.expiresAt": { $lte: now } },
    { $pull: { pendingMembers: { expiresAt: { $lte: now } } } },
  );
};

// Reports why a member can or cannot book. Besides "already enrolled" and
// "class full", it distinguishes "hold-expired" (the hold ran out before
// payment) so verifyPayment and the webhook can tell the cases apart.
export const getClassEnrollmentStatus = async (
  classId: string,
  memberId: string,
) => {
  const classItem = await ClassModel.findById(classId).select(
    "members capacity pendingMembers",
  );
  if (!classItem) return "class-not-found" as const;

  const alreadyMember = classItem.members.some(
    (m) => m.toString() === memberId,
  );
  if (alreadyMember) return "already-enrolled" as const;

  const now = new Date();
  const hadHold = (classItem.pendingMembers ?? []).some(
    (p) => p.member.toString() === memberId,
  );
  const hasActiveHold = (classItem.pendingMembers ?? []).some(
    (p) => p.member.toString() === memberId && p.expiresAt > now,
  );

  if (hadHold && !hasActiveHold) return "hold-expired" as const;

  if (
    classItem.capacity != null &&
    classItem.members.length >= classItem.capacity
  ) {
    return "class-full" as const;
  }

  return "unknown" as const;
};

// Removes a member from a class.
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

// Removes a member from every class (used when a profile is deleted).
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

// Assigns or changes a class's trainer.
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

// Finds classes taught by a trainer.
export const findClassesByTrainerId = async (trainerId: string) => {
  return ClassModel.find({ trainer: trainerId }).populate(TRAINER_POPULATE);
};

// Finds the classes a member is enrolled in. Used by the admin member-details
// view ("classes joined").
export const findClassesByMemberId = async (memberProfileId: string) => {
  return ClassModel.find({ members: memberProfileId }).populate(
    TRAINER_POPULATE,
  );
};

// Used by the class reminder job. Needs every class's schedule plus each
// enrolled member's underlying User._id, because Notification.user references
// User, not MemberProfile.
export const findAllClassesForReminderCheck = async () => {
  return ClassModel.find().populate({
    path: "members",
    select: "userId",
    populate: {
      path: "userId",
      select: "_id",
    },
  });
};

export const markReminderSent = async (classId: string, sentAt: Date) => {
  return ClassModel.findByIdAndUpdate(classId, {
    lastReminderSentAt: sentAt,
  });
};

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

export const addMemberToClass = async (classId: string, memberId: string) => {
  return ClassModel.findByIdAndUpdate(
    classId,
    { $addToSet: { members: memberId } },
    { new: true },
  );
};

// Update
export const updateClass = async (id: string, data: Partial<IClass>) => {
  return ClassModel.findByIdAndUpdate(id, data, { new: true });
};

// Delete
export const deleteClass = async (id: string) => {
  return ClassModel.findByIdAndDelete(id);
};

// --- Add these to class.repository.ts ---

// ✅ NEW — called when someone starts checkout. Grabs and holds a seat
// for `ttlMinutes` if one's available. Returns the updated class doc if
// the hold was placed, or null if the class is full (counting both
// confirmed members AND other people's active holds).
export const reserveSeat = async (
  classId: string,
  memberId: string,
  ttlMinutes: number,
) => {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);

  // Clear this member's own expired holds first, so retrying checkout
  // after a previous hold lapsed doesn't get blocked by their own
  // leftover entry.
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

  // Only classes with a set capacity need the seat-counting condition —
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

// ✅ NEW — frees a held seat immediately (payment failed / checkout
// abandoned mid-flow / Paystack init errored after we'd already reserved).
export const releaseSeat = async (classId: string, memberId: string) => {
  return ClassModel.findByIdAndUpdate(
    classId,
    { $pull: { pendingMembers: { member: memberId } } },
    { new: true },
  );
};

// ✅ NEW — payment confirmed: turns a hold into a real member. Only
// succeeds if that member currently has an active (non-expired) hold —
// this stops a payment confirming into a seat that already expired and
// was potentially given to someone else.
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

// ✅ NEW — bulk-release every expired hold, across all classes. Called by
// the existing cleanup cron job for holds nobody ever confirmed or
// explicitly released (abandoned checkout, browser closed, etc).
export const releaseExpiredHolds = async () => {
  const now = new Date();
  return ClassModel.updateMany(
    { "pendingMembers.expiresAt": { $lte: now } },
    { $pull: { pendingMembers: { expiresAt: { $lte: now } } } },
  );
};

// ✅ UPDATED — now also reports "hold-expired" so verifyPayment/webhook
// can tell "your seat hold ran out before you paid" apart from "someone
// else took the last seat" and "you're already enrolled".
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
  return ClassModel.find({ trainer: trainerId }).populate(TRAINER_POPULATE);
};

// Find classes a specific member is enrolled in — used by the admin
// member-details view to show "classes joined".
export const findClassesByMemberId = async (memberProfileId: string) => {
  return ClassModel.find({ members: memberProfileId }).populate(
    TRAINER_POPULATE,
  );
};

// Used by the class reminder job — needs every class's schedule info
// PLUS each enrolled member's underlying User._id (to send them a
// notification, since Notification.user references User, not
// MemberProfile).
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

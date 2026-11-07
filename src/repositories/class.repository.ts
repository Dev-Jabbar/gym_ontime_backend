import ClassModel, { IClass } from "../models/class.model";
import { Types } from "mongoose";
import mongoose from "mongoose";

// Reusable population configuration for retrieving trainer information
// together with the User information linked to that trainer.
const TRAINER_POPULATE = {
  path: "trainer",
  select:
    "avatar userId bio specialty phone experience certifications availability",
  populate: {
    path: "userId",
    select: "name",
  },
};

// ============================================================
// BASIC CLASS OPERATIONS
// ============================================================

// Creates a new class using the supplied class data.
export const createClass = async (data: Partial<IClass>) => {
  return ClassModel.create(data);
};

// Retrieves all classes and their associated trainer information.
export const findAllClasses = async () => {
  return ClassModel.find().populate(TRAINER_POPULATE);
};

// Finds a specific class using its MongoDB ID.
export const findClassById = async (id: string) => {
  return ClassModel.findById(id).populate(TRAINER_POPULATE);
};

// Finds a class with a matching name and schedule.
// Used to check whether a class with the same details already exists.
export const findByNameAndSchedule = async (name: string, schedule: Date) => {
  return ClassModel.findOne({ name, schedule });
};

// Adds a member to the confirmed members array.
// $addToSet prevents the same member from being added twice.
export const addMemberToClass = async (classId: string, memberId: string) => {
  return ClassModel.findByIdAndUpdate(
    classId,
    { $addToSet: { members: memberId } },
    { new: true },
  );
};

// Updates an existing class using its ID and the supplied data.
export const updateClass = async (id: string, data: Partial<IClass>) => {
  return ClassModel.findByIdAndUpdate(id, data, { new: true });
};

// Deletes a class using its ID.
export const deleteClass = async (id: string) => {
  return ClassModel.findByIdAndDelete(id);
};

// ============================================================
// SEAT RESERVATION AND ENROLLMENT OPERATIONS
// ============================================================

/**
 * Atomically reserves a temporary seat hold for a class, if one is
 * available. Called when a member starts checkout.
 *
 * The capacity check and database update happen in one atomic
 * findOneAndUpdate operation. This prevents concurrent requests
 * from successfully reserving the same last available seat.
 *
 * Occupied seats are calculated using:
 * - Confirmed members.
 * - Pending reservations that have not expired.
 *
 * Unlimited-capacity classes (capacity: null) skip the capacity check.
 *
 * @param classId - The class being booked.
 * @param memberId - The member attempting to book.
 * @param ttlMinutes - How long the temporary reservation lasts.
 * @returns The updated class if successful, otherwise null.
 */
export const reserveSeat = async (
  classId: string,
  memberId: string,
  ttlMinutes: number,
) => {
  // 1. Calculate the reservation's expiry time.
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);

  // 2. Remove this member's previously expired reservation.
  // This allows the member to try reserving again after their
  // previous reservation has expired.
  await ClassModel.updateOne(
    { _id: classId },
    {
      $pull: {
        pendingMembers: { member: memberId, expiresAt: { $lte: now } },
      },
    },
  );

  // 3. Retrieve the class capacity.
  // We only need the capacity field for the upcoming availability check.
  const classDoc = await ClassModel.findById(classId).select("capacity");

  // Stop if the requested class does not exist.
  if (!classDoc) return null;

  // 4. Build the conditions the class must satisfy before reserving a seat.
  const filter: any = {
    // Only reserve a seat in the requested class.
    _id: classId,

    // The member must not already be enrolled.
    members: { $ne: memberId },

    // The member must not already have a pending reservation.
    "pendingMembers.member": { $ne: memberId },
  };

  // 5. Check available capacity if the class has a defined limit.
  // Unlimited-capacity classes do not need this condition.
  if (classDoc.capacity != null) {
    filter.$expr = {
      // The total occupied seats must be less than the class capacity.
      $lt: [
        {
          $add: [
            // Count confirmed members.
            { $size: "$members" },

            // Count pending reservations that have not expired.
            {
              $size: {
                $filter: {
                  // Use pendingMembers, or an empty array if it is null.
                  input: { $ifNull: ["$pendingMembers", []] },

                  // Give each pending reservation the temporary name "p".
                  as: "p",

                  // Only count reservations whose expiry is still in the future.
                  cond: { $gt: ["$$p.expiresAt", now] },
                },
              },
            },
          ],
        },

        // Compare the occupied seat count against the class capacity.
        "$capacity",
      ],
    };
  }

  // 6. Atomically check all conditions and create the reservation.
  // If another request takes the last seat first, this filter will no
  // longer match and MongoDB will return null.
  return ClassModel.findOneAndUpdate(
    filter,

    // Add the member and their expiry time to pendingMembers.
    { $push: { pendingMembers: { member: memberId, expiresAt } } },

    // Return the updated class document.
    { new: true },
  );
};

/**
 * Immediately releases a member's temporary seat reservation.
 *
 * Used when payment fails, checkout is abandoned, or payment
 * initialization fails after a reservation has been created.
 */
export const releaseSeat = async (classId: string, memberId: string) => {
  // Find the class and remove this member's pending reservation.
  return ClassModel.findByIdAndUpdate(
    classId,
    { $pull: { pendingMembers: { member: memberId } } },
    { new: true },
  );
};

/**
 * Converts a valid temporary reservation into a confirmed enrollment.
 *
 * Only reservations that have not expired can be confirmed.
 *
 * @returns The updated class if confirmation succeeds, otherwise null.
 */
export const confirmSeat = async (classId: string, memberId: string) => {
  // 1. Get the current time to check whether the reservation is still valid.
  const now = new Date();

  // 2. Find the class containing this member's active reservation.
  return ClassModel.findOneAndUpdate(
    {
      _id: classId,

      // The member must have a pending reservation whose expiry
      // is later than the current time.
      pendingMembers: {
        $elemMatch: { member: memberId, expiresAt: { $gt: now } },
      },
    },

    {
      // 3. Add the member to confirmed members.
      // $addToSet prevents duplicate member IDs.
      $addToSet: { members: memberId },

      // 4. Remove the member's temporary reservation.
      $pull: { pendingMembers: { member: memberId } },
    },

    // Return the updated class document.
    { new: true },
  );
};

/**
 * Removes every expired pending reservation across all classes.
 *
 * This is a cleanup operation for reservations that were never
 * confirmed or manually released, such as abandoned checkouts.
 *
 * Usually executed periodically by a scheduled cleanup job.
 */
export const releaseExpiredHolds = async () => {
  // 1. Get the current time.
  const now = new Date();

  // 2. Find every class containing at least one expired reservation.
  return ClassModel.updateMany(
    { "pendingMembers.expiresAt": { $lte: now } },

    // 3. Remove every expired reservation from matching classes.
    { $pull: { pendingMembers: { expiresAt: { $lte: now } } } },
  );
};

/**
 * Determines why a member can or cannot enroll in a class.
 *
 * Possible statuses:
 * - class-not-found
 * - already-enrolled
 * - hold-expired
 * - class-full
 * - unknown
 */
/**
 * Determines why a member can or cannot enroll in a class.
 *
 * Capacity is calculated using confirmed members and all other members'
 * unexpired pending reservations.
 *
 * Possible statuses:
 * - class-not-found
 * - already-enrolled
 * - hold-expired
 * - class-full
 * - unknown
 */
export const getClassEnrollmentStatus = async (
  classId: string,
  memberId: string,
) => {
  // 1. Retrieve only the class information needed for enrollment checks.
  const classItem = await ClassModel.findById(classId).select(
    "members capacity pendingMembers",
  );

  // Stop if the class does not exist.
  if (!classItem) return "class-not-found" as const;

  // 2. Check whether the member is already enrolled.
  const alreadyMember = classItem.members.some(
    (m) => m.toString() === memberId,
  );

  if (alreadyMember) return "already-enrolled" as const;

  // 3. Get the current time for checking reservation expiry.
  const now = new Date();

  // 4. Check whether this member has any pending reservation.
  const hadHold = (classItem.pendingMembers ?? []).some(
    (p) => p.member.toString() === memberId,
  );

  // 5. Check whether this member has an unexpired reservation.
  const hasActiveHold = (classItem.pendingMembers ?? []).some(
    (p) => p.member.toString() === memberId && p.expiresAt > now,
  );

  // If a reservation exists but none is active, the hold has expired.
  if (hadHold && !hasActiveHold) return "hold-expired" as const;

  // 6. Check whether the class has reached capacity.
  // Count confirmed members plus all other members' active pending holds.
  if (classItem.capacity != null) {
    const activePendingHolds = (classItem.pendingMembers ?? []).filter(
      (p) => p.member.toString() !== memberId && p.expiresAt > now,
    ).length;

    const occupiedSeats = classItem.members.length + activePendingHolds;

    if (occupiedSeats >= classItem.capacity) {
      return "class-full" as const;
    }
  }

  // 7. No specific enrollment problem was identified.
  return "unknown" as const;
};

// ============================================================
// MEMBER MANAGEMENT
// ============================================================

// Removes a specific member from a class's confirmed members array.
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

// Removes a member from every class they are enrolled in.
// Used when deleting a member profile.
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

// ============================================================
// TRAINER MANAGEMENT
// ============================================================

// Assigns a trainer to a class or changes the existing trainer.
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

// Removes a trainer assignment from every class.
// An optional MongoDB session allows this operation to participate
// in a larger transaction.
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

// Performs the same trainer-removal operation as the function above.
// Kept as a separate exported function for existing callers.
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

// ============================================================
// CLASS LOOKUPS
// ============================================================

// Finds all classes assigned to a particular trainer.
// Also retrieves the trainer's associated information.
export const findClassesByTrainerId = async (trainerId: string) => {
  return ClassModel.find({ trainer: trainerId }).populate(TRAINER_POPULATE);
};

// Finds all classes a member is enrolled in.
// Used by the admin member-details view to display classes joined.
export const findClassesByMemberId = async (memberProfileId: string) => {
  return ClassModel.find({ members: memberProfileId }).populate(
    TRAINER_POPULATE,
  );
};

/**
 * Retrieves all classes needed by the class reminder job.
 *
 * Populates the enrolled members and their underlying User IDs because
 * Notification.user references User, not MemberProfile.
 */
export const findAllClassesForReminderCheck = async () => {
  return ClassModel.find().populate({
    // Populate the members array.
    path: "members",

    // Only retrieve each member's userId.
    select: "userId",

    // Populate the User document referenced by userId.
    populate: {
      path: "userId",
      select: "_id",
    },
  });
};

// Updates the timestamp recording when a class reminder was last sent.
export const markReminderSent = async (classId: string, sentAt: Date) => {
  return ClassModel.findByIdAndUpdate(classId, {
    lastReminderSentAt: sentAt,
  });
};

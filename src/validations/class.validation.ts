import { z } from "zod";

/** Reusable MongoDB ObjectId validation. */
export const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid MongoDB ObjectId");

export const createClassSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  schedule: z.coerce.date("Schedule is required and must be a valid date"),
  duration: z.number().min(1, "Duration is required (in minutes)"),
  recurrence: z.enum(["none", "daily", "weekly", "monthly"]).default("none"),
  recurrenceDays: z
    .array(
      z.enum([
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      ]),
    )
    .optional(),
  pricing: z.object({
    oneTime: z.number().min(0).optional(),
    weekly: z.number().min(0).optional(),
    monthly: z.number().min(0).optional(),
    threeMonths: z.number().min(0).optional(),
  }),
  capacity: z.number().min(1, "Capacity must be at least 1").optional(),
  // Optional Cloudinary URL for the class card's banner image.
  image: z.string().url().optional(),
  // A User._id, not a TrainerProfile._id (the same convention as the userId
  // of assignTrainerParamsSchema). The service resolves it to the matching
  // TrainerProfile before saving. A class cannot be created without a
  // trainer; this is enforced here (required, not .optional()) so calling the
  // API directly cannot bypass the frontend's dropdown.
  trainer: objectIdSchema.min(1, "A trainer must be assigned to this class"),
});

export const updateClassSchema = z
  .object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    schedule: z.coerce.date().optional(),
    duration: z.number().min(1).optional(),
    recurrence: z.enum(["none", "daily", "weekly", "monthly"]).optional(),
    recurrenceDays: z
      .array(
        z.enum([
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
          "saturday",
          "sunday",
        ]),
      )
      .optional(),
    pricing: z
      .object({
        oneTime: z.number().min(0).optional(),
        weekly: z.number().min(0).optional(),
        monthly: z.number().min(0).optional(),
        threeMonths: z.number().min(0).optional(),
      })
      .optional(),
    capacity: z.number().min(1, "Capacity must be at least 1").optional(),
    image: z.string().url().optional(),
    trainer: objectIdSchema.optional(),
    members: z.array(objectIdSchema).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

/** Route params: class id. */
export const classIdParamSchema = z.object({
  id: objectIdSchema,
});

// Route params for assigning a trainer to a class.
export const assignTrainerParamsSchema = z.object({
  id: objectIdSchema, // classId
  userId: objectIdSchema, // userId (a user with the "trainer" role)
});

// Route params for adding or removing a member of a class.
export const memberClassParamsSchema = z.object({
  id: objectIdSchema, // classId
  userId: objectIdSchema, // userId (a user with the "member" role)
});

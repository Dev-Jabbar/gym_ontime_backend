import { z } from "zod";

/**
 * 🔹 Reusable Mongo ObjectId validation
 */
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
    quarterly: z.number().min(0).optional(),
    biannual: z.number().min(0).optional(),
    yearly: z.number().min(0).optional(),
  }),
  capacity: z.number().min(1, "Capacity must be at least 1").optional(),
  // ⚠️ This is a User._id, not a TrainerProfile._id — same convention
  // as assignTrainerParamsSchema's userId. The service layer resolves
  // it to the matching TrainerProfile before saving, mirroring exactly
  // what assignTrainerToClass already does. A class cannot be created
  // without a trainer — enforced here (required, not .optional()) so
  // hitting the API directly can't bypass the frontend's dropdown.
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
        quarterly: z.number().min(0).optional(),
        biannual: z.number().min(0).optional(),
        yearly: z.number().min(0).optional(),
      })
      .optional(),
    capacity: z.number().min(1, "Capacity must be at least 1").optional(),
    trainer: objectIdSchema.optional(),
    members: z.array(objectIdSchema).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

/**
 * 🔹 Params validation
 */
export const classIdParamSchema = z.object({
  id: objectIdSchema,
});

// 🔹 Assign trainer to class (params)
export const assignTrainerParamsSchema = z.object({
  id: objectIdSchema, // classId
  userId: objectIdSchema, // userId (user with "trainer" role)
});

// 🔹 Add/Remove member to/from class (params)
export const memberClassParamsSchema = z.object({
  id: objectIdSchema, // classId
  userId: objectIdSchema, // userId (user with "member" role)
});

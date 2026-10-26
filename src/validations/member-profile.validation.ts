import { z } from "zod";

/** Reusable MongoDB ObjectId validation. */
export const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid MongoDB ObjectId");

/** Body for creating a member profile. */
export const createMemberSchema = z.object({
  avatar: z.string().url("Avatar must be a valid URL").optional(),
  phone: z.string().optional(),
  dateOfBirth: z.coerce.date().optional(),
  gender: z.enum(["male", "female", "prefer_not_to_say"]).optional(),
  fitnessGoal: z
    .enum([
      "weight_loss",
      "muscle_gain",
      "endurance",
      "flexibility",
      "general_fitness",
    ])
    .optional(),
  healthNotes: z.string().optional(),
  emergencyContact: z
    .object({
      name: z.string().min(1, "Emergency contact name is required"),
      phone: z.string().min(1, "Emergency contact phone is required"),
    })
    .optional(),
});

/** Body for updating a member profile (all fields optional). */
export const updateMemberSchema = createMemberSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

/** Route params: member profile id. */
export const memberIdParamSchema = z.object({
  id: objectIdSchema,
});

/** Route params: user id. */
export const memberUserIdParamSchema = z.object({
  userId: objectIdSchema,
});

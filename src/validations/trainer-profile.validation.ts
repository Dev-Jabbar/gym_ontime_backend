import { z } from "zod";

/** 🔹 Reusable Mongo ObjectId validation */
export const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid MongoDB ObjectId");

/** 🔹 Create trainer profile */
export const createTrainerSchema = z.object({
  avatar: z.string().url("Avatar must be a valid URL").optional(),
  bio: z.string().max(500, "Bio must be 500 characters or less").optional(),
  specialty: z.string().optional(),
  phone: z.string().optional(),
  experience: z.number().min(0, "Experience must be 0 or more").optional(),
  certifications: z.array(z.string()).optional(),
  availability: z.string().optional(),
  dateOfBirth: z.coerce.date().optional(),
  gender: z.enum(["male", "female", "prefer_not_to_say"]).optional(),
});

/** 🔹 Update trainer (all fields optional) */
export const updateTrainerSchema = createTrainerSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

/** 🔹 Params validation */
export const trainerIdParamSchema = z.object({
  id: objectIdSchema,
});

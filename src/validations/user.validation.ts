import { z } from "zod";

/**
 * 🔹 Reusable ObjectId
 */
export const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid MongoDB ObjectId");

/**
 * 🔹 Register
 */
export const registerUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["member", "trainer", "admin"]).optional(),
});

/**
 * 🔹 Login
 */
export const loginUserSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

/**
 * 🔹 Update
 */
export const updateUserSchema = z
  .object({
    name: z.string().min(1).optional(),
    role: z.enum(["member", "trainer", "admin"]).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

/**
 * 🔹 Params
 */
export const userIdParamSchema = z.object({
  id: objectIdSchema,
});

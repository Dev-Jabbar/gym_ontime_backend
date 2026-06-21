import { Request, Response } from "express";
import { ZodError } from "zod";
import * as userService from "../services/user.service";
import * as memberProfileService from "../services/member-profile.service";
import * as trainerProfileService from "../services/trainer-profile.service";
import * as adminProfileService from "../services/admin-profile.service";

import {
  registerUserSchema,
  loginUserSchema,
  updateUserSchema,
  userIdParamSchema,
} from "../validations/user.validation";
import { AppError } from "../errors/AppError";

/**
 * ✅ Register (PUBLIC)
 */
export const register = async (req: Request, res: Response) => {
  try {
    const data = registerUserSchema.parse(req.body);
    const user = await userService.registerUser(data);

    res.status(201).json(user);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ errors: error.issues });
    }

    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    res.status(500).json({ message: "Registration failed" });
  }
};

/**
 * ✅ Login (PUBLIC)
 */
export const login = async (req: Request, res: Response) => {
  try {
    const data = loginUserSchema.parse(req.body);
    const user = await userService.loginUser(data.email, data.password);

    // Set HTTP-only cookie
    res.cookie("token", user.token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    });

    // Send user info but NOT the token
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ errors: error.issues });
    }
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    res.status(500).json({ message: "Login failed" });
  }
};

/**
 * ✅ Get current logged-in user (AUTHENTICATED)
 */
export const getMe = async (req: Request, res: Response) => {
  try {
    const user = await userService.getUserById(req.user!.id);

    let avatar = null;

    if (req.user!.role === "admin") {
      avatar = await adminProfileService.getAdminAvatar(req.user!.id);
    } else if (req.user!.role === "member") {
      avatar = await memberProfileService.getMemberAvatar(req.user!.id);
    } else if (req.user!.role === "trainer") {
      avatar = await trainerProfileService.getTrainerAvatar(req.user!.id);
    }

    // ✅ convert Mongoose document to plain object
    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    res.status(500).json({ message: "Failed to fetch user" });
  }
};
/**
 * ✅ Logout (PUBLIC or AUTHENTICATED)
 */
export const logout = async (_req: Request, res: Response) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
  });
  res.json({ message: "Logged out successfully" });
};

/**
 * ✅ Get all users (ADMIN ONLY)
 */
export const getAllUsers = async (_req: Request, res: Response) => {
  try {
    const users = await userService.getAllUsers();
    res.json(users);
  } catch {
    res.status(500).json({ message: "Failed to fetch users" });
  }
};

/**
 * ✅ Get user by ID (ADMIN or SAME USER)
 */
export const getUserById = async (req: Request, res: Response) => {
  try {
    const { id } = userIdParamSchema.parse(req.params);

    // 🔐 Authorization check
    if (req.user?.role !== "admin" && req.user?.id !== id) {
      return res.status(403).json({ message: "Access denied" });
    }

    const user = await userService.getUserById(id);
    res.json(user);
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    res.status(500).json({ message: "Failed to fetch user" });
  }
};

/**
 * ✅ Update user (ADMIN or SAME USER)
 */
export const updateUser = async (req: Request, res: Response) => {
  try {
    const { id } = userIdParamSchema.parse(req.params);
    const body = updateUserSchema.parse(req.body);

    // 🔐 Authorization check
    if (req.user?.role !== "admin" && req.user?.id !== id) {
      return res.status(403).json({ message: "Access denied" });
    }

    const updated = await userService.updateUser(id, body);
    res.json(updated);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ errors: error.issues });
    }

    res.status(500).json({ message: "Failed to update user" });
  }
};

/**
 * ✅ Delete user (ADMIN ONLY)
 */
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = userIdParamSchema.parse(req.params);

    // Extra safety (even though route is protected)
    if (req.user?.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    await userService.deleteUser(id);
    res.json({ message: "User deleted successfully" });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    res.status(500).json({ message: "Failed to delete user" });
  }
};

export const upgradeToTrainer = async (req: Request, res: Response) => {
  try {
    const { id } = userIdParamSchema.parse(req.params);
    const updated = await userService.upgradeToTrainer(id);
    res.json(updated);
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    res.status(500).json({ message: "Failed to upgrade user to trainer" });
  }
};

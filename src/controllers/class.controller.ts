import { Request, Response } from "express";
import { ZodError } from "zod";
import * as classService from "../services/class.service";
import {
  createClassSchema,
  updateClassSchema,
  classIdParamSchema,
  assignTrainerParamsSchema,
  memberClassParamsSchema,
} from "../validations/class.validation";
import { AppError } from "../errors/AppError";

/**
 * ✅ Create class
 */
export const createClass = async (req: Request, res: Response) => {
  try {
    const validatedData = createClassSchema.parse(req.body);
    const newClass = await classService.createClass(validatedData);

    return res.status(201).json(newClass);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        message: "Validation failed",
        errors: error.issues,
      });
    }

    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        message: error.message,
      });
    }

    console.error("Create class error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * ✅ Get all classes
 */
export const getAllClasses = async (req: Request, res: Response) => {
  try {
    const classes = await classService.getAllClasses();
    res.json(classes);
  } catch (error) {
    console.error("Get all classes error:", error);
    res.status(500).json({ message: "Failed to fetch classes" });
  }
};

/**
 * ✅ Get class by ID
 */
export const getClassById = async (req: Request, res: Response) => {
  try {
    const { id } = classIdParamSchema.parse(req.params);

    const foundClass = await classService.getClassById(id);
    if (!foundClass) {
      return res.status(404).json({ message: "Class not found" });
    }

    res.json(foundClass);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        message: "Invalid class ID",
        errors: error.issues,
      });
    }

    console.error("Get class by ID error:", error);
    res.status(500).json({ message: "Failed to fetch class" });
  }
};

/**
 * ✅ Get class member count (PUBLIC)
 */
export const getClassMemberCount = async (req: Request, res: Response) => {
  try {
    const { id } = classIdParamSchema.parse(req.params);

    const foundClass = await classService.getClassById(id);
    if (!foundClass) {
      return res.status(404).json({ message: "Class not found" });
    }

    res.json({
      success: true,
      data: {
        classId: foundClass.id,
        className: foundClass.name,
        totalMembers: foundClass.enrolled,
        capacity: foundClass.capacity || null,
        spotsRemaining: foundClass.capacity
          ? foundClass.capacity - foundClass.enrolled
          : null,
        isFull: foundClass.capacity
          ? foundClass.enrolled >= foundClass.capacity
          : false,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        message: "Invalid class ID",
        errors: error.issues,
      });
    }

    console.error("Get class member count error:", error);
    res.status(500).json({ message: "Failed to fetch member count" });
  }
};

/**
 * ✅ Update class
 */
export const updateClass = async (req: Request, res: Response) => {
  try {
    const { id } = classIdParamSchema.parse(req.params);
    const validatedBody = updateClassSchema.parse(req.body);

    const updated = await classService.updateClass(id, validatedBody);
    if (!updated) {
      return res.status(404).json({ message: "Class not found" });
    }

    res.json(updated);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        message: "Validation failed",
        errors: error.issues,
      });
    }

    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        message: error.message,
      });
    }

    console.error("Update class error:", error);
    res.status(500).json({ message: "Failed to update class" });
  }
};

/**
 * ✅ Delete class
 */
export const deleteClass = async (req: Request, res: Response) => {
  try {
    const { id } = classIdParamSchema.parse(req.params);

    const deleted = await classService.deleteClass(id);
    if (!deleted) {
      return res.status(404).json({ message: "Class not found" });
    }

    res.json({ message: "Class deleted successfully" });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        message: "Invalid class ID",
        errors: error.issues,
      });
    }

    if (error instanceof AppError) {
      // ✅ add this
      return res.status(error.statusCode).json({ message: error.message });
    }

    console.error("Delete class error:", error);
    res.status(500).json({ message: "Failed to delete class" });
  }
};

/**
 * ✅ ADD MEMBER TO CLASS
 */
export const addMemberToClass = async (req: Request, res: Response) => {
  try {
    const { id: classId, userId } = memberClassParamsSchema.parse(req.params);

    const result = await classService.addMemberToClass(classId, userId);

    res.json(result);
  } catch (error) {
    if (error instanceof ZodError)
      return res
        .status(400)
        .json({ message: "Validation failed", errors: error.issues });

    if (error instanceof AppError)
      return res.status(error.statusCode).json({ message: error.message });

    console.error(error);
    res.status(500).json({ message: "Failed to add member" });
  }
};

/**
 * ✅ REMOVE MEMBER FROM CLASS
 */
export const removeMemberFromClass = async (req: Request, res: Response) => {
  try {
    const { id: classId, userId } = memberClassParamsSchema.parse(req.params);

    const result = await classService.removeMemberFromClass(classId, userId);

    res.json(result);
  } catch (error) {
    if (error instanceof ZodError)
      return res
        .status(400)
        .json({ message: "Validation failed", errors: error.issues });

    if (error instanceof AppError)
      return res.status(error.statusCode).json({ message: error.message });

    console.error(error);
    res.status(500).json({ message: "Failed to remove member" });
  }
};

/**
 * ✅ ASSIGN TRAINER TO CLASS
 */
export const assignTrainerToClass = async (req: Request, res: Response) => {
  try {
    const { id: classId, userId } = assignTrainerParamsSchema.parse(req.params);

    const updated = await classService.assignTrainerToClass(classId, userId);

    res.json(updated);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        message: "Invalid parameters",
        errors: error.issues,
      });
    }

    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    console.error(error);
    res.status(500).json({ message: "Failed to assign trainer" });
  }
};

/**
 * ✅ Get class members (for trainers)
 */
export const getClassMembers = async (req: Request, res: Response) => {
  try {
    const { id } = classIdParamSchema.parse(req.params);
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const result = await classService.getClassMembers(id, userId, userRole);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        message: error.message,
      });
    }

    console.error("Get class members error:", error);
    res.status(500).json({ message: "Failed to fetch class members" });
  }
};

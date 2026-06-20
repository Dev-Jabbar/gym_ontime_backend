import express from "express";
import * as classController from "../controllers/class.controller";
import { protect } from "../middleware/auth.middleware";

const router = express.Router();

/**
 * PUBLIC
 * Anyone can view classes
 */
router.get("/", classController.getAllClasses);

/**
 * ADMIN ONLY
 * Admin manages class lifecycle
 */
router.post("/", protect(["admin"]), classController.createClass);

/**
 * PUBLIC - Get class member count
 * Members can see how full a class is (MUST come before /:id/members)
 */
router.get("/:id/member-count", classController.getClassMemberCount);

/**
 * TRAINER/ADMIN - Get members in a class (full details, no payment info)
 * IMPORTANT: This must come BEFORE /:id to avoid route conflicts
 */
router.get(
  "/:id/members",
  protect(["trainer", "admin"]),
  classController.getClassMembers,
);

/**
 * PUBLIC - Get class by ID
 */
router.get("/:id", classController.getClassById);

/**
 * ADMIN ONLY - Update/Delete
 */
router.put("/:id", protect(["admin"]), classController.updateClass);
router.delete("/:id", protect(["admin"]), classController.deleteClass);

/**
 * MEMBER MANAGEMENT
 * Admin controls enrollment (userId = user with "member" role)
 */
router.post(
  "/:id/members/:userId",
  protect(["admin"]),
  classController.addMemberToClass,
);

router.delete(
  "/:id/members/:userId",
  protect(["admin"]),
  classController.removeMemberFromClass,
);

/**
 * TRAINER MANAGEMENT
 * Only admin assigns trainers (userId = user with "trainer" role)
 */
router.put(
  "/:id/trainer/:userId",
  protect(["admin"]),
  classController.assignTrainerToClass,
);

export default router;

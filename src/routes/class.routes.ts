import express from "express";
import * as classController from "../controllers/class.controller";
import { protect } from "../middleware/auth.middleware";

const router = express.Router();

// Public: anyone can view classes.
router.get("/", classController.getAllClasses);

// Admin only: creates classes.
router.post("/", protect(["admin"]), classController.createClass);

// Admin only: classes a specific member is enrolled in (admin member-details
// view, "classes joined"). Must be declared before any "/:id" route, or
// "by-member" would be matched as a class id.
router.get(
  "/by-member/:memberProfileId",
  protect(["admin"]),
  classController.getClassesByMemberController,
);

// Public: how full a class is. Declared before /:id/members.
router.get("/:id/member-count", classController.getClassMemberCount);

// Trainer or admin: members of a class (full details, no payment info).
// Must be declared before /:id to avoid route conflicts.
router.get(
  "/:id/members",
  protect(["trainer", "admin"]),
  classController.getClassMembers,
);

// Public: one class by id.
router.get("/:id", classController.getClassById);

// Admin only: update and delete.
router.put("/:id", protect(["admin"]), classController.updateClass);
router.delete("/:id", protect(["admin"]), classController.deleteClass);

// Member management: the admin controls enrollment (userId is a user with
// the "member" role).
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

// Trainer management: only the admin assigns trainers (userId is a user with
// the "trainer" role).
router.put(
  "/:id/trainer/:userId",
  protect(["admin"]),
  classController.assignTrainerToClass,
);

export default router;

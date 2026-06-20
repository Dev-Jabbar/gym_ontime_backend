import express from "express";
import * as trainerProfileController from "../controllers/trainer-profile.controller";
import { protect } from "../middleware/auth.middleware";

const router = express.Router();

/**
 * PUBLIC
 */
router.get("/", trainerProfileController.getAllTrainerProfiles);

/**
 * TRAINER (own profile)
 */
router.post(
  "/profile",
  protect(["trainer"]),
  trainerProfileController.createTrainerProfile,
);

router.get(
  "/me",
  protect(["trainer"]),
  trainerProfileController.getMyTrainerProfile,
);

router.put(
  "/me",
  protect(["trainer"]),
  trainerProfileController.updateMyTrainerProfile,
);

router.delete(
  "/me",
  protect(["trainer"]),
  trainerProfileController.deleteMyTrainerProfile,
);

router.get(
  "/my-classes",
  protect(["trainer"]),
  trainerProfileController.getMyClasses,
);
/**
 * PUBLIC
 */
router.get("/:id", trainerProfileController.getTrainerProfileById);

export default router;

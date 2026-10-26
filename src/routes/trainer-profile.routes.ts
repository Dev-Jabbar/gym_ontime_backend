import express from "express";
import * as trainerProfileController from "../controllers/trainer-profile.controller";
import { protect } from "../middleware/auth.middleware";

const router = express.Router();

// Public.
router.get("/", trainerProfileController.getAllTrainerProfiles);

// Trainer: own profile.
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
// Public.
router.get("/:id", trainerProfileController.getTrainerProfileById);

export default router;

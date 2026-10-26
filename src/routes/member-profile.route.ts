import express from "express";
import * as memberProfileController from "../controllers/member-profile.controller";
import { protect } from "../middleware/auth.middleware";

const router = express.Router();

// Public.
router.get("/", memberProfileController.getAllMemberProfiles);

// Member: own profile.
router.post(
  "/profile",
  protect(["member"]),
  memberProfileController.createMemberProfile,
);

router.get(
  "/me",
  protect(["member"]),
  memberProfileController.getMyMemberProfile,
);

router.put(
  "/me",
  protect(["member"]),
  memberProfileController.updateMyMemberProfile,
);

router.delete(
  "/me",
  protect(["member"]),
  memberProfileController.deleteMyMemberProfile,
);

// Public.
router.get("/:id", memberProfileController.getMemberProfileById);

export default router;

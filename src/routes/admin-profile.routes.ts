import express from "express";
import * as adminProfileController from "../controllers/admin-profile.controller";
import { protect } from "../middleware/auth.middleware";

const router = express.Router();

router.get("/me", protect(["admin"]), adminProfileController.getMyAdminProfile);

router.put(
  "/me",
  protect(["admin"]),
  adminProfileController.updateMyAdminProfile,
);

export default router;

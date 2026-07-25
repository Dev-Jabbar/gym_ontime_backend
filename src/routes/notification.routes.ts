import express from "express";
import * as notificationController from "../controllers/notification.controller";
import { protect } from "../middleware/auth.middleware";

const router = express.Router();

router.get(
  "/my-notifications",
  protect(),
  notificationController.getMyNotifications,
);

router.put("/:id/read", protect(), notificationController.markAsRead);

router.put("/mark-all-read", protect(), notificationController.markAllAsRead);

export default router;

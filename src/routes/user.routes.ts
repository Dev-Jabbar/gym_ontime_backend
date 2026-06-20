import express from "express";
import * as userController from "../controllers/user.controller";
import { protect } from "../middleware/auth.middleware";

const router = express.Router();

// Public
router.post("/register", userController.register);
router.post("/login", userController.login);

router.post("/logout", userController.logout);

router.get("/me", protect(), userController.getMe);

// Admin only
router.get("/", protect(["admin"]), userController.getAllUsers);

router.post(
  "/:id/upgrade-to-trainer",
  protect(["admin"]),
  userController.upgradeToTrainer,
);

router.delete("/:id", protect(["admin"]), userController.deleteUser);

// Admin or same user
router.get("/:id", protect(), userController.getUserById);
router.put("/:id", protect(), userController.updateUser);

export default router;

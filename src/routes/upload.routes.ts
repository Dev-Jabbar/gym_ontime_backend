import express from "express";
import { getUploadSignature } from "../controllers/upload.controller";
import { protect } from "../middleware/auth.middleware";

const router = express.Router();

/**
 * Any authenticated role can get a signature — this just proves
 * "I'm a logged-in user of this app," not "I'm allowed to upload
 * anything specific." What the uploaded URL is later used for
 * (e.g. saved as your own avatar) is enforced by the profile-update
 * endpoint that consumes it, not by this endpoint.
 */
router.post("/signature", protect(), getUploadSignature);

export default router;

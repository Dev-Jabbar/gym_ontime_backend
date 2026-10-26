import express from "express";
import { getUploadSignature } from "../controllers/upload.controller";
import { protect } from "../middleware/auth.middleware";

const router = express.Router();

// Any authenticated role can get a signature. It only proves the caller is a
// logged-in user of this app, not that they may upload anything specific.
// What the uploaded URL is later used for (for example as the user's own
// avatar) is enforced by the profile-update endpoint that consumes it.
router.post("/signature", protect(), getUploadSignature);

export default router;

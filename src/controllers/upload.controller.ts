import { Request, Response } from "express";
import cloudinary from "../config/cloudinary";

/**
 * Generates a signed upload signature for the authenticated user.
 *
 * How the signed flow works:
 * 1. The browser calls this endpoint (with its auth cookie) to get a
 *    signature.
 * 2. The browser uploads the file directly to Cloudinary, attaching the
 *    signature, timestamp, api_key and folder.
 * 3. Cloudinary verifies the signature with the same secret this endpoint
 *    used, proving the request was authorized by this backend.
 *
 * The API secret (CLOUDINARY_API_SECRET) is only used here, on the server,
 * and is never sent to the browser.
 */
export const getUploadSignature = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const timestamp = Math.round(Date.now() / 1000);
    const folder = "avatars";

    // Every parameter signed here must be sent back with the upload request
    // exactly as is. Cloudinary re-derives the signature from the parameters
    // it receives, so a missing, changed or extra parameter is rejected.
    const paramsToSign = {
      timestamp,
      folder,
    };

    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET as string,
    );

    res.json({
      signature,
      timestamp,
      folder,
      apiKey: process.env.CLOUDINARY_API_KEY,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    });
  } catch (error) {
    console.error("Cloudinary signature error:", error);
    res.status(500).json({ message: "Failed to generate upload signature" });
  }
};

import { Request, Response } from "express";
import cloudinary from "../config/cloudinary";

/**
 * Generates a signed upload signature for the authenticated user.
 *
 * How the signed flow works:
 * 1. Browser calls this endpoint (with auth cookie) to get a signature.
 * 2. Browser uploads the file directly to Cloudinary's API, attaching
 *    that signature + timestamp + api_key + folder.
 * 3. Cloudinary verifies the signature server-side using the same
 *    secret this endpoint used to generate it — proving the request
 *    was authorized by *our* backend, not forged by a random client.
 *
 * The API secret (CLOUDINARY_API_SECRET) is used here, in Node, and
 * is never sent to or visible from the browser at any point.
 */
export const getUploadSignature = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const timestamp = Math.round(Date.now() / 1000);
    const folder = "avatars";

    // Every parameter included here MUST be sent back with the actual
    // upload request later, exactly as-is — Cloudinary re-derives the
    // signature from whatever params arrive and compares it to this
    // one. Mismatched or missing params (even an extra one) => rejected.
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

import { Request, Response, NextFunction } from "express";
import { verifyToken, TokenPayload } from "../utils/jwt";

declare module "express-serve-static-core" {
  interface Request {
    user?: TokenPayload;
  }
}

/**
 * Express middleware factory that gates a route behind a valid login
 * session, and optionally a specific role.
 *
 * Reads the JWT from the `token` HTTP-only cookie (never from a header),
 * verifies its signature/expiry, and attaches the decoded payload to
 * `req.user` for downstream handlers. Returns 401 if there's no token or
 * it's invalid/expired, and 403 if a role restriction is given and the
 * user's role isn't in it.
 *
 * Usage: `protect()` for "any logged-in user", `protect(["admin"])` for
 * a specific role. Called once at route-definition time — the returned
 * function is what Express actually runs per-request.
 *
 * @param roles - Allowed roles for this route. Omit to allow any
 *   authenticated user regardless of role.
 */
export const protect = (roles?: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Cookie only — deliberately not also checking an Authorization
    // header, so there's exactly one auth path to reason about.
    const token = req.cookies?.token;

    if (!token) {
      return res
        .status(401)
        .json({ message: "Unauthorized: No token provided" });
    }

    try {
      const decoded = verifyToken(token);

      req.user = decoded;

      if (roles && !roles.includes(req.user.role)) {
        return res
          .status(403)
          .json({ message: "Forbidden: Insufficient role" });
      }

      next();
    } catch (err) {
      // Covers both a malformed/tampered signature and a naturally
      // expired token — both are just "not a valid session" from the
      // caller's point of view.
      return res.status(401).json({ message: "Unauthorized: Invalid token" });
    }
  };
};

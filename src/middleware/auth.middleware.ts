import { Request, Response, NextFunction } from "express";
import { verifyToken, TokenPayload } from "../utils/jwt";

declare module "express-serve-static-core" {
  interface Request {
    user?: TokenPayload;
  }
}

export const protect = (roles?: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Read from cookie instead of Authorization header
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
      return res.status(401).json({ message: "Unauthorized: Invalid token" });
    }
  };
};

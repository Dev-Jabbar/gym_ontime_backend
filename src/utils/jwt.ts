import jwt from "jsonwebtoken";
import { JWT_CONFIG } from "../config/jwtConfig";

export interface TokenPayload {
  id: string;
  role: string;
  email: string;
}

export const signToken = (payload: TokenPayload): string => {
  return jwt.sign(
    payload,
    JWT_CONFIG.secret, // ✅ plain string is VALID
    {
      expiresIn: JWT_CONFIG.expiresIn, // ✅ string like "7d" is VALID at runtime
    } as any // ⬅️ silence broken typings
  );
};

export const verifyToken = (token: string): TokenPayload => {
  return jwt.verify(token, JWT_CONFIG.secret) as TokenPayload;
};

import jwt from "jsonwebtoken";
import { JWT_CONFIG } from "../config/jwtConfig";

/** Decoded shape of every JWT this app issues. Kept minimal on purpose —
 * anything beyond identity/role belongs in a DB lookup, not the token. */
export interface TokenPayload {
  id: string;
  role: string;
  email: string;
}

/**
 * Signs a login token for the given user. Expiry is centralized in
 * `JWT_CONFIG` rather than hardcoded here, so it only needs changing
 * in one place.
 */
export const signToken = (payload: TokenPayload): string => {
  return jwt.sign(
    payload,
    JWT_CONFIG.secret, // plain string is valid at runtime
    {
      expiresIn: JWT_CONFIG.expiresIn, // e.g. "7d" — valid at runtime
    } as any, // @types/jsonwebtoken's overload doesn't accept a plain
    // string secret + string expiresIn together, even though the
    // library itself supports it — cast rather than fight the types.
  );
};

/**
 * Verifies a token's signature and expiry, and returns its decoded
 * payload. Throws if the token is missing, tampered with, or expired —
 * callers (see `auth.middleware.ts`) are expected to catch this and
 * respond 401 rather than let it propagate.
 */
export const verifyToken = (token: string): TokenPayload => {
  return jwt.verify(token, JWT_CONFIG.secret) as TokenPayload;
};

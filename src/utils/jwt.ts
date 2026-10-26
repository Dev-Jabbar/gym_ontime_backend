import jwt from "jsonwebtoken";
import { JWT_CONFIG } from "../config/jwtConfig";

/**
 * Decoded shape of every JWT this app issues. Kept minimal on purpose:
 * anything beyond identity and role belongs in a database lookup, not the
 * token.
 */
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
    JWT_CONFIG.secret, // A plain string secret is valid at runtime.
    {
      expiresIn: JWT_CONFIG.expiresIn, // For example "7d"; valid at runtime.
    } as any, // The cast is needed because @types/jsonwebtoken's overload does
    // not accept a plain string secret together with a string expiresIn, even
    // though the library supports it.
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

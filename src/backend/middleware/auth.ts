import type { NextFunction, Request, Response } from "express";
import { AppError } from "../errors";
import { getFirebaseServices } from "../config/firebase";
import type { ServerEnv } from "../config/env";
import type { AuthenticatedUser } from "../types";

export interface TokenVerifier {
  verifyIdToken(idToken: string): Promise<AuthenticatedUser>;
}

export class FirebaseAdminTokenVerifier implements TokenVerifier {
  private readonly env?: ServerEnv | undefined;

  constructor(env?: ServerEnv) {
    this.env = env;
  }

  async verifyIdToken(idToken: string): Promise<AuthenticatedUser> {
    const { auth } = getFirebaseServices(this.env);
    const decoded = await auth.verifyIdToken(idToken, true);
    if (!decoded.uid) {
      throw new AppError(401, "UNAUTHORIZED", "Invalid authentication token: missing UID.");
    }
    return {
      uid: decoded.uid,
      email: decoded.email,
    };
  }
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser | undefined;
    }
  }
}

export function createAuthMiddleware(verifier: TokenVerifier) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || typeof authHeader !== "string") {
        throw new AppError(401, "UNAUTHORIZED", "Missing Authorization header.");
      }

      const parts = authHeader.trim().split(/\s+/);
      if (parts.length !== 2 || parts[0]?.toLowerCase() !== "bearer" || !parts[1]) {
        throw new AppError(
          401,
          "UNAUTHORIZED",
          "Malformed Authorization header. Expected 'Bearer <Firebase_ID_Token>'.",
        );
      }

      const token = parts[1];
      let verifiedUser: AuthenticatedUser;
      try {
        verifiedUser = await verifier.verifyIdToken(token);
      } catch (err) {
        if (err instanceof AppError) {
          throw err;
        }
        throw new AppError(401, "UNAUTHORIZED", "Invalid or expired Firebase ID token.");
      }

      if (!verifiedUser?.uid || typeof verifiedUser.uid !== "string") {
        throw new AppError(401, "UNAUTHORIZED", "Invalid authentication token.");
      }

      req.user = {
        uid: verifiedUser.uid,
        email: verifiedUser.email,
      };
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function getAuthenticatedUid(req: Request): string {
  const uid = req.user?.uid;
  if (!uid) {
    throw new AppError(401, "UNAUTHORIZED", "Authentication required.");
  }
  return uid;
}

export function assertOwnership(resourceUid: string, authenticatedUid: string): void {
  if (!resourceUid || !authenticatedUid || resourceUid !== authenticatedUid) {
    throw new AppError(
      403,
      "FORBIDDEN",
      "Access denied: you do not own the requested resource.",
    );
  }
}

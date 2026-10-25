import type { Request, RequestHandler } from "express";

// Who is signed in, from the shared passkey sign-in service
// (github.com/waynezhu6/auth). Its session cookie is sent to every app on the
// domain; this backend passes it on to the service over the server's internal
// network, which answers with the user or 401.
//
// Locally there's no auth service: set AUTH_DEV_USER in backend/.env to be
// signed in as that name, or leave it unset to be signed out.
const AUTH_URL = process.env.AUTH_URL ?? "http://auth-backend:3001";
const DEV_USER = process.env.NODE_ENV === "production" ? undefined : process.env.AUTH_DEV_USER;

/** The shared sign-in page, which sends the browser back to next afterwards. */
export function loginUrl(next: string): string {
  return `/apps/auth/?next=${encodeURIComponent(next)}`;
}

export interface User {
  /** Stable for the account's lifetime. Key your data on this. */
  id: string;
  name: string;
}

/** The signed-in user, or null. Throws if the auth service can't be reached. */
export async function currentUser(req: Request): Promise<User | null> {
  if (DEV_USER) return { id: `dev-${DEV_USER}`, name: DEV_USER };
  const cookie = req.headers.cookie;
  if (!cookie) return null;
  const res = await fetch(`${AUTH_URL}/api/verify`, { headers: { cookie }, signal: AbortSignal.timeout(5000) });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`auth service answered ${res.status}`);
  return (await res.json()) as User;
}

declare module "express-serve-static-core" {
  interface Locals {
    user: User;
  }
}

/**
 * For routes that need a signed-in user: puts them in res.locals.user, or
 * answers 401. The frontend sends the browser to loginUrl() (api.ts) on a 401.
 *
 *   app.get("/api/notes", requireUser, (req, res) => { res.locals.user.id ... })
 */
export const requireUser: RequestHandler = (req, res, next) => {
  currentUser(req).then(
    (user) => {
      if (!user) {
        res.status(401).json({ error: "Sign in first" });
        return;
      }
      res.locals.user = user;
      next();
    },
    (err) => {
      console.error("Couldn't check sign-in:", err);
      res.status(503).json({ error: "Sign-in is unavailable right now" });
    },
  );
};

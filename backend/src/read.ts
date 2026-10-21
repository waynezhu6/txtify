import { Router, type Request, type Response } from "express";
import { timingSafeEqual } from "crypto";
import { extract, ExtractError } from "./extract.js";
import { articlePage, messagePage, CSP } from "./page.js";
import { API_BASE } from "./paths.js";

// GET /api/read?url=<article>[&key=<ACCESS_KEY>], public at <API_BASE>/read
// The access key keeps strangers from spending the RapidAPI quota. Passing it
// once as ?key= stores it in a cookie, so the bookmarklet needs only the url.

const COOKIE = "txtify_key";
const LIMIT_PER_HOUR = Number(process.env.READ_LIMIT_PER_HOUR ?? 60);

const router = Router();

function send(res: Response, status: number, html: string) {
  res.status(status).set({ "Content-Security-Policy": CSP, "Cache-Control": "private, no-store" }).type("html").send(html);
}

function cookieKey(req: Request): string | undefined {
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === COOKIE) return decodeURIComponent(rest.join("="));
  }
}

function matches(given: string | undefined, expected: string): boolean {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// One shared hourly budget: even with a valid key, a runaway loop can't drain
// the quota. Sliding window, in memory; resets on restart, which is fine.
const recent: number[] = [];
function overLimit(): boolean {
  const now = Date.now();
  while (recent.length && now - recent[0] > 3_600_000) recent.shift();
  if (recent.length >= LIMIT_PER_HOUR) return true;
  recent.push(now);
  return false;
}

function parseTarget(raw: unknown): URL | undefined {
  if (typeof raw !== "string" || raw.length > 2048) return;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`);
    return url.protocol === "http:" || url.protocol === "https:" ? url : undefined;
  } catch {
    return;
  }
}

router.get("/read", async (req, res) => {
  const expected = process.env.ACCESS_KEY;
  if (!expected) {
    return send(res, 503, messagePage("Not set up yet", "ACCESS_KEY is not set on the server."));
  }

  const queryKey = typeof req.query.key === "string" && req.query.key ? req.query.key : undefined;
  if (queryKey !== undefined) {
    if (!matches(queryKey, expected)) return send(res, 401, messagePage("Wrong key", "That access key isn't right."));
    // Remember the key, then drop it from the address bar and history.
    res.cookie(COOKIE, queryKey, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: API_BASE,
      maxAge: 365 * 24 * 3_600_000,
    });
    const rest = new URLSearchParams(req.query as Record<string, string>);
    rest.delete("key");
    return res.redirect(303, `${API_BASE}/read?${rest}`);
  }
  if (!matches(cookieKey(req), expected)) {
    return send(res, 401, messagePage("Access key needed", "Enter your access key on the txtify home page first."));
  }

  const target = parseTarget(req.query.url);
  if (!target) return send(res, 400, messagePage("Not a web address", "Pass an http or https URL as ?url=."));

  if (overLimit()) {
    return send(res, 429, messagePage("Slow down", `txtify is capped at ${LIMIT_PER_HOUR} articles an hour.`, target.href));
  }

  try {
    const article = await extract(target.href);
    send(res, 200, articlePage(article, target.href));
  } catch (err) {
    if (!(err instanceof ExtractError)) console.error("read failed:", err);
    const status = err instanceof ExtractError ? err.status : 500;
    const message = err instanceof ExtractError ? err.message : "Something went wrong.";
    send(res, status, messagePage("Couldn't get the article", message, target.href));
  }
});

export default router;

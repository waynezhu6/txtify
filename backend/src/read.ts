import { Router, type Request, type Response } from "express";
import { timingSafeEqual } from "crypto";
import { cached, store } from "./cache.js";
import { extract, ExtractError, type Article } from "./extract.js";
import { articlePage, messagePage, reading, CSP } from "./page.js";
import { API_BASE } from "./paths.js";
import { MONTHLY_API_LIMIT, nextFreeSlot, reserveCall } from "./quota.js";

// Two ways to read an article, behind the same key and limits:
//   GET /api/article?url=<article>[&key=<ACCESS_KEY>]  JSON for the frontend's
//       reader at <APP_BASE><article>
//   GET /api/read?url=<article>[&key=<ACCESS_KEY>]     a whole HTML page, for
//       direct use at <API_BASE>/read
// The access key keeps strangers from spending the RapidAPI quota. Passing it
// once as ?key= stores it in a cookie, so later calls need only the url.

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

// One shared hourly budget, on top of the monthly cap in quota.ts: even with a
// valid key, a runaway loop can't drain the month in one go. Sliding window, in memory; resets on restart, which is fine.
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

function queryKey(req: Request): string | undefined {
  return typeof req.query.key === "string" && req.query.key ? req.query.key : undefined;
}

function remember(res: Response, key: string) {
  res.cookie(COOKIE, key, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: API_BASE,
    maxAge: 365 * 24 * 3_600_000,
  });
}

type Refusal = { status: number; title: string; message: string; needKey?: boolean };

// The server is set up and the caller has the key (a ?key= also sets the cookie).
function authorize(req: Request, res: Response): Refusal | undefined {
  const expected = process.env.ACCESS_KEY;
  if (!expected) return { status: 503, title: "Not set up yet", message: "ACCESS_KEY is not set on the server." };

  const key = queryKey(req);
  if (key !== undefined) {
    if (!matches(key, expected)) return { status: 401, title: "Wrong key", message: "That access key isn't right.", needKey: true };
    remember(res, key);
  } else if (!matches(cookieKey(req), expected)) {
    return { status: 401, title: "Access key needed", message: "Enter your access key to read on this browser.", needKey: true };
  }
}

// Everything short of fetching: setup, key, url.
function check(req: Request, res: Response): { target: URL } | Refusal {
  const refused = authorize(req, res);
  if (refused) return refused;
  const target = parseTarget(req.query.url);
  if (!target) return { status: 400, title: "Not a web address", message: "Pass an http or https URL." };
  return { target };
}

// From the cache if it's there; otherwise one RapidAPI call, if both the
// hourly and the monthly budget allow it.
async function fetchArticle(target: URL): Promise<{ article: Article } | { status: number; message: string }> {
  try {
    const hit = cached(target.href);
    if (hit) return { article: hit };

    if (overLimit()) return { status: 429, message: `txtify is capped at ${LIMIT_PER_HOUR} new articles an hour.` };
    if (!(await reserveCall())) {
      const next = await nextFreeSlot();
      const when = next ? ` The next one frees up ${next.toISOString().slice(0, 16).replace("T", " ")} UTC.` : "";
      return { status: 429, message: `This month's ${MONTHLY_API_LIMIT} new articles are used up, to stay in RapidAPI's free tier.${when} Articles read before still open.` };
    }

    const article = await extract(target.href);
    store(target.href, article);
    return { article };
  } catch (err) {
    if (!(err instanceof ExtractError)) console.error("read failed:", err);
    return {
      status: err instanceof ExtractError ? err.status : 500,
      message: err instanceof ExtractError ? err.message : "Something went wrong.",
    };
  }
}

router.get("/article", async (req, res) => {
  res.set("Cache-Control", "private, no-store");
  const checked = check(req, res);
  if (!("target" in checked)) {
    return res.status(checked.status).json({ error: checked.message, needKey: checked.needKey ?? false });
  }
  const result = await fetchArticle(checked.target);
  if (!("article" in result)) return res.status(result.status).json({ error: result.message, source: checked.target.href });
  res.json(reading(result.article, checked.target.href));
});

router.get("/read", async (req, res) => {
  // A key in the address bar goes into the cookie, then out of the URL and history.
  if (queryKey(req) !== undefined) {
    const refused = authorize(req, res);
    if (refused) return send(res, refused.status, messagePage(refused.title, refused.message));
    const rest = new URLSearchParams(req.query as Record<string, string>);
    rest.delete("key");
    return res.redirect(303, `${API_BASE}/read?${rest}`);
  }
  const checked = check(req, res);
  if (!("target" in checked)) return send(res, checked.status, messagePage(checked.title, checked.message));
  const result = await fetchArticle(checked.target);
  if (!("article" in result)) return send(res, result.status, messagePage("Couldn't get the article", result.message, checked.target.href));
  send(res, 200, articlePage(result.article, checked.target.href));
});

export default router;

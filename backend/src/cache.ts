import type { Article } from "./extract.js";

// Recently fetched articles, so reopening one (a reload, a double click) costs
// no API call and doesn't count toward either limit. In memory only: entries
// expire after CACHE_MINUTES, at most MAX_ENTRIES are kept, and a restart
// empties it.
const TTL_MS = Number(process.env.CACHE_MINUTES ?? 10) * 60_000;
const MAX_ENTRIES = 100;

// Map keeps insertion order, so the first key is always the oldest entry.
const entries = new Map<string, { article: Article; at: number }>();

function prune(now: number) {
  for (const [url, entry] of entries) {
    if (now - entry.at < TTL_MS && entries.size <= MAX_ENTRIES) break;
    entries.delete(url);
  }
}

export function cached(url: string): Article | undefined {
  prune(Date.now());
  return entries.get(url)?.article;
}

export function store(url: string, article: Article): void {
  entries.delete(url);
  entries.set(url, { article, at: Date.now() });
  prune(Date.now());
}

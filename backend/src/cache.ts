import pool from "./db.js";
import type { Article } from "./extract.js";

// Fetched articles, by URL. A cached read costs no API call and doesn't count
// toward either limit.
const CACHE_DAYS = Number(process.env.CACHE_DAYS ?? 7);

export async function cached(url: string): Promise<Article | undefined> {
  const { rows } = await pool.query<{ article: Article }>(
    "SELECT article FROM article_cache WHERE url = $1 AND fetched_at > now() - make_interval(days => $2)",
    [url, CACHE_DAYS],
  );
  return rows[0]?.article;
}

export async function store(url: string, article: Article): Promise<void> {
  await pool.query(
    `INSERT INTO article_cache (url, article) VALUES ($1, $2)
     ON CONFLICT (url) DO UPDATE SET article = EXCLUDED.article, fetched_at = now()`,
    [url, article],
  );
  await pool.query("DELETE FROM article_cache WHERE fetched_at < now() - make_interval(days => $1)", [CACHE_DAYS]);
}

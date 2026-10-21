// Calls the FiveFilters Full-Text RSS API on RapidAPI. The key only lives in
// the server's environment (RAPIDAPI_KEY); it never reaches the browser.

const HOST = process.env.RAPIDAPI_HOST ?? "full-text-rss.p.rapidapi.com";

export interface Article {
  title?: string;
  author?: string;
  date?: string;
  domain?: string;
  url?: string;
  effective_url?: string;
  language?: string;
  word_count?: number;
  content?: string;
}

export class ExtractError extends Error {
  constructor(message: string, readonly status = 502) {
    super(message);
  }
}

export async function extract(url: string): Promise<Article> {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) throw new ExtractError("RAPIDAPI_KEY is not set on the server.", 503);

  let res: Response;
  try {
    res = await fetch(`https://${HOST}/extract.php`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-rapidapi-key": key,
        "x-rapidapi-host": HOST,
      },
      body: new URLSearchParams({ url, content: "html5", xss: "1", lang: "2" }),
      signal: AbortSignal.timeout(25_000),
    });
  } catch (err) {
    throw new ExtractError(`Couldn't reach the extraction service (${(err as Error).name}).`);
  }

  if (res.status === 429) throw new ExtractError("The RapidAPI quota or rate limit was hit.", 429);
  if (res.status === 401 || res.status === 403) {
    throw new ExtractError("RapidAPI rejected the key. Check RAPIDAPI_KEY and the subscription.", 502);
  }
  if (!res.ok) throw new ExtractError(`The extraction service answered ${res.status}.`);

  try {
    return (await res.json()) as Article;
  } catch {
    throw new ExtractError("The extraction service returned something that isn't JSON.");
  }
}

# txtify

A personal reader: give it an article URL and it returns a clean, text-only page. It asks the [Full-Text RSS API](https://rapidapi.com/fivefilters/api/full-text-rss) (FiveFilters, on RapidAPI) to extract the article, sanitizes the HTML, and renders it in a light reading layout.

It works when the article text is in the page the publisher serves (soft or metered paywalls, JavaScript overlays, sites that give crawlers full text). Hard paywalls that only send a teaser stay hard. It's for personal reading; keep it private.

Built from [app-template](https://github.com/waynezhu6/app-template). Deployment, the database and Caddy work exactly as described there and in [infrastructure](https://github.com/waynezhu6/infrastructure).

## Using it

- Put the article link after the address: `https://waynezhu.dev/apps/txtify/https://example.com/article`. The first time on a browser it asks for `ACCESS_KEY`, then keeps it in a cookie.
- Home page, https://waynezhu.dev/apps/txtify/: paste a URL.
- Bookmarklet: drag "Read this" from the home page to your bookmarks bar, then click it on any article.
- Without JavaScript: `https://waynezhu.dev/api/txtify/read?url=<article>` returns the whole page from the backend (add `&key=<ACCESS_KEY>` once per browser).

## Server configuration

Besides the `DATABASE_URL` the infrastructure repo provides, the backend reads:

| Variable | |
|---|---|
| `RAPIDAPI_KEY` | Your RapidAPI key, subscribed to Full-Text RSS. Required. |
| `ACCESS_KEY` | Access key you choose (any long random string). Required; without it every read is refused. |
| `READ_LIMIT_PER_HOUR` | Cap on new (uncached) articles per hour across all users. Default 60. |
| `MONTHLY_API_LIMIT` | Hard cap on RapidAPI calls in any 31 days, counted in Postgres so redeploys don't reset it. Default 250, the free tier; past it RapidAPI charges per request. |
| `CACHE_DAYS` | How long a fetched article is kept. Reading it again within that time costs no API call. Default 7. |

Set them as this repo's Actions secrets (Settings → Secrets and variables → Actions → New repository secret), then re-run the Deploy workflow (Actions → Deploy → Run workflow). `.github/workflows/deploy.yml` hands each to the backend as an environment variable (add a line under `env` there for a new one, such as `READ_LIMIT_PER_HOUR`). For `ACCESS_KEY`, a random string works well, and it's what you enter on the home page:

```bash
openssl rand -hex 24
```

## Local dev

```bash
npm install
docker compose -f docker-compose.dev.yml up -d
cp backend/.env.example backend/.env   # then fill in RAPIDAPI_KEY and ACCESS_KEY
npm run dev                            # http://localhost:5173/apps/txtify/
```

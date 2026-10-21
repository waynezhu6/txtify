# txtify

A personal reader: give it an article URL and it returns a clean, text-only page. It asks the [Full-Text RSS API](https://rapidapi.com/fivefilters/api/full-text-rss) (FiveFilters, on RapidAPI) to extract the article, sanitizes the HTML, and renders it in a light reading layout.

It works when the article text is in the page the publisher serves (soft or metered paywalls, JavaScript overlays, sites that give crawlers full text). Hard paywalls that only send a teaser stay hard. It's for personal reading; keep it private.

Built from [app-template](https://github.com/waynezhu6/app-template). Deployment, the database and Caddy work exactly as described there and in [infrastructure](https://github.com/waynezhu6/infrastructure).

## Using it

- Home page, https://waynezhu.dev/apps/txtify/: paste a URL. The first time on a browser, open "Access key" and enter `ACCESS_KEY`; it's then kept in a cookie.
- Bookmarklet: drag "Read this" from the home page to your bookmarks bar, then click it on any article.
- Directly: `https://waynezhu.dev/api/txtify/read?url=<article>` (add `&key=<ACCESS_KEY>` once per browser).

## Server configuration

Besides the `DATABASE_URL` the infrastructure repo provides, the backend reads:

| Variable | |
|---|---|
| `RAPIDAPI_KEY` | Your RapidAPI key, subscribed to Full-Text RSS. Required. |
| `ACCESS_KEY` | Access key you choose (any long random string). Required; without it every read is refused. |
| `READ_LIMIT_PER_HOUR` | Cap on articles per hour across all users, to protect the API quota. Default 60. |

On the server, append them to `~/infrastructure/secrets/txtify.env` and re-run this repo's Deploy workflow (Actions → Deploy → Run workflow):

```bash
printf 'RAPIDAPI_KEY=%s\nACCESS_KEY=%s\n' '<your rapidapi key>' "$(openssl rand -hex 24)" >> ~/infrastructure/secrets/txtify.env
grep ACCESS_KEY ~/infrastructure/secrets/txtify.env   # the access key to enter on the home page
```

## Local dev

```bash
npm install
docker compose -f docker-compose.dev.yml up -d
cp backend/.env.example backend/.env   # then fill in RAPIDAPI_KEY and ACCESS_KEY
npm run dev                            # http://localhost:5173/apps/txtify/
```

# txtify

Personal text-only article reader at `waynezhu.dev/apps/txtify/`. The frontend reads the article URL from its own path (`<APP_BASE><article url>`) and renders `GET <API_BASE>/article?url=`, which sends the URL to the Full-Text RSS API on RapidAPI and returns sanitized JSON (`backend/src/read.ts`, `extract.ts`, `page.ts`). `GET <API_BASE>/read?url=` returns the same as a whole server-rendered page, for use without JS. Built from [app-template](https://github.com/waynezhu6/app-template): React + Vite frontend, Express + Postgres backend, deployed by `.github/workflows/deploy.yml`. Server-side details (Caddy, Postgres, registration, secrets) live in the [infrastructure](https://github.com/waynezhu6/infrastructure) repo, not here.

## Conventions

- Backend is ESM TypeScript (`backend/src`, imports end in `.js`). Routes go under `/api/*`.
- The app lives under a path prefix: frontend at `/apps/<name>/`, backend at `/api/<name>/` (Caddy strips it, so Express still sees `/api/...`). Never hardcode `/` or `/api` URLs: the frontend calls the backend via `api()`/`apiUrl()` in `frontend/src/api.ts`, and the backend uses `API_BASE`/`APP_BASE` from `backend/src/paths.ts` for redirects, links and cookie paths. Cookies use `path: API_BASE`, because all apps share one domain.
- The backend listens on port 3001 and must keep the `/api/health` route.
- Schema changes are migrations: `cd backend && npm run migrate:create -- <name>` (ES modules in `backend/migrations`). They run on startup before the server listens; never edit one that has shipped. During a deploy the new version migrates while the old one is still serving, so a migration must not break the code before it: add freely, drop or rename only in a later deploy. Keep the SIGTERM handler in `backend/src/index.ts`, which lets the old version finish its requests.
- Database access goes through the pool in `backend/src/db.ts`; config comes from `DATABASE_URL` only.
- Local dev: `docker compose -f docker-compose.dev.yml up -d`, `cp backend/.env.example backend/.env`, `npm run dev`, then open `http://localhost:5173/apps/<folder-name>/`.
- After adding or upgrading a package, commit the updated root `package-lock.json`; CI and the Docker build use `npm ci`.
- Server env beyond the template: `RAPIDAPI_KEY` and `ACCESS_KEY` (required), `READ_LIMIT_PER_HOUR` (default 60), `MONTHLY_API_LIMIT` (default 250, RapidAPI's free tier; `quota.ts`) and `CACHE_MINUTES` (default 10; in-memory `cache.ts`). Every RapidAPI call must go through `reserveCall()` first, so the monthly cap can't be bypassed. They are this repo's Actions secrets, listed under `env` in the Deploy step of `deploy.yml`; never in this repo's files.
- Article HTML from the API is untrusted: keep it going through `sanitize-html` in `page.ts` and keep the page's CSP.

## Don't change without a reason

- The `deploy.yml` workflow and `backend/Dockerfile`. They carry the contract with the infrastructure repo's deployer: one image `ghcr.io/<owner>/<name>-backend` (built with `--build-arg APP=<name>`) that serves the backend on port 3001 with `/api/health`, and holds the built frontend at `/app/frontend/dist`. How the container runs (name, networks, environment) is defined in infrastructure, not here.
- Don't add server details (hostnames, Caddy config, DB credentials) to this repo; they belong in infrastructure.

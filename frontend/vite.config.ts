import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { basename, resolve } from 'path'

// The app is served at waynezhu.dev/apps/<name>/ and its backend at
// waynezhu.dev/api/<name>/. <name> is the repo name: CI sets APP from it, and
// locally it falls back to the checkout's folder name. Dev uses the same
// paths, so a hardcoded "/..." URL breaks here rather than only in production.
const app = (process.env.APP ?? basename(resolve(import.meta.dirname, '..'))).toLowerCase()
const apiBase = `/api/${app}`

// The reader shows article HTML. The backend sanitizes it; this CSP is the
// second line, so nothing in it can run script or send data off. Build only:
// the dev server needs inline scripts.
const CSP =
  "default-src 'self'; img-src https: http: data:; style-src 'self' 'unsafe-inline'; " +
  "connect-src 'self'; form-action 'self'; base-uri 'none'; object-src 'none'"
const csp: Plugin = {
  name: 'csp',
  apply: 'build',
  transformIndexHtml: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head' }],
}

export default defineConfig({
  base: `/apps/${app}/`,
  define: {
    'import.meta.env.VITE_API_BASE': JSON.stringify(apiBase),
  },
  plugins: [react(), csp],
  server: {
    proxy: {
      // Caddy strips the prefix in production; do the same in dev.
      [apiBase]: {
        target: 'http://localhost:3001',
        rewrite: (path) => '/api' + path.slice(apiBase.length),
      },
    },
  },
})

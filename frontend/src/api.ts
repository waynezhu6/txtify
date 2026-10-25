// The backend lives at /api/<name>/ (see vite.config.ts). Always go through
// these instead of writing "/api/..." so calls reach this app's backend.
export const API_BASE = import.meta.env.VITE_API_BASE

export function apiUrl(path: string): string {
  return API_BASE + path
}

export function api(path: string, init?: RequestInit): Promise<Response> {
  return fetch(apiUrl(path), init)
}

// The shared sign-in page. It sends the browser back here afterwards. Use it
// when a backend route that needs a user (requireUser) answers 401:
//   if (res.status === 401) location.assign(loginUrl())
export function loginUrl(): string {
  return `/apps/auth/?next=${encodeURIComponent(location.pathname + location.search)}`
}

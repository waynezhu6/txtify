import { useEffect, useState, type FormEvent } from 'react'
import './App.css'
import { api } from './api'

// The article to read is the rest of the path: /apps/txtify/https://example.com/a?b=1.
// Some proxies and clients squash "https://" to "https:/", so put it back.
const BASE = import.meta.env.BASE_URL
function articleFromLocation(): string {
  const rest = window.location.pathname.slice(BASE.length) + window.location.search
  return rest.replace(/^(https?:)\/*/i, '$1//').replace(/^\/+/, '')
}

function readerPath(url: string): string {
  return BASE + url.trim()
}

interface Reading {
  title: string
  meta: string[]
  source: string
  content: string
}

type State =
  | { kind: 'loading' }
  | { kind: 'article'; reading: Reading }
  | { kind: 'needKey'; error: string }
  | { kind: 'error'; error: string }

function KeyForm({ onKey, autoFocus }: { onKey: (key: string) => void; autoFocus?: boolean }) {
  const [key, setKey] = useState('')
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (key.trim()) onKey(key.trim())
      }}
    >
      <input
        type="password"
        placeholder="Access key"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        autoComplete="current-password"
        autoFocus={autoFocus}
        required
      />
      <button type="submit">Continue</button>
    </form>
  )
}

function Reader({ url }: { url: string }) {
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [key, setKey] = useState('')

  useEffect(() => {
    let live = true
    const params = new URLSearchParams({ url })
    if (key) params.set('key', key)
    setState({ kind: 'loading' })
    api(`/article?${params}`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        if (!live) return
        if (res.ok) setState({ kind: 'article', reading: body })
        else if (body.needKey) setState({ kind: 'needKey', error: body.error })
        else setState({ kind: 'error', error: body.error ?? `HTTP ${res.status}` })
      })
      .catch(() => live && setState({ kind: 'error', error: "Couldn't reach the server." }))
    return () => {
      live = false
    }
  }, [url, key])

  useEffect(() => {
    document.title = state.kind === 'article' ? state.reading.title : 'txtify'
  }, [state])

  return (
    <main className="reader">
      <nav>
        <a href={BASE}>txtify</a>
      </nav>
      {state.kind === 'loading' && <p className="muted">Fetching the article…</p>}
      {state.kind === 'needKey' && (
        <>
          <p>{state.error}</p>
          <KeyForm onKey={setKey} autoFocus />
        </>
      )}
      {state.kind === 'error' && (
        <>
          <h1>Couldn't get the article</h1>
          <p>{state.error}</p>
          <p>
            <a href={url} rel="noopener noreferrer nofollow">
              Open the original
            </a>
          </p>
        </>
      )}
      {state.kind === 'article' && (
        <>
          <header>
            <h1>{state.reading.title}</h1>
            <div className="meta">
              {state.reading.meta.map((m) => `${m} · `).join('')}
              <a href={state.reading.source} rel="noopener noreferrer nofollow">
                Original
              </a>
            </div>
          </header>
          {/* Sanitized by the backend (page.ts); no scripts, handlers or non-http links. */}
          <article dangerouslySetInnerHTML={{ __html: state.reading.content }} />
        </>
      )}
    </main>
  )
}

function Home() {
  const [url, setUrl] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (url.trim()) window.location.assign(readerPath(url))
  }

  const bookmarklet = `javascript:location.href='${window.location.origin}${BASE}'+location.href`

  return (
    <main>
      <h1>txtify</h1>
      <p className="muted">
        Paste an article link to read it as plain text, or put the link after the address: <code>{window.location.origin}{BASE}https://…</code>
      </p>
      <form onSubmit={submit}>
        <input
          type="url"
          placeholder="https://example.com/article"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
          autoFocus
        />
        <button type="submit">Read</button>
      </form>
      <p className="muted">
        Or drag this to your bookmarks bar and click it on any article:{' '}
        <a className="bookmarklet" href={bookmarklet} onClick={(e) => e.preventDefault()}>
          Read this
        </a>
      </p>
    </main>
  )
}

function App() {
  const url = articleFromLocation()
  return url ? <Reader url={url} /> : <Home />
}

export default App

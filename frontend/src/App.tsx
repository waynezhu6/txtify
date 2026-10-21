import { useState, type FormEvent } from 'react'
import './App.css'
import { apiUrl } from './api'

// The reading itself happens at the backend's /read, which returns a full HTML page.
// This page is just a way in: a URL box, the one-time key, and a bookmarklet.
function readerUrl(url: string, key = '') {
  const params = new URLSearchParams({ url })
  if (key) params.set('key', key)
  return apiUrl(`/read?${params}`)
}

function App() {
  const [url, setUrl] = useState('')
  const [key, setKey] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (url.trim()) window.location.href = readerUrl(url.trim(), key.trim())
  }

  const bookmarklet = `javascript:location.href='${window.location.origin}${apiUrl('/read')}?url='+encodeURIComponent(location.href)`

  return (
    <main>
      <h1>txtify</h1>
      <p className="muted">Paste an article link to read it as plain text.</p>
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
        <details>
          <summary>Access key</summary>
          <input
            type="password"
            placeholder="Only needed the first time on this browser"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            autoComplete="current-password"
          />
        </details>
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

export default App

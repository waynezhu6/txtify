import sanitizeHtml from "sanitize-html";
import type { Article } from "./extract.js";
import { APP_BASE } from "./paths.js";

// The page sets its own CSP, so even if something slipped past the sanitizer
// it couldn't run script or phone home beyond loading images.
export const CSP =
  "default-src 'none'; img-src https: http: data:; style-src 'unsafe-inline'; " +
  "form-action 'self'; base-uri 'none'; frame-ancestors 'none'";

export function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function clean(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "figure", "figcaption", "picture"]),
    allowedAttributes: {
      a: ["href", "title"],
      img: ["src", "alt", "title", "width", "height"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan"],
    },
    allowedSchemes: ["http", "https"],
    allowedSchemesByTag: { img: ["http", "https", "data"] },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer nofollow", target: "_blank" }),
      img: sanitizeHtml.simpleTransform("img", { loading: "lazy" }),
    },
  });
}

const STYLE = `
  :root { color-scheme: light dark; --bg: #fbf9f4; --fg: #2b2a27; --muted: #77736a; --link: #2a5db0; --rule: #e4dfd3; }
  @media (prefers-color-scheme: dark) { :root { --bg: #1c1b19; --fg: #e6e2d9; --muted: #9a958a; --link: #8ab4f8; --rule: #33312d; } }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--fg); font: 19px/1.65 Charter, "Iowan Old Style", Georgia, serif; }
  main { max-width: 680px; margin: 0 auto; padding: 40px 20px 80px; }
  header { border-bottom: 1px solid var(--rule); margin-bottom: 28px; padding-bottom: 16px; }
  h1 { font-size: 1.9em; line-height: 1.2; margin: 0 0 10px; }
  .meta, nav { font: 14px/1.5 system-ui, sans-serif; color: var(--muted); }
  nav { margin-bottom: 24px; }
  a { color: var(--link); }
  img, video { max-width: 100%; height: auto; }
  figure { margin: 1.5em 0; } figcaption { font-size: 0.8em; color: var(--muted); }
  blockquote { margin: 1.2em 0; padding-left: 1em; border-left: 3px solid var(--rule); color: var(--muted); }
  pre { overflow-x: auto; font-size: 0.8em; }
  table { border-collapse: collapse; display: block; overflow-x: auto; }
  td, th { border: 1px solid var(--rule); padding: 4px 8px; }
`;

function layout(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>${escape(title)}</title>
<style>${STYLE}</style>
</head>
<body><main>
<nav><a href="${APP_BASE}">txtify</a></nav>
${body}
</main></body>
</html>`;
}

export function articlePage(a: Article, requested: string): string {
  const source = [a.effective_url, a.url].find((u) => u && /^https?:\/\//i.test(u)) ?? requested;
  const title = a.title?.trim() || "Untitled";
  const meta = [a.author, a.domain, a.date ? a.date.slice(0, 10) : undefined, a.word_count ? `${a.word_count} words` : undefined]
    .filter(Boolean)
    .map((s) => escape(String(s)))
    .join(" · ");
  const content = clean(a.content ?? "");
  const body = content.trim()
    ? content
    : "<p>No article text came back for this page. It may be behind a hard paywall or rendered by JavaScript.</p>";
  return layout(
    title,
    `<header><h1>${escape(title)}</h1>
<div class="meta">${meta ? `${meta} · ` : ""}<a href="${escape(source)}" rel="noopener noreferrer nofollow">Original</a></div></header>
<article>${body}</article>`,
  );
}

export function messagePage(title: string, message: string, original?: string): string {
  const link = original
    ? `<p><a href="${escape(original)}" rel="noopener noreferrer nofollow">Open the original</a></p>`
    : "";
  return layout(title, `<header><h1>${escape(title)}</h1></header><p>${escape(message)}</p>${link}`);
}

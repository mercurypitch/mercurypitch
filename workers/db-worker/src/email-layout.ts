// ============================================================
// Mail layout — the look the sign-up and purchase mails share
// ============================================================
//
// Mail clients set the rules: tables and inline styles only, no SVG, live
// text never inside an image, and pictures as JPEG or PNG under /email/ on
// the app's own origin. Each picture is versioned in its name because a sent
// mail can never be updated: a changed picture gets a new name.

import { ABOUT_URL, escapeHtml, footerHtml, REPO_URL } from './email'

/**
 * Where a mail's links and pictures point. Links follow the app the sign-up
 * came from, so a dev sign-up lands on dev. Pictures always come from a
 * public host: a mail opened on a phone cannot load anything from localhost.
 */
export interface MailOrigins {
  appOrigin: string
  assetOrigin: string
}

// ── pictures ─────────────────────────────────────────────────────────

export interface MailArt {
  path: string
  height: number
  alt: string
}

/** Every picture a mail can show, by role. Shown 600 wide, stored at 2x. */
export const MAIL_ART = {
  firstNote: {
    path: '/email/hero-01-first-note-v1.jpg',
    height: 400,
    alt: 'Merc, a glowing droplet, sings on a round brass stage under an amber spotlight while a ribbon of light rises through three rings.',
  },
  constellation: {
    path: '/email/hero-04-constellation-v1.jpg',
    height: 400,
    alt: 'Merc, a glowing droplet, stands on a rooftop ledge looking up at two linked constellations, with city lights below.',
  },
  karaokeNight: {
    path: '/email/hero-06-karaoke-night-v1.jpg',
    height: 400,
    alt: 'Merc, a glowing droplet, sings into a vintage microphone on a small stage under an amber spotlight.',
  },
  letter: {
    path: '/email/banner-07-letter-v1.jpg',
    height: 260,
    alt: 'Merc, a glowing droplet, peeks out of an open black envelope, holding up an amber key of light.',
  },
  credits: {
    path: '/email/hero-08-credits-v1.jpg',
    height: 400,
    alt: 'Merc, a glowing droplet, holds up an amber orb while a bright sphere above it splits into violet, blue, teal and amber ribbons of light.',
  },
} as const satisfies Record<string, MailArt>

export const WORDMARK_PATH = '/email/wordmark-v1@2x.png'

// ── look ─────────────────────────────────────────────────────────────

export const W = {
  page: '#010409',
  card: '#0d1117',
  panel: '#0b1520',
  panelLine: '#1c2a3b',
  line: '#30363d',
  text: '#e6edf3',
  soft: '#c3ccd6',
  muted: '#8b949e',
  blue: '#58a6ff',
  teal: '#2dd4bf',
  violet: '#bc8cff',
  amber: '#f2b45c',
  ink: '#04121f',
  track: '#1c2433',
  mystery: '#101b2a',
  mysteryLine: '#3b4a5f',
} as const

export const SANS = "'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
// Outfit loads where a client honours the <link> in the head (Apple Mail);
// everywhere else the headline falls back to the sans stack.
export const DISPLAY = "Outfit,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
export const MONO = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace'

// ── building blocks ──────────────────────────────────────────────────

export const url = (origin: string, path: string): string =>
  escapeHtml(`${origin}${path}`)

export function button(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 4px;"><tr><td bgcolor="${W.teal}" style="background:${W.teal};border-radius:12px;"><a href="${href}" style="display:inline-block;padding:15px 28px;font:700 16px/1.2 ${SANS};color:${W.ink};text-decoration:none;border-radius:12px;">${label}</a></td></tr></table>`
}

export function arrowLink(label: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;margin-top:12px;font:600 15px/1.4 ${SANS};color:${W.blue};text-decoration:none;">${label} &rarr;</a>`
}

export function inlineLink(label: string, href: string): string {
  return `<a href="${href}" style="color:${W.blue};text-decoration:none;font-weight:600;">${label}</a>`
}

export function eyebrow(text: string, color: string = W.teal): string {
  return `<div style="font:700 12px/1.4 ${SANS};letter-spacing:1.6px;text-transform:uppercase;color:${color};margin:0 0 10px;">${escapeHtml(text)}</div>`
}

// ── sections ─────────────────────────────────────────────────────────

/** The eyebrow, headline and first paragraph under the picture. */
export interface Lines {
  eyebrow: string
  headline: string
  body: string
}

/** Where a tap on the picture goes: a path on the app and what it opens. */
export interface HeroLink {
  path: string
  label: string
}

/** The picture on top. Without a link it is only a picture. */
export function heroRow(
  art: MailArt,
  origins: MailOrigins,
  link: HeroLink | null,
): string {
  const img = `<img src="${url(origins.assetOrigin, art.path)}" width="600" height="${art.height}" alt="${escapeHtml(art.alt)}" style="display:block;width:100%;height:auto;border:0;border-radius:17px 17px 0 0;">`
  const hero =
    link === null
      ? img
      : `<a href="${url(origins.appOrigin, link.path)}" aria-label="${escapeHtml(link.label)}" style="display:block;text-decoration:none;">${img}</a>`
  return `<tr><td style="padding:0;font-size:0;line-height:0;">${hero}</td></tr>`
}

export function introRow(lines: Lines, after = ''): string {
  return `<tr><td style="padding:30px 36px 4px;">${eyebrow(lines.eyebrow)}<h1 style="margin:0;font:700 31px/1.12 ${DISPLAY};letter-spacing:-0.4px;color:${W.text};">${escapeHtml(lines.headline)}</h1><p style="margin:14px 0 0;font:17px/1.6 ${SANS};color:${W.soft};">${escapeHtml(lines.body)}</p>${after}</td></tr>`
}

/** The closing line, and a quieter note under a rule when there is one. */
export function signOffRow(line: string, note: string | null): string {
  const under =
    note === null
      ? ''
      : `<div style="border-top:1px solid ${W.line};margin-top:20px;padding-top:16px;font:13px/1.6 ${SANS};color:${W.muted};">${escapeHtml(note)}</div>`
  return `<tr><td style="padding:22px 36px 30px;"><p style="margin:0;font:15px/1.6 ${SANS};color:${W.soft};">${escapeHtml(line)}</p>${under}</td></tr>`
}

/** The whole mail: wordmark, the card of rows, and the shared footer. */
export function documentHtml(
  subject: string,
  preheader: string,
  origins: MailOrigins,
  rows: string[],
  reason: string,
): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${escapeHtml(subject)}</title>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@600;700&amp;display=swap" rel="stylesheet">
</head>
<body style="margin:0; padding:0; background:${W.page}; -webkit-text-size-adjust:100%;">
<div style="display:none; max-height:0; overflow:hidden; opacity:0; color:${W.page}; font-size:1px; line-height:1px;">${escapeHtml(preheader)}&#8203;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${W.page}" style="background:${W.page};"><tr><td align="center" style="padding:22px 12px 30px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
<tr><td style="padding:2px 4px 16px;"><a href="${escapeHtml(origins.appOrigin)}" style="text-decoration:none;"><img src="${url(origins.assetOrigin, WORDMARK_PATH)}" width="204" height="40" alt="MercuryPitch" style="display:block;border:0;width:204px;height:40px;"></a></td></tr>
<tr><td style="background:${W.card};border:1px solid ${W.line};border-radius:18px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows.join('')}</table></td></tr>
${footerHtml(reason)}
</table></td></tr></table>
</body>
</html>`
}

/** The footer, as the plain-text part says it. */
export function footerText(reason: string): string[] {
  return [
    'Mercury Pitch · Learn to sing and play. Practice has never been more fun.',
    `${ABOUT_URL} · ${REPO_URL}`,
    `${reason} mercurypitch.com.`,
  ]
}

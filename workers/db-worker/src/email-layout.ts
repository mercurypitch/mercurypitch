// ============================================================
// Mail layout — the look the sign-up and purchase mails share
// ============================================================
//
// Mail clients set the rules: tables and inline styles only, no SVG, live
// text never inside an image, and pictures as JPEG or PNG under /email/ on
// the app's own origin. Each picture is versioned in its name because a sent
// mail can never be updated: a changed picture gets a new name. Names keep to
// letters, digits and hyphens: Cloudflare answers anything a URL would
// percent-encode, like an @, with a redirect before the picture.

import { ABOUT_URL, AUTO_LINK_STYLE, COLOR_SCHEME_META, escapeHtml, footerHtml, REPO_URL, } from './email'

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

/**
 * The wordmark on its own dark plate in the page colour, made by
 * scripts/generate-mail-wordmark.mjs. Gmail on iPhone in dark mode recolours
 * our page light but never a picture: there the plate reads as a dark badge
 * and the white "Mercury" stays readable. On our page it cannot be seen.
 *
 * Mails sent before it point at /email/wordmark-v1-2x.png, and before that
 * at /email/wordmark-v1@2x.png, the same bytes reached through Cloudflare's
 * redirect. Both files stay for them.
 */
export const WORDMARK_PATH = '/email/wordmark-v2-2x.png'

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

// ── columns ──────────────────────────────────────────────────────────

/**
 * The class on a column that sits beside another on a desktop and takes the
 * whole card on a phone. HEAD_CSS sets its width; where a client drops the
 * <style> (Gmail with a non-Google account), the inline 263 px still fits
 * two to a row in the 600 px card and stacks narrower.
 */
export const COLUMN_CLASS = 'mp-col'

/**
 * Below 600 px a column takes the full width, so on a phone the tiles reach
 * the card's right edge instead of stopping at 263 px. From 600 px two
 * columns split the row evenly. Gmail, Apple Mail, Outlook's apps and Yahoo
 * read media queries in the head; Outlook for Windows reads none and gets
 * the [if mso] table in twoUp().
 */
const HEAD_CSS = `@media screen and (max-width:599px){.${COLUMN_CLASS}{max-width:100%!important;}}@media screen and (min-width:600px){.${COLUMN_CLASS}{max-width:50%!important;}}`

/**
 * Cells two to a row on a desktop and one to a row on a phone: inline
 * blocks that wrap, in a cell with font-size 0 so no whitespace opens a gap
 * between them. Outlook for Windows ignores inline-block and max-width, so it
 * gets the same cells in a real table of half-width cells instead.
 */
export function twoUp(cells: readonly string[]): string {
  const open = '<td width="50%" valign="top">'
  const blocks = cells
    .map((cell, i) => {
      const before =
        i === 0
          ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${open}`
          : i % 2 === 0
            ? `</td></tr><tr>${open}`
            : `</td>${open}`
      return `<!--[if mso]>${before}<![endif]--><div class="${COLUMN_CLASS}" style="display:inline-block;width:100%;max-width:263px;vertical-align:top;font-size:16px;">${cell}</div>`
    })
    .join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="font-size:0;">${blocks}<!--[if mso]></td></tr></table><![endif]--></td></tr></table>`
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
  const img = `<img src="${url(origins.assetOrigin, art.path)}" width="600" height="${art.height}" alt="${escapeHtml(art.alt)}" style="display:block;width:100%;height:auto;border:0;border-radius:17px 17px 0 0;color:${W.soft};">`
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
${COLOR_SCHEME_META}
<title>${escapeHtml(subject)}</title>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@600;700&amp;display=swap" rel="stylesheet">
<style>${HEAD_CSS}</style>
${AUTO_LINK_STYLE}
</head>
<body id="body" style="margin:0; padding:0; background:${W.page}; -webkit-text-size-adjust:100%;">
<div style="display:none; max-height:0; overflow:hidden; opacity:0; color:${W.page}; font-size:1px; line-height:1px;">${escapeHtml(preheader)}&#8203;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${W.page}" style="background:${W.page};"><tr><td align="center" style="padding:22px 12px 30px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
<tr><td style="padding:0 0 8px;"><a href="${escapeHtml(origins.appOrigin)}" style="text-decoration:none;"><img src="${url(origins.assetOrigin, WORDMARK_PATH)}" width="220" height="56" alt="MercuryPitch" style="display:block;border:0;width:220px;height:56px;color:${W.text};"></a></td></tr>
<tr><td style="background:${W.card};border:1px solid ${W.line};border-radius:18px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows.join('')}</table></td></tr>
${footerHtml(reason)}
</table></td></tr></table>
</body>
</html>`
}

/** The footer, as the plain-text part says it. */
export function footerText(reason: string): string[] {
  return [
    'MercuryPitch · Learn to sing and play.',
    `${ABOUT_URL} · ${REPO_URL}`,
    `${reason} mercurypitch.com.`,
  ]
}

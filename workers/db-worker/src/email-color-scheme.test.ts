import { describe, expect, it } from 'vitest'
import type { Env } from './auth'
import { AUTO_LINK_STYLE, COLOR_SCHEME_META } from './email'
import { renderLoginCode, renderSignUpCode } from './email-code'
import type { MailOrigins } from './email-layout'
import { renderNewsletterIssue } from './email-newsletter'
import { renderAccountNotice } from './email-notice'
import { renderPasswordReset } from './email-password-reset'
import { EMAIL_PREVIEW_PATH, handleEmailPreview, PREVIEW_MAIL_IDS, } from './email-preview'

// Every mail is drawn dark and declares "light only" (see COLOR_SCHEME_META).
// A client that honors it paints text with no color of its own black, and a
// link link blue, so nothing in a mail may lean on those defaults.

/** An inline color of its own: not background-color or border-color, and
 *  not a keyword that hands the choice back to the client. */
const OWN_COLOR =
  /(?:^|;)\s*color\s*:\s*(?!inherit|transparent|currentcolor)[^;\s]/i

/** Elements that never wrap text. */
const VOID = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'track',
  'wbr',
])

/** A start tag's own style attribute ("data-style" does not count). */
function styleOf(tag: string): string {
  return /\sstyle="([^"]*)"/i.exec(tag)?.[1] ?? ''
}

interface Open {
  name: string
  colored: boolean
  flagged: boolean
}

/**
 * Every line of text with no inline color on any element between it and
 * <body> (Gmail drops the body's own styles), every link with words in it
 * and no color of its own, and every picture whose alt text would fall back
 * to the client's default. The mails are generated, well-formed HTML, so a
 * tokenizer is enough: comments (Outlook's [if mso] blocks among them), the
 * doctype and the head's raw-text elements are skipped whole.
 */
function uncolored(html: string): string[] {
  const found: string[] = []
  const stack: Open[] = []
  let inBody = false
  const tokens =
    /<!--[\s\S]*?-->|<!doctype[^>]*>|<(style|title|script)\b[^>]*>[\s\S]*?<\/\1\s*>|<\/?([a-z][a-z0-9]*)\b[^>]*>|[^<]+/gi
  for (const [token, rawText, tagName] of html.matchAll(tokens)) {
    if (token.startsWith('<!') || rawText !== undefined) continue
    if (tagName === undefined) {
      // Spacers and the preheader's zero-width padding draw nothing.
      const text = token
        .replace(
          /&(?:nbsp|zwnj|#160|#x0*a0|#8203|#x200b|#8204|#847|#x34f);/gi,
          ' ',
        )
        .trim()
      if (!inBody || text === '') continue
      if (!stack.some((open) => open.colored))
        found.push(`text: ${text.slice(0, 40)}`)
      const link = stack.findLast((open) => open.name === 'a')
      if (link !== undefined && !link.colored && !link.flagged) {
        link.flagged = true
        found.push(`link: ${text.slice(0, 40)}`)
      }
      continue
    }
    const name = tagName.toLowerCase()
    if (token.startsWith('</')) {
      const at = stack.map((open) => open.name).lastIndexOf(name)
      if (at >= 0) stack.length = at
      continue
    }
    if (name === 'body') {
      inBody = true
      continue
    }
    const colored = OWN_COLOR.test(styleOf(token))
    if (name === 'img') {
      if (!colored)
        found.push(`picture: ${/\salt="([^"]*)"/i.exec(token)?.[1] ?? ''}`)
      continue
    }
    if (VOID.has(name) || token.endsWith('/>')) continue
    stack.push({ name, colored, flagged: false })
  }
  return found
}

async function preview(id: string): Promise<string> {
  const res = handleEmailPreview(
    new Request(`https://api.test${EMAIL_PREVIEW_PATH}?mail=${id}`),
    { EMAIL_PREVIEW: '1' } as Env,
    EMAIL_PREVIEW_PATH,
  )
  if (res === null || res.status !== 200)
    throw new Error(`no preview called ${id}`)
  return res.text()
}

const ORIGINS: MailOrigins = {
  appOrigin: 'https://mercurypitch.com',
  assetOrigin: 'https://mercurypitch.com',
}

const item = {
  title: 'What happened',
  body: 'A paragraph.',
  href: 'https://mercurypitch.com/',
  cta: 'Open it',
}

/** Every preview, plus each renderer called directly. */
async function everyMail(): Promise<[string, string][]> {
  const previews = await Promise.all(
    PREVIEW_MAIL_IDS.map(
      async (id): Promise<[string, string]> => [id, await preview(id)],
    ),
  )
  return [
    ...previews,
    [
      'password reset',
      renderPasswordReset({
        ...ORIGINS,
        resetUrl: 'https://mercurypitch.com/#/reset-password?token=t',
        ttlHours: 1,
      }).html,
    ],
    [
      'login code',
      renderLoginCode({ ...ORIGINS, code: '123456', ttlMinutes: 10 }).html,
    ],
    [
      'sign-up code',
      renderSignUpCode({ ...ORIGINS, code: '123456', ttlMinutes: 10 }).html,
    ],
    [
      'newsletter',
      renderNewsletterIssue({
        ...ORIGINS,
        subject: 'Issue',
        preheader: 'Pre',
        intro: 'Intro.',
        items: [item],
        unsubscribeUrl: 'https://mercurypitch.com/u',
      }).html,
    ],
    [
      'account notice',
      renderAccountNotice({
        ...ORIGINS,
        kind: 'security',
        subject: 'Notice',
        preheader: 'Pre',
        intro: 'First.\n\nSecond.',
        items: [item],
      }).html,
    ],
  ]
}

describe('the color scheme every mail declares', () => {
  it('reaches every preview and every renderer', async () => {
    expect(PREVIEW_MAIL_IDS.length).toBeGreaterThan(0)
    expect(await everyMail()).toHaveLength(PREVIEW_MAIL_IDS.length + 5)
  })

  it('is "light only", once, never "dark", with the auto-link rules beside it', async () => {
    for (const [name, html] of await everyMail()) {
      expect(html.split(COLOR_SCHEME_META).length - 1, name).toBe(1)
      expect(html.split(AUTO_LINK_STYLE).length - 1, name).toBe(1)
      expect(html, name).not.toMatch(/content="[^"]*dark[^"]*"/)
      expect(html, name).toMatch(/<body id="body"/)
    }
  })

  it('gives every line of text, every link and every picture a color of its own', async () => {
    for (const [name, html] of await everyMail()) {
      expect(uncolored(html), name).toEqual([])
    }
  })

  it('notices text, a link or a picture that leans on the default', () => {
    const html =
      '<!doctype html><html><body>' +
      '<p>Plain</p>' +
      '<p style="background-color:#000">Fill only</p>' +
      '<div style="color:inherit">Handed back</div>' +
      '<div style="color:#fff"><a href="https://a.test/">Bare link</a> and colored words</div>' +
      '<img src="x.png" alt="Pictured" data-style="color:#fff" style="display:block">' +
      '<IMG src="y.png" alt="Shouting" style="border-color:#fff">' +
      '<img src="z.png" alt="Fine" style="color:#fff;display:block">' +
      '</body></html>'
    expect(uncolored(html)).toEqual([
      'text: Plain',
      'text: Fill only',
      'text: Handed back',
      'link: Bare link',
      'picture: Pictured',
      'picture: Shouting',
    ])
  })
})

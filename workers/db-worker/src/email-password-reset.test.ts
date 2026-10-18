import { describe, expect, it } from 'vitest'
import type { RenderedEmail } from './email'
import type { MailOrigins } from './email-layout'
import { MAIL_ART, WORDMARK_PATH } from './email-layout'
import { renderPasswordReset } from './email-password-reset'

/** The footer's copyright line as the HTML spells it. */
const COPYRIGHT = '&copy; 2026 Mercury Pitch &middot; AGPL-3.0'

// Links and pictures on different hosts, so a test can tell which one a URL
// was built from.
const APP = 'https://app.test'
const PICTURES = 'https://pictures.test'
const ORIGINS: MailOrigins = { appOrigin: APP, assetOrigin: PICTURES }
const RESET_URL = `${APP}/#/reset-password?token=t0k`

const reset = (
  displayName: string | null = 'Sam Singer',
  ttlHours = 2,
  resetUrl = RESET_URL,
): RenderedEmail =>
  renderPasswordReset({ ...ORIGINS, displayName, resetUrl, ttlHours })

const hrefs = (html: string): string[] =>
  [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, '&'))
const srcs = (html: string): string[] =>
  [...html.matchAll(/src="([^"]*)"/g)].map((m) => m[1])

/** What a reader sees: tags gone, entities read. */
function visibleText(html: string): string {
  return html
    .replace(/<head>[\s\S]*?<\/head>/, '')
    .replace(/<\/?(?:a|span)\b[^>]*>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&middot;/g, '·')
    .replace(/&copy;/g, '©')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
}

describe('the password reset mail', () => {
  it('says what it is in the subject and the preheader', () => {
    const { subject, html } = reset()
    expect(subject).toBe('Reset your MercuryPitch password')
    expect(visibleText(html)).toContain(
      'Choose a new password. The link expires in 2 hours.',
    )
  })

  it('offers the link as a button and as text to paste, and nowhere else', () => {
    const { html, text } = reset()
    expect(hrefs(html).filter((href) => href === RESET_URL)).toHaveLength(2)
    expect(visibleText(html)).toContain('Choose a new password')
    expect(visibleText(html)).toContain(
      "If the button doesn't open, paste this into your browser:",
    )
    expect(text).toContain(`\n\n${RESET_URL}\n\n`)
    // The picture is not a way in: resetting is always a deliberate tap.
    expect(html).not.toMatch(/<a\b[^>]*>\s*<img\b[^>]*banner-07-letter/)
  })

  it('says the link expires and works once, in both parts', () => {
    const { html, text } = reset()
    expect(visibleText(html)).toContain(
      'The link expires in 2 hours and can be used once.',
    )
    expect(text).toContain('It expires in 2 hours and can be used once.')
    expect(visibleText(reset('Sam', 1).html)).toContain(
      'The link expires in 1 hour and can be used once.',
    )
  })

  it('tells somebody who did not ask that their password stays as it is', () => {
    const { html, text } = reset()
    for (const copy of [visibleText(html), text]) {
      expect(copy).toContain(
        "Didn't request a reset? You can safely ignore this email. Your password won't change.",
      )
    }
  })

  it('greets the account holder by name, and gets straight to it without one', () => {
    expect(visibleText(reset('Sam Singer').html)).toContain(
      'Hi Sam Singer, we received a request to reset the password for your MercuryPitch account.',
    )
    for (const nameless of [null, '  ']) {
      const { html, text } = reset(nameless)
      expect(visibleText(html)).toContain(
        'We received a request to reset the password for your MercuryPitch account.',
      )
      expect(text).toContain(
        'We received a request to reset the password for your MercuryPitch account.',
      )
      expect(visibleText(html)).not.toContain('Hi ')
    }
  })

  it('opens with the letter, and loads its pictures from the picture host', () => {
    const { html } = reset()
    expect(srcs(html)).toEqual([
      PICTURES + WORDMARK_PATH,
      PICTURES + MAIL_ART.letter.path,
    ])
  })

  it('links only to the reset, the app and the project pages', () => {
    const elsewhere = hrefs(reset().html).filter(
      (href) =>
        href !== RESET_URL &&
        href !== APP &&
        !href.startsWith('https://about.mercurypitch.com') &&
        href !== 'https://github.com/mercurypitch/mercurypitch' &&
        href !== 'https://mercurypitch.com' &&
        !href.startsWith('https://fonts.googleapis.com/'),
    )
    expect(elsewhere).toEqual([])
  })

  it('says why it was sent', () => {
    const line =
      "You're receiving this because a password reset was requested for your account on mercurypitch.com."
    expect(visibleText(reset().html)).toContain(line)
    expect(reset().text).toContain(line)
  })

  it('keeps the house style', () => {
    const { subject, html, text } = reset()
    for (const copy of [subject, html, text]) {
      expect(copy).not.toMatch(/—|&mdash;|&#8212;/)
      expect(copy).not.toMatch(/practise/i)
      expect(copy).not.toMatch(/\p{Extended_Pictographic}/u)
    }
    // The name is one word, as docs/branding/BRAND.md types it: in the copy,
    // the labels and the alt text. Only the copyright line, a legal notice,
    // keeps its own wording.
    for (const copy of [subject, html.replace(COPYRIGHT, ''), text]) {
      expect(copy).not.toContain('Mercury Pitch')
    }
    expect(visibleText(html)).toContain('© 2026 Mercury Pitch · AGPL-3.0')
  })

  it('fits a phone, and stays under the size Gmail clips at', () => {
    const { html } = reset()
    expect(html).not.toMatch(/style="(?:[^"]*;)?\s*width:\s*600px/)
    expect(html).toContain('style="width:100%;max-width:600px;"')
    expect(html).not.toMatch(/display:\s*(?:inline-)?(?:flex|grid)/)
    expect(new TextEncoder().encode(html).length).toBeLessThan(102 * 1024)
  })

  it('escapes the name and the link', () => {
    const { html } = reset(
      '<i>Sam</i>',
      2,
      `${APP}/#/reset-password?token=a"b<c&d`,
    )
    expect(html).not.toContain('<i>Sam</i>')
    expect(html).toContain('Hi &lt;i&gt;Sam&lt;/i&gt;,')
    expect(html).toContain('token=a&quot;b&lt;c&amp;d')
    expect(html).not.toContain('token=a"b<c')
  })
})

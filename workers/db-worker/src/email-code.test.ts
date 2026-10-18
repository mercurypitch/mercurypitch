import { describe, expect, it } from 'vitest'
import type { RenderedEmail } from './email'
import { renderLoginCode, renderSignUpCode } from './email-code'
import type { MailOrigins } from './email-layout'
import { MAIL_ART, MONO, WORDMARK_PATH } from './email-layout'

/** The footer's copyright line as the HTML spells it. */
const COPYRIGHT = '&copy; 2026 Mercury Pitch &middot; AGPL-3.0'

// Links and pictures on different hosts, so a test can tell which one a URL
// was built from.
const APP = 'https://app.test'
const PICTURES = 'https://pictures.test'
const ORIGINS: MailOrigins = { appOrigin: APP, assetOrigin: PICTURES }

const signIn = (
  displayName: string | null = 'Sam Singer',
  ttlMinutes = 10,
): RenderedEmail =>
  renderLoginCode({ ...ORIGINS, displayName, code: '416028', ttlMinutes })

const signUp = (ttlMinutes = 10): RenderedEmail =>
  renderSignUpCode({ ...ORIGINS, code: '730519', ttlMinutes })

const BOTH: ReadonlyArray<[string, () => RenderedEmail, string]> = [
  ['the sign-in code', () => signIn(), '416028'],
  ['the sign-up code', () => signUp(), '730519'],
]

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

describe('the code mails', () => {
  it('lead the subject with the code, which on a locked phone is often all there is', () => {
    expect(signIn().subject).toBe('416028 is your MercuryPitch sign-in code')
    expect(signUp().subject).toBe('730519 is your MercuryPitch sign-up code')
  })

  it.each(BOTH)(
    '%s: shows the code once, large and monospaced, as one run of text',
    (_label, render, code) => {
      const { html, text } = render()
      const shown = [...html.matchAll(new RegExp(`>${code}<`, 'g'))]
      expect(shown).toHaveLength(1)
      expect(html).toContain(
        `<div style="font:700 36px/1.2 ${MONO};letter-spacing:10px;color:#2dd4bf;">${code}</div>`,
      )
      expect(text).toContain(`\n\n    ${code}\n\n`)
    },
  )

  it.each(BOTH)(
    '%s: says it expires and works once, in both parts',
    (_label, render) => {
      const { html, text } = render()
      expect(visibleText(html)).toContain(
        'It expires in 10 minutes and works once.',
      )
      expect(text).toContain('It expires in 10 minutes and works once.')
    },
  )

  it('give the expiry in the preheader too', () => {
    expect(visibleText(signIn().html)).toContain(
      'Your sign-in code expires in 10 minutes.',
    )
    expect(visibleText(signUp().html)).toContain(
      'Your sign-up code expires in 10 minutes.',
    )
  })

  it('say "1 minute" for a code good for one', () => {
    expect(visibleText(signIn('Sam', 1).html)).toContain(
      'It expires in 1 minute and works once.',
    )
    expect(signUp(1).text).toContain('It expires in 1 minute and works once.')
  })

  // A mailed code and a mailed link are the same proof. Offering both would
  // teach the habit of clicking sign-in links in mail, exactly the habit a
  // phishing message needs.
  it.each(BOTH)(
    '%s: carries no link to sign in with',
    (_label, render, code) => {
      const { html, text } = render()
      // The wordmark opens the app; nothing else in the mail points at it.
      expect(hrefs(html).filter((href) => href.startsWith(APP))).toEqual([APP])
      expect(hrefs(html).filter((href) => href.includes(code))).toEqual([])
      expect(text).not.toContain(APP)
    },
  )

  it.each(BOTH)(
    '%s: opens with the letter, a picture and not a link',
    (_label, render) => {
      const { html } = render()
      expect(srcs(html)).toEqual([
        PICTURES + WORDMARK_PATH,
        PICTURES + MAIL_ART.letter.path,
      ])
      expect(html).toContain(`alt="${MAIL_ART.letter.alt}"`)
      expect(html).not.toMatch(/<a\b[^>]*>\s*<img\b[^>]*banner-07-letter/)
    },
  )

  it('greets the account holder by name, and gets straight to it without one', () => {
    expect(visibleText(signIn('Sam Singer').html)).toContain(
      'Hi Sam Singer, type this code into the sign-in screen you just opened.',
    )
    expect(signIn('Sam Singer').text).toContain(
      'Hi Sam Singer, type this code into the sign-in screen you just opened:',
    )
    for (const nameless of [null, '   ']) {
      const { html, text } = signIn(nameless)
      expect(visibleText(html)).toContain(
        'Type this code into the sign-in screen you just opened.',
      )
      expect(text).toContain(
        'Type this code into the sign-in screen you just opened:',
      )
      expect(visibleText(html)).not.toContain('Hi ')
    }
  })

  it('tells somebody who did not try to sign in that ignoring it is safe, and that nobody will ask for the code', () => {
    const { html, text } = signIn()
    for (const copy of [visibleText(html), text]) {
      expect(copy).toContain(
        "Didn't try to sign in? Ignore this email. Without this code, whoever asked can't finish signing in, and nothing about your account has changed.",
      )
      expect(copy).toContain(
        'Nobody from MercuryPitch will ever ask you for this code.',
      )
    }
  })

  it('sets up an account with no password, and says the sign-up cannot be finished without the code', () => {
    const { html, text } = signUp()
    for (const copy of [visibleText(html), text]) {
      expect(copy).toContain('There is no password to make.')
      expect(copy).toContain(
        "Didn't ask for this? Ignore this email. Without this code, whoever asked can't finish signing up, and no account has been made.",
      )
      expect(copy).toContain(
        'Nobody from MercuryPitch will ever ask you for this code.',
      )
    }
    expect(visibleText(html)).toContain(
      'Type this code into MercuryPitch to set up your account.',
    )
    // The address has no account and no name to greet.
    expect(visibleText(html)).not.toContain('Hi ')
  })

  it('say why they were sent', () => {
    expect(visibleText(signIn().html)).toContain(
      "You're receiving this because a sign-in code was requested for your account on mercurypitch.com.",
    )
    expect(signIn().text).toContain(
      "You're receiving this because a sign-in code was requested for your account on mercurypitch.com.",
    )
    expect(visibleText(signUp().html)).toContain(
      "You're receiving this because a sign-up code was requested for this address on mercurypitch.com.",
    )
  })

  it.each(BOTH)('%s: keeps the house style', (_label, render) => {
    const { subject, html, text } = render()
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
    expect(visibleText(html)).toContain('Learn to sing and play.')
    expect(visibleText(html)).not.toContain('never been more fun')
    expect(visibleText(html)).toContain('© 2026 Mercury Pitch · AGPL-3.0')
  })

  // The old look was a 600 px table, 624 px with its padding, so a 375 px
  // phone scrolled it sideways (preview screenshots, 18 Oct 2026).
  it.each(BOTH)(
    '%s: fits a phone: no fixed-width table, no flex or grid',
    (_label, render) => {
      const { html } = render()
      expect(html).not.toMatch(/style="(?:[^"]*;)?\s*width:\s*600px/)
      expect(html).toContain('style="width:100%;max-width:600px;"')
      expect(html).not.toMatch(/display:\s*(?:inline-)?(?:flex|grid)/)
    },
  )

  it.each(BOTH)('%s: stays under the size Gmail clips at', (_label, render) => {
    expect(new TextEncoder().encode(render().html).length).toBeLessThan(
      102 * 1024,
    )
  })

  it('escapes the name it greets', () => {
    const { html, text } = signIn('<b>Sam</b> & "Co"')
    expect(html).not.toContain('<b>Sam</b>')
    expect(html).toContain('Hi &lt;b&gt;Sam&lt;/b&gt; &amp; &quot;Co&quot;,')
    // The plain-text part is not HTML: the name goes in as typed.
    expect(text).toContain('Hi <b>Sam</b> & "Co",')
  })
})

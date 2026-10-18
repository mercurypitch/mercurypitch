import { describe, expect, it } from 'vitest'
import type { RenderedEmail } from './email'
import type { MailOrigins } from './email-layout'
import { MAIL_ART, WORDMARK_PATH } from './email-layout'
import type { NewsletterIssueVars } from './email-newsletter'
import { renderNewsletterIssue } from './email-newsletter'

/** The footer's copyright line as the HTML spells it. */
const COPYRIGHT = '&copy; 2026 Mercury Pitch &middot; AGPL-3.0'

// Links and pictures on different hosts, so a test can tell which one a URL
// was built from.
const APP = 'https://app.test'
const PICTURES = 'https://pictures.test'
const ORIGINS: MailOrigins = { appOrigin: APP, assetOrigin: PICTURES }
const UNSUBSCRIBE = 'https://api.test/api/newsletter/unsubscribe?t=u1.sig'

const ISSUE: NewsletterIssueVars = {
  ...ORIGINS,
  displayName: 'Sam Singer',
  subject: 'MercuryPitch 0.9.10: jam rooms keep time',
  preheader: 'Jam rooms follow the song.',
  intro: 'A small release. Here is what changed.',
  items: [
    {
      title: 'Jam rooms follow the song',
      body: 'The lanes line up with what you hear.',
      href: `${APP}/#/jam`,
      cta: 'Start a room',
    },
    {
      title: 'Drums land where you played them',
      body: 'Hits sit where they were heard.',
      href: `${APP}/guitar-night`,
    },
    { title: 'Product updates, if you want them', body: 'A checkbox.' },
  ],
  unsubscribeUrl: UNSUBSCRIBE,
}

const issue = (vars: Partial<NewsletterIssueVars> = {}): RenderedEmail =>
  renderNewsletterIssue({ ...ISSUE, ...vars })

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
    .replace(/&rarr;/g, '→')
    .replace(/&rsaquo;/g, '›')
    .replace(/&copy;/g, '©')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
}

describe('the newsletter issue', () => {
  it('puts the subject in the inbox and on the page alike', () => {
    const { subject, html } = issue()
    expect(subject).toBe(ISSUE.subject)
    expect(html).toContain('>MercuryPitch 0.9.10: jam rooms keep time</h1>')
    expect(visibleText(html)).toContain('Jam rooms follow the song.')
  })

  it('opens with the first-note stage, which opens Home', () => {
    const { html } = issue()
    expect(srcs(html)).toEqual([
      PICTURES + WORDMARK_PATH,
      PICTURES + MAIL_ART.firstNote.path,
    ])
    expect(html).toContain(
      `<a href="${APP}/#/home" aria-label="Open MercuryPitch"`,
    )
  })

  it('greets by name, or says hi there', () => {
    expect(visibleText(issue().html)).toContain(
      'Hi Sam Singer, A small release. Here is what changed.',
    )
    expect(visibleText(issue({ displayName: null }).html)).toContain(
      'Hi there, A small release.',
    )
    expect(issue({ displayName: '  ' }).text).toContain('Hi there,\n')
  })

  it('gives each item its own panel, with a link only where it has one', () => {
    const { html } = issue()
    const text = visibleText(html)
    expect(text).toContain(
      'Jam rooms follow the song The lanes line up with what you hear. Start a room →',
    )
    // No call to action of its own: the default.
    expect(text).toContain('Hits sit where they were heard. Take a look →')
    expect(text).toContain('Product updates, if you want them A checkbox.')
    expect(hrefs(html)).toContain(`${APP}/#/jam`)
    expect(hrefs(html)).toContain(`${APP}/guitar-night`)
    // An empty href is no link.
    const bare = issue({ items: [{ title: 'T', body: 'B', href: '' }] })
    expect(visibleText(bare.html)).not.toContain('Take a look')
  })

  it('opens the app from its button', () => {
    const { html, text } = issue()
    expect(visibleText(html)).toContain('Open MercuryPitch')
    expect(html).toMatch(
      new RegExp(
        `<a href="${APP}" style="display:inline-block;padding:15px 28px;`,
      ),
    )
    expect(text).toContain(`Open MercuryPitch: ${APP}`)
  })

  // Somebody said yes once, maybe months ago, so every copy carries the way
  // back out.
  it('carries the way out in both parts', () => {
    const { html, text } = issue()
    expect(hrefs(html)).toContain(UNSUBSCRIBE)
    expect(visibleText(html)).toContain(
      "You're getting this because you asked for product updates. Unsubscribe with one click: no sign-in, and it takes effect right away.",
    )
    expect(text).toContain(
      "You're getting this because you asked for product updates at mercurypitch.com.",
    )
    expect(text).toContain(`Unsubscribe: ${UNSUBSCRIBE}`)
    expect(visibleText(html)).toContain(
      'You can change this any time in Settings › Account at mercurypitch.com.',
    )
  })

  it('carries every link the HTML offers in the text part', () => {
    const { html, text } = issue()
    const offered = hrefs(html).filter(
      (href) =>
        (href.startsWith(APP) && href !== `${APP}/#/home`) ||
        href === UNSUBSCRIBE,
    )
    expect(offered.length).toBeGreaterThan(2)
    for (const href of offered) expect(text).toContain(href)
  })

  it('keeps the house style in the words it writes itself', () => {
    const { html, text } = issue()
    for (const copy of [html, text]) {
      expect(copy).not.toMatch(/—|&mdash;|&#8212;/)
      expect(copy).not.toMatch(/practise/i)
    }
    // The name is one word, as docs/branding/BRAND.md types it: in the copy,
    // the labels and the alt text. Only the copyright line, a legal notice,
    // keeps its own wording.
    for (const copy of [html.replace(COPYRIGHT, ''), text]) {
      expect(copy).not.toContain('Mercury Pitch')
    }
    expect(visibleText(html)).toContain('© 2026 Mercury Pitch · AGPL-3.0')
  })

  it('fits a phone, and stays under the size Gmail clips at', () => {
    const { html } = issue()
    expect(html).not.toMatch(/style="(?:[^"]*;)?\s*width:\s*600px/)
    expect(html).not.toMatch(/display:\s*(?:inline-)?(?:flex|grid)/)
    expect(new TextEncoder().encode(html).length).toBeLessThan(102 * 1024)
  })

  it('escapes what the issue says', () => {
    const { html } = issue({
      subject: 'A <b>bold</b> issue',
      items: [
        {
          title: '<i>T</i>',
          body: 'B & "C"',
          href: 'https://app.test/x?a=1&b="2"',
          cta: '<u>Go</u>',
        },
      ],
      unsubscribeUrl: 'https://api.test/u?t=a"b',
    })
    expect(html).not.toContain('<b>bold</b>')
    expect(html).not.toContain('<i>T</i>')
    expect(html).not.toContain('<u>Go</u>')
    expect(html).toContain('<title>A &lt;b&gt;bold&lt;/b&gt; issue</title>')
    expect(html).toContain('B &amp; &quot;C&quot;')
    expect(html).toContain('href="https://app.test/x?a=1&amp;b=&quot;2&quot;"')
    expect(html).toContain('href="https://api.test/u?t=a&quot;b"')
  })
})

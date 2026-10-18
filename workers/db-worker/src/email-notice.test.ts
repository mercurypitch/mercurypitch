import { describe, expect, it } from 'vitest'
import type { RenderedEmail } from './email'
import type { MailOrigins } from './email-layout'
import { WORDMARK_PATH } from './email-layout'
import type { AccountNoticeVars } from './email-notice'
import { renderAccountNotice } from './email-notice'

/** The footer's copyright line as the HTML spells it. */
const COPYRIGHT = '&copy; 2026 Mercury Pitch &middot; AGPL-3.0'

// Links and pictures on different hosts, so a test can tell which one a URL
// was built from.
const APP = 'https://app.test'
const PICTURES = 'https://pictures.test'
const ORIGINS: MailOrigins = { appOrigin: APP, assetOrigin: PICTURES }

const SECURITY: AccountNoticeVars = {
  ...ORIGINS,
  displayName: 'Sam Singer',
  kind: 'security',
  subject: 'A sign-in bug, fixed',
  preheader: 'What happened and what you can do.',
  intro: 'First paragraph.\n\nSecond paragraph\nwith a line break.',
  items: [
    { title: 'What happened', body: 'One.\n\nTwo.' },
    {
      title: 'What you can do',
      body: 'Check your sessions.',
      href: 'https://app.test/#/settings',
      cta: 'Open Settings',
    },
  ],
}

const notice = (vars: Partial<AccountNoticeVars> = {}): RenderedEmail =>
  renderAccountNotice({ ...SECURITY, ...vars })

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

const NEVER_ASKS =
  'We will never ask for your password by email. A message that does is not from us, whatever it looks like.'

describe('the account notice', () => {
  it('names its kind over the headline, and in the text part', () => {
    for (const [kind, label] of [
      ['security', 'Security notice'],
      ['legal', 'Legal notice'],
      ['account', 'About your account'],
    ] as const) {
      const { html, text } = notice({ kind })
      expect(html).toMatch(
        new RegExp(`>${label}</div><h1 [^>]*>A sign-in bug, fixed</h1>`),
      )
      expect(text.split('\n')[0]).toBe(
        `${label.toUpperCase()}: A sign-in bug, fixed`,
      )
    }
  })

  it('says it will never ask for a password, on a security notice only', () => {
    const security = notice()
    expect(visibleText(security.html)).toContain(NEVER_ASKS)
    expect(security.text).toContain(NEVER_ASKS)
    for (const kind of ['legal', 'account'] as const) {
      const other = notice({ kind })
      expect(other.html).not.toContain('never ask for your password')
      expect(other.text).not.toContain('never ask for your password')
    }
  })

  // There is no way out of a notice, so it offers none: a switch that does
  // nothing would be the lie.
  it('carries no unsubscribe, and says why it came anyway', () => {
    const { html, text } = notice({ kind: 'legal' })
    expect(html.toLowerCase()).not.toContain('unsubscribe')
    expect(text.toLowerCase()).not.toContain('unsubscribe')
    const reason =
      "You're getting this because you have a MercuryPitch account. It's a service message about that account, not a product update, so it goes to every account holder whatever their newsletter setting."
    expect(visibleText(html)).toContain(reason)
    expect(text).toContain(reason)
  })

  it('turns blank lines into paragraphs and single newlines into line breaks', () => {
    const { html, text } = notice()
    expect(html).toContain('>First paragraph.</p>')
    expect(html).toContain('>Second paragraph<br>with a line break.</p>')
    expect(html).toContain('>One.</p>')
    expect(html).toContain('>Two.</p>')
    expect(text).toContain(
      'First paragraph.\n\nSecond paragraph\nwith a line break.',
    )
    expect(text).toContain('* What happened\n  One.\n\n  Two.')
  })

  it('gives each part its own panel, and its link a plain underline', () => {
    const { html, text } = notice()
    expect(visibleText(html)).toContain(
      'What you can do Check your sessions. Open Settings',
    )
    expect(html).toMatch(
      /<a href="https:\/\/app\.test\/#\/settings" style="[^"]*text-decoration:underline;[^"]*">Open Settings<\/a>/,
    )
    expect(text).toContain(
      'Check your sessions.\n\n  https://app.test/#/settings',
    )
    const bare = notice({
      items: [{ title: 'More', body: 'B', href: 'https://app.test/x' }],
    })
    expect(visibleText(bare.html)).toContain('More B Read more')
  })

  it('greets by name, or says hi there', () => {
    expect(visibleText(notice().html)).toContain(
      'Hi Sam Singer, First paragraph.',
    )
    expect(visibleText(notice({ displayName: null }).html)).toContain(
      'Hi there, First paragraph.',
    )
    expect(notice({ displayName: null }).text).toContain('\nHi there,\n')
  })

  it('invites a reply that a person reads', () => {
    const { html, text } = notice()
    const line = 'Questions? Reply to this email and a person will read it.'
    expect(visibleText(html)).toContain(line)
    expect(text).toContain(line)
  })

  // The operator's rehearsal copy. A forwarded test must never read as the
  // notice having gone out.
  it('marks a test copy in the subject and in both parts', () => {
    const { subject, html, text } = notice({ test: true })
    const banner =
      'This is a test copy. The notice has not been sent to anyone else.'
    expect(subject).toBe('[TEST] A sign-in bug, fixed')
    expect(visibleText(html)).toContain(banner)
    expect(text.split('\n')[0]).toBe(banner)
    expect(notice().html).not.toContain('test copy')
  })

  it('shows no picture but the wordmark', () => {
    expect(srcs(notice().html)).toEqual([PICTURES + WORDMARK_PATH])
  })

  it('links only to what the notice names, the app and the project pages', () => {
    const elsewhere = hrefs(notice().html).filter(
      (href) =>
        href !== 'https://app.test/#/settings' &&
        href !== APP &&
        !href.startsWith('https://about.mercurypitch.com') &&
        href !== 'https://github.com/mercurypitch/mercurypitch' &&
        href !== 'https://mercurypitch.com' &&
        !href.startsWith('https://fonts.googleapis.com/'),
    )
    expect(elsewhere).toEqual([])
  })

  it('keeps the house style in the words it writes itself', () => {
    const { html, text } = notice()
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
    expect(visibleText(html)).toContain(
      'You have an account at mercurypitch.com.',
    )
  })

  it('fits a phone, and stays under the size Gmail clips at', () => {
    const { html } = notice()
    expect(html).not.toMatch(/style="(?:[^"]*;)?\s*width:\s*600px/)
    expect(html).not.toMatch(/display:\s*(?:inline-)?(?:flex|grid)/)
    expect(new TextEncoder().encode(html).length).toBeLessThan(102 * 1024)
  })

  it('escapes what was typed', () => {
    const { html, text } = notice({
      displayName: '<b>Sam</b>',
      subject: 'A <i>notice</i>',
      intro: 'First <b>paragraph</b>.',
    })
    expect(html).not.toContain('<b>')
    expect(html).not.toContain('<i>notice</i>')
    expect(html).toContain('First &lt;b&gt;paragraph&lt;/b&gt;.</p>')
    expect(html).toContain('Hi &lt;b&gt;Sam&lt;/b&gt;,')
    // The plain-text part is not HTML, so it goes in as typed.
    expect(text).toContain('First <b>paragraph</b>.')
  })
})

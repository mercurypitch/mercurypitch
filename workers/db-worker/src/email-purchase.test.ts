import { describe, expect, it } from 'vitest'
import { ABOUT_URL, REPO_URL } from './email'
import type { MailOrigins } from './email-layout'
import { MAIL_ART, WORDMARK_PATH } from './email-layout'
import type { PurchaseEmailVars } from './email-purchase'
import { renderPurchaseEmail } from './email-purchase'

// Links and pictures on different hosts, so a test can tell which one a URL
// was built from.
const APP = 'https://app.test'
const PICTURES = 'https://pictures.test'
const ORIGINS: MailOrigins = { appOrigin: APP, assetOrigin: PICTURES }

const STARTER: PurchaseEmailVars = {
  ...ORIGINS,
  packLabel: 'Starter',
  credits: 20,
  balance: 23,
  amountMinor: 500,
  currency: 'eur',
  orderDateIso: '2026-10-08T12:00:00.000Z',
}

const purchase = (vars: Partial<PurchaseEmailVars> = {}) =>
  renderPurchaseEmail({ ...STARTER, ...vars })

const hrefs = (html: string): string[] =>
  [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, '&'))

/** What a reader sees: tags dropped, entities decoded, spaces collapsed. */
function visibleText(html: string): string {
  return html
    .replace(/<head>[\s\S]*?<\/head>/, '')
    .replace(/<\/?(?:a|span|strong)\b[^>]*>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&middot;/g, '·')
    .replace(/&rsaquo;/g, '›')
    .replace(/&copy;/g, '©')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
}

describe('the purchase mail', () => {
  it('says how many credits are ready', () => {
    expect(purchase().subject).toBe('Your 20 credits are ready')
    expect(purchase({ credits: 1 }).subject).toBe('Your 1 credit is ready')
    expect(purchase({ credits: 1000 }).subject).toBe(
      'Your 1,000 credits are ready',
    )
  })

  it('shows the pack, what landed, the new balance and the payment', () => {
    const text = visibleText(purchase().html)
    expect(text).toContain('Starter pack')
    expect(text).toContain('Thank you. Your credits are in.')
    expect(text).toContain('+20 credits')
    expect(text).toContain('New balance: 23 credits')
    expect(text).toContain('€5.00 · 8 October 2026')
  })

  it('puts the credits picture on top and opens Karaoke Night from it', () => {
    const { html } = purchase()
    expect(html).toContain(`src="${PICTURES}${MAIL_ART.credits.path}"`)
    expect(html).toContain(`src="${PICTURES}${WORDMARK_PATH}"`)
    expect(html).toMatch(
      new RegExp(
        `<a href="${APP}/karaoke" aria-label="Open Karaoke Night"[^>]*><img src="${PICTURES}${MAIL_ART.credits.path}"`,
      ),
    )
  })

  it('leaves what a song costs to Settings, which has the live prices', () => {
    const { html, text } = purchase()
    for (const copy of [visibleText(html), text]) {
      expect(copy).not.toMatch(
        /per song|about one song|1 credit|one credit|server|GPU/i,
      )
      expect(
        copy.replace('Settings > Credits', 'Settings › Credits'),
      ).toContain(
        'See your balance and what each song costs in Settings › Credits',
      )
    }
  })

  it('invites the singer to try it in Karaoke Night', () => {
    const { html } = purchase()
    expect(visibleText(html)).toContain('Try it in Karaoke Night')
    expect(visibleText(html)).not.toMatch(/Use Credits/i)
    expect(hrefs(html)).toContain(`${APP}/karaoke`)
    expect(hrefs(html)).toContain(`${APP}/#/settings/credits`)
  })

  it('links only to the app it was given and the project pages', () => {
    const elsewhere = hrefs(purchase().html).filter(
      (href) =>
        href !== APP &&
        !href.startsWith(APP + '/') &&
        !href.startsWith(ABOUT_URL) &&
        href !== REPO_URL &&
        href !== 'https://mercurypitch.com' &&
        !href.startsWith('https://fonts.googleapis.com/'),
    )
    expect(elsewhere).toEqual([])
  })

  it('carries every app link in the text part', () => {
    const { html, text } = purchase()
    for (const href of hrefs(html).filter((h) => h.startsWith(APP + '/'))) {
      expect(text).toContain(href)
    }
  })

  it('keeps the house style', () => {
    const { subject, html, text } = purchase()
    for (const copy of [subject, html, text]) {
      expect(copy).not.toMatch(/—|&mdash;|&#8212;/)
      expect(copy).not.toMatch(/practise/i)
    }
    // The wordmark picture's alt is the logo; anywhere a person reads the
    // name, it is two words.
    expect(visibleText(html)).not.toContain('MercuryPitch')
    expect(text).not.toContain('MercuryPitch')
    expect(visibleText(html)).toContain(
      "You're receiving this because you bought credits on mercurypitch.com.",
    )
    expect(visibleText(html)).toContain('© 2026 Mercury Pitch · AGPL-3.0')
    expect(new TextEncoder().encode(html).length).toBeLessThan(102 * 1024)
  })

  it('escapes whatever it prints', () => {
    const { html } = purchase({
      packLabel: '<b>Pro</b> & "Co"',
      currency: 'x<y',
    })
    expect(html).not.toContain('<b>Pro</b>')
    expect(html).toContain('&lt;b&gt;Pro&lt;/b&gt; &amp; &quot;Co&quot; pack')
    expect(html).not.toContain('X<Y')
  })
})

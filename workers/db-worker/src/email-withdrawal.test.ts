import { describe, expect, it } from 'vitest'
import type { WithdrawalEmailVars } from './email-withdrawal'
import { renderWithdrawalEmail, submittedAt } from './email-withdrawal'

// Made up: the real seller is the owner's TRADER_* vars.
const TRADER = {
  name: 'Sample Trader',
  address: '1 Sample Street, 00000 Sampletown',
  email: 'sales@example.test',
  vatId: 'XX000000000',
}

const CANCELLED: WithdrawalEmailVars = {
  appOrigin: 'https://app.test',
  assetOrigin: 'https://pictures.test',
  name: 'Sam Singer',
  email: 'sam@example.test',
  packLabel: 'Starter',
  paidCredits: 20,
  purchasedAtIso: '2026-10-08T12:00:00.000Z',
  amountMinor: 500,
  currency: 'eur',
  submittedAtIso: '2026-10-12T14:32:09.000Z',
  unusedCredits: 14,
  bonusCredits: 30,
  refundMinor: 350,
  refundState: 'refunded',
  stripeRefundStatus: 'succeeded',
  trader: TRADER,
}

const mail = (vars: Partial<WithdrawalEmailVars> = {}) =>
  renderWithdrawalEmail({ ...CANCELLED, ...vars })

/** What a reader sees: tags dropped, entities decoded, spaces collapsed. */
function visibleText(html: string): string {
  return html
    .replace(/<head>[\s\S]*?<\/head>/, '')
    .replace(/<\/?(?:a|span|strong)\b[^>]*>/g, '')
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

describe('the withdrawal acknowledgement', () => {
  it('says the cancellation arrived', () => {
    const { subject, html, text } = mail()
    expect(subject).toBe("We've received your cancellation")
    expect(visibleText(html)).toContain("We've received your cancellation")
    expect(text.split('\n')[0]).toBe("We've received your cancellation")
  })

  it('repeats the statement and when it reached us, in both parts', () => {
    const { html, text } = mail()
    const page = visibleText(html)
    for (const [label, value] of [
      ['Statement', 'I withdraw from my contract for this purchase.'],
      ['Purchase', 'Starter pack, 20 credits, bought 8 October 2026 for €5.00'],
      ['Name', 'Sam Singer'],
      ['Confirmation to', 'sam@example.test'],
      ['Submitted', '12 October 2026 at 14:32 UTC'],
    ]) {
      expect(page).toContain(`${label} ${value}`)
      expect(text).toContain(`${label}: ${value}`)
    }
  })

  it('writes the time in UTC on a 24-hour clock', () => {
    expect(submittedAt('2026-10-25T23:05:00.000Z')).toBe(
      '25 October 2026 at 23:05 UTC',
    )
    expect(submittedAt('2026-11-01T00:00:59.000Z')).toBe(
      '1 November 2026 at 00:00 UTC',
    )
  })

  it('says the refund went back to the card once Stripe finished it', () => {
    expect(mail().text).toContain(
      "We've refunded €3.50 to the card or account you paid with. Banks usually show it within 5 to 10 business days.",
    )
  })

  it('says the refund has started while Stripe has not finished it', () => {
    for (const stripeRefundStatus of ['pending', 'requires_action', null]) {
      const { html, text } = mail({ stripeRefundStatus })
      for (const copy of [visibleText(html), text]) {
        expect(copy).toContain(
          "We've started a refund of €3.50 to the card or account you paid with. Banks usually show it within 5 to 10 business days.",
        )
        expect(copy).not.toContain("We've refunded")
      }
    }
  })

  it('promises the refund within 14 days when it is still to come', () => {
    for (const refundState of ['pending', 'failed', 'manual'] as const) {
      const { html, text } = mail({ refundState })
      for (const copy of [visibleText(html), text]) {
        expect(copy).toContain(
          "We'll refund €3.50 to the card or account you paid with within 14 days.",
        )
        expect(copy).not.toMatch(/failed|manual|by hand|Stripe/i)
      }
    }
  })

  it('says so when nothing was left to refund', () => {
    expect(mail({ refundState: 'none', refundMinor: 0 }).text).toContain(
      'There was nothing left to refund.',
    )
  })

  it('says which credits left the balance, the bonus included', () => {
    expect(mail().text).toContain(
      'The 14 unused credits from this purchase have left your balance, and so have the 30 bonus credits that came with it.',
    )
    expect(mail({ unusedCredits: 1, bonusCredits: 1 }).text).toContain(
      'The 1 unused credit from this purchase has left your balance, and so has the bonus credit that came with it.',
    )
    expect(mail({ bonusCredits: 0 }).text).toContain(
      'The 14 unused credits from this purchase have left your balance.',
    )
  })

  it('promises the refund by hand without an amount when the price is not on record', () => {
    const { text } = mail({
      amountMinor: null,
      refundMinor: null,
      refundState: 'manual',
    })

    expect(text).toContain(
      "We'll refund what you paid for the unused credits to the card or account you paid with within 14 days.",
    )
    expect(text).toContain(
      'Purchase: Starter pack, 20 credits, bought 8 October 2026\n',
    )
    expect(text).not.toContain('€0.00')
  })

  it('promises what was paid, less any earlier refund, for a purchase with no consent on record', () => {
    const { text, html } = mail({
      amountMinor: null,
      refundMinor: null,
      basis: 'full',
      refundState: 'manual',
    })
    const promise =
      "We'll refund what you paid, less any earlier refund, to the card or account you paid with within 14 days."

    expect(text).toContain(promise)
    expect(visibleText(html)).toContain(promise)
    expect(
      mail({ basis: 'full', refundMinor: 500, refundState: 'pending' }).text,
    ).toContain(
      "We'll refund €5.00 to the card or account you paid with within 14 days.",
    )
  })

  it('says the balance stays when nothing was left to take', () => {
    expect(mail({ unusedCredits: 0, bonusCredits: 0 }).text).toContain(
      "You'd used every credit from this purchase, so your balance stays as it is.",
    )
    expect(mail({ unusedCredits: 0, bonusCredits: 30 }).text).toContain(
      'The 30 bonus credits that came with this purchase have left your balance.',
    )
  })

  it('names the seller', () => {
    const seller =
      'Sold by Sample Trader, 1 Sample Street, 00000 Sampletown. Email sales@example.test. VAT ID XX000000000.'
    const { html, text } = mail()
    expect(visibleText(html)).toContain(seller)
    expect(text).toContain(seller)
  })

  it('keeps the house style', () => {
    const { subject, html, text } = mail()
    for (const copy of [subject, html, text]) {
      expect(copy).not.toMatch(/—|&mdash;|&#8212;/)
      expect(copy).not.toMatch(/practise/i)
      expect(copy).not.toMatch(/\p{Extended_Pictographic}/u)
    }
    expect(visibleText(html)).toContain(
      "You're receiving this because you cancelled a purchase on mercurypitch.com.",
    )
  })

  it('escapes what the buyer typed', () => {
    const { html } = mail({ name: '<script>x</script> & "Sam"' })
    expect(html).not.toContain('<script>x</script>')
    expect(html).toContain(
      '&lt;script&gt;x&lt;/script&gt; &amp; &quot;Sam&quot;',
    )
  })
})

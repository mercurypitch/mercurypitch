import { describe, expect, it } from 'vitest'
import type { WithdrawalMode } from './withdrawal-wording'
import { CHECKOUT_CHECKBOX, CHECKOUT_SUBMIT_LINE, CONFIRM_WITHDRAWAL_LABEL, isKnownWithdrawalMode, PACK_FOOTNOTE, parseWithdrawalMode, rightToCancelLines, traderLine, WITHDRAW_LINK_LABEL, WITHDRAWAL_RECEIVED, WITHDRAWAL_TERMS_URL, } from './withdrawal-wording'

const MODES: WithdrawalMode[] = ['refund_unused', 'waiver']

/** Every sentence a buyer can read, in both modes. */
const everySentence = (): string[] => [
  ...MODES.flatMap((mode) => [
    CHECKOUT_CHECKBOX[mode],
    PACK_FOOTNOTE[mode],
    ...rightToCancelLines(mode, { deadline: '23 October 2026', credits: 20 }),
  ]),
  CHECKOUT_SUBMIT_LINE,
  WITHDRAW_LINK_LABEL,
  CONFIRM_WITHDRAWAL_LABEL,
  WITHDRAWAL_RECEIVED,
]

describe('WITHDRAWAL_MODE', () => {
  it('refunds unused credits unless it says waiver', () => {
    expect(parseWithdrawalMode(undefined)).toBe('refund_unused')
    expect(parseWithdrawalMode('')).toBe('refund_unused')
    expect(parseWithdrawalMode('refund_unused')).toBe('refund_unused')
    expect(parseWithdrawalMode(' Waiver ')).toBe('waiver')
    // A typo falls back to the model that protects the buyer.
    expect(parseWithdrawalMode('waiverr')).toBe('refund_unused')
  })

  it('knows a typo for one', () => {
    expect(isKnownWithdrawalMode(undefined)).toBe(true)
    expect(isKnownWithdrawalMode('waiver')).toBe(true)
    expect(isKnownWithdrawalMode('refund_unused')).toBe(true)
    expect(isKnownWithdrawalMode('refund-unused')).toBe(false)
  })
})

describe('the checkout checkbox', () => {
  it("fits in Stripe's 1,200 characters and links how cancelling works", () => {
    for (const mode of MODES) {
      expect(CHECKOUT_CHECKBOX[mode].length).toBeLessThanOrEqual(1200)
      expect(CHECKOUT_CHECKBOX[mode]).toContain(
        `[How cancelling works](${WITHDRAWAL_TERMS_URL})`,
      )
    }
  })

  it('links the withdrawal section of the Terms', () => {
    expect(WITHDRAWAL_TERMS_URL).toBe(
      'https://about.mercurypitch.com/terms/#withdrawal',
    )
  })

  it('asks for the credits now in both modes, and says what that costs', () => {
    expect(CHECKOUT_CHECKBOX.refund_unused).toContain(
      "I only get back the price of credits I haven't used",
    )
    expect(CHECKOUT_CHECKBOX.waiver).toContain(
      "I lose my right to cancel this purchase once they're added",
    )
    for (const mode of MODES) {
      expect(CHECKOUT_CHECKBOX[mode]).toMatch(
        /^Add my credits now so I can use them straight away/,
      )
    }
  })

  it('keeps the VAT sentence off the pay button until the tax adviser answers', () => {
    expect(CHECKOUT_SUBMIT_LINE).toBe(
      'Your credits are added as soon as you pay.',
    )
  })
})

describe('the right to cancel in the purchase mail', () => {
  it('gives the last day and where to cancel under refund_unused', () => {
    const lines = rightToCancelLines('refund_unused', {
      deadline: '23 October 2026',
      credits: 140,
    })
    expect(lines).toEqual([
      "You asked us to add these credits straight away. You can still cancel this purchase until 23 October 2026 and get back the price of the credits you haven't used. Credits you've used aren't refunded, and once you've used all 140, you can no longer cancel.",
      'To cancel, open Settings › Credits and choose Withdraw from contract here, or reply to this email.',
    ])
  })

  it('confirms the waiver in one sentence under waiver', () => {
    expect(
      rightToCancelLines('waiver', {
        deadline: '23 October 2026',
        credits: 140,
      }),
    ).toEqual([
      "You asked us to add these credits straight away and confirmed that you lose your right to cancel once they're added.",
    ])
  })

  it('names the seller with address, email and VAT ID', () => {
    expect(
      traderLine({
        name: 'Sample Trader',
        address: '1 Sample Street, 00000 Sampletown',
        email: 'sales@example.test',
        vatId: 'XX000000000',
      }),
    ).toBe(
      'Sold by Sample Trader, 1 Sample Street, 00000 Sampletown. Email sales@example.test. VAT ID XX000000000.',
    )
  })
})

describe('the wording', () => {
  it('keeps the house style', () => {
    for (const sentence of everySentence()) {
      expect(sentence).not.toMatch(/—/)
      expect(sentence).not.toMatch(/practise/i)
      expect(sentence).not.toMatch(
        /\b(seamless|effortless|intuitive|delightful|unlock|journey|calm)/i,
      )
      expect(sentence).not.toMatch(/\p{Extended_Pictographic}/u)
    }
  })
})

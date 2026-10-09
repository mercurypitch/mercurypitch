// ── One inbox, one promo record ──────────────────────────────────────
//
// A promo code's email record stops one inbox from claiming twice. Keyed on
// the address as typed, it stopped nothing: Gmail delivers you+1@gmail.com,
// you+2@gmail.com and y.o.u@gmail.com to the same inbox, so each could be
// confirmed and each claimed. These pin which addresses count as one inbox,
// and which must stay two people.
import { describe, expect, it } from 'vitest'
import { promoMailbox } from './promo-claim'

describe('promoMailbox', () => {
  it('folds plus tags at any provider', () => {
    expect(promoMailbox('singer+launch@example.com')).toBe('singer@example.com')
    expect(promoMailbox('singer+a+b@proton.me')).toBe('singer@proton.me')
  })

  it('folds Gmail dots and googlemail.com into one gmail.com inbox', () => {
    expect(promoMailbox('y.o.u@gmail.com')).toBe('you@gmail.com')
    expect(promoMailbox('Y.O.U+2@GoogleMail.com')).toBe('you@gmail.com')
    expect(promoMailbox(' you@gmail.com ')).toBe('you@gmail.com')
  })

  it('keeps dots elsewhere: first.last@ and firstlast@ can be two people', () => {
    expect(promoMailbox('first.last@example.com')).toBe(
      'first.last@example.com',
    )
    expect(promoMailbox('first.last@example.com')).not.toBe(
      promoMailbox('firstlast@example.com'),
    )
  })

  it('leaves an address it cannot read as typed, lower-cased', () => {
    expect(promoMailbox('+tag@example.com')).toBe('+tag@example.com')
    expect(promoMailbox('...@gmail.com')).toBe('...@gmail.com')
    expect(promoMailbox('no-at-sign')).toBe('no-at-sign')
    expect(promoMailbox('trailing@')).toBe('trailing@')
    expect(promoMailbox('Mixed@Case.COM')).toBe('mixed@case.com')
  })
})

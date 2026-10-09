import { describe, expect, it } from 'vitest'
import { featuredPromoView, isInstant, promoRefusal, validatePromoWrite, } from './promo-rules'

const OPEN = {
  code: 'LAUNCH',
  credits: 5,
  active: 1,
  startsAt: '2026-10-02T00:00:00.000Z',
  expiresAt: '2027-01-01T23:59:59.000Z',
  maxRedemptions: 1000,
  redemptionCount: 8,
}
const DURING = new Date('2026-11-15T12:00:00.000Z')

describe('promoRefusal', () => {
  it('lets an open code through', () => {
    expect(promoRefusal(OPEN, DURING)).toBeNull()
  })

  it.each([
    ['while switched off', { active: 0 }, DURING, 'inactive'],
    [
      'before its start',
      {},
      new Date('2026-10-01T23:59:59.999Z'),
      'not-started',
    ],
    ['after its end', {}, new Date('2027-01-02T00:00:00.000Z'), 'expired'],
    ['at its cap', { redemptionCount: 1000 }, DURING, 'full'],
    ['whose end date does not parse', { expiresAt: 'soon' }, DURING, 'expired'],
    [
      'whose start date does not parse',
      { startsAt: 'whenever' },
      DURING,
      'not-started',
    ],
  ])('refuses a code %s', (_label, overrides, now, refusal) => {
    expect(promoRefusal({ ...OPEN, ...overrides }, now)).toBe(refusal)
  })

  it('is open from the first millisecond of its start', () => {
    expect(promoRefusal(OPEN, new Date('2026-10-02T00:00:00.000Z'))).toBeNull()
  })

  it('is still open at the instant it ends', () => {
    expect(promoRefusal(OPEN, new Date('2027-01-01T23:59:59.000Z'))).toBeNull()
  })

  it('reads missing dates and a missing cap as no limit', () => {
    const unbounded = {
      ...OPEN,
      startsAt: null,
      expiresAt: null,
      maxRedemptions: null,
      redemptionCount: 50_000,
    }
    expect(promoRefusal(unbounded, DURING)).toBeNull()
  })
})

describe('featuredPromoView', () => {
  it('says only the code, its credits and its end while the code is open', () => {
    expect(featuredPromoView(OPEN, DURING)).toEqual({
      code: 'LAUNCH',
      credits: 5,
      expiresAt: '2027-01-01T23:59:59.000Z',
    })
  })

  it('offers nothing once the code would be refused', () => {
    expect(
      featuredPromoView({ ...OPEN, redemptionCount: 1000 }, DURING),
    ).toBeNull()
  })

  it('offers nothing when no code is featured', () => {
    expect(featuredPromoView(null, DURING)).toBeNull()
  })
})

describe('validatePromoWrite', () => {
  it('accepts a complete, well-formed code', () => {
    expect(
      validatePromoWrite({
        code: 'LAUNCH',
        credits: 5,
        maxRedemptions: 1000,
        startsAt: '2026-10-02T00:00:00.000Z',
        expiresAt: '2027-01-01T23:59:59.000Z',
        active: true,
        featured: false,
      }),
    ).toBeNull()
  })

  it('accepts clearing both dates and the cap', () => {
    expect(
      validatePromoWrite({
        startsAt: null,
        expiresAt: null,
        maxRedemptions: null,
      }),
    ).toBeNull()
  })

  it.each([
    ['an end that is not a timestamp', { expiresAt: '1.01.2027' }, /expiresAt/],
    ['a date with no time', { expiresAt: '2027-01-01' }, /expiresAt/],
    [
      'an end on a day that does not exist',
      { expiresAt: '2027-02-30T23:59:59.000Z' },
      /expiresAt/,
    ],
    [
      'a start with a timezone offset',
      { startsAt: '2026-10-02T00:00:00.000+02:00' },
      /startsAt/,
    ],
    [
      'a start after the end',
      {
        startsAt: '2027-01-02T00:00:00.000Z',
        expiresAt: '2027-01-01T23:59:59.000Z',
      },
      /startsAt/,
    ],
    ['zero credits', { credits: 0 }, /credits/],
    ['fractional credits', { credits: 2.5 }, /credits/],
    ['credits sent as text', { credits: '5' }, /credits/],
    ['a negative cap', { maxRedemptions: -1 }, /maxRedemptions/],
    ['a switch that is not a boolean', { active: 'yes' }, /active/],
    ['a featured flag that is not a boolean', { featured: 2 }, /featured/],
    ['a lower-case code', { code: 'launch' }, /code/],
    ['a code with a space', { code: 'NEW YEAR' }, /code/],
  ])('refuses %s', (_label, body, field) => {
    expect(validatePromoWrite(body)).toMatch(field)
  })
})

describe('isInstant', () => {
  it('accepts the one shape the table holds', () => {
    expect(isInstant('2027-01-01T23:59:59.000Z')).toBe(true)
  })

  it.each([
    ['a month that does not exist', '2026-13-01T00:00:00.000Z'],
    ['an hour that does not exist', '2026-10-01T25:00:00.000Z'],
    ['a day that does not exist', '2027-02-30T00:00:00.000Z'],
    ['no milliseconds', '2027-01-01T23:59:59Z'],
    ['a date only', '2027-01-01'],
    ['not a string', 20270101],
  ])('says no, without throwing, to %s', (_label, value) => {
    expect(() => isInstant(value)).not.toThrow()
    expect(isInstant(value)).toBe(false)
  })
})

// ============================================================
// plan-card-slot: the slot Home keeps for its plan card before the card's chunk is in
// ============================================================
//
// Home draws its "Your plan" card from a lazy chunk, after its own first paint,
// so it keeps a slot for the card from a read it can make at once: the card's
// rules (plan-card-rules.ts, whose own cases run each of them) and the height
// the card last drew at on this device. These cases run the read as Home makes
// it, straight from storage, and the card's half, what it keeps. The last
// block reads the module's source: Home imports it statically, in the native
// build too, so it must carry no plan code and say no words.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FIRST_VALUE_KEY, resetFirstValueForTests } from '@/lib/first-value'
import { moduleShape } from './module-shape.fixture'
import { readPlanCardSlot, rememberPlanCardSlot } from './plan-card-slot'
import { PLAN_CARD_DISMISSED_KEY, PLAN_CARD_SLOT_KEY, PLAN_OPENED_KEY, PLAN_RECORD_KEY, } from './plan-keys'

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.parse('2026-10-23T12:00:00.000Z')
const PHONE = 390

/** A record as the store writes it, `daysAgo` before NOW. */
function stored(status: string, daysAgo = 1, more: object = {}): string {
  const at = new Date(NOW - daysAgo * DAY).toISOString()
  localStorage.setItem(
    PLAN_RECORD_KEY,
    JSON.stringify({
      v: 1,
      status,
      choices: { q1: null, q2: null, q3: [], q4: [] },
      at,
      via: 'layer',
      ...more,
    }),
  )
  return at
}

/** What the card kept: drawn at `h` px for record `at`, `w` px wide, with these stops. */
const kept = (
  at: string,
  w: number,
  h: number,
  dests: string[] = ['sing', 'hearYourself', 'karaokeNight'],
): void => {
  localStorage.setItem(PLAN_CARD_SLOT_KEY, JSON.stringify({ at, w, h, dests }))
}

beforeEach(() => {
  localStorage.clear()
  resetFirstValueForTests()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ── What Home reads at once ────────────────────────────────────────────

describe('the slot Home keeps before the card is in', () => {
  it('keeps nothing open when there is no record, or nothing that reads as one', () => {
    expect(readPlanCardSlot(NOW, PHONE)).toBeNull()

    const later = JSON.stringify({
      v: 2,
      status: 'answered',
      at: new Date(NOW - DAY).toISOString(),
    })
    for (const value of [
      '"a word"',
      '[1]',
      '{"status":"answered"}',
      'nope',
      later,
    ]) {
      localStorage.setItem(PLAN_RECORD_KEY, value)
      expect(readPlanCardSlot(NOW, PHONE)).toBeNull()
    }
  })

  it.each([
    ['answered', 'plan'],
    ['shown', 'ask'],
    ['declined', 'ask'],
  ] as const)(
    'keeps the %s card open, at the size Home guesses, on a device that has not drawn it',
    (status, kind) => {
      stored(status)

      expect(readPlanCardSlot(NOW, PHONE)).toEqual({ kind, height: null })
    },
  )

  it('keeps nothing open for a record out of its week', () => {
    stored('answered', 8)

    expect(readPlanCardSlot(NOW, PHONE)).toBeNull()
  })

  it('keeps nothing open for a card hidden for its record, even where it kept a height', () => {
    const at = stored('answered', 1)
    kept(at, PHONE, 259.2)
    localStorage.setItem(PLAN_CARD_DISMISSED_KEY, JSON.stringify(at))

    expect(readPlanCardSlot(NOW, PHONE)).toBeNull()
  })

  it('keeps nothing open on a device that hid the card before the X kept a date', () => {
    stored('answered', 1)
    localStorage.setItem(PLAN_CARD_DISMISSED_KEY, 'true')

    expect(readPlanCardSlot(NOW, PHONE)).toBeNull()
  })

  it('keeps the slot open for a plan answered since its card was hidden', () => {
    const hidden = stored('answered', 3)
    localStorage.setItem(PLAN_CARD_DISMISSED_KEY, JSON.stringify(hidden))

    stored('answered', 1)

    expect(readPlanCardSlot(NOW, PHONE)).toEqual({ kind: 'plan', height: null })
  })

  it('keeps the height the card drew at for this record, in a window this wide', () => {
    const at = stored('answered')
    kept(at, PHONE, 259.2)

    expect(readPlanCardSlot(NOW, PHONE)).toEqual({
      kind: 'plan',
      height: 259.2,
    })
  })

  it('guesses again when the window is another width, or the record is another one', () => {
    const at = stored('answered')
    kept(at, 1440, 127.7)
    expect(readPlanCardSlot(NOW, PHONE)).toEqual({ kind: 'plan', height: null })

    kept('2026-10-01T00:00:00.000Z', PHONE, 259.2)
    expect(readPlanCardSlot(NOW, PHONE)).toEqual({ kind: 'plan', height: null })
  })

  it('keeps nothing open where the card drew nothing for this record, whatever the width: a width does not bring a card back', () => {
    const at = stored('answered')
    kept(at, 1440, 0, [])

    expect(readPlanCardSlot(NOW, PHONE)).toBeNull()
  })

  it('keeps nothing open where every stop the card drew is done, whatever the width', () => {
    const at = stored('answered')
    kept(at, 1440, 127.7, ['sing'])
    localStorage.setItem(
      FIRST_VALUE_KEY,
      JSON.stringify({ sing: '2026-10-22T12:00:00.000Z' }),
    )

    expect(readPlanCardSlot(NOW, PHONE)).toBeNull()
  })

  it('never throws on a kept stop name an object inherits: it is a stop not done', () => {
    const at = stored('answered')
    kept(at, PHONE, 193.4, ['constructor', 'toString'])

    expect(() => readPlanCardSlot(NOW, PHONE)).not.toThrow()
    expect(readPlanCardSlot(NOW, PHONE)).toEqual({
      kind: 'plan',
      height: 193.4,
    })
  })

  it('keeps nothing open where the card drew nothing for this record: every stop was done', () => {
    const at = stored('answered')
    kept(at, PHONE, 0, [])

    expect(readPlanCardSlot(NOW, PHONE)).toBeNull()
  })

  it('keeps nothing open where every stop the card drew has been done since, by a first value or an opening', () => {
    const at = stored('answered')
    kept(at, PHONE, 259.2)
    localStorage.setItem(
      FIRST_VALUE_KEY,
      JSON.stringify({ sing: '2026-10-22T12:00:00.000Z' }),
    )
    localStorage.setItem(PLAN_OPENED_KEY, JSON.stringify(['hearYourself']))
    // Karaoke Night is done by a scored song, not by being opened.
    expect(readPlanCardSlot(NOW, PHONE)).toEqual({
      kind: 'plan',
      height: 259.2,
    })

    localStorage.setItem(
      FIRST_VALUE_KEY,
      JSON.stringify({
        sing: '2026-10-22T12:00:00.000Z',
        karaoke: '2026-10-22T13:00:00.000Z',
      }),
    )
    expect(readPlanCardSlot(NOW, PHONE)).toBeNull()
  })

  it('keeps the ask open whatever the device has done: it has no stops', () => {
    const at = stored('shown')
    kept(at, PHONE, 146.9, [])
    localStorage.setItem(
      FIRST_VALUE_KEY,
      JSON.stringify({ sing: '2026-10-22T12:00:00.000Z' }),
    )

    expect(readPlanCardSlot(NOW, PHONE)).toEqual({ kind: 'ask', height: 146.9 })
  })

  it('guesses for a kept height that does not read', () => {
    const at = stored('shown')
    for (const value of [
      '"tall"',
      JSON.stringify({ at, w: PHONE, h: -4, dests: [] }),
      JSON.stringify({ at, w: PHONE, h: 'x', dests: [] }),
      JSON.stringify({ at, w: PHONE, h: 146.9 }),
      JSON.stringify({ at, w: PHONE, h: 146.9, dests: [3] }),
    ]) {
      localStorage.setItem(PLAN_CARD_SLOT_KEY, value)
      expect(readPlanCardSlot(NOW, PHONE)).toEqual({
        kind: 'ask',
        height: null,
      })
    }
  })

  it('keeps nothing open when storage cannot be read', () => {
    stored('answered')
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })

    expect(readPlanCardSlot(NOW, PHONE)).toBeNull()
  })
})

// ── What the card leaves for the next load ─────────────────────────────

describe('what the card keeps for Home', () => {
  it('keeps the height it drew at and its stops, for the record it drew and the width of the window', () => {
    const at = stored('answered')

    rememberPlanCardSlot(259.2, PHONE, ['sing', 'hearYourself', 'karaokeNight'])

    expect(
      JSON.parse(localStorage.getItem(PLAN_CARD_SLOT_KEY) ?? 'null'),
    ).toEqual({
      at,
      w: PHONE,
      h: 259.2,
      dests: ['sing', 'hearYourself', 'karaokeNight'],
    })
    expect(readPlanCardSlot(NOW, PHONE)).toEqual({
      kind: 'plan',
      height: 259.2,
    })
  })

  it('keeps it for the record the card says it drew, which may be newer than storage', () => {
    stored('answered')

    rememberPlanCardSlot(0, PHONE, [], '2026-10-23T11:00:00.000Z')

    expect(
      JSON.parse(localStorage.getItem(PLAN_CARD_SLOT_KEY) ?? 'null'),
    ).toEqual({ at: '2026-10-23T11:00:00.000Z', w: PHONE, h: 0, dests: [] })
  })

  it('keeps nothing when there is no record to keep it for', () => {
    rememberPlanCardSlot(259.2, PHONE, ['sing'])

    expect(localStorage.getItem(PLAN_CARD_SLOT_KEY)).toBeNull()
  })

  it('does not write again what is already kept', () => {
    stored('answered')
    rememberPlanCardSlot(193.4, PHONE, ['sing', 'jam'])
    const write = vi.spyOn(localStorage, 'setItem')

    rememberPlanCardSlot(193.4, PHONE, ['sing', 'jam'])
    expect(write).not.toHaveBeenCalled()

    rememberPlanCardSlot(259.2, PHONE, ['sing', 'jam'])
    rememberPlanCardSlot(259.2, PHONE, ['sing', 'lesson1'])
    expect(write).toHaveBeenCalledTimes(2)
  })
})

// ── What the module is ─────────────────────────────────────────────────

describe('the module', () => {
  const shape = moduleShape('src/features/plan/plan-card-slot.ts')

  it("imports only the card's rules, where the plan is stored, how storage is read, and types", () => {
    expect(shape.valueImports).toEqual([
      './plan-card-rules',
      './plan-keys',
      '@/lib/storage',
    ])
    expect(shape.typeImports).toEqual(['./build-plan', './plan-card-rules'])
    expect(shape.dynamicImports).toBe(0)
  })

  it('does nothing when it is imported: only declarations stand at its top level', () => {
    expect(shape.doing).toEqual([])
  })

  it('says no words, and restates no rule: its only strings are the types it checks', () => {
    expect(shape.strings).toEqual(['number', 'object', 'string'])
  })
})

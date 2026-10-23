// ============================================================
// Plan record — what is kept of the answers, and what counts as a record
// ============================================================
//
// The record comes back from storage and, through settings sync, from other
// devices, so it can come back as anything: a hand edit, a newer client's
// write, half a write. isPlanRecordV1 is the one gate and it is strict, so a
// value that fails it is treated as no record instead of trusted. This file
// pins what passes (every id any column can write, in every status), what
// does not (one case for each way a record can be wrong), and the two typed
// lines kept apart from the record: clipped to their limits, and only ever
// on this device. The store that writes and reads the record is in the
// plan-store test files.

import { beforeEach, describe, expect, it } from 'vitest'
import { ROOMS } from '@/features/onboarding/rooms'
import { PLAN_RECORD_KEY, PLAN_TEXT_KEY } from './plan-keys'
import type { PlanRecordV1, PlanStatus, PlanVia } from './plan-record'
import { isPlanRecordV1, PLAN_IDS, Q3_OTHER_MAX, Q4_APP_MAX, readPlanTexts, writePlanTexts, } from './plan-record'
import type { PlanChoices } from './questions'
import { EMPTY_CHOICES, q2Options, q3Options, q4Options } from './questions'

const AT = '2026-10-20T12:00:00.000Z'

/** Choices with only the fields a case cares about; the rest stay empty. */
const choices = (c: Partial<PlanChoices>): PlanChoices => ({
  ...EMPTY_CHOICES,
  q3: [],
  q4: [],
  ...c,
})

/** A record the questions wrote: the audition singer, answered at First Light. */
const ANSWERED: PlanRecordV1 = {
  v: 1,
  status: 'answered',
  choices: {
    q1: 'singing',
    q2: 'audition',
    q3: ['progress', 'tune'],
    q4: ['teacher'],
  },
  at: AT,
  via: 'first-light',
}

/** The record with other choices, everything else as it is. */
const withChoices = (c: unknown): unknown => ({ ...ANSWERED, choices: c })

/**
 * Every key in storage. The test storage is a plain object, so it is walked
 * by length and key(): Object.keys would list its methods and never a key.
 */
function storedKeys(): string[] {
  const keys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key !== null) keys.push(key)
  }
  return keys
}

beforeEach(() => {
  localStorage.clear()
})

describe('a record the questions wrote', () => {
  it('accepts a record the questions wrote', () => {
    expect(isPlanRecordV1(ANSWERED)).toBe(true)
    // What storage hands back is the record after a round trip through JSON.
    expect(isPlanRecordV1(JSON.parse(JSON.stringify(ANSWERED)))).toBe(true)
  })

  it('accepts every status and every way the plan was first shown', () => {
    const statuses: PlanStatus[] = ['shown', 'answered', 'declined']
    const vias: PlanVia[] = ['first-light', 'layer', 'welcome-skip']
    const rejected = statuses.flatMap((status) =>
      vias
        .filter((via) => !isPlanRecordV1({ ...ANSWERED, status, via }))
        .map((via) => `${status} via ${via}`),
    )

    expect(rejected).toEqual([])
  })

  it('accepts a record with nothing picked, and one with every question passed', () => {
    expect(isPlanRecordV1({ ...ANSWERED, choices: choices({}) })).toBe(true)
    expect(
      isPlanRecordV1({ ...ANSWERED, status: 'shown', choices: EMPTY_CHOICES }),
    ).toBe(true)
  })

  it('accepts every id any column can write, as the questions offer them', () => {
    const rejected: string[] = []
    const check = (label: string, c: PlanChoices): void => {
      if (!isPlanRecordV1({ ...ANSWERED, choices: c })) rejected.push(label)
    }
    for (const q1 of [...PLAN_IDS.q1, null]) {
      check(`q1 ${q1}`, choices({ q1 }))
      for (const o of q2Options(q1))
        check(`q2 ${o.id} after ${q1}`, choices({ q1, q2: o.id }))
      for (const o of q3Options(q1))
        check(`q3 ${o.id} after ${q1}`, choices({ q1, q3: [o.id] }))
      for (const o of q4Options(q1))
        check(`q4 ${o.id} after ${q1}`, choices({ q1, q4: [o.id] }))
    }

    expect(rejected).toEqual([])
  })

  it('accepts two Q3 picks and a Q4 with several', () => {
    expect(
      isPlanRecordV1(
        withChoices(
          choices({ q3: ['time', 'what'], q4: ['video', 'app', 'along'] }),
        ),
      ),
    ).toBe(true)
  })

  it('accepts a voiceprint that found something, with or without a drill', () => {
    const drill = {
      ...ANSWERED,
      voiceprint: { room: 'exercises', detail: 'Long Note' },
    }
    const song = { ...ANSWERED, voiceprint: { room: 'karaoke', detail: null } }

    expect(isPlanRecordV1(drill)).toBe(true)
    expect(isPlanRecordV1(song)).toBe(true)
  })

  it('accepts a voiceprint in any room the app has', () => {
    const rejected = ROOMS.map((room) => room.id).filter(
      (id) =>
        !isPlanRecordV1({
          ...ANSWERED,
          voiceprint: { room: id, detail: null },
        }),
    )

    expect(rejected).toEqual([])
  })

  it('accepts a record that has been synced', () => {
    expect(
      isPlanRecordV1({ ...ANSWERED, syncedAt: '2026-10-21T08:00:00.000Z' }),
    ).toBe(true)
  })

  it('knows exactly the thirty ids the questions can write', () => {
    expect(PLAN_IDS.q1).toEqual([
      'singing',
      'guitar',
      'piano',
      'ear',
      'everything',
    ])
    expect([...PLAN_IDS.q2].sort()).toEqual([
      'audition',
      'basics',
      'by_ear',
      'curious',
      'exam',
      'fun',
      'intervals',
      'song',
      'together',
      'tune',
    ])
    expect([...PLAN_IDS.q3].sort()).toEqual([
      'alone',
      'difference',
      'other',
      'progress',
      'setup',
      'shy',
      'tempo',
      'time',
      'tune',
      'what',
    ])
    expect([...PLAN_IDS.q4].sort()).toEqual([
      'along',
      'app',
      'starting',
      'teacher',
      'video',
    ])
  })
})

describe('a record that is broken or from the future', () => {
  /** Each way a record can be wrong, with a name for the failure message. */
  const BROKEN: [label: string, value: unknown][] = [
    ['a future version', { ...ANSWERED, v: 2 }],
    ['no version', { ...ANSWERED, v: undefined }],
    ['a version written as text', { ...ANSWERED, v: '1' }],
    ['an unknown status', { ...ANSWERED, status: 'archived' }],
    ['no status', { ...ANSWERED, status: undefined }],
    ['an unknown way in', { ...ANSWERED, via: 'email' }],
    ['no way in', { ...ANSWERED, via: undefined }],
    [
      'an unknown first answer',
      withChoices({ q1: 'drums', q2: null, q3: [], q4: [] }),
    ],
    [
      'a first answer that is not text',
      withChoices({ q1: 7, q2: null, q3: [], q4: [] }),
    ],
    ['an unknown goal', withChoices({ q1: null, q2: 'loud', q3: [], q4: [] })],
    [
      'an unknown hard part',
      withChoices({ q1: null, q2: null, q3: ['rhythm'], q4: [] }),
    ],
    [
      'an unknown thing tried',
      withChoices({ q1: null, q2: null, q3: [], q4: ['friends'] }),
    ],
    [
      'three Q3 picks',
      withChoices({
        q1: 'singing',
        q2: null,
        q3: ['time', 'what', 'shy'],
        q4: [],
      }),
    ],
    [
      'Q3 as one pick, not a list',
      withChoices({ q1: null, q2: null, q3: 'time', q4: [] }),
    ],
    [
      'Q4 as one pick, not a list',
      withChoices({ q1: null, q2: null, q3: [], q4: 'app' }),
    ],
    [
      'an id inside Q3 that is not text',
      withChoices({ q1: null, q2: null, q3: [1], q4: [] }),
    ],
    ['no goal field', withChoices({ q1: null, q3: [], q4: [] })],
    ['no choices', { ...ANSWERED, choices: undefined }],
    ['choices that are null', { ...ANSWERED, choices: null }],
    ['choices that are a list', { ...ANSWERED, choices: [] }],
    ['a bad date', { ...ANSWERED, at: 'yesterday' }],
    ['an empty date', { ...ANSWERED, at: '' }],
    ['a date that is a number', { ...ANSWERED, at: 1792497600000 }],
    ['no date', { ...ANSWERED, at: undefined }],
    ['a bad synced date', { ...ANSWERED, syncedAt: 'later' }],
    ['a synced date that is a number', { ...ANSWERED, syncedAt: 5 }],
    [
      'a voiceprint of an unknown room',
      { ...ANSWERED, voiceprint: { room: 'attic', detail: null } },
    ],
    [
      'a voiceprint whose drill is a number',
      { ...ANSWERED, voiceprint: { room: 'ascent', detail: 5 } },
    ],
    [
      'a voiceprint with no drill field',
      { ...ANSWERED, voiceprint: { room: 'ascent' } },
    ],
    ['a voiceprint that is null', { ...ANSWERED, voiceprint: null }],
    ['an empty object', {}],
    ['the text "{}"', '{}'],
    ['the record as text, not parsed', JSON.stringify(ANSWERED)],
    ['null', null],
    ['nothing', undefined],
    ['a list', [ANSWERED]],
    ['a number', 1],
    ['a boolean', true],
  ]

  it('treats a broken or future record as no record', () => {
    for (const [label, value] of BROKEN) {
      expect(isPlanRecordV1(value), label).toBe(false)
    }
  })

  it('never throws on a value storage can hand back', () => {
    const stored = [
      '{"v":1}',
      '{"v":1,"status":"answered"}',
      '{"__proto__":{"v":1}}',
      '[[[]]]',
      '"x"',
      '0',
      'false',
    ]

    for (const text of stored) {
      expect(isPlanRecordV1(JSON.parse(text)), text).toBe(false)
    }
  })
})

describe('the typed lines', () => {
  it('clips typed lines and keeps them on this device', () => {
    writePlanTexts({ q3other: 'a'.repeat(200), q4app: 'b'.repeat(200) })

    expect(Q3_OTHER_MAX).toBe(140)
    expect(Q4_APP_MAX).toBe(60)
    expect(readPlanTexts()).toEqual({
      q3other: 'a'.repeat(140),
      q4app: 'b'.repeat(60),
    })
    // They live under the device key. Storage is walked whole: that is the
    // only key written, so no synced `pitchperfect_` key holds them and the
    // record's own key was never written.
    expect(localStorage.getItem(PLAN_TEXT_KEY)).toContain('a'.repeat(140))
    expect(storedKeys()).toEqual([PLAN_TEXT_KEY])
    expect(localStorage.getItem(PLAN_RECORD_KEY)).toBeNull()
  })

  it('stores nothing longer than the limit', () => {
    writePlanTexts({ q3other: 'a'.repeat(200), q4app: 'b'.repeat(200) })

    const stored = JSON.parse(localStorage.getItem(PLAN_TEXT_KEY) ?? '{}')
    expect(stored.q3other).toHaveLength(140)
    expect(stored.q4app).toHaveLength(60)
  })

  it('trims a typed line, and reads back exactly what it kept', () => {
    writePlanTexts({
      q3other: '  not enough hours in the day \n',
      q4app: ' Duolingo ',
    })
    const first = readPlanTexts()

    expect(first).toEqual({
      q3other: 'not enough hours in the day',
      q4app: 'Duolingo',
    })
    writePlanTexts(first)
    expect(readPlanTexts()).toEqual(first)
  })

  it('leaves no space at the end of a line cut at its limit', () => {
    // 'word ' repeated is 200 long, and a cut at 140 lands on a space.
    const line = 'word '.repeat(40)
    writePlanTexts({ q3other: line, q4app: '' })
    const written = JSON.parse(
      localStorage.getItem(PLAN_TEXT_KEY) ?? '{}',
    ).q3other
    // A stored line is cut the same way when it is too long to begin with.
    localStorage.setItem(
      PLAN_TEXT_KEY,
      JSON.stringify({ q3other: line, q4app: '' }),
    )
    const read = readPlanTexts().q3other

    for (const kept of [written, read]) {
      expect(kept.length).toBeLessThanOrEqual(140)
      expect(kept).toBe(kept.trim())
      expect(kept.endsWith('word')).toBe(true)
    }
  })

  it('reads empty lines when nothing was written', () => {
    expect(readPlanTexts()).toEqual({ q3other: '', q4app: '' })
  })

  it.each([
    ['text that is not JSON', 'just some words'],
    ['a number', '42'],
    ['a list', '["a","b"]'],
    ['a string', '"hello"'],
    ['null', 'null'],
    ['an object of the wrong shapes', '{"q3other":5,"q4app":["x"]}'],
  ])('reads empty lines from a stored value that is %s', (_, stored) => {
    localStorage.setItem(PLAN_TEXT_KEY, stored)

    expect(readPlanTexts()).toEqual({ q3other: '', q4app: '' })
  })

  it('keeps the line that is text when the other is not', () => {
    localStorage.setItem(PLAN_TEXT_KEY, '{"q3other":"  too shy ","q4app":7}')

    expect(readPlanTexts()).toEqual({ q3other: 'too shy', q4app: '' })
  })
})

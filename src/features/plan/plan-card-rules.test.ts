// ============================================================
// plan-card-rules: the card's rules, each written once
// ============================================================
//
// The card (through plan-progress.ts), the store and Home's slot for the card
// all read these rules, so each is held here once. plan-progress.test.ts runs
// the week and the kind through the card's whole state; these cases run each
// rule on its own, and read the module's source: Home imports it statically,
// in the native build too, so it must carry no plan code and say no words.

import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FIRST_VALUE_KEY, resetFirstValueForTests } from '@/lib/first-value'
import { moduleShape } from './module-shape.fixture'
import { hiddenOnDevice, isNameList, openedOnDevice, PLAN_CARD_DAYS, PLAN_CARD_KINDS, planCardKind, stopDoneBy, } from './plan-card-rules'
import { PLAN_CARD_DISMISSED_KEY, PLAN_OPENED_KEY } from './plan-keys'

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.parse('2026-10-23T12:00:00.000Z')
const at = (daysAgo: number): string =>
  new Date(NOW - daysAgo * DAY).toISOString()

beforeEach(() => {
  localStorage.clear()
  resetFirstValueForTests()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ── The week and the kind ──────────────────────────────────────────────

describe('which card a record asks for', () => {
  it('keeps a card for a week', () => {
    expect(PLAN_CARD_DAYS).toBe(7)
    expect(PLAN_CARD_KINDS).toEqual(['plan', 'ask'])
  })

  it.each([
    ['answered', 'plan'],
    ['shown', 'ask'],
    ['declined', 'ask'],
  ] as const)('a record %s in its week asks for the %s', (status, kind) => {
    expect(
      planCardKind({
        record: { status, at: at(6.9) },
        dismissed: false,
        now: NOW,
      }),
    ).toBe(kind)
  })

  it.each([
    ['a week after it was written', 7],
    ['more than a week ahead of the clock', -7.1],
  ])('asks for nothing %s', (_, daysAgo) => {
    expect(
      planCardKind({
        record: { status: 'answered', at: at(daysAgo) },
        dismissed: false,
        now: NOW,
      }),
    ).toBeNull()
  })

  it('asks for nothing for a date that does not read, no record, or a card that was hidden', () => {
    const answered = { status: 'answered', at: at(1) }

    expect(
      planCardKind({
        record: { status: 'answered', at: 'not a date' },
        dismissed: false,
        now: NOW,
      }),
    ).toBeNull()
    expect(
      planCardKind({ record: null, dismissed: false, now: NOW }),
    ).toBeNull()
    expect(
      planCardKind({ record: answered, dismissed: true, now: NOW }),
    ).toBeNull()
  })
})

// ── What finishes a stop ───────────────────────────────────────────────

describe('when a stop is done', () => {
  const never = (): boolean => false
  const always = (): boolean => true

  it('a room with first values is done by one of them, and not by an opening', () => {
    expect(stopDoneBy('karaokeNight', always)).toBe(false)

    localStorage.setItem(
      FIRST_VALUE_KEY,
      JSON.stringify({ karaoke: '2026-10-22T13:00:00.000Z' }),
    )
    expect(stopDoneBy('karaokeNight', never)).toBe(true)
  })

  it('a room with none is done by an opening from the plan', () => {
    const opened = vi.fn((dest: string) => dest === 'jam')

    expect(stopDoneBy('jam', opened)).toBe(true)
    expect(stopDoneBy('lesson1', opened)).toBe(false)
    expect(opened).toHaveBeenCalledWith('jam')
  })

  it.each(['constructor', 'toString', '__proto__', 'hasOwnProperty', 'nope'])(
    'a name that is no destination, %s, is a stop not done, and never throws',
    (name) => {
      expect(stopDoneBy(name as 'jam', always)).toBe(false)
    },
  )
})

// ── What the device holds ──────────────────────────────────────────────

describe('what the device says', () => {
  it('the card is hidden only when the X stored true', () => {
    expect(hiddenOnDevice()).toBe(false)

    for (const value of ['""', '"true"', '1', '{}', 'nope']) {
      localStorage.setItem(PLAN_CARD_DISMISSED_KEY, value)
      expect(hiddenOnDevice()).toBe(false)
    }

    localStorage.setItem(PLAN_CARD_DISMISSED_KEY, 'true')
    expect(hiddenOnDevice()).toBe(true)
  })

  it('the card is not hidden when storage cannot be read', () => {
    localStorage.setItem(PLAN_CARD_DISMISSED_KEY, 'true')
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })

    expect(hiddenOnDevice()).toBe(false)
  })

  it('reads the opened stops as a list of names, and nothing else as one', () => {
    expect(openedOnDevice()).toEqual([])

    localStorage.setItem(PLAN_OPENED_KEY, JSON.stringify(['jam', 'lesson1']))
    expect(openedOnDevice()).toEqual(['jam', 'lesson1'])

    for (const value of ['"jam"', '[1]', '{"0":"jam"}', 'nope']) {
      localStorage.setItem(PLAN_OPENED_KEY, value)
      expect(openedOnDevice()).toEqual([])
    }
  })

  it('a list of names is an array of strings only', () => {
    expect(isNameList([])).toBe(true)
    expect(isNameList(['a', 'b'])).toBe(true)
    expect(isNameList(['a', 1])).toBe(false)
    expect(isNameList('a')).toBe(false)
    expect(isNameList(null)).toBe(false)
  })
})

// ── What the module is ─────────────────────────────────────────────────

describe('the module', () => {
  const shape = moduleShape('src/features/plan/plan-card-rules.ts')

  it('imports only where the plan is stored, how storage and first values are read, and types', () => {
    expect(shape.valueImports).toEqual([
      './plan-keys',
      '@/lib/first-value',
      '@/lib/storage',
    ])
    expect(shape.typeImports).toEqual(['./build-plan', '@/lib/first-value'])
    expect(shape.dynamicImports).toBe(0)
  })

  it('does nothing when it is imported: only declarations stand at its top level', () => {
    expect(shape.doing).toEqual([])
  })

  it('says no words: its only strings are ids (a status, the kinds, what finishes a stop) and the types it checks', () => {
    expect(shape.strings).toEqual([
      'answered',
      'ask',
      'drill',
      'ear',
      'guitar',
      'karaoke',
      'opened',
      'piano',
      'plan',
      'sing',
      'string',
    ])
  })
})

// ── Written once ───────────────────────────────────────────────────────

describe('each rule in one place', () => {
  /** The files that follow the rules: each imports them, and none restates one. */
  const READERS = [
    'src/features/plan/HomePlanCard.tsx',
    'src/features/plan/plan-progress.ts',
    'src/features/plan/plan-store.ts',
    'src/features/plan/plan-card-slot.ts',
  ]
  const RULES = [
    'PLAN_CARD_DAYS',
    'withinTheWeek',
    'planCardKind',
    'DONE_WHEN',
    'stopDoneBy',
    'hiddenOnDevice',
    'isNameList',
    'openedOnDevice',
  ]

  /** The names a file declares at its top level. */
  function declared(file: string): string[] {
    const source = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    )
    return source.statements.flatMap((statement) => {
      if (ts.isFunctionDeclaration(statement) && statement.name) {
        return [statement.name.text]
      }
      if (ts.isVariableStatement(statement)) {
        return statement.declarationList.declarations.flatMap((d) =>
          ts.isIdentifier(d.name) ? [d.name.text] : [],
        )
      }
      return []
    })
  }

  it('declares every rule here', () => {
    expect(
      declared('src/features/plan/plan-card-rules.ts').filter((name) =>
        RULES.includes(name),
      ),
    ).toEqual(RULES)
  })

  it.each(READERS)('%s declares none of them', (file) => {
    expect(declared(file).filter((name) => RULES.includes(name))).toEqual([])
  })

  it.each(READERS)(
    '%s reads neither the hidden card nor the opened stops from storage itself',
    (file) => {
      expect(readFileSync(file, 'utf8')).not.toMatch(
        /storageGet\b[^(]*\(\s*PLAN_(CARD_DISMISSED|OPENED)_KEY/u,
      )
    },
  )
})

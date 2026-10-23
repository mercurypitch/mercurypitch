// ============================================================
// Plan back tests — the way back to the plan shows once it was answered
// ============================================================
//
// A lesson page is its own document, so its link back to the plan sits in the
// markup, hidden, and one call at boot shows it from what the app stored. Four
// things have to stay in step and these hold all four: what counts as an
// answered plan, what the plan store really writes, how a page boots when
// storage cannot be read, and every lesson page and its boot. The admin
// console publishes a lesson at run time (tools/draft-lessons.ts), so every
// page has both, and a page added later fails here until it does.
//
// bootPlanBackLink listens for pageshow on the shared test window and has no
// way to stop. A listener left by an earlier case only touches that case's own
// page, and every case builds a page of its own, so none sees another's.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ts from 'typescript'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AUDITION, fresh, NO_TEXTS } from '@/features/plan/plan-choices.fixture'
import type { PlanRecordV1, PlanStatus } from '@/features/plan/plan-record'
import { declinePlan, markPlanShown, savePlanAnswers, } from '@/features/plan/plan-store'
import { lessonDocument, lessonPages } from '../../../../tools/draft-lessons'
import { bootPlanBackLink, revealPlanBackLink } from './plan-back'

const REPO = resolve(__dirname, '../../../..')
const read = (path: string): string => readFileSync(resolve(REPO, path), 'utf8')

const LINK = '<a data-plan-back hidden href="/#/plan">Back to your plan</a>'
const WAY_BACK = 'a[data-plan-back][hidden][href="/#/plan"]'

/** A page of its own, so a case never leaves a link behind for the next. */
const page = (body: string): Document =>
  new DOMParser().parseFromString(`<body>${body}</body>`, 'text/html')

/** Is the way back showing on this page? */
const wayBackShowing = (doc: Document): boolean =>
  doc.querySelector('a[data-plan-back]:not([hidden])') !== null

/** A plan record as the plan store keeps one, with `status` as given. */
const stored = (status: PlanStatus): string => {
  const record: PlanRecordV1 = {
    v: 1,
    status,
    choices: { q1: 'singing', q2: 'audition', q3: ['progress'], q4: [] },
    at: '2026-10-21T09:30:00.000Z',
    via: 'first-light',
  }
  return JSON.stringify(record)
}

/** An answered plan's stored text, with `v` replaced by whatever is given. */
const answeredWithVersion = (v: unknown): string =>
  JSON.stringify({ ...(JSON.parse(stored('answered')) as object), v })

// Every value the way back must stay hidden for. Only a record the app itself
// can open counts: version 1 with its status 'answered'.
const HIDDEN: readonly (readonly [what: string, raw: string | null])[] = [
  ['no plan', null],
  ['an empty value', ''],
  ['half a write', stored('answered').slice(0, 30)],
  ['text that is not JSON', 'answered'],
  ['a string', '"answered"'],
  ['null', 'null'],
  ['a number', '1'],
  ['a list that holds an answered plan', `[${stored('answered')}]`],
  ['a plan only shown', stored('shown')],
  ['a declined plan', stored('declined')],
  ['a status in other letters', stored('answered').replace('d"', 'D"')],
  ['an object with no status', '{"v":1}'],
  ["a newer client's answered plan", answeredWithVersion(2)],
  ['an answered plan with no version', '{"status":"answered"}'],
  ['an answered plan whose version is text', answeredWithVersion('1')],
]

afterEach(() => {
  vi.restoreAllMocks()
})

describe('revealPlanBackLink', () => {
  it('shows the way back when the plan was answered', () => {
    // Arrange
    const doc = page(
      `${LINK}<p>Next lesson</p>${LINK}<a hidden href="/x">x</a>`,
    )

    // Act
    revealPlanBackLink(doc, stored('answered'))

    // Assert
    const links = Array.from(doc.querySelectorAll('a[data-plan-back]'))
    expect(links.map((link) => link.hasAttribute('hidden'))).toEqual([
      false,
      false,
    ])
    // only the way back: any other hidden link on the page stays hidden
    expect(doc.querySelector('a[href="/x"]')?.hasAttribute('hidden')).toBe(true)
  })

  it.each(HIDDEN)('keeps it hidden for %s', (_what, raw) => {
    // Arrange
    const doc = page(LINK)

    // Act
    revealPlanBackLink(doc, raw)

    // Assert
    expect(wayBackShowing(doc)).toBe(false)
  })

  it('leaves a page with no way back alone', () => {
    // Arrange
    const doc = page('<p>A lesson with no link in it</p>')

    // Act
    revealPlanBackLink(doc, stored('answered'))

    // Assert
    expect(doc.body.innerHTML).toBe('<p>A lesson with no link in it</p>')
  })
})

// What a lesson reads is what the app writes: the same key, and the status
// the store gives an answered plan. A rename on either side fails here, not
// on a learner's last screen.
describe('bootPlanBackLink with the plan the store has recorded', () => {
  const wayBackShown = (): boolean => {
    const doc = page(LINK)
    bootPlanBackLink(doc)
    return wayBackShowing(doc)
  }

  beforeEach(() => {
    fresh()
  })

  it('shows the way back once the four questions are saved', () => {
    // Arrange
    savePlanAnswers(AUDITION, NO_TEXTS)

    // Act
    const shown = wayBackShown()

    // Assert
    expect(shown).toBe(true)
  })

  it.each([
    ['nothing recorded yet', () => undefined],
    ['a plan only put in front of the person', () => markPlanShown('layer')],
    ['a plan turned down with Not now', () => declinePlan(AUDITION)],
  ])('keeps it hidden for %s', (_, record) => {
    // Arrange
    record()

    // Act
    const shown = wayBackShown()

    // Assert
    expect(shown).toBe(false)
  })
})

// A browser that blocks site data throws when a page reaches for storage, and
// the boot is one call in a lesson's main.ts: if that call threw, nothing
// after it would start. The answered plan is saved before storage is blocked,
// so a hidden link means the read failed quietly, not that nothing was there.
describe('bootPlanBackLink when storage is blocked', () => {
  const denied = (): never => {
    throw new DOMException(
      'Access is denied for this document',
      'SecurityError',
    )
  }

  const BLOCKS: readonly (readonly [what: string, block: () => unknown])[] = [
    [
      'a getItem that throws',
      () => vi.spyOn(window.localStorage, 'getItem').mockImplementation(denied),
    ],
    [
      'a localStorage that throws when the page reaches for it',
      () => vi.spyOn(window, 'localStorage', 'get').mockImplementation(denied),
    ],
  ]

  beforeEach(() => {
    fresh()
    savePlanAnswers(AUDITION, NO_TEXTS)
  })

  it.each(BLOCKS)('boots and keeps it hidden for %s', (_what, block) => {
    // Arrange
    const doc = page(LINK)
    block()

    // Act
    const boot = (): void => bootPlanBackLink(doc)

    // Assert
    expect(boot).not.toThrow()
    expect(wayBackShowing(doc)).toBe(false)
  })

  it('shows the way back again once storage can be read', () => {
    // Arrange: blocked for one boot, then released
    const blocked = vi
      .spyOn(window.localStorage, 'getItem')
      .mockImplementation(denied)
    bootPlanBackLink(page(LINK))
    blocked.mockRestore()
    const doc = page(LINK)

    // Act
    bootPlanBackLink(doc)

    // Assert
    expect(wayBackShowing(doc)).toBe(true)
  })
})

// Back from the app can restore a lesson from the back/forward cache without
// running its boot again, so the stored plan is read again then. A normal load
// also fires pageshow, with persisted false, and the boot has just read.
describe('bootPlanBackLink when the page comes back from the cache', () => {
  beforeEach(() => {
    fresh()
  })

  it.each([
    ['shows the way back', true],
    ['leaves it hidden', false],
  ])('%s on a pageshow with persisted %s', (_what, persisted) => {
    // Arrange: booted before the plan was answered, then answered in the app
    const doc = page(LINK)
    bootPlanBackLink(doc)
    savePlanAnswers(AUDITION, NO_TEXTS)

    // Act
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted }))

    // Assert: it reads again for a restore, and only for a restore
    expect(wayBackShowing(doc)).toBe(persisted)
  })

  it('keeps it hidden on a restore when the plan is still unanswered', () => {
    // Arrange
    const doc = page(LINK)
    bootPlanBackLink(doc)

    // Act
    window.dispatchEvent(
      new PageTransitionEvent('pageshow', { persisted: true }),
    )

    // Assert
    expect(wayBackShowing(doc)).toBe(false)
  })
})

// A lesson page is its own bundle, and what this module imports rides into
// every one of them. plan-keys.ts imports nothing (pure-modules.test.ts holds
// that), while the app's record check would carry the four questions along.
describe('the plan back module', () => {
  it('imports only the plan key, so no plan code rides into a lesson page', () => {
    // Arrange
    const source = read('src/features/lessons/kit/plan-back.ts')

    // Act
    const imported = ts
      .preProcessFile(source, true, true)
      .importedFiles.map((file) => file.fileName)

    // Assert
    expect(imported).toEqual(['@/features/plan/plan-keys'])
  })
})

// The pages: every lesson page, found the way the build finds them.
const PAGES = lessonPages(REPO)
const pad = (n: number): string => String(n).padStart(2, '0')
const count = (text: string, pattern: RegExp): number =>
  text.match(pattern)?.length ?? 0

describe('the lesson pages', () => {
  it('are read from learn/, Lesson 1 among them', () => {
    expect(PAGES).toContain(1)
  })

  // .plan-back sets a display, and an author display beats the browser's own
  // [hidden]: the link's rule has to hide it too, or it shows to everyone.
  it('keep the link hidden whatever display its rule sets', () => {
    // Arrange
    const sections = read('src/features/lessons/kit/lesson-sections.css')

    // Assert
    expect(sections).toMatch(
      /\.plan-back\[hidden\]\s*\{\s*display:\s*none;?\s*\}/,
    )
  })
})

describe.each(PAGES)('lesson page %i', (n) => {
  const html = (): string => read(lessonDocument(n))

  it("puts the hidden way back in its markup, straight after the next card's mark", () => {
    // Arrange
    const doc = new DOMParser().parseFromString(html(), 'text/html')

    // Act
    const links = doc.querySelectorAll(WAY_BACK)

    // Assert
    expect(links).toHaveLength(1)
    expect(links[0]?.textContent?.trim()).toBe('Back to your plan')
    expect(
      links[0]?.previousElementSibling?.matches('div[data-next-card]'),
    ).toBe(true)
  })

  // kit/next-card.ts turns the mark into the card's link and moves the mark's
  // children into it, so a way back inside the mark would end up a link
  // inside a link. The mark is a div, so the parsed page shows where it sits.
  it('keeps the way back out of the mark the kit turns into the card', () => {
    // Arrange
    const doc = new DOMParser().parseFromString(html(), 'text/html')

    // Act
    const link = doc.querySelector(WAY_BACK)

    // Assert
    expect(link).not.toBeNull()
    expect(link?.closest('[data-next-card]')).toBeNull()
  })

  // The read and the check live in the kit, once. A main that names storage,
  // the key or the pure half has a read of its own, and one that can throw
  // takes the rest of the lesson's boot with it. The kit arrives by a dynamic
  // import, so the way back adds nothing to the lesson's first paint.
  it('boots the link with one call after first paint and reads no storage itself', () => {
    // Arrange
    const main = read(`src/features/lessons/lesson-${pad(n)}/main.ts`)

    // Act
    const wiring = {
      staticImports: count(
        main,
        /\bfrom '@\/features\/lessons\/kit\/plan-back'/g,
      ),
      lazyImports: count(
        main,
        /\bvoid import\('@\/features\/lessons\/kit\/plan-back'\)/g,
      ),
      calls: count(main, /\bbootPlanBackLink\(document\)/g),
      own:
        main.match(
          /\blocalStorage\b|\bPLAN_RECORD_KEY\b|\brevealPlanBackLink\b/g,
        ) ?? [],
    }

    // Assert
    expect(wiring).toEqual({
      staticImports: 0,
      lazyImports: 1,
      calls: 1,
      own: [],
    })
  })
})

// ============================================================
// Page state tests — the state a page was served with, or its build's defaults
// ============================================================

import { afterEach, describe, expect, it, vi } from 'vitest'
import type * as PageStateModule from './page-state'
import { followPageState, lessonLive, pageLessons, readPageState, } from './page-state'
import { LESSONS } from './season'

/** A document as the site worker serves it: `state` in its head, `body` its markup. */
function servedDocument(state: unknown, body = ''): Document {
  const doc = document.implementation.createHTMLDocument('Lesson')
  if (state !== undefined) {
    const tag = doc.createElement('script')
    tag.type = 'application/json'
    tag.id = 'lesson-state'
    tag.textContent = typeof state === 'string' ? state : JSON.stringify(state)
    doc.head.append(tag)
  }
  doc.body.innerHTML = body
  return doc
}

const STATE = (lessons: object, drafts = false) => ({
  version: 1,
  updatedAt: '2026-10-20T09:30:00.000Z',
  lessons,
  drafts,
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('readPageState', () => {
  it('reads the state the worker wrote into the page', () => {
    // Act
    const state = readPageState(
      servedDocument(STATE({ 3: { published: true } })),
    )

    // Assert
    expect(state).toEqual(STATE({ 3: { published: true } }))
  })

  it("reads a page with no state, or one it cannot read, as its build's defaults", async () => {
    for (const drafts of ['1', '0'] as const) {
      // Arrange: the same module built with drafts shown, then held back
      vi.stubEnv('VITE_DRAFT_LESSONS', drafts)
      vi.resetModules()
      const built: typeof PageStateModule = await import('./page-state')

      for (const doc of [
        servedDocument(undefined),
        servedDocument('{"version":1,'),
        servedDocument({ version: 2, lessons: {} }),
      ]) {
        // Act
        const state = built.readPageState(doc)

        // Assert
        expect(state, drafts).toEqual({
          version: 1,
          updatedAt: null,
          lessons: {},
          drafts: drafts === '1',
        })
      }
    }
  })

  it("lists no draft on a production bundle's page that no worker served", async () => {
    // Arrange
    vi.stubEnv('VITE_DRAFT_LESSONS', '0')
    vi.resetModules()
    const built: typeof PageStateModule = await import('./page-state')

    // Act
    const lessons = built.pageLessons(servedDocument(undefined))

    // Assert
    expect([lessons[3].page, lessons[5].page]).toEqual([undefined, undefined])
    expect(lessons[2].page).toBe('/learn/02')
    expect(built.lessonLive(3, servedDocument(undefined))).toBe(false)
  })
})

describe('pageLessons and lessonLive', () => {
  it('publish a draft and hold back a released lesson as the state says', () => {
    // Arrange: drafts held back, as on mercurypitch.com, and two overrides
    const doc = servedDocument(
      STATE({
        3: { published: true, hook: 'figures' },
        2: { published: false },
      }),
    )

    // Act
    const lessons = pageLessons(doc)

    // Assert
    expect([lessons[3].page, lessons[3].hook]).toEqual([
      '/learn/03',
      LESSONS[3].hookAlts?.[0]?.text,
    ])
    expect([lessons[2].page, lessons[2].minutes]).toEqual([
      undefined,
      undefined,
    ])
    expect(lessons[5].page).toBeUndefined()
    expect([
      lessonLive(3, doc),
      lessonLive(2, doc),
      lessonLive(1, doc),
    ]).toEqual([true, false, true])
  })
})

describe('followPageState', () => {
  const BODY = `
    <nav id="nav"><a href="/learn/01">One</a><a href="/learn/02">Two</a></nav>
    <ul class="meta"><li><a class="chip chip-link" href="/learn/02"><i></i>After Lesson 2: Twelve notes</a></li></ul>
    <p id="other"><a href="/learn/02#step-3">step three of Lesson 2</a>, <a href="/mirror?lesson=02">the Mirror</a></p>
    <p id="readings">Lesson 2 is <span data-if-live="2">ready</span><span data-if-planned="2" hidden>coming later</span>; Lesson 1 is <span data-if-live="1">ready</span><span data-if-planned="1" hidden>coming later</span>; <span data-if-live="x">odd</span>.</p>`

  it('takes away every link to a lesson that is not live, keeping a chip and the words', () => {
    // Arrange: Lesson 2 held back
    const doc = servedDocument(STATE({ 2: { published: false } }), BODY)

    // Act
    followPageState(doc)

    // Assert
    expect(
      Array.from(doc.querySelectorAll('#nav a')).map((a) => a.textContent),
    ).toEqual(['One'])
    const chip = doc.querySelector('.meta li > .chip')
    expect([chip?.tagName, chip?.className, chip?.textContent]).toEqual([
      'SPAN',
      'chip',
      'After Lesson 2: Twelve notes',
    ])
    expect(doc.getElementById('other')?.textContent).toBe(
      'step three of Lesson 2, the Mirror',
    )
    expect(doc.querySelector('#other a')?.getAttribute('href')).toBe(
      '/mirror?lesson=02',
    )
  })

  it("keeps the true reading of each lesson's state, unwrapped, and drops the other", () => {
    // Arrange: Lesson 2 held back, Lesson 1 live
    const doc = servedDocument(STATE({ 2: { published: false } }), BODY)

    // Act
    followPageState(doc)

    // Assert
    const readings = doc.getElementById('readings')
    expect(readings?.textContent).toBe(
      'Lesson 2 is coming later; Lesson 1 is ready; odd.',
    )
    expect(readings?.querySelectorAll('[hidden]')).toHaveLength(0)
    expect(readings?.querySelector('[data-if-live="x"]')).not.toBeNull()
  })

  it('leaves a page whose every lesson is live as it was', () => {
    // Arrange
    const doc = servedDocument(STATE({}), BODY)
    const before = doc.body.innerHTML

    // Act
    followPageState(doc)

    // Assert: only the readings are settled
    expect(doc.querySelectorAll('a[href^="/learn/"]')).toHaveLength(4)
    expect(doc.getElementById('readings')?.textContent).toBe(
      'Lesson 2 is ready; Lesson 1 is ready; odd.',
    )
    expect(doc.getElementById('nav')?.outerHTML).toBe(
      /<nav id="nav">.*?<\/nav>/s.exec(before)?.[0],
    )
  })
})

// ============================================================
// Lesson 12 Sing it tests — every state the card walks, on the page's markup
// ============================================================
//
// WEB-SPEC, Toys 6, Tests 8 and End to end 7 at unit level: each visit
// loads the page's modules afresh (`visit`), so the voice choice reads
// `fyp-voice` as a new visit does and the visit's ending starts from the
// practise card. Every sound is one of the kit's runs, swapped for the
// kit's recorder, so a test says how Merc's notes end. The comfort check
// comes first; the voice choice follows either answer, under its first
// line with none stored and its second with one; Play Merc's notes sings
// the roots over the chords as one run, at do = C4 or C5; Start the guide
// waits, aria-disabled under its hint, until they are heard with sound on;
// the sweep counts in on do and plays the chords under it; "How did that
// feel?" follows each sweep; Move do stops at four lower and three higher,
// moving Merc's notes, the readout and the ring's do; Effortful and
// Uncomfortable put the guide and Move do away and pick the rest card, as
// "Just listen today" does; off screen for 600 ms or a hidden page stops
// what plays; and a whole visit stores nothing but the voice.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { scrollOutOfView } from '@/features/lessons/kit/browser-doubles.test-fixtures'
import { AWAY_MS } from '@/features/lessons/kit/leave'
import { COUNT_IN_SEC } from '@/features/lessons/kit/move-do'
import type * as RunModule from '@/features/lessons/kit/run'
import type * as Recorder from '@/features/lessons/kit/run-recorder.test-fixtures'
import type { RecordedRun } from '@/features/lessons/kit/run-recorder.test-fixtures'
import type * as GuideModule from '@/features/lessons/kit/slide-guide'
import type { Guide } from '@/features/lessons/kit/slide-guide'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import { ringLabel } from './lines'
import { AFTER, HINT, STATUS } from './sing-flow'
import { guideChordsAt, readoutAt, singAlongAt } from './sing-guide'

vi.mock('@/features/lessons/kit/run', async (actual) => {
  const recorder =
    await import('@/features/lessons/kit/run-recorder.test-fixtures')
  return {
    ...(await actual<typeof RunModule>()),
    ...recorder.recordedRuns,
    recorder,
  }
})

// the kit's guide as it is, the one the visit mounted kept for its sweep
vi.mock('@/features/lessons/kit/slide-guide', async (actual) => {
  const real = await actual<typeof GuideModule>()
  return { ...real, mountGuide: vi.fn(real.mountGuide) }
})

/** A visit: the page's modules loaded afresh, Sing it mounted on the page's markup, the sound on. */
async function visit(voice: Voice | null = null) {
  vi.resetModules()
  localStorage.clear()
  if (voice !== null) localStorage.setItem('fyp-voice', JSON.stringify(voice))
  const dom = await import('./page-dom.test-fixtures')
  const sing = await import('./sing')
  const comfort = await import('@/features/lessons/kit/comfort')
  const sound = await import('@/features/lessons/kit/sound')
  const guides = await import('@/features/lessons/kit/slide-guide')
  const { recorder } =
    (await import('@/features/lessons/kit/run')) as unknown as {
      readonly recorder: typeof Recorder
    }
  recorder.resetRuns()
  dom.loadPage()
  dom.soundOn()
  sing.initSing({ blue: 'blue.png', orange: 'orange.png' })
  const guide = vi.mocked(guides.mountGuide).mock.results.at(-1)?.value as Guide
  return { ...dom, ...comfort, ...sound, guide, runs: recorder.runs }
}

type Visit = Awaited<ReturnType<typeof visit>>

/** Shown on the card: neither it nor any box around it hidden. */
function shown(p: Visit, selector: string): boolean {
  for (let el: HTMLElement | null = p.el(selector); el; el = el.parentElement)
    if (el.hidden) return false
  return true
}

const status = (p: Visit): string => p.el('#singStatus').textContent ?? ''

function choose(p: Visit, comfort: 'sing' | 'listen', voice?: Voice): void {
  p.el(`[data-comfort="${comfort}"]`).click()
  if (voice !== undefined)
    p.el(`[data-panel="voice"] [data-voice="${voice}"]`).click()
}

const last = (p: Visit): RecordedRun => {
  const run = p.runs.at(-1)
  if (run === undefined) throw new Error('nothing has played')
  return run
}

/** Play Merc's notes pressed, and the notes heard to their end. */
async function hearMerc(p: Visit): Promise<RecordedRun> {
  p.el('[data-notes-play]').click()
  const run = last(p)
  run.end(true)
  await p.settle()
  return run
}

/** Start the guide pressed, and its count-in and sweep run to their end. */
async function sweep(p: Visit): Promise<void> {
  p.el('[data-guide-start]').click()
  await vi.advanceTimersByTimeAsync((COUNT_IN_SEC + 10) * 1000 + 100)
  await p.settle()
}

const startDisabled = (p: Visit): string | null =>
  p.el('[data-guide-start]').getAttribute('aria-disabled')

afterEach(() => {
  window.dispatchEvent(new Event('pagehide'))
  vi.useRealTimers()
  vi.restoreAllMocks()
  Reflect.deleteProperty(document, 'hidden')
  document.body.textContent = ''
  localStorage.clear()
})

describe("Lesson 12's Sing it: before singing", () => {
  it('opens on the comfort check every visit, a voice stored or not', async () => {
    // Act
    const p = await visit('higher')

    // Assert: WEB-SPEC, Toys 6, state 1
    expect(shown(p, '[data-panel="comfort"]')).toBe(true)
    expect(shown(p, '[data-panel="voice"]')).toBe(false)
    expect(status(p)).toBe(STATUS.comfort)
  })

  it('asks for a voice under its first line with none stored, and plays nothing until one is chosen', async () => {
    // Arrange
    const p = await visit()

    // Act
    choose(p, 'listen')
    p.el('[data-notes-play]').click()

    // Assert: state 2
    expect(shown(p, '[data-voice-line="none"]')).toBe(true)
    expect(shown(p, '[data-panel="notes"]')).toBe(false)
    expect(p.runs).toHaveLength(0)
  })

  it('keeps a stored voice pressed under its second line, and a tap on the other changes it', async () => {
    // Arrange
    const p = await visit('lower')

    // Act
    choose(p, 'sing')
    const stored = {
      line: shown(p, '[data-voice-line="stored"]'),
      pressed: p.el('[data-voice="lower"]').getAttribute('aria-pressed'),
    }
    p.el('[data-voice="higher"]').click()
    const run = await hearMerc(p)

    // Assert
    expect(stored).toEqual({ line: true, pressed: 'true' })
    expect(run.notes).toEqual(singAlongAt('higher', 0))
    expect(localStorage.getItem('fyp-voice')).toBe('"higher"')
  })

  it('offers only Play Merc\'s notes after "Just listen today", with the doctor lines, and picks the rest card', async () => {
    // Arrange
    const p = await visit('lower')

    // Act
    choose(p, 'listen')

    // Assert: state 3
    expect(shown(p, '[data-panel="listen"]')).toBe(true)
    expect(shown(p, '[data-notes-play]')).toBe(true)
    expect(shown(p, '[data-guide-start]')).toBe(false)
    expect(shown(p, '.move-do')).toBe(false)
    expect(p.VisitEnding.ending).toBe('rest')
  })
})

describe("Lesson 12's Sing it: Merc's notes and the guide", () => {
  it.each([
    ['lower', 60],
    ['higher', 72],
  ] as const)(
    'sings the roots over the chords as one run for the %s voice, do on %i',
    async (voice, doMidi) => {
      // Arrange
      const p = await visit(voice)
      choose(p, 'sing')

      // Act
      p.el('[data-notes-play]').click()

      // Assert: FACTS 59, 61, 73
      const run = last(p)
      expect(run.notes).toEqual(singAlongAt(voice, 0))
      expect(run.o).toMatchObject({ audible: true, kind: 'soft' })
      expect(
        run.notes.filter((n) => n.kind === 'merc').map((n) => n.midi),
      ).toEqual([0, -5, -3, -7, 0].map((d) => d + doMidi))
    },
  )

  it("keeps Start the guide aria-disabled under its hint until Merc's notes are heard with sound on", async () => {
    // Arrange
    const p = await visit('lower')
    choose(p, 'sing')
    const before = {
      disabled: startDisabled(p),
      hint: p.el('[data-guide-hint]').textContent,
    }
    vi.mocked(p.Sound.canPlay).mockReturnValue(false)

    // Act
    await hearMerc(p)
    const silent = {
      disabled: startDisabled(p),
      hint: p.el('[data-guide-hint]').textContent,
    }
    vi.mocked(p.Sound.canPlay).mockReturnValue(true)
    await hearMerc(p)

    // Assert: state 5
    expect(before).toEqual({ disabled: 'true', hint: HINT.first })
    expect(silent).toEqual({ disabled: 'true', hint: HINT.silent })
    expect(startDisabled(p)).toBe('false')
    expect(shown(p, '[data-guide-hint]')).toBe(false)
  })

  it('does nothing on a press of Start the guide before the notes are heard', async () => {
    // Arrange
    const p = await visit('lower')
    choose(p, 'sing')

    // Act
    p.el('[data-guide-start]').click()

    // Assert
    expect(p.runs).toHaveLength(0)
    expect(status(p)).toBe(STATUS.first)
  })

  it('counts in on do, then plays the chords under the sweep, and asks "How did that feel?" at its end', async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
    const p = await visit('lower')
    choose(p, 'sing')
    await hearMerc(p)

    // Act
    p.el('[data-guide-start]').click()
    const guiding = status(p)
    const chords = last(p)
    await vi.advanceTimersByTimeAsync((COUNT_IN_SEC + 10) * 1000 + 100)
    await p.settle()

    // Assert: states 5 and 6
    expect(guiding).toBe(STATUS.guiding)
    expect(chords.notes).toEqual(
      guideChordsAt(0).map((n) => ({ ...n, t: n.t + COUNT_IN_SEC })),
    )
    expect(
      chords.notes.every((n) => n.kind === undefined || n.kind === 'soft'),
    ).toBe(true)
    expect(shown(p, '[data-panel="feel"]')).toBe(true)
    expect(status(p)).toBe(STATUS.feel)
  })

  it('says "Do, so, la, fa, do" after Easy, and keeps the guide', async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
    const p = await visit('lower')
    choose(p, 'sing')
    await hearMerc(p)
    await sweep(p)

    // Act
    p.el('[data-feel="easy"]').click()

    // Assert: state 6
    expect(shown(p, '[data-after="roots"]')).toBe(true)
    expect(status(p)).toBe(AFTER.roots)
    expect(shown(p, '[data-guide-start]')).toBe(true)
    expect(p.VisitEnding.ending).toBe('practise')
  })

  it.each([
    ['effortful', 'gentle', false],
    ['uncomfortable', 'enough', true],
  ] as const)(
    'puts the guide and Move do away after %s, with its line, and picks the rest card for the visit',
    async (feeling, after, doctor) => {
      // Arrange
      vi.useFakeTimers({
        toFake: ['setTimeout', 'clearTimeout', 'performance'],
      })
      const p = await visit('lower')
      choose(p, 'sing')
      await hearMerc(p)
      await sweep(p)

      // Act
      p.el(`[data-feel="${feeling}"]`).click()
      const run = await hearMerc(p)

      // Assert: state 6; REQ-GVC-021, 023, 055
      expect(shown(p, `[data-after="${after}"]`)).toBe(true)
      expect(shown(p, '[data-guide-start]')).toBe(false)
      expect(shown(p, '.move-do')).toBe(false)
      expect(shown(p, '[data-after-doctor]')).toBe(doctor)
      expect(p.VisitEnding.ending).toBe('rest')
      expect(run.notes).toEqual(singAlongAt('lower', 0))
    },
  )
})

describe("Lesson 12's Sing it: Move do", () => {
  it('stops three higher and four lower, each end aria-disabled, moving the notes, the readout and the ring', async () => {
    // Arrange
    const p = await visit('lower')
    choose(p, 'sing')
    const higher = p.el('[data-move-do="1"]')
    const lower = p.el('[data-move-do="-1"]')

    // Act
    for (let i = 0; i < 5; i++) higher.click()
    const top = {
      disabled: higher.getAttribute('aria-disabled'),
      readout: p.el('[data-do-readout]').innerHTML,
      ring: p.el('.ring-note').innerHTML,
    }
    const run = await hearMerc(p)
    for (let i = 0; i < 9; i++) lower.click()

    // Assert: FACTS 60
    expect(top).toEqual({
      disabled: 'true',
      readout: readoutAt('lower', 3).html,
      ring: ringLabel(63),
    })
    expect(readoutAt('lower', 3).words).toBe(
      'do is E flat 4: E flat 4, B flat 3, C4, A flat 3, E flat 4',
    )
    expect(run.notes).toEqual(singAlongAt('lower', 3))
    expect(lower.getAttribute('aria-disabled')).toBe('true')
    expect(higher.getAttribute('aria-disabled')).toBe('false')
    expect(p.el('[data-do-readout]').innerHTML).toBe(
      readoutAt('lower', -4).html,
    )
  })
})

describe("Lesson 12's Sing it: leaving, and what is stored", () => {
  it("stops Merc's notes once the section has been off screen for 600 ms, not heard", async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
    const p = await visit('lower')
    choose(p, 'sing')
    p.el('[data-notes-play]').click()

    // Act
    scrollOutOfView(p.el('#sing'))
    await vi.advanceTimersByTimeAsync(AWAY_MS)
    await p.settle()

    // Assert: kit/leave.ts
    expect(last(p).stopped).toBe(true)
    expect(startDisabled(p)).toBe('true')
  })

  it('stops a sweep when the page is hidden, and asks nothing', async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
    const p = await visit('lower')
    choose(p, 'sing')
    await hearMerc(p)
    p.el('[data-guide-start]').click()

    // Act
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => true,
    })
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(12_000)

    // Assert
    expect(last(p).stopped).toBe(true)
    expect(shown(p, '[data-panel="feel"]')).toBe(false)
    expect(status(p)).toBe(STATUS.ready)
  })

  it('stores nothing but the voice through a whole visit', async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
    const p = await visit()

    // Act
    choose(p, 'sing', 'higher')
    for (let i = 0; i < 2; i++) p.el('[data-move-do="-1"]').click()
    await hearMerc(p)
    await sweep(p)
    p.el('[data-feel="workable"]').click()

    // Assert: Tests 8's storage clause
    const keys = Array.from({ length: localStorage.length }, (_, i) =>
      localStorage.key(i),
    )
    expect(keys).toEqual(['fyp-voice'])
  })
})

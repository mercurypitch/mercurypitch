// ============================================================
// Lesson 9 Sing it leaving tests — a take silenced, abandoned or never begun
// ============================================================
//
// WEB-SPEC, Toys 4 states 5, 6 and 9 and Tests 6 and 7, the parts on the
// page's markup: the sound turned off while Merc sings ends the take
// uncounted, the card back to Start with its hint; another sound on the
// page, a hidden tab or the section left 600 ms abandons the take, before
// any voice or after it, and lets the microphone go at once, the card never
// pulling the viewer back once they have gone, while a shorter moment away
// keeps it; a tab hidden while the microphone opens starts no take; a
// microphone that cannot open leaves the card listening only, with the
// practice card; and nothing from a take, its reading or its answer is
// stored. The listener and the runs are doubles (sing-take.test-fixtures.ts).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { scrollIntoViewAgain, scrollOutOfView, } from '@/features/lessons/kit/browser-doubles.test-fixtures'
import type * as ListenModule from '@/features/lessons/kit/listen'
import type * as MercDuo from '@/features/lessons/kit/merc-duo'
import type * as RunModule from '@/features/lessons/kit/run'
import type { TakeDouble } from './sing-take.test-fixtures'
import { closeCard, freshTakes, hideTab, lastTake, loadCard, mercRun, mercRuns, onCard, press, start, status, sung, take, } from './sing-take.test-fixtures'

const takes = vi.hoisted(() => ({}) as TakeDouble)

vi.mock('@/features/lessons/kit/run', async (actual) => {
  const recorder =
    await import('@/features/lessons/kit/run-recorder.test-fixtures')
  return {
    ...(await actual<typeof RunModule>()),
    ...recorder.recordedRuns,
    recorder,
  }
})

vi.mock('@/features/lessons/kit/merc-duo', async (actual) => ({
  ...(await actual<typeof MercDuo>()),
  mercSing: vi.fn(),
  mercListen: vi.fn(),
  mercCelebrate: vi.fn(),
}))

vi.mock('@/features/lessons/kit/listen', async (actual) =>
  (await import('./sing-take.test-fixtures')).listenDouble(
    await actual(),
    takes,
  ),
)

const load = () => loadCard(takes)

/** A voice heard in an open take, then the tab hidden: the take abandoned after voice. */
function voiceThenHide(o: ListenModule.TakeOptions): void {
  o.onFrame?.({ t: 0.6, f0: 220, conf: 0.95, rms: 0.1 }, 0.5)
  hideTab()
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  localStorage.clear()
  Object.assign(takes, freshTakes())
})

afterEach(closeCard)

describe("Lesson 9's Sing it: the sound off, and leaving", () => {
  it('ends the take uncounted when the sound goes off while Merc sings, the hint beside Start', async () => {
    // Arrange
    const p = await load()
    await press(p, start(p))

    // Act: the switch turned off, and the kit's runs stopped with it
    vi.spyOn(p.Sound, 'state', 'get').mockReturnValue('off')
    p.Sound.set('off')
    mercRun(p).end(false)
    await vi.advanceTimersByTimeAsync(1000)

    // Assert
    expect(p.card.visit.takes).toEqual([])
    expect(takes.opened).toBe(0)
    expect(onCard(p, '[data-sing="start"]')).toBe(true)
    expect(p.el('[data-start-hint]').textContent).toBe(
      "Sound is off, so nothing played. Turn sound on to hear Merc's ladder, then press Start.",
    )
    expect(takes.released).toBe(1)
  })

  it('abandons a take when another sound on the page starts while Merc sings', async () => {
    // Arrange
    const p = await load()
    await press(p, start(p))

    // Act
    p.NowPlaying.claim(() => undefined)
    await vi.advanceTimersByTimeAsync(1000)

    // Assert
    expect(mercRun(p).stopped).toBe(true)
    expect(takes.opened).toBe(0)
    expect(lastTake(p)).toEqual({ ladder: 'full', kind: 'leftSilent' })
  })

  it.each([
    ['before any voice', hideTab, 'leftSilent'],
    ['after the voice started', voiceThenHide, 'leftVoiced'],
  ] as const)(
    'abandons the take when the tab is hidden %s, letting the microphone go at once',
    async (_, during, kind) => {
      // Arrange
      const p = await load()
      takes.during = during

      // Act
      await take(p, start(p), [])

      // Assert
      expect(lastTake(p)).toEqual({ ladder: 'full', kind })
      expect(takes.releasedNow).toBe(1)
      expect(onCard(p, '[data-panel="feel"]')).toBe(false)
    },
  )

  it('abandons the take when the section stays away 600 ms, letting the microphone go at once and leaving the viewer where they went', async () => {
    // Arrange: a card far below the screen, as once the viewer has scrolled away
    const scrolled = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrolled,
    })
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
      DOMRect.fromRect({ x: 0, y: 2000, width: 360, height: 900 }),
    )
    const p = await load()
    let before = 0
    takes.during = () => {
      before = scrolled.mock.calls.length
      scrollOutOfView(p.el('#sing'))
      vi.advanceTimersByTime(600)
    }

    // Act
    await take(p, start(p), [])

    // Assert
    expect(lastTake(p)).toEqual({ ladder: 'full', kind: 'leftSilent' })
    expect(takes.releasedNow).toBe(1)
    expect(scrolled.mock.calls.length).toBe(before)
    Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView')
  })

  it('keeps the take when the section comes back within 600 ms, as a panel that grows can take it off screen for a moment', async () => {
    // Arrange
    const p = await load()
    takes.inside = () => {
      scrollOutOfView(p.el('#sing'))
      vi.advanceTimersByTime(599)
      scrollIntoViewAgain(p.el('#sing'))
      vi.advanceTimersByTime(600)
    }

    // Act
    await take(p, start(p), sung([50, 1.5], [54, 1.5], [57, 1.5], [62, 1.5]))

    // Assert
    expect(lastTake(p)).toEqual({ ladder: 'full', kind: 'all' })
    expect([takes.released, takes.releasedNow]).toEqual([1, 0])
  })

  it('starts no take when the tab is hidden while the microphone opens, and lets it go at once', async () => {
    // Arrange
    const p = await load()
    takes.opening = hideTab

    // Act
    await press(p, start(p))

    // Assert
    expect(mercRuns(p)).toEqual([])
    expect(takes.opened).toBe(0)
    expect(takes.releasedNow).toBe(1)
    expect(lastTake(p)).toEqual({ ladder: 'full', kind: 'leftSilent' })
  })

  it('listens only when the microphone cannot open, keeping the practice card', async () => {
    // Arrange
    const p = await load()
    vi.mocked(p.Sound.context).mockReturnValue(null)

    // Act
    await press(p, start(p))

    // Assert
    expect(status(p)).toBe(
      'No microphone? Sing along anyway: Merc sings the ladder first, and nothing listens.',
    )
    expect(onCard(p, '[data-listen-why="nomic"]')).toBe(true)
    expect(onCard(p, '[data-sing="start"]')).toBe(false)
    expect(mercRuns(p)).toEqual([])
    expect(p.VisitEnding.ending).toBe('practise')
  })

  it('stores nothing from a take, its reading or its answer', async () => {
    // Arrange
    const p = await load()

    // Act
    await take(p, start(p), sung([50, 1.5], [54, 1.5], [57, 1.5], [62, 1.5]))
    p.el('[data-feel="easy"]').click()

    // Assert
    expect(
      Array.from({ length: localStorage.length }, (_, i) =>
        localStorage.key(i),
      ),
    ).toEqual(['fyp-voice'])
  })
})

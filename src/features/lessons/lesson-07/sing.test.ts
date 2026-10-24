// ============================================================
// Lesson 7 Sing it tests — the card, on the page's markup
// ============================================================
//
// WEB-SPEC, Tests 7, the parts the pure flow cannot show: the voice choice
// comes first when none is stored, and a stored one starts pressed; "Just
// listen today" shows no Start and picks the rest card; Start waits for
// Merc's siren, and with sound off stays unavailable with the sound-off
// hint; without Web Audio Sing it is listen-only with no Start; a refused
// microphone listens only and keeps the Vocal Range Test card; a steady A3
// reads as its one note, "Easy" offers Again once, and after a second take
// it is gone; "Uncomfortable" takes the band away; a tab hidden while the
// microphone opens starts no take, lets it go, and counts it, the third
// leaving Done for today, and the section scrolled away starts none either,
// though once it is back in view Start starts one; the ring rests once a
// take ends, with motion or without, and beside Done for today, and Merc's
// siren ends on "Rest" in a listen-only visit; Done for today keeps the
// question, its answer and its lines, the four answers locked with the one
// picked still pressed, and no take on offer again; and storage holds
// nothing but `fyp-voice` and `fyp-l07-warmup`. The listener is a double:
// its takes are synthetic frames, read by the real siren reader.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { scrollIntoViewAgain, scrollOutOfView, } from '@/features/lessons/kit/browser-doubles.test-fixtures'
import type * as ListenModule from '@/features/lessons/kit/listen'
import type { F0Frame } from '@/lib/mirror/metrics'
import { DEFAULT_HOP_SEC } from '@/lib/mirror/metrics'

/** A steady note for `seconds`, after half a second of silence, at the detector's hop. */
function steady(midi: number, seconds: number): F0Frame[] {
  const frames: F0Frame[] = []
  let t = 0
  for (; t < 0.5; t += DEFAULT_HOP_SEC) frames.push({ t, f0: 0, conf: 0 })
  const f0 = 440 * 2 ** ((midi - 69) / 12)
  for (const end = t + seconds; t < end; t += DEFAULT_HOP_SEC)
    frames.push({ t, f0, conf: 0.95 })
  return frames
}

const takes = vi.hoisted(() => ({
  next: [] as F0Frame[],
  /** Runs as the page asks for the microphone, before the listener resolves. */
  opening: null as (() => void) | null,
  /** Runs inside an open take, which then reads nothing: the viewer gone mid-take. */
  during: null as ((o: ListenModule.TakeOptions) => void) | null,
  /** Takes opened, and the times the microphone was let go: after its linger, or at once. */
  opened: 0,
  released: 0,
  releasedNow: 0,
}))

vi.mock('@/features/lessons/kit/listen', async (importOriginal) => {
  const real = await importOriginal<typeof ListenModule>()
  return {
    ...real,
    listen: () => {
      takes.opening?.()
      return Promise.resolve({
        holding: true,
        latest: () => null,
        release: () => {
          takes.released += 1
        },
        releaseNow: () => {
          takes.releasedNow += 1
        },
      })
    },
    takeFrames: (_: unknown, o: ListenModule.TakeOptions) => {
      takes.opened += 1
      if (takes.during === null) return Promise.resolve(takes.next)
      takes.during(o)
      return Promise.resolve(null)
    },
  }
})

/**
 * The page's modules, loaded afresh: the voice choice reads storage as it
 * loads, and the motion setting is read as its module loads, under reduced
 * motion as the doubles hold it unless `moving`.
 */
async function load(o: { readonly moving?: boolean } = {}) {
  vi.resetModules()
  if (o.moving === true) {
    // the doubles first, then the system setting with motion on, before any
    // kit module reads it: none of the doubles' queries matches
    await import('@/features/lessons/kit/browser-doubles.test-fixtures')
    const doubles = window.matchMedia.bind(window)
    vi.spyOn(window, 'matchMedia').mockImplementation((q) => ({
      ...doubles(q),
      matches: false,
    }))
  }
  const dom = await import('./page-dom.test-fixtures')
  const sing = await import('./sing')
  const comfort = await import('@/features/lessons/kit/comfort')
  const sound = await import('@/features/lessons/kit/sound')
  // the listener's chunk, loaded now so a take's own import of it resolves
  // at once, however long a busy machine takes to transform it
  await import('@/features/lessons/kit/listen')
  dom.loadPage()
  sing.initSing({ blue: 'blue.png', orange: 'orange.png' })
  return { ...dom, ...sing, ...comfort, ...sound }
}

type Page = Awaited<ReturnType<typeof load>>

const shown = (p: Page, selector: string): boolean => !p.el(selector).hidden

/** Shown on the card: neither it nor any box around it hidden. */
function onCard(p: Page, selector: string): boolean {
  for (let el: HTMLElement | null = p.el(selector); el; el = el.parentElement)
    if (el.hidden) return false
  return true
}
const status = (p: Page): string => p.el('#singStatus').textContent ?? ''

/** Whether the test's browser has Web Audio: the page only asks whether it is there. */
function webAudio(on: boolean): void {
  const w = window as unknown as Record<string, unknown>
  // the page only asks whether the constructor exists, so any function will do
  if (on) w.AudioContext = function AudioContext() {}
  else delete w.AudioContext
}

/** Every key in storage. */
const keys = (): string[] =>
  Array.from(
    { length: localStorage.length },
    (_, i) => localStorage.key(i) ?? '',
  )

/** The tab hidden, as switching to another tab hides it: `document.hidden`, then its event. */
function hideTab(): void {
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    get: () => true,
  })
  document.dispatchEvent(new Event('visibilitychange'))
}

/** The page's Sing it section, which its leave watch observes. */
function singSection(): Element {
  const section = document.querySelector('#sing')
  if (section === null) throw new Error('no #sing')
  return section
}

/** The section scrolled away as the microphone opens, and kept away past the page's 600 ms. */
function leaveSection(): void {
  scrollOutOfView(singSection())
  vi.advanceTimersByTime(600)
}

/** A voice heard in an open take, then the tab hidden: the take abandoned after voice. */
function voiceThenHide(o: ListenModule.TakeOptions): void {
  o.onFrame?.({ t: 0.6, f0: 220, conf: 0.95, rms: 0.1 }, 0.5)
  hideTab()
}

/** The word the ring says. */
const ringSays = (p: Page): string =>
  p.el('#ring .ring-state').textContent ?? ''

/**
 * The page's frame loop on frames the test runs, the ring on screen: `draw(s)`
 * runs the frame asked for, `s` seconds from now, as a ring on screen is drawn.
 */
async function drawnRing(p: Page): Promise<(seconds: number) => void> {
  const asked: FrameRequestCallback[] = []
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) =>
    asked.push(cb),
  )
  const loop = await import('@/features/lessons/kit/frame-loop')
  loop.startFrameLoop()
  scrollIntoViewAgain(p.el('#ring'))
  return (seconds) => {
    for (const cb of asked.splice(0)) cb(performance.now() + seconds * 1000)
  }
}

beforeEach(() => {
  localStorage.clear()
  webAudio(true)
  takes.opening = null
  takes.during = null
  takes.opened = 0
  takes.released = 0
  takes.releasedNow = 0
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  webAudio(false)
  Reflect.deleteProperty(document, 'hidden')
  document.body.textContent = ''
  localStorage.clear()
})

/** Merc's siren played to its end with the sound on, by the button in `from`. */
async function playMerc(
  p: Page,
  from = '[data-panel="prepare"]',
): Promise<void> {
  vi.spyOn(p.Sound, 'canPlay').mockReturnValue(true)
  vi.spyOn(p.Sound, 'state', 'get').mockReturnValue('on')
  p.el(`${from} [data-merc-siren]`).click()
  await vi.advanceTimersByTimeAsync(6200)
}

/** Start or Again pressed, a take of `frames` read. */
async function sing(
  p: Page,
  button: HTMLElement,
  frames: F0Frame[],
): Promise<void> {
  takes.next = frames
  vi.spyOn(p.Sound, 'context').mockReturnValue({} as AudioContext)
  button.click()
  // the listener's chunk (loaded already) resolves, then the take opens on the fake clock
  await vi.dynamicImportSettled()
  await vi.advanceTimersByTimeAsync(1000)
}

describe("Lesson 7's Sing it: before a take", () => {
  it('asks for the voice first when none is stored, then briefs', async () => {
    // Arrange
    const p = await load()

    // Act
    p.el('[data-comfort="sing"]').click()
    const first = [
      shown(p, '[data-panel="voice"]'),
      shown(p, '[data-panel="prepare"]'),
    ]
    p.el('[data-panel="voice"] [data-voice="lower"]').click()

    // Assert
    expect(first).toEqual([true, false])
    expect(shown(p, '[data-voice-line="none"]')).toBe(true)
    expect(shown(p, '[data-panel="prepare"]')).toBe(true)
    expect(p.el('[data-sing="start"]').getAttribute('aria-disabled')).toBe(
      'true',
    )
    expect(p.el('[data-start-hint]').textContent?.trim()).toBe(
      "Play Merc's siren first",
    )
    expect(status(p)).toBe(
      "Warm up if you like. Then play Merc's siren, and press Start.",
    )
  })

  it('starts a stored voice pressed, changeable, under its own line', async () => {
    // Arrange
    localStorage.setItem('fyp-voice', JSON.stringify('higher'))
    const p = await load()

    // Act
    p.el('[data-comfort="sing"]').click()

    // Assert
    expect(shown(p, '[data-voice-line="stored"]')).toBe(true)
    expect(p.el('[data-voice="higher"]').getAttribute('aria-pressed')).toBe(
      'true',
    )
    expect(shown(p, '[data-panel="prepare"]')).toBe(true)
  })

  it('readies Start once Merc’s siren has sounded with the sound on', async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const p = await load()
    p.el('[data-comfort="sing"]').click()
    p.el('[data-panel="voice"] [data-voice="lower"]').click()

    // Act
    await playMerc(p)

    // Assert
    expect(p.el('[data-sing="start"]').getAttribute('aria-disabled')).toBe(
      'false',
    )
    expect(p.el('[data-start-hint]').hidden).toBe(true)
  })

  it('keeps Start unavailable after a play with the sound off, and says why', async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const p = await load()
    p.el('[data-comfort="sing"]').click()
    p.el('[data-panel="voice"] [data-voice="lower"]').click()
    vi.spyOn(p.Sound, 'canPlay').mockReturnValue(false)
    vi.spyOn(p.Sound, 'state', 'get').mockReturnValue('off')

    // Act
    p.el('[data-panel="prepare"] [data-merc-siren]').click()
    await vi.advanceTimersByTimeAsync(6200)

    // Assert
    expect(p.el('[data-sing="start"]').getAttribute('aria-disabled')).toBe(
      'true',
    )
    expect(p.el('[data-start-hint]').textContent).toBe(
      "Sound is off, so nothing played. Turn sound on to hear Merc's siren, then press Start.",
    )
  })

  it('listens only after "Just listen today": no Start, the doctor lines, the rest card', async () => {
    // Arrange
    const p = await load()

    // Act
    p.el('[data-comfort="listen"]').click()
    p.el('[data-panel="voice"] [data-voice="lower"]').click()

    // Assert
    expect(shown(p, '[data-panel="listen"]')).toBe(true)
    expect(shown(p, '[data-panel="listen"] .doctor')).toBe(true)
    expect(shown(p, '[data-panel="prepare"]')).toBe(false)
    expect(shown(p, '[data-listen-play]')).toBe(true)
    expect(p.VisitEnding.ending).toBe('rest')
    expect(status(p)).toBe('Just listening today: the microphone stays off.')
  })

  it('listens only, with no Start, in a browser without Web Audio', async () => {
    // Arrange
    webAudio(false)
    const p = await load()

    // Act
    p.el('[data-comfort="sing"]').click()
    p.el('[data-panel="voice"] [data-voice="lower"]').click()

    // Assert
    expect(shown(p, '[data-panel="prepare"]')).toBe(false)
    expect(shown(p, '[data-listen-why="nomic"]')).toBe(true)
    expect(p.el('[data-listen-hint]').textContent).toBe(
      "This browser can't play sound here.",
    )
    expect(shown(p, '[data-listen-hint]')).toBe(true)
    expect(p.VisitEnding.ending).toBe('practise')
  })

  it('listens only after a refused microphone, keeping the Vocal Range Test card', async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const p = await load()
    p.el('[data-comfort="sing"]').click()
    p.el('[data-panel="voice"] [data-voice="lower"]').click()
    await playMerc(p)
    vi.spyOn(p.Sound, 'context').mockReturnValue(null)

    // Act
    p.el('[data-sing="start"]').click()
    await vi.advanceTimersByTimeAsync(100)

    // Assert
    expect(status(p)).toBe(
      'No microphone? Sing along anyway: Merc sings the siren first, and nothing listens.',
    )
    expect(shown(p, '[data-listen-why="nomic"]')).toBe(true)
    expect(p.VisitEnding.ending).toBe('practise')
  })
})

describe("Lesson 7's Sing it: the card in view", () => {
  it('brings the card back when a tall panel gives way and leaves it above the screen, and never at load', async () => {
    // Arrange: a card scrolled 300 px above the top of the screen
    const scrolled = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrolled,
    })
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
      DOMRect.fromRect({ x: 0, y: -300, width: 360, height: 900 }),
    )
    const p = await load()
    const atLoad = scrolled.mock.calls.length

    // Act: "Sing along", the comfort check giving way to the briefing
    p.el('[data-comfort="sing"]').click()

    // Assert
    expect(atLoad).toBe(0)
    expect(scrolled).toHaveBeenCalledWith({
      block: 'start',
      behavior: 'instant',
    })
    delete (HTMLElement.prototype as { scrollIntoView?: unknown })
      .scrollIntoView
  })
})

describe("Lesson 7's Sing it: the takes", () => {
  it('reads a steady A3 as its one note, then offers Again once a visit', async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const p = await load()
    p.el('[data-comfort="sing"]').click()
    p.el('[data-panel="voice"] [data-voice="lower"]').click()
    await playMerc(p)

    // Act: a take, "Easy", Again, a second take, "Easy"
    await sing(p, p.el('[data-sing="start"]'), steady(57, 3))
    const line = p.el('[data-reading-line]').textContent
    const asked = shown(p, '[data-panel="feel"]')
    p.el('[data-feel="easy"]').click()
    const closing = shown(p, '[data-closing="band"]')
    const again = shown(p, '[data-panel="after"] [data-sing="again"]')
    await sing(
      p,
      p.el('[data-panel="after"] [data-sing="again"]'),
      steady(57, 3),
    )
    p.el('[data-feel="easy"]').click()

    // Assert
    expect(line).toBe('The lit band is the middle of your siren: about A3.')
    expect(asked).toBe(true)
    expect(closing).toBe(true)
    expect(again).toBe(true)
    expect(shown(p, '[data-panel="after"] [data-sing="again"]')).toBe(false)
    expect(shown(p, '[data-panel="after"] [data-sing="today"]')).toBe(true)
    expect(p.VisitEnding.ending).toBe('practise')
  })

  it('takes the band away after "Uncomfortable", with the doctor lines and the rest card', async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const p = await load()
    p.el('[data-comfort="sing"]').click()
    p.el('[data-panel="voice"] [data-voice="lower"]').click()
    await playMerc(p)
    await sing(p, p.el('[data-sing="start"]'), steady(57, 3))

    // Act
    p.el('[data-feel="uncomfortable"]').click()

    // Assert
    expect(shown(p, '[data-closing="enough"]')).toBe(true)
    expect(shown(p, '[data-after-doctor]')).toBe(true)
    expect(shown(p, '[data-reading]')).toBe(false)
    expect(shown(p, '[data-panel="after"] [data-sing="again"]')).toBe(false)
    expect(p.el('#singChart canvas').getAttribute('aria-label')).not.toContain(
      'lit',
    )
    expect(p.VisitEnding.ending).toBe('rest')
  })

  it('asks nothing after a take with no voice, and offers a fresh start', async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const p = await load()
    p.el('[data-comfort="sing"]').click()
    p.el('[data-panel="voice"] [data-voice="lower"]').click()
    await playMerc(p)

    // Act
    await sing(p, p.el('[data-sing="start"]'), steady(57, 0))

    // Assert
    expect(p.el('[data-reading-line]').textContent).toBe(
      "We didn't hear you start that time. Hum “ng” as the ring turns.",
    )
    expect(shown(p, '[data-panel="feel"]')).toBe(false)
    expect(shown(p, '[data-take-actions] [data-sing="again"]')).toBe(true)
    expect(shown(p, '[data-take-actions] [data-sing="today"]')).toBe(true)
  })

  it('starts no take when the tab is hidden while the microphone opens, lets it go, and offers Start again', async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const p = await load()
    p.el('[data-comfort="sing"]').click()
    p.el('[data-panel="voice"] [data-voice="lower"]').click()
    await playMerc(p)
    takes.opening = hideTab

    // Act: Start, and the tab hidden before the listener resolves
    await sing(p, p.el('[data-sing="start"]'), steady(57, 3))

    // Assert
    expect(takes.opened).toBe(0)
    expect(takes.releasedNow).toBe(1)
    expect(status(p)).toBe('Stopped listening: the microphone is off.')
    expect(shown(p, '[data-panel="prepare"]')).toBe(true)
    expect(shown(p, '[data-sing="start"]')).toBe(true)
  })

  it('starts no take when the section is scrolled away while the microphone opens, lets it go, and offers Start again', async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const p = await load()
    p.el('[data-comfort="sing"]').click()
    p.el('[data-panel="voice"] [data-voice="lower"]').click()
    await playMerc(p)
    takes.opening = leaveSection

    // Act: Start, and the section away for good before the listener resolves
    await sing(p, p.el('[data-sing="start"]'), steady(57, 3))

    // Assert: let go as leaving the section lets go, after the linger
    expect(takes.opened).toBe(0)
    expect([takes.released, takes.releasedNow]).toEqual([1, 0])
    expect(status(p)).toBe('Stopped listening: the microphone is off.')
    expect(shown(p, '[data-panel="prepare"]')).toBe(true)
    expect(shown(p, '[data-sing="start"]')).toBe(true)
  })

  it('starts a take after Start once the section, away past its 600 ms, is back in view', async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const p = await load()
    p.el('[data-comfort="sing"]').click()
    p.el('[data-panel="voice"] [data-voice="lower"]').click()
    await playMerc(p)
    leaveSection()
    scrollIntoViewAgain(singSection())

    // Act
    await sing(p, p.el('[data-sing="start"]'), steady(57, 3))

    // Assert: one take, read and asked about, and the microphone let go once, as it ended
    expect(takes.opened).toBe(1)
    expect([takes.released, takes.releasedNow]).toEqual([1, 0])
    expect(shown(p, '[data-panel="feel"]')).toBe(true)
  })

  it('counts a take ended by a hidden tab: after the third, no Start, and Done for today', async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const p = await load()
    p.el('[data-comfort="sing"]').click()
    p.el('[data-panel="voice"] [data-voice="lower"]').click()
    await playMerc(p)
    takes.opening = hideTab

    // Act: Start three times, the tab hidden each time the microphone opens
    await sing(p, p.el('[data-sing="start"]'), steady(57, 3))
    await sing(p, p.el('[data-sing="start"]'), steady(57, 3))
    const afterTwo = shown(p, '[data-sing="start"]')
    await sing(p, p.el('[data-sing="start"]'), steady(57, 3))

    // Assert
    expect(takes.opened).toBe(0)
    expect(afterTwo).toBe(true)
    expect(shown(p, '[data-sing="start"]')).toBe(false)
    expect(onCard(p, '[data-take-actions] [data-sing="today"]')).toBe(true)
    expect(shown(p, '[data-take-actions] [data-sing="again"]')).toBe(false)
  })

  it('stores nothing but the voice and the warm-up’s Skip', async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const p = await load()
    p.el('[data-comfort="sing"]').click()
    p.el('[data-panel="voice"] [data-voice="lower"]').click()
    p.el('[data-warm="skip"]').click()
    await playMerc(p)

    // Act: a whole visit
    await sing(p, p.el('[data-sing="start"]'), steady(57, 3))
    p.el('[data-feel="workable"]').click()
    p.el('[data-panel="after"] [data-sing="today"]').click()

    // Assert
    expect(keys().sort()).toEqual(['fyp-l07-warmup', 'fyp-voice'])
    expect(status(p)).toBe('Done for today.')
  })
})

describe("Lesson 7's Sing it: after Done for today", () => {
  /** The visit to a band: comfortable, the lower voice, Merc's siren heard, one take of A3. */
  async function sungBand(): Promise<Page> {
    const p = await load()
    p.el('[data-comfort="sing"]').click()
    p.el('[data-panel="voice"] [data-voice="lower"]').click()
    await playMerc(p)
    await sing(p, p.el('[data-sing="start"]'), steady(57, 3))
    return p
  }
  const pressed = (p: Page, f: string): string | null =>
    p.el(`[data-feel="${f}"]`).getAttribute('aria-pressed')
  /** The four answers, as [answer, pressed, disabled]. */
  const answers = (): [string, string | null, boolean][] =>
    Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        '#singCard button[data-feel]',
      ),
    ).map((b) => [
      b.dataset.feel ?? '',
      b.getAttribute('aria-pressed'),
      b.disabled,
    ])
  const lit = (p: Page): boolean =>
    (p.el('#singChart canvas').getAttribute('aria-label') ?? '').includes('lit')
  /** No button on the card that would start or end a take. */
  const noTakes = (p: Page): boolean =>
    [
      '[data-sing="start"]',
      '[data-panel="after"] [data-sing="again"]',
      '[data-panel="after"] [data-sing="today"]',
      '[data-take-actions] [data-sing="again"]',
      '[data-take-actions] [data-sing="today"]',
    ].every((sel) => !onCard(p, sel))

  it('keeps the question, its answer and the closing line, with no take on offer', async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const p = await sungBand()
    p.el('[data-feel="easy"]').click()

    // Act
    p.el('[data-panel="after"] [data-sing="today"]').click()

    // Assert
    expect(onCard(p, '[data-panel="feel"]')).toBe(true)
    expect(pressed(p, 'easy')).toBe('true')
    expect(onCard(p, '[data-closing="band"]')).toBe(true)
    expect(onCard(p, '[data-reading]')).toBe(true)
    expect(lit(p)).toBe(true)
    expect(noTakes(p)).toBe(true)
    expect(status(p)).toBe('Done for today.')
  })

  it('locks the answer: the one picked stays pressed, and the others change nothing', async () => {
    // Arrange: "Easy", Done for today
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const p = await sungBand()
    p.el('[data-feel="easy"]').click()
    p.el('[data-panel="after"] [data-sing="today"]').click()

    // Act: "Workable", then "Uncomfortable", as a script might press them
    for (const f of ['workable', 'uncomfortable'])
      p.el(`[data-feel="${f}"]`).dispatchEvent(new MouseEvent('click'))

    // Assert
    expect(answers()).toEqual([
      ['easy', 'true', true],
      ['workable', 'false', true],
      ['effortful', 'false', true],
      ['uncomfortable', 'false', true],
    ])
    expect(onCard(p, '[data-panel="feel"]')).toBe(true)
    expect(onCard(p, '[data-closing="band"]')).toBe(true)
    expect(onCard(p, '[data-after-doctor]')).toBe(false)
    expect(onCard(p, '[data-reading]')).toBe(true)
    expect(lit(p)).toBe(true)
    expect(noTakes(p)).toBe(true)
    expect(p.VisitEnding.ending).toBe('practise')
    expect(status(p)).toBe('Done for today.')
  })

  it('leaves the reading and nothing to press after a take with no voice', async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const p = await load()
    p.el('[data-comfort="sing"]').click()
    p.el('[data-panel="voice"] [data-voice="lower"]').click()
    await playMerc(p)
    await sing(p, p.el('[data-sing="start"]'), steady(57, 0))

    // Act
    p.el('[data-take-actions] [data-sing="today"]').click()

    // Assert
    expect(onCard(p, '[data-reading]')).toBe(true)
    expect(onCard(p, '[data-panel="feel"]')).toBe(false)
    expect(noTakes(p)).toBe(true)
    expect(status(p)).toBe('Done for today.')
  })
})

describe("Lesson 7's Sing it: the ring at rest", () => {
  describe.each([
    { motion: 'with motion', moving: true },
    { motion: 'under reduced motion', moving: false },
  ])('$motion', ({ moving }) => {
    it('rests once a take ends with a reading', async () => {
      // Arrange
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      const p = await load({ moving })
      p.el('[data-comfort="sing"]').click()
      p.el('[data-panel="voice"] [data-voice="lower"]').click()
      await playMerc(p)

      // Act
      await sing(p, p.el('[data-sing="start"]'), steady(57, 3))

      // Assert
      expect(shown(p, '[data-panel="feel"]')).toBe(true)
      expect(ringSays(p)).toBe('Rest')
    })

    it('rests once a take is abandoned after its voice was heard', async () => {
      // Arrange
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      const p = await load({ moving })
      p.el('[data-comfort="sing"]').click()
      p.el('[data-panel="voice"] [data-voice="lower"]').click()
      await playMerc(p)
      takes.during = voiceThenHide

      // Act
      await sing(p, p.el('[data-sing="start"]'), steady(57, 3))

      // Assert
      expect(status(p)).toBe('Stopped listening: the microphone is off.')
      expect(shown(p, '[data-sing="start"]')).toBe(true)
      expect(ringSays(p)).toBe('Rest')
    })
  })

  it('rests beside Done for today once three Starts are abandoned as the microphone opens', async () => {
    // Arrange: Merc's siren heard to its end on a ring the frame loop draws
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const p = await load()
    const draw = await drawnRing(p)
    p.el('[data-comfort="sing"]').click()
    p.el('[data-panel="voice"] [data-voice="lower"]').click()
    await playMerc(p)
    draw(10)
    const heard = ringSays(p)
    takes.opening = hideTab

    // Act: Start three times, the tab hidden each time the microphone opens
    for (let i = 0; i < 3; i += 1)
      await sing(p, p.el('[data-sing="start"]'), steady(57, 3))

    // Assert
    expect(heard).toBe('Ready')
    expect(takes.opened).toBe(0)
    expect(onCard(p, '[data-take-actions] [data-sing="today"]')).toBe(true)
    expect(ringSays(p)).toBe('Rest')
  })

  it('ends Merc\'s siren on Rest after "Just listen today", with no take to be ready for', async () => {
    // Arrange: a listen-only visit, on a ring the frame loop draws
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const p = await load()
    const draw = await drawnRing(p)
    p.el('[data-comfort="listen"]').click()
    p.el('[data-panel="voice"] [data-voice="lower"]').click()

    // Act: Merc's siren from the listen-only card, run to its end
    await playMerc(p, '[data-listen-play]')
    draw(10)

    // Assert
    expect(shown(p, '[data-listen-play]')).toBe(true)
    expect(ringSays(p)).toBe('Rest')
  })

  it("ends Merc's siren on Rest once a refused microphone leaves the visit listening only", async () => {
    // Arrange: Merc's siren heard, then Start with no audio context to open
    // the microphone in, as the refused-microphone test reaches it: the
    // visit turns listen-only ('nomic')
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const p = await load()
    const draw = await drawnRing(p)
    p.el('[data-comfort="sing"]').click()
    p.el('[data-panel="voice"] [data-voice="lower"]').click()
    await playMerc(p)
    draw(10)
    vi.spyOn(p.Sound, 'context').mockReturnValue(null)
    p.el('[data-sing="start"]').click()
    await vi.advanceTimersByTimeAsync(100)

    // Act: Merc's siren again, from the listen-only card, run to its end
    await playMerc(p, '[data-listen-play]')
    draw(10)

    // Assert
    expect(shown(p, '[data-listen-why="nomic"]')).toBe(true)
    expect(ringSays(p)).toBe('Rest')
  })
})

// ============================================================
// Lesson 11 Sing it tests — the card, on the page's markup
// ============================================================
//
// WEB-SPEC, Tests 7 and 8, the parts the kit's pure flow cannot show
// (kit/siren-flow.test.ts holds every branch of the flow): the voice choice
// comes first when none is stored, and a stored one starts pressed; Start
// waits for Merc's slow siren, and with sound off stays unavailable with
// the sound-off hint; "Just listen today" shows no Start and picks the rest
// card; without Web Audio Sing it is listen-only with no Start; a refused
// microphone listens only and keeps the practice card. A take with voice
// draws the singer's line and nothing else, its summary "Your siren, drawn
// as a line.", and asks how it felt; an answer locks, and the next take
// frees the four; "Easy" closes on the plain line and offers Again once;
// "Effortful" ends the singing with Merc's siren still to play; and
// "Uncomfortable" takes the line away. A take with no voice asks nothing
// and offers a fresh start; a tab hidden while the microphone opens starts
// no take and lets it go. The microphone is asked for as `lesson-11`;
// storage holds nothing but `fyp-voice` and `fyp-l11-warmup`. The listener
// is a double: its takes are synthetic frames, fed to the page as the
// kit's listener feeds them.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
  /** The consumer id the microphone was asked for, each time. */
  asked: [] as string[],
  /** The options each take was opened with. */
  options: [] as ListenModule.TakeOptions[],
  opened: 0,
  released: 0,
  releasedNow: 0,
}))

vi.mock('@/features/lessons/kit/listen', async (importOriginal) => {
  const real = await importOriginal<typeof ListenModule>()
  return {
    ...real,
    listen: (id: string) => {
      takes.asked.push(id)
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
    // each frame reaches the page as the kit's listener hands it on, then
    // the take ends with them all
    takeFrames: (_: unknown, o: ListenModule.TakeOptions) => {
      takes.opened += 1
      takes.options.push(o)
      const at = takes.next.find((f) => f.f0 > 0)?.t ?? null
      for (const f of takes.next)
        o.onFrame?.({ ...f, rms: 0.1 }, at !== null && f.t >= at ? at : null)
      return Promise.resolve(takes.next)
    },
  }
})

/** The page's modules, loaded afresh: the voice choice reads storage as it loads. */
async function load() {
  vi.resetModules()
  const dom = await import('./page-dom.test-fixtures')
  const sing = await import('./sing')
  const comfort = await import('@/features/lessons/kit/comfort')
  const sound = await import('@/features/lessons/kit/sound')
  await import('@/features/lessons/kit/listen')
  dom.loadPage()
  const card = sing.initSing({ blue: 'blue.png', orange: 'orange.png' })
  return { ...dom, ...sing, ...comfort, ...sound, card }
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
  if (on) w.AudioContext = function AudioContext() {}
  else delete w.AudioContext
}

/** Every key in storage. */
const keys = (): string[] =>
  Array.from(
    { length: localStorage.length },
    (_, i) => localStorage.key(i) ?? '',
  )

/** The tab hidden, as switching to another tab hides it. */
function hideTab(): void {
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    get: () => true,
  })
  document.dispatchEvent(new Event('visibilitychange'))
}

beforeEach(() => {
  localStorage.clear()
  webAudio(true)
  takes.opening = null
  takes.asked = []
  takes.options = []
  takes.opened = 0
  takes.released = 0
  takes.releasedNow = 0
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  webAudio(false)
  Reflect.deleteProperty(document, 'hidden')
  document.body.textContent = ''
  localStorage.clear()
})

/** Merc's slow siren played to its end with the sound on, by the button in `from`. */
async function playMerc(
  p: Page,
  from = '[data-panel="prepare"]',
): Promise<void> {
  vi.spyOn(p.Sound, 'canPlay').mockReturnValue(true)
  vi.spyOn(p.Sound, 'state', 'get').mockReturnValue('on')
  p.el(`${from} [data-merc-siren]`).click()
  await vi.advanceTimersByTimeAsync(8700)
}

/** Start or Again pressed, a take of `frames` heard. */
async function sing(
  p: Page,
  button: HTMLElement,
  frames: F0Frame[],
): Promise<void> {
  takes.next = frames
  vi.spyOn(p.Sound, 'context').mockReturnValue({} as AudioContext)
  button.click()
  await vi.dynamicImportSettled()
  await vi.advanceTimersByTimeAsync(1000)
}

/** Comfortable, the lower voice, Merc's slow siren heard. */
async function briefed(): Promise<Page> {
  const p = await load()
  p.el('[data-comfort="sing"]').click()
  p.el('[data-panel="voice"] [data-voice="lower"]').click()
  await playMerc(p)
  return p
}

describe("Lesson 11's Sing it: before a take", () => {
  it('asks for the voice first when none is stored, then briefs, Start waiting for Merc', async () => {
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
    expect(p.el('[data-sing="start"]').getAttribute('aria-disabled')).toBe(
      'true',
    )
    expect(p.el('[data-start-hint]').textContent?.trim()).toBe(
      "Play Merc's slow siren first",
    )
    expect(status(p)).toBe(
      "Warm up if you like. Then play Merc's slow siren, and press Start.",
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

  it("readies Start once Merc's slow siren has sounded, drawn in its one gear with no seam", async () => {
    // Act
    const p = await briefed()

    // Assert
    expect(p.el('[data-sing="start"]').getAttribute('aria-disabled')).toBe(
      'false',
    )
    expect(p.el('[data-start-hint]').hidden).toBe(true)
    const s = p.card.live.chart.scene
    expect(s.seams).toEqual([])
    expect(s.lines).toHaveLength(1)
    expect(s.lines[0].points.every((pt) => pt.share === 1)).toBe(true)
    expect(p.el('#singChart canvas').getAttribute('aria-label')).toBe(
      "Merc's slow siren, from E 3 up to C sharp 4 and back",
    )
  })

  it('keeps Start unavailable after a play with the sound off, and says why', async () => {
    // Arrange
    const p = await load()
    p.el('[data-comfort="sing"]').click()
    p.el('[data-panel="voice"] [data-voice="lower"]').click()
    vi.spyOn(p.Sound, 'canPlay').mockReturnValue(false)
    vi.spyOn(p.Sound, 'state', 'get').mockReturnValue('off')

    // Act
    p.el('[data-panel="prepare"] [data-merc-siren]').click()
    await vi.advanceTimersByTimeAsync(8700)

    // Assert
    expect(p.el('[data-sing="start"]').getAttribute('aria-disabled')).toBe(
      'true',
    )
    expect(p.el('[data-start-hint]').textContent).toBe(
      "Sound is off, so nothing played. Turn sound on to hear Merc's slow siren, then press Start.",
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
    expect(onCard(p, '[data-listen-play]')).toBe(true)
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
    expect(p.VisitEnding.ending).toBe('practise')
  })

  it('listens only after a refused microphone, keeping the practice card', async () => {
    // Arrange
    const p = await briefed()
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

describe("Lesson 11's Sing it: the takes", () => {
  it('opens a take as lesson-11 with its timing: 6 s to start, 14 s at most, a second of quiet after two of voice', async () => {
    // Arrange
    const p = await briefed()

    // Act
    await sing(p, p.el('[data-sing="start"]'), steady(57, 3))

    // Assert
    expect(takes.asked).toEqual(['lesson-11'])
    expect(takes.options[0]).toMatchObject({
      wait: 6,
      run: 14,
      quiet: 1,
      quietAfter: 2,
    })
    expect(takes.released).toBe(1)
  })

  it('draws the singer’s line and nothing else, says so in words, and asks how it felt', async () => {
    // Arrange
    const p = await briefed()

    // Act: a voice that jumps two semitones mid-take, as a flip might
    await sing(p, p.el('[data-sing="start"]'), [
      ...steady(55, 2),
      ...steady(57, 2).map((f) => ({ ...f, t: f.t + 2.5 })),
    ])

    // Assert: no seam, label, band or mark beside the line
    const s = p.card.live.chart.scene
    expect(s.seams).toEqual([])
    expect(s.wash).toBeNull()
    expect(s.bands).toEqual([])
    expect(s.beads).toEqual([])
    expect(s.caption).toBeNull()
    expect(s.lines.map((l) => l.color)).toEqual(['#f59e0b', '#a78bfa'])
    expect(p.card.live.sung.every((pt) => pt.share === undefined)).toBe(true)
    expect(p.el('#singChart canvas').getAttribute('aria-label')).toBe(
      'Your siren, drawn as a line.',
    )
    expect(status(p)).toBe('Your siren, drawn as a line. How did that feel?')
    expect(shown(p, '[data-panel="feel"]')).toBe(true)
  })

  it('closes "Easy" on the plain line and offers Again once a visit', async () => {
    // Arrange
    const p = await briefed()

    // Act: a take, "Easy", Again, a second take, "Easy"
    await sing(p, p.el('[data-sing="start"]'), steady(57, 3))
    p.el('[data-feel="easy"]').click()
    const closing = shown(p, '[data-closing="plain"]')
    const again = shown(p, '[data-panel="after"] [data-sing="again"]')
    await sing(
      p,
      p.el('[data-panel="after"] [data-sing="again"]'),
      steady(57, 3),
    )
    p.el('[data-feel="easy"]').click()

    // Assert
    expect(closing).toBe(true)
    expect(again).toBe(true)
    expect(status(p)).toBe(
      "That's it: one slow siren, done. Flip or no flip, that's a whole siren.",
    )
    expect(shown(p, '[data-panel="after"] [data-sing="again"]')).toBe(false)
    expect(shown(p, '[data-panel="after"] [data-sing="today"]')).toBe(true)
    expect(p.VisitEnding.ending).toBe('practise')
  })

  it('locks an answer once given, and frees the four for the next take', async () => {
    // Arrange
    const p = await briefed()
    await sing(p, p.el('[data-sing="start"]'), steady(57, 3))

    // Act
    p.el('[data-feel="easy"]').click()
    p.el('[data-feel="uncomfortable"]').dispatchEvent(new MouseEvent('click'))
    const locked = [
      p.el<HTMLButtonElement>('[data-feel="workable"]').disabled,
      shown(p, '[data-closing="enough"]'),
    ]
    await sing(
      p,
      p.el('[data-panel="after"] [data-sing="again"]'),
      steady(57, 3),
    )

    // Assert
    expect(locked).toEqual([true, false])
    expect(p.el<HTMLButtonElement>('[data-feel="workable"]').disabled).toBe(
      false,
    )
  })

  it('ends the singing after "Effortful", Merc’s slow siren still to play, and picks the rest card', async () => {
    // Arrange
    const p = await briefed()
    await sing(p, p.el('[data-sing="start"]'), steady(57, 3))

    // Act
    p.el('[data-feel="effortful"]').click()

    // Assert
    expect(shown(p, '[data-closing="gentle"]')).toBe(true)
    expect(onCard(p, '[data-panel="after"] [data-sing="again"]')).toBe(false)
    expect(onCard(p, '[data-sing="start"]')).toBe(false)
    expect(onCard(p, '[data-listen-play] [data-merc-siren]')).toBe(true)
    expect(p.VisitEnding.ending).toBe('rest')
  })

  it('takes the line away after "Uncomfortable", with the doctor lines and the rest card', async () => {
    // Arrange
    const p = await briefed()
    await sing(p, p.el('[data-sing="start"]'), steady(57, 3))

    // Act
    p.el('[data-feel="uncomfortable"]').click()

    // Assert
    expect(shown(p, '[data-closing="enough"]')).toBe(true)
    expect(shown(p, '[data-after-doctor]')).toBe(true)
    expect(p.card.live.sung).toEqual([])
    expect(p.card.live.chart.scene.lines).toHaveLength(1)
    expect(p.VisitEnding.ending).toBe('rest')
  })

  it('keeps the question, its answer and the closing line after Done for today, with no take on offer', async () => {
    // Arrange
    const p = await briefed()
    await sing(p, p.el('[data-sing="start"]'), steady(57, 3))
    p.el('[data-feel="easy"]').click()

    // Act
    p.el('[data-panel="after"] [data-sing="today"]').click()

    // Assert
    expect(onCard(p, '[data-panel="feel"]')).toBe(true)
    expect(p.el('[data-feel="easy"]').getAttribute('aria-pressed')).toBe('true')
    expect(onCard(p, '[data-closing="plain"]')).toBe(true)
    for (const sel of [
      '[data-sing="start"]',
      '[data-panel="after"] [data-sing="again"]',
      '[data-panel="after"] [data-sing="today"]',
      '[data-take-actions] [data-sing="again"]',
    ])
      expect(onCard(p, sel), sel).toBe(false)
    expect(status(p)).toBe('Done for today.')
  })

  it('asks nothing after a take with no voice, and offers a fresh start', async () => {
    // Arrange
    const p = await briefed()

    // Act
    await sing(p, p.el('[data-sing="start"]'), steady(57, 0))

    // Assert
    expect(status(p)).toBe(
      'We didn’t hear you start that time. Hum “ng” as the ring turns.',
    )
    expect(onCard(p, '[data-take-actions] .no-voice-line')).toBe(true)
    expect(shown(p, '[data-panel="feel"]')).toBe(false)
    expect(onCard(p, '[data-take-actions] [data-sing="again"]')).toBe(true)
    expect(onCard(p, '[data-take-actions] [data-sing="today"]')).toBe(true)
  })

  it('starts no take when the tab is hidden while the microphone opens, lets it go, and offers Start again', async () => {
    // Arrange
    const p = await briefed()
    takes.opening = hideTab

    // Act
    await sing(p, p.el('[data-sing="start"]'), steady(57, 3))

    // Assert
    expect(takes.opened).toBe(0)
    expect(takes.releasedNow).toBe(1)
    expect(status(p)).toBe('Stopped listening: the microphone is off.')
    expect(shown(p, '[data-sing="start"]')).toBe(true)
  })

  it('stores nothing but the voice and the warm-up’s Skip, and names no flip, gear or switch after a take', async () => {
    // Arrange
    const p = await load()
    p.el('[data-comfort="sing"]').click()
    p.el('[data-panel="voice"] [data-voice="lower"]').click()
    p.el('[data-warm="skip"]').click()
    await playMerc(p)

    // Act: a whole visit
    await sing(p, p.el('[data-sing="start"]'), steady(57, 3))
    const after = [
      status(p),
      p.el('#singChart canvas').getAttribute('aria-label') ?? '',
    ]
    p.el('[data-feel="workable"]').click()
    p.el('[data-panel="after"] [data-sing="today"]').click()

    // Assert
    expect(keys().sort()).toEqual(['fyp-l11-warmup', 'fyp-voice'])
    expect(status(p)).toBe('Done for today.')
    for (const line of after)
      expect(line).not.toMatch(/flip|gear|switch|break|register/i)
  })
})

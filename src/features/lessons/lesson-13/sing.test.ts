// ============================================================
// Lesson 13 Sing it tests — every state, on the page's own markup
// ============================================================
//
// WEB-SPEC, Toys 6 and Tests 6 and 7, with the microphone and the hold run
// doubled (a hold resolves with the reading the test gives it) and the
// kit's runs recorded: with no stored voice the voice choice comes before
// either path, and a stored voice starts pressed with its own line; "Just
// listen today" shows no Start and picks the rest card; without Web Audio,
// Sing it is listen-only with no Start; Lower and Higher move the note a
// semitone a tap, four at most, each playing Merc's ‘ah’ for 1.0 s; a take
// with no voice asks no feeling and offers Again; "Easy" and "Workable"
// offer Again while takes remain, Merc celebrating at most once a visit,
// from 80 % in the band; the tricky line under half; "Effortful" keeps the
// reading and "Uncomfortable" takes it away, both ending the singing for
// the visit and picking the rest card; a demonstration cut short counts as
// no take, and a take abandoned once open counts; never a fourth take; the
// names row follows the frames' clock, ‘ee’ from the take's opening; the
// strip is dark while the take is open; nothing is stored but `fyp-voice`
// and `fyp-l13-warmup`.

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi, } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { VisitEnding } from '@/features/lessons/kit/comfort'
import type * as HoldRun from '@/features/lessons/kit/hold-run'
import type { HoldContext } from '@/features/lessons/kit/hold-run'
import type { HoldReading } from '@/features/lessons/kit/hold-take'
import type * as MercDuo from '@/features/lessons/kit/merc-duo'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { Sound } from '@/features/lessons/kit/sound'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import { el, loadPage, settle, soundOn } from './page-dom.test-fixtures'
import { cueAt, initSing, MAX_MOVE, STATUS, WARMUP_KEY } from './sing'
import { VOICE_LINE } from './sing-view'

const duo = vi.hoisted(() => ({ sing: vi.fn(), celebrate: vi.fn() }))
/** The doubled microphone and hold run: whether the microphone opens, and each hold's context. */
const fake = vi.hoisted(() => ({
  micOk: true,
  holds: [] as {
    readonly c: HoldContext
    resolve(r: HoldReading | null): void
  }[],
}))

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))

vi.mock('@/features/lessons/kit/merc-duo', async (actual) => ({
  ...(await actual<typeof MercDuo>()),
  mercSing: duo.sing,
  mercCelebrate: duo.celebrate,
}))

vi.mock('@/features/lessons/kit/mic-hold', () => ({
  MicHold: class {
    mod: object | null = null
    listener: object | null = null
    async open(): Promise<boolean> {
      if (!fake.micOk) return false
      this.mod = {}
      this.listener = { holding: true }
      return true
    }
    release(): void {
      this.listener = null
    }
  },
}))

vi.mock('@/features/lessons/kit/hold-run', async (actual) => ({
  ...(await actual<typeof HoldRun>()),
  holdOne: (c: HoldContext) =>
    new Promise<HoldReading | null>((resolve) => {
      fake.holds.push({ c, resolve })
    }),
}))

const STILLS = { blue: '/blue.png', orange: '/orange.png' }

/** No voice chosen, as on a first visit: the kit keeps its voice for the module's life, and offers no way back to none. */
function noVoice(): void {
  localStorage.clear()
  VoiceChoice.set(null as unknown as Voice)
  localStorage.clear()
}

/** The browser's Web Audio, there or not: jsdom has none, and the page asks before it offers to sing. */
function webAudio(on: boolean): void {
  if (on)
    Object.defineProperty(window, 'AudioContext', {
      // a constructor is all the page asks for: Sound's own clock is doubled
      value: function AudioContext(): void {
        // never built: the page only asks whether it is there
      },
      configurable: true,
      writable: true,
    })
  else Reflect.deleteProperty(window, 'AudioContext')
}

/** A reading of `share` of the ten seconds in the band, or one with no voice. */
function reading(share: number | 'silent'): HoldReading {
  const silent = share === 'silent'
  const s = silent ? 0 : share
  return {
    kind: silent ? 'silent' : 'read',
    length: 10,
    inBand: s * 10,
    of: 10,
    stoppedAt: null,
    settled: silent ? null : 0.5,
    d: silent ? null : 4,
    octaves: 0,
    share: s,
    line: silent
      ? "We didn't hear you start that time. Breathe in, then sing as the ring turns."
      : `In the band for ${s * 10} of the 10 seconds.`,
    octaveLine: null,
  }
}

const status = (): string => el('#singStatus').textContent ?? ''
const btn = (selector: string): HTMLButtonElement =>
  el<HTMLButtonElement>(`#singCard ${selector}`)
/** Whether the element `selector` finds shows: neither it nor a panel round it hidden. */
const showing = (selector: string): boolean => {
  const found = Array.from(
    document.querySelectorAll<HTMLElement>(`#singCard ${selector}`),
  )
  return found.some((e) => e.closest('[hidden]') === null)
}
const panels = (): string[] =>
  Array.from(
    document.querySelectorAll<HTMLElement>('#singCard [data-panel]'),
    (p) => (p.hidden ? '' : (p.dataset.panel ?? '')),
  ).filter((p) => p !== '')
const lit = (): string | null =>
  document.querySelector<HTMLElement>('#singLive [data-names] [aria-current]')
    ?.dataset.name ?? null

/** Comfortable, the stored voice, and Start pressed: the hold's context, Merc's demonstration not yet played. */
async function start(): Promise<HoldContext> {
  btn('[data-comfort="sing"]').click()
  if (VoiceChoice.voice === null) btn('[data-voice="lower"]').click()
  const before = fake.holds.length
  btn('[data-sing="start"]').click()
  return (await nextHold(before)).c
}

/** The hold after the `before`th, once Start or Again has loaded the reader and opened the microphone. */
async function nextHold(before: number): Promise<(typeof fake.holds)[number]> {
  await vi.waitFor(() => {
    if (fake.holds.length <= before) throw new Error('no hold yet')
  })
  const hold = fake.holds.at(-1)
  if (hold === undefined) throw new Error('no hold')
  return hold
}

/** A take that runs: the demonstration heard to its end, then the reading. */
async function takeWith(r: HoldReading | null, again = false): Promise<void> {
  if (again) {
    const shown = Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        '#singCard [data-sing="again"], #singCard [data-sing="start"]',
      ),
    ).find((b) => b.closest('[hidden]') === null)
    if (shown === undefined) throw new Error('no Again')
    const before = fake.holds.length
    shown.click()
    await nextHold(before)
  } else await start()
  const hold = fake.holds.at(-1)
  if (hold === undefined) throw new Error('no hold')
  const demo = hold.c.listen.play(true)
  runs.at(-1)?.end(true)
  await demo
  hold.resolve(r)
  await settle()
}

const feel = (f: string): void => btn(`[data-feel="${f}"]`).click()

// Start loads the hold reader on a visit's first take (sing.ts `openMic`).
// It is loaded here first, so no test's wait for a hold spans a cold load of
// it: on a cold cache that load once took 1.2 s, past the wait's one second.
beforeAll(async () => {
  await import('@/features/lessons/kit/hold-take')
})

beforeEach(() => {
  localStorage.clear()
  VoiceChoice.set('lower')
  VisitEnding.set('practise')
  fake.micOk = true
  fake.holds.length = 0
  resetRuns()
  webAudio(true)
  soundOn()
  // the page's one clock, as a tap makes it; the microphone double never reads it
  vi.spyOn(Sound, 'context').mockReturnValue({} as AudioContext)
  loadPage()
  Element.prototype.scrollIntoView = () => undefined
})

afterEach(async () => {
  NowPlaying.claim(() => undefined)
  await settle()
  webAudio(false)
  vi.restoreAllMocks()
  duo.sing.mockReset()
  duo.celebrate.mockReset()
  document.body.textContent = ''
})

describe('before the hold (WEB-SPEC, Toys 6, states 1 to 6)', () => {
  it('asks the comfort check first, and with no stored voice the voice choice comes before either path, its first line', () => {
    // Arrange
    localStorage.clear()
    noVoice()
    initSing(STILLS)
    const first = panels()

    // Act
    btn('[data-comfort="listen"]').click()

    // Assert
    expect(first).toEqual(['comfort'])
    expect(panels()).toEqual(['voice', 'listen'])
    expect(el('#singLive').hidden).toBe(true)
    expect(el('[data-voice-line]').textContent).toBe(VOICE_LINE.none)
    expect(showing('[data-listen-play]')).toBe(false)
  })

  it('shows a stored voice pressed, with the line for it, and lets it change', () => {
    // Arrange
    initSing(STILLS)

    // Act
    btn('[data-comfort="sing"]').click()
    const lowerPressed = btn('[data-voice="lower"]').getAttribute(
      'aria-pressed',
    )
    btn('[data-voice="higher"]').click()

    // Assert
    expect(lowerPressed).toBe('true')
    expect(VoiceChoice.voice).toBe('higher')
    expect(el('[data-voice-line]').textContent).toBe(VOICE_LINE.stored)
  })

  it('listens only after "Just listen today": no Start, the rest card, and Play Merc\'s ten seconds sings the five vowels on A3', async () => {
    // Arrange
    initSing(STILLS)

    // Act
    btn('[data-comfort="listen"]').click()
    btn('[data-listen-play]').click()

    // Assert
    expect(showing('[data-sing="start"]')).toBe(false)
    expect(VisitEnding.ending).toBe('rest')
    expect(status()).toBe(
      'Merc sings ‘ee’, ‘eh’, ‘ah’, ‘oh’ and ‘oo’ on A 3, two seconds each.',
    )
    expect(runs[0].points[0]?.hz).toBe(220)
    expect(runs[0].points.at(-1)?.t).toBe(10)
    expect(fake.holds).toHaveLength(0)
  })

  it('offers only listening without Web Audio: no Start, and the line says why', () => {
    // Arrange
    webAudio(false)
    initSing(STILLS)

    // Act
    btn('[data-comfort="sing"]').click()

    // Assert
    expect(panels()).toEqual(['voice', 'listen'])
    expect(showing('[data-sing="start"]')).toBe(false)
    expect(status()).toBe(`${STATUS.nomic} ${STATUS.noAudio}`)
  })

  it("moves the note a semitone a tap, four at most either way, each tap Merc's ‘ah’ for 1.0 s", () => {
    // Arrange
    initSing(STILLS)
    btn('[data-comfort="sing"]').click()

    // Act
    btn('[data-note="higher"]').click()
    const one = status()
    for (let i = 0; i < 6; i++)
      if (showing('[data-note="higher"]')) btn('[data-note="higher"]').click()

    // Assert
    expect(one).toBe('Your note: A sharp 3')
    expect(status()).toBe('Your note: C sharp 4')
    expect(runs).toHaveLength(MAX_MOVE)
    expect(runs.map((r) => r.points.at(-1)?.t)).toEqual([1, 1, 1, 1])
    expect(showing('[data-note="higher"]')).toBe(false)
    expect(showing('[data-note="lower"]')).toBe(true)
  })

  it('folds the warm-up once Skip is pressed, and stores nothing but the voice and the Skip, whatever a visit does', async () => {
    // Arrange
    localStorage.clear()
    noVoice()
    initSing(STILLS)
    btn('[data-comfort="sing"]').click()
    btn('[data-voice="higher"]').click()

    // Act
    btn('[data-warm="skip"]').click()
    btn('[data-note="lower"]').click()
    await takeWith(reading(0.9), true)
    feel('easy')

    // Assert
    expect(el<HTMLDetailsElement>('#warmup').open).toBe(false)
    expect(localStorage.getItem(WARMUP_KEY)).toBe('true')
    const keys = Array.from({ length: localStorage.length }, (_, k) =>
      localStorage.key(k),
    )
    expect(keys.sort()).toEqual(['fyp-l13-warmup', 'fyp-voice'])
  })
})

describe('the hold (states 7 and 8)', () => {
  it("plays Merc's five vowels as its Listen phase, ten seconds on the ring, then the strip goes dark", async () => {
    // Arrange
    const view = initSing(STILLS)
    const c = await start()

    // Act
    const demo = c.listen.play(true)
    const during = el('#singLive').hidden
    const lighted = view.chart.scene.spectrum?.columns.length
    runs[0].end(true)
    const heard = await demo

    // Assert
    expect([c.length, c.listen.sec, c.midi]).toEqual([10, 10, 57])
    expect(heard).toBe(true)
    expect(during).toBe(false)
    expect(runs[0].points.at(-1)?.t).toBe(10)
    expect(lighted).toBeGreaterThan(0)
    expect(view.chart.scene.spectrum?.columns).toEqual([])
  })

  it('lights ‘ee’ as the take opens, then each vowel 2 s apart on the frames’ clock, a pace and never a check', () => {
    // Act / Assert
    expect([0, 1.99, 2, 4.01, 6, 8, 9.9, 12].map(cueAt)).toEqual([
      'ee',
      'ee',
      'eh',
      'ah',
      'oh',
      'oo',
      'oo',
      'oo',
    ])
  })

  it('follows the frames with the names row once the voice comes, and clears it when the take ends', async () => {
    // Arrange
    initSing(STILLS)
    const c = await start()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })

    // Act
    c.onPhase('breathe')
    vi.advanceTimersByTime(400)
    const opened = lit()
    c.onSung?.(4.2)
    const later = lit()
    fake.holds[0].resolve(reading(0.9))
    await settle()
    vi.useRealTimers()

    // Assert
    expect([opened, later, lit()]).toEqual(['ee', 'ah', null])
  })

  it('asks no feeling after a take with no voice, and offers Again and Done for today', async () => {
    // Arrange
    initSing(STILLS)

    // Act
    await takeWith(reading('silent'))

    // Assert
    expect(panels()).toEqual([])
    expect(showing('[data-take-actions] [data-sing="again"]')).toBe(true)
    expect(showing('[data-take-actions] [data-sing="today"]')).toBe(true)
    expect(status()).toMatch(
      /^One hold: ten seconds\. We didn't hear you start/,
    )
  })

  it('counts a demonstration cut short as no take, and brings Start back', async () => {
    // Arrange
    initSing(STILLS)
    const c = await start()

    // Act: another sound takes the page's one sound mid-demonstration
    const demo = c.listen.play(true)
    NowPlaying.claim(() => undefined)
    const heard = await demo
    fake.holds[0].resolve(null)
    await settle()
    for (let i = 0; i < 3; i++) await takeWith(reading('silent'), i > 0)

    // Assert
    expect(heard).toBe(false)
    expect(fake.holds).toHaveLength(4)
    expect(showing('[data-sing="again"]')).toBe(false)
  })

  it('counts a take abandoned once open, and brings Start back while takes remain', async () => {
    // Arrange
    initSing(STILLS)

    // Act
    await takeWith(null)

    // Assert
    expect(panels()).toEqual(['voice', 'prepare'])
    expect(status()).toBe(STATUS.stopped)
    await takeWith(reading('silent'), true)
    await takeWith(reading('silent'), true)
    expect(fake.holds).toHaveLength(3)
    expect(showing('[data-sing="again"]')).toBe(false)
  })

  it('stops at the microphone refused: listening only, with the no-microphone line, and the practice card kept', async () => {
    // Arrange
    fake.micOk = false
    initSing(STILLS)

    // Act
    btn('[data-comfort="sing"]').click()
    btn('[data-sing="start"]').click()
    await vi.waitFor(() => {
      if (status() !== STATUS.nomic) throw new Error('still asking')
    })

    // Assert
    expect(panels()).toEqual(['voice', 'listen'])
    expect(status()).toBe(STATUS.nomic)
    expect(VisitEnding.ending).toBe('practise')
    expect(showing('[data-listen-play]')).toBe(true)
  })
})

describe('after the hold (states 9 and 10)', () => {
  it('offers Again and Done for today after Easy and after Workable, and Merc celebrates once a visit, from 80 % in the band', async () => {
    // Arrange
    initSing(STILLS)

    // Act
    await takeWith(reading(0.9))
    feel('easy')
    const first = { again: showing('[data-panel="after"] [data-sing="again"]') }
    await takeWith(reading(0.9), true)
    feel('workable')

    // Assert
    expect(first.again).toBe(true)
    expect(status()).toBe(STATUS.rest)
    expect(duo.celebrate).toHaveBeenCalledTimes(1)
    expect(VisitEnding.ending).toBe('practise')
  })

  it('adds the tricky line under half in the band, and no celebration', async () => {
    // Arrange
    initSing(STILLS)

    // Act
    await takeWith(reading(0.4))
    feel('easy')

    // Assert
    expect(showing('[data-tricky]')).toBe(true)
    expect(duo.celebrate).not.toHaveBeenCalled()
  })

  it("keeps the reading after Effortful, offers only Done for today and Play Merc's ten seconds, and picks the rest card", async () => {
    // Arrange
    initSing(STILLS)

    // Act
    await takeWith(reading(0.9))
    feel('effortful')

    // Assert
    expect(showing('[data-reading]')).toBe(true)
    expect(showing('[data-sing="again"]')).toBe(false)
    expect(showing('[data-panel="after"] [data-sing="today"]')).toBe(true)
    expect(showing('[data-listen-play]')).toBe(true)
    expect(VisitEnding.ending).toBe('rest')
    expect(status()).toBe(STATUS.gentle)
    expect(duo.celebrate).not.toHaveBeenCalled()
  })

  it('takes the reading away after Uncomfortable, with the doctor lines, no button but none, and the rest card', async () => {
    // Arrange
    initSing(STILLS)

    // Act
    await takeWith(reading(0.9))
    feel('uncomfortable')

    // Assert
    expect(el('#singLive').hidden).toBe(true)
    expect(showing('[data-after-doctor]')).toBe(true)
    expect(showing('[data-sing="again"]')).toBe(false)
    expect(showing('[data-sing="today"]')).toBe(false)
    expect(VisitEnding.ending).toBe('rest')
  })

  it('locks the feelings once answered and frees them only for the next take', async () => {
    // Arrange
    initSing(STILLS)
    await takeWith(reading(0.9))

    // Act
    feel('easy')
    const locked = btn('[data-feel="workable"]').disabled
    await takeWith(reading(0.9), true)

    // Assert
    expect(locked).toBe(true)
    expect(btn('[data-feel="workable"]').disabled).toBe(false)
  })

  it('never reaches a fourth take: Again goes after the third, Done for today stays', async () => {
    // Arrange
    initSing(STILLS)

    // Act
    await takeWith(reading(0.9))
    feel('easy')
    await takeWith(reading(0.9), true)
    feel('easy')
    await takeWith(reading(0.9), true)
    feel('workable')

    // a press the page never offers, as a script might make it
    btn('[data-panel="after"] [data-sing="again"]').click()
    await settle()

    // Assert
    expect(fake.holds).toHaveLength(3)
    expect(showing('[data-sing="again"]')).toBe(false)
    expect(showing('[data-panel="after"] [data-sing="today"]')).toBe(true)
  })

  it('ends the checkpoint with Done for today, leaving the card the answers set', async () => {
    // Arrange
    initSing(STILLS)
    await takeWith(reading(0.9))
    feel('easy')

    // Act
    btn('[data-panel="after"] [data-sing="today"]').click()

    // Assert
    expect(status()).toBe(STATUS.done)
    expect(showing('[data-sing="again"]')).toBe(false)
    expect(VisitEnding.ending).toBe('practise')
  })
})

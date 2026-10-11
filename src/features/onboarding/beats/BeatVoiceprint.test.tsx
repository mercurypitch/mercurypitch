// ============================================================
// The voiceprint: one run, one counter (owner decision V7)
// ============================================================
//
// Four steps counted in one place. The briefs between steps used to say
// "That was 1 of 3" under an eyebrow that said "Step 1 of 4", so these
// tests drive the whole script, from the first "I'm ready" to the result,
// and read every screen it shows on the way.
//
// The microphone is faked at the session seam: each take hands back a
// scripted pitch trace (a glide up, a glide down, a held note, then the
// five match takes). The script, its timers and its counters run for
// real; the two canvases are stubbed because jsdom cannot draw.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import type { OpenResult, ProbeResult, VoiceSession } from '@/lib/voice-session'

const takes = vi.hoisted(() => ({
  /** Hands back the next take's frames; reset per test. */
  next: (): PitchFrame[] => [],
  /**
   * Off: a take hands back its frames at once, so the counter tests run
   * fast. On: a take lasts as long as it asks for, so its screen shows
   * and a sound started under it is caught.
   */
  realTime: false,
}))

/**
 * Every sound the beat makes, faked at the synthesizers: each one logs
 * what it is and when, counts itself while it sounds, and ends after its
 * length unless it is stopped first. `context` is null by default, so the
 * counter tests run silent as they always did.
 */
const audio = vi.hoisted(() => {
  const state = {
    context: null as unknown,
    log: [] as { kind: 'tone' | 'sweep' | 'hold'; midi: number | null }[],
    active: 0,
    maxActive: 0,
    /** The most sounds playing at any moment a take was recording. */
    activeDuringTake: 0,
    recording: false,
    /** Sounds still sounding each time the session was closed. */
    closedOver: [] as number[],
    sound(kind: 'tone' | 'sweep' | 'hold', midi: number | null, sec: number) {
      state.log.push({ kind, midi })
      state.active += 1
      state.maxActive = Math.max(state.maxActive, state.active)
      if (state.recording) {
        state.activeDuringTake = Math.max(state.activeDuringTake, state.active)
      }
      let over = false
      let finish = (): void => {}
      const done = new Promise<void>((resolve) => {
        finish = resolve
      })
      const end = (): void => {
        if (over) return
        over = true
        state.active -= 1
        finish()
      }
      setTimeout(end, sec * 1000)
      return { stop: end, done }
    },
    reset(): void {
      state.context = null
      state.log = []
      state.active = 0
      state.maxActive = 0
      state.activeDuringTake = 0
      state.recording = false
      state.closedOver = []
    },
  }
  return state
})

vi.mock('@/lib/reference-tone', () => ({
  startReferenceTone: (_ctx: unknown, midi: number, sec = 1) =>
    audio.sound('tone', midi, sec),
  playReferenceTone: (_ctx: unknown, midi: number, sec = 1) =>
    audio.sound('tone', midi, sec).done,
}))

// The demo cues' synthesizers hand back a handle that can only be stopped,
// as the real ones do.
vi.mock('@/lib/demo-audio', () => ({
  playSirenSweep: (_ctx: unknown, opts: { seconds?: number } = {}) => ({
    stop: audio.sound('sweep', null, opts.seconds ?? 2.2).stop,
  }),
  playHoldTone: (_ctx: unknown, _hz: number, sec = 1.6) => ({
    stop: audio.sound('hold', null, sec).stop,
  }),
}))

vi.mock('@/lib/voice-session', () => ({
  createVoiceSession: (): VoiceSession =>
    ({
      open: (): Promise<OpenResult> =>
        Promise.resolve({ ok: true } as OpenResult),
      probe: (): Promise<ProbeResult> => Promise.resolve('ok' as ProbeResult),
      arm: (): void => {},
      record: (seconds: number): Promise<PitchFrame[]> => {
        audio.activeDuringTake = Math.max(audio.activeDuringTake, audio.active)
        const frames = takes.next()
        if (!takes.realTime) return Promise.resolve(frames)
        audio.recording = true
        return new Promise((resolve) => {
          setTimeout(() => {
            audio.recording = false
            resolve(frames)
          }, seconds * 1000)
        })
      },
      latest: () => null,
      latestSmoothed: () => null,
      level: (): number => 0,
      // Null unless a test hands one over: then the beat's sounds play.
      context: () => audio.context as AudioContext | null,
      isOpen: (): boolean => true,
      devices: (): Promise<MediaDeviceInfo[]> => Promise.resolve([]),
      useDevice: (): Promise<ProbeResult> =>
        Promise.resolve('ok' as ProbeResult),
      close: (): void => {
        audio.closedOver.push(audio.active)
      },
    }) as unknown as VoiceSession,
}))

vi.mock('@/features/mirror/TaskDemo', () => ({ TaskDemo: () => null }))
vi.mock('@/features/mirror/LiveViz', () => ({ LiveViz: () => null }))

import { BeatVoiceprint } from './BeatVoiceprint'

const HOP = 0.016

/** An even slide between two pitches, the way a singer glides. */
function glide(fromHz: number, toHz: number, seconds = 8): PitchFrame[] {
  const n = Math.round(seconds / HOP)
  return Array.from({ length: n }, (_, i) => ({
    t: i * HOP,
    f0: fromHz * (toHz / fromHz) ** (i / (n - 1)),
    conf: 0.95,
    rms: 0.2,
  }))
}

function held(hz: number, seconds: number): PitchFrame[] {
  return Array.from({ length: Math.round(seconds / HOP) }, (_, i) => ({
    t: i * HOP,
    f0: hz,
    conf: 0.95,
    rms: 0.2,
  }))
}

/** A singer we can hear: two octaves of glide, then steady notes. */
function audibleSinger(): () => PitchFrame[] {
  const script = [glide(110, 440), glide(440, 110), held(220, 6)]
  return () => script.shift() ?? held(220, 3)
}

const counter = (): string =>
  document.querySelector('[data-step-counter]')?.textContent ?? ''

const readyButton = (): HTMLElement | null =>
  screen.queryByRole('button', { name: "I'm ready" })

interface Run {
  /** The counter on each task's first screen, in order. */
  intros: string[]
  /** Every screen's text, sampled every 250 ms of script time. */
  screens: string[]
  onComplete: ReturnType<typeof vi.fn>
}

/**
 * Render the beat and answer every "I'm ready" until the script hands
 * back its result, sampling the screen as the timers run.
 */
async function runThrough(): Promise<Run> {
  const onComplete = vi.fn()
  render(() => <BeatVoiceprint onComplete={onComplete} onDenied={() => {}} />)
  const intros: string[] = []
  const screens: string[] = []
  for (
    let tick = 0;
    tick < 1000 && onComplete.mock.calls.length === 0;
    tick++
  ) {
    screens.push(document.body.textContent ?? '')
    const ready = readyButton()
    if (ready !== null) {
      intros.push(counter())
      fireEvent.click(ready)
    }
    await vi.advanceTimersByTimeAsync(250)
  }
  return { intros, screens, onComplete }
}

describe('the voiceprint counter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    takes.next = audibleSinger()
    audio.reset()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    takes.realTime = false
  })

  it('says the step and the whole run time on its first screen', async () => {
    // Arrange
    render(() => <BeatVoiceprint onComplete={() => {}} onDenied={() => {}} />)

    // Act
    await vi.advanceTimersByTimeAsync(0)

    // Assert
    expect(readyButton()).not.toBeNull()
    expect(counter()).toBe('Step 1 of 4 · about 90 seconds')
    const segments = document.querySelectorAll(
      '[data-beat="voiceprint"] li[data-state]',
    )
    expect([...segments].map((s) => s.getAttribute('data-state'))).toEqual([
      'current',
      'ahead',
      'ahead',
      'ahead',
    ])
  })

  it('moves one counter through all four steps, and never counts out of three', async () => {
    const run = await runThrough()

    expect(run.onComplete).toHaveBeenCalledOnce()
    expect(run.intros).toEqual([
      'Step 1 of 4 · about 90 seconds',
      'Step 2 of 4 · Glide down',
      'Step 3 of 4 · Hold',
      'Step 4 of 4 · Match',
    ])
    const outOfThree = run.screens.filter((text) => /\bof 3\b/.test(text))
    expect(outOfThree).toEqual([])
  })

  it('counts the five-note match as it goes, then puts the count away', async () => {
    const run = await runThrough()

    const firstSeen = [1, 2, 3, 4, 5].map((n) =>
      run.screens.findIndex((text) => text.includes(`Note ${n} of 5`)),
    )
    expect(firstSeen.every((index) => index >= 0)).toBe(true)
    expect([...firstSeen].sort((a, b) => a - b)).toEqual(firstSeen)
    expect(document.querySelector('[data-match-progress]')).toBeNull()
  })

  it('says it could not hear the slides, and counts the match as skipped, when the glides heard nothing', async () => {
    // Arrange: silence for every take, so there is no range to pitch
    // the five notes against.
    takes.next = () => []

    // Act
    const run = await runThrough()

    // Assert: the run ends after the hold, and the brief says why the
    // five notes the Fork promised are not coming. It used to say "That
    // is everything we need", one screen before the twin said it could
    // not read a range.
    expect(run.onComplete).toHaveBeenCalledOnce()
    expect(run.intros).toEqual([
      'Step 1 of 4 · about 90 seconds',
      'Step 2 of 4 · Glide down',
      'Step 3 of 4 · Hold',
    ])
    const brief = run.screens.find((t) =>
      t.includes("We couldn't hear your slides"),
    )
    expect(brief).toContain(
      "The five notes are pitched from your range, so we'll skip them this time.",
    )
    expect(brief).toContain('Step 4 of 4 · Match skipped')
    expect(run.screens.some((t) => t.includes('everything we need'))).toBe(
      false,
    )
    expect(run.screens.some((t) => t.includes('Note 1 of 5'))).toBe(false)

    // The counter does not wait on the hold while the result is read.
    expect(document.body).toHaveTextContent('Reading your voice…')
    expect(counter()).toBe('Step 4 of 4 · Match skipped')
    const segments = document.querySelectorAll(
      '[data-beat="voiceprint"] li[data-state]',
    )
    expect([...segments].map((s) => s.getAttribute('data-state'))).toEqual([
      'done',
      'done',
      'done',
      'skipped',
    ])
  })

  it('still says "Last one" and counts the match after a hold it can follow', async () => {
    const run = await runThrough()

    expect(
      run.screens.some((t) => t.includes('Last one: match five notes.')),
    ).toBe(true)
    expect(run.screens.some((t) => t.includes('skipped'))).toBe(false)
  })

  it('keeps the em dash off every screen of the run', async () => {
    // Takes that last, so the recording screen and its hint show.
    takes.realTime = true

    const run = await runThrough()

    expect(run.screens.some((t) => t.includes('Recording'))).toBe(true)
    expect(run.screens.filter((t) => t.includes('—'))).toEqual([])
  })
})

// ── One sound at a time (owner testing, iPhone, 11 Oct 2026) ──────────
//
// A note played on arrival at the hold, and "Hear a note" played a
// different note over it. Now both are the singer's own mid-range note,
// the button waits for any sound to finish, and no two sounds overlap
// anywhere in the run.

const hearButton = (): HTMLButtonElement | null =>
  screen.queryByRole('button', { name: /^(Hear a note|Playing)/ })

/** Answer every gate until the hold task's intro is on screen. */
async function untilHoldIntro(): Promise<void> {
  render(() => <BeatVoiceprint onComplete={() => {}} onDenied={() => {}} />)
  for (let tick = 0; tick < 400; tick++) {
    if (counter().startsWith('Step 3 of 4') && readyButton() !== null) return
    const ready = readyButton()
    if (ready !== null) fireEvent.click(ready)
    await vi.advanceTimersByTimeAsync(250)
  }
  throw new Error('the run never reached the hold')
}

describe('the voiceprint plays one sound at a time', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    takes.next = audibleSinger()
    takes.realTime = true
    audio.reset()
    audio.context = { state: 'running' }
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    takes.realTime = false
    audio.reset()
  })

  it('plays the middle of the singer\'s glides on arrival at the hold, and "Hear a note" plays that same note', async () => {
    // Arrange: glides from A2 to A4, so the middle of the range is A3.
    await untilHoldIntro()
    const arrival = audio.log.at(-1)
    await vi.advanceTimersByTimeAsync(5000)

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Hear a note (A3)' }))

    // Assert
    expect(arrival).toEqual({ kind: 'tone', midi: 57 })
    expect(audio.log.at(-1)).toEqual({ kind: 'tone', midi: 57 })
    expect(audio.maxActive).toBe(1)
  })

  it('keeps "Hear a note" disabled while the arrival note plays, and frees it once the note ends', async () => {
    // Arrange
    await untilHoldIntro()
    const during = hearButton()?.disabled

    // Act
    await vi.advanceTimersByTimeAsync(5000)

    // Assert
    expect(during).toBe(true)
    expect(hearButton()?.disabled).toBe(false)
    expect(hearButton()?.textContent).toBe('Hear a note (A3)')
  })

  it('disables "Hear a note" again while its own note plays', async () => {
    // Arrange
    await untilHoldIntro()
    await vi.advanceTimersByTimeAsync(5000)

    // Act
    fireEvent.click(hearButton() as HTMLButtonElement)

    // Assert
    expect(hearButton()?.disabled).toBe(true)
    expect(audio.active).toBe(1)
  })

  it('never plays two sounds at once, and none while a take records', async () => {
    // Arrange: tap "Hear a note" whenever it is free, and say "I'm ready"
    // while its note is still sounding, the hardest case for the take.
    const onComplete = vi.fn()
    render(() => <BeatVoiceprint onComplete={onComplete} onDenied={() => {}} />)

    // Act
    for (
      let tick = 0;
      tick < 1200 && onComplete.mock.calls.length === 0;
      tick++
    ) {
      const hear = hearButton()
      if (hear !== null && !hear.disabled) {
        fireEvent.click(hear)
        fireEvent.click(readyButton() as HTMLElement)
      } else if (hear === null && readyButton() !== null) {
        fireEvent.click(readyButton() as HTMLElement)
      }
      await vi.advanceTimersByTimeAsync(250)
    }

    // Assert: a sweep up, a sweep down, the hold's note on arrival and
    // again from the button, then the five notes of the match.
    expect(onComplete).toHaveBeenCalledOnce()
    expect(audio.log.map((s) => s.kind)).toEqual([
      'sweep',
      'sweep',
      'tone',
      'tone',
      'tone',
      'tone',
      'tone',
      'tone',
      'tone',
    ])
    expect(audio.log[2]?.midi).toBe(57)
    expect(audio.log[3]?.midi).toBe(57)
    expect(audio.maxActive).toBe(1)
    expect(audio.activeDuringTake).toBe(0)
  })
})

// ── Leaving mid-note ("Not now", review of PR 977) ────────────────────
//
// Closing the session closes its AudioContext, which cuts a note's
// 180 ms release off at whatever level it had reached: a pop. The beat
// lets the release finish first, and still closes the context, so
// nothing leaks.

describe('leaving the voiceprint while a note sounds', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    takes.next = audibleSinger()
    audio.reset()
    audio.context = { state: 'running' }
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    audio.reset()
  })

  it('lets the release finish before it closes the audio context', async () => {
    // Arrange: the first intro's sweep is sounding.
    render(() => <BeatVoiceprint onComplete={() => {}} onDenied={() => {}} />)
    await vi.advanceTimersByTimeAsync(0)
    expect(audio.active).toBe(1)

    // Act
    cleanup()
    const closedAtOnce = audio.closedOver.length
    await vi.advanceTimersByTimeAsync(400)

    // Assert
    expect(closedAtOnce).toBe(0)
    expect(audio.closedOver).toEqual([0])
  })

  it('closes at once when nothing is sounding', async () => {
    // Arrange
    render(() => <BeatVoiceprint onComplete={() => {}} onDenied={() => {}} />)
    await vi.advanceTimersByTimeAsync(5000)
    expect(audio.active).toBe(0)

    // Act
    cleanup()

    // Assert
    expect(audio.closedOver).toEqual([0])
  })
})

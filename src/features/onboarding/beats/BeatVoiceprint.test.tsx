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
}))

vi.mock('@/lib/voice-session', () => ({
  createVoiceSession: (): VoiceSession =>
    ({
      open: (): Promise<OpenResult> =>
        Promise.resolve({ ok: true } as OpenResult),
      probe: (): Promise<ProbeResult> => Promise.resolve('ok' as ProbeResult),
      arm: (): void => {},
      record: (): Promise<PitchFrame[]> => Promise.resolve(takes.next()),
      latest: () => null,
      latestSmoothed: () => null,
      level: (): number => 0,
      // No audio context: the reference tones are skipped, not played.
      context: () => null,
      isOpen: (): boolean => true,
      devices: (): Promise<MediaDeviceInfo[]> => Promise.resolve([]),
      useDevice: (): Promise<ProbeResult> =>
        Promise.resolve('ok' as ProbeResult),
      close: (): void => {},
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
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
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
})

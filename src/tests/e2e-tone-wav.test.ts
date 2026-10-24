// ============================================================
// The e2e fake-mic files — a path of their own, and the sound they promise
// ============================================================
//
// `writeToneWav` named its file after the frequency alone. Every caller uses
// 220 Hz, but they ask for four different lengths — 1s (karaoke-results-mobile),
// 5s (the default, five specs), 8s (stem-mixer-lyrics-short-viewport) and 20s
// (guided-voice-check, admin-exercise-audio, lrc-word-markers) — and each call
// runs at module load, when Playwright loads spec files to collect tests.
//
// With `fullyParallel` and four workers that is a race over one path: whichever
// worker wrote last decided what every other spec's microphone played. A spec
// that asked for 20 seconds could be handed a 1-second tone.
//
// `writeStepsWav` is a sung ladder for the same microphone: silence, then
// steady tones in order. Its file is read back here sample by sample, for
// the silence, each step's pitch and length, and the joins between steps;
// `fakeMicArgs` can have Chromium play it once instead of looping it.

import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { fakeMicArgs, writeStepsWav, writeToneWav, } from '@/e2e/helpers/tone-wav'

const RATE = 48000

/** 44-byte WAV header, then 16-bit mono samples at 48 kHz. */
function toneSeconds(file: string): number {
  return (fs.statSync(file).size - 44) / 2 / RATE
}

function samplesOf(file: string): Int16Array {
  const buf = fs.readFileSync(file)
  return new Int16Array(buf.buffer, buf.byteOffset + 44, (buf.length - 44) / 2)
}

/**
 * The pitch of every period wholly between `from` and `to` seconds, Hz, from
 * the rising zero crossings: the voice crosses zero rising exactly once a
 * period (0.4·sin φ·(1 + cos φ + cos² φ) is zero only where sin φ is), and a
 * fade moves no crossing.
 */
function periodsBetween(s: Int16Array, from: number, to: number): number[] {
  const rises = risesBetween(s, from, to)
  return rises.slice(1).map((r, j) => 1 / (r - rises[j]))
}

/** The rising zero crossings from `from` to `to` seconds, in seconds. */
function risesBetween(s: Int16Array, from: number, to: number): number[] {
  const rises: number[] = []
  for (let i = Math.round(from * RATE); i + 1 < Math.round(to * RATE); i++) {
    if (s[i] < 0 && s[i + 1] >= 0)
      rises.push((i + s[i] / (s[i] - s[i + 1])) / RATE)
  }
  return rises
}

/**
 * When the voice moves from `a` Hz to `b` Hz, within 20 ms of `near`
 * seconds. On one running phase the period that holds the move is x seconds
 * of `a` and the rest of `b`, one cycle in all: a·x + b·(d − x) = 1.
 */
function moveNear(s: Int16Array, near: number, a: number, b: number): number {
  const rises = risesBetween(s, near - 0.02, near + 0.02)
  const at = rises.findIndex((r, j) => cents(1 / (rises[j + 1] - r), b) < 1)
  const d = rises[at] - rises[at - 1]
  if (cents(1 / d, a) < 1) return rises[at]
  return rises[at - 1] + (1 - b * d) / (a - b)
}

/** The loudest sample from `from` to `to` seconds. */
function peakBetween(s: Int16Array, from: number, to: number): number {
  let most = 0
  for (let i = Math.round(from * RATE); i < Math.round(to * RATE); i++)
    most = Math.max(most, Math.abs(s[i]))
  return most
}

/**
 * The amplitude of `hz` over `seconds` from `from`. With a whole number of
 * its cycles in the window, no other harmonic of the same note leaks in.
 */
function amplitudeOf(
  s: Int16Array,
  hz: number,
  from: number,
  seconds: number,
): number {
  const start = Math.round(from * RATE)
  const n = Math.round(seconds * RATE)
  let re = 0
  let im = 0
  for (let i = 0; i < n; i++) {
    const w = (2 * Math.PI * hz * i) / RATE
    re += s[start + i] * Math.cos(w)
    im += s[start + i] * Math.sin(w)
  }
  return (2 * Math.hypot(re, im)) / n
}

const cents = (hz: number, of: number): number =>
  Math.abs(1200 * Math.log2(hz / of))

/** The largest change from one sample to the next: a click is a jump. */
function largestJump(s: Int16Array): number {
  let most = 0
  for (let i = 1; i < s.length; i++)
    most = Math.max(most, Math.abs(s[i] - s[i - 1]))
  return most
}

const LADDER = [146.83, 185, 220, 293.66].map((hz) => ({ hz, seconds: 1.5 }))

describe('writeToneWav', () => {
  it('gives each duration its own path at the same frequency', () => {
    expect(writeToneWav(220, 1)).not.toBe(writeToneWav(220, 20))
  })

  it('leaves an already-written longer tone intact', () => {
    // The clobber, reproduced: a short-tone spec loading after a long-tone one
    // used to truncate the file the long-tone spec had already pinned.
    const long = writeToneWav(220, 20)
    writeToneWav(220, 1)

    expect(toneSeconds(long)).toBe(20)
  })

  it('writes the number of seconds it was asked for', () => {
    expect(toneSeconds(writeToneWav(220, 8))).toBe(8)
    expect(toneSeconds(writeToneWav(220))).toBe(5)
  })
})

describe('writeStepsWav', () => {
  it('holds silence for the lead, then the steps, then half a second of silence', () => {
    // Played once, Chromium repeats a file's last slice after its end: the
    // tail is what makes that slice silence.
    const file = writeStepsWav(LADDER, 2)

    const s = samplesOf(file)

    expect(toneSeconds(file)).toBe(8.5)
    expect(s.slice(0, 2 * RATE).every((v) => v === 0)).toBe(true)
    expect(s.findIndex((v) => Math.abs(v) > 500) / RATE).toBeCloseTo(2, 2)
    expect(s.slice(8 * RATE).every((v) => v === 0)).toBe(true)
  })

  it('sings each step at its own pitch from its first period to its last, in order', () => {
    const s = samplesOf(writeStepsWav(LADDER, 2))

    const heard = LADDER.map(({ hz }, k) => {
      const periods = periodsBetween(s, 2 + 1.5 * k, 2 + 1.5 * (k + 1))
      return {
        periods: periods.length >= Math.floor(1.5 * hz) - 1,
        worst: Math.max(...periods.map((p) => cents(p, hz))),
      }
    })

    expect(heard.map((h) => h.periods)).toEqual([true, true, true, true])
    expect(heard.map((h) => h.worst < 1)).toEqual([true, true, true, true])
  })

  it('moves to each next step where the last one ends, to a tenth of a millisecond', () => {
    const s = samplesOf(writeStepsWav(LADDER, 2))

    const moves = [1, 2, 3].map((k) =>
      moveNear(s, 2 + 1.5 * k, LADDER[k - 1].hz, LADDER[k].hz),
    )

    expect(moves.map((t, j) => Math.abs(t - (3.5 + 1.5 * j)) < 1e-4)).toEqual([
      true,
      true,
      true,
    ])
  })

  it("sings in writeToneWav's voice, harmonics and all", () => {
    // YIN locks onto the harmonics far more reliably than onto a bare sine.
    // A3 is the third step, from 5 to 6.5 s; one second holds whole cycles of
    // each harmonic.
    const tone = samplesOf(writeToneWav(220, 2))
    const stepped = samplesOf(writeStepsWav(LADDER, 2))

    const ratios = [220, 440, 660].map(
      (hz) => amplitudeOf(stepped, hz, 5.2, 1) / amplitudeOf(tone, hz, 0.5, 1),
    )

    expect(ratios[0]).toBeCloseTo(1, 2)
    expect(ratios[1]).toBeCloseTo(1, 2)
    expect(ratios[2]).toBeCloseTo(1, 2)
  })

  it('fades in over 10 ms after the lead, and out over 10 ms before the tail', () => {
    // D3 opens the ladder at 2 s and D4 closes it at 8 s.
    const s = samplesOf(writeStepsWav(LADDER, 2))
    const d3 = peakBetween(s, 2.1, 2.2)
    const d4 = peakBetween(s, 7.8, 7.9)

    const fades = [
      peakBetween(s, 2, 2.001) / d3,
      peakBetween(s, 2.01, 2.01 + 1 / 146.83) / d3,
      peakBetween(s, 7.99 - 1 / 293.66, 7.99) / d4,
      peakBetween(s, 7.999, 8) / d4,
    ]

    expect(fades[0]).toBeLessThanOrEqual(0.1)
    expect(fades[1]).toBeCloseTo(1, 2)
    expect(fades[2]).toBeCloseTo(1, 2)
    expect(fades[3]).toBeLessThanOrEqual(0.1)
  })

  it('moves from step to step without a click', () => {
    // A tone restarting its phase at each step jumps by up to its whole swing.
    const steady = largestJump(samplesOf(writeToneWav(293.66, 1)))

    const stepped = largestJump(samplesOf(writeStepsWav(LADDER, 2)))

    expect(stepped).toBeLessThanOrEqual(steady + 2)
  })

  it('rests in silence on a step with no pitch, fading the tones either side', () => {
    // A hard edge at a rest would jump by as much as the tone's swing.
    const steady = largestJump(samplesOf(writeToneWav(220, 1)))
    const rested = [
      { hz: 146.83, seconds: 1 },
      { hz: 0, seconds: 0.5 },
      { hz: 220, seconds: 1 },
    ]

    const s = samplesOf(writeStepsWav(rested, 1))

    expect(s.slice(2 * RATE, 2.5 * RATE).every((v) => v === 0)).toBe(true)
    expect(largestJump(s)).toBeLessThanOrEqual(steady + 2)
  })

  it('gives each lead and each ladder its own path, lengths included', () => {
    // Specs write their files at module load, across parallel workers: two
    // ladders sharing a path would overwrite each other, as writeToneWav's
    // lengths once did.
    const smaller = [146.83, 185, 220, 185, 146.83].map((hz) => ({
      hz,
      seconds: 1.5,
    }))
    const quicker = LADDER.map((step) => ({ ...step, seconds: 1 }))

    const paths = new Set([
      writeStepsWav(LADDER, 8),
      writeStepsWav(LADDER, 2),
      writeStepsWav(smaller, 8),
      writeStepsWav(quicker, 8),
    ])

    expect(paths.size).toBe(4)
  })
})

describe('fakeMicArgs', () => {
  it('has Chromium loop the file by default', () => {
    const args = fakeMicArgs('/tmp/steps.wav')

    expect(args).toEqual([
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--use-file-for-fake-audio-capture=/tmp/steps.wav',
    ])
  })

  it('has Chromium play the file once with loop off', () => {
    const args = fakeMicArgs('/tmp/steps.wav', { loop: false })

    expect(args).toEqual([
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--use-file-for-fake-audio-capture=/tmp/steps.wav%noloop',
    ])
  })
})

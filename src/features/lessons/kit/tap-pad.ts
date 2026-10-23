// ============================================================
// Tap pad — one wide button that takes taps, and the taps' tempo
// ============================================================
//
// The lessons' pad (Lesson 8 WEB-SPEC, Toys 5): a 64 px button, "Tap" with
// "or press Space" under it, that takes a tap by the Ear Lab's own rule
// (src/lib/ear/tap-rule.ts): on pointer down with the primary button, on
// Space or Enter, a held key's repeats ignored, and on a click that no
// pointer or key made (a screen reader, a switch, voice control), each at
// its event's own `timeStamp` on the page's clock.
// It flashes for 110 ms and keeps `touch-action: manipulation`, so a quick
// second tap is never read as a zoom.
//
// `createTapTempo` reads the taps' tempo: 60,000 over the middle of the last
// eight gaps, in whole BPM, from the fourth tap of a run. A gap over 2 s
// starts a new run; one under 0.15 s is a bounce and is dropped. A steady
// delay cancels out of a gap, so the reading needs no lining-up. Nothing is
// stored.

import { clickTap, isTapKey, keyTap, pointerTap, TAP_FLASH_MS, } from '@/lib/ear/tap-rule'

/** Binds `pad` to `onTap`, which hears each tap's page-clock time in ms. */
export function bindTapPad(
  pad: HTMLButtonElement,
  onTap: (atMs: number) => void,
): void {
  let flash = 0
  const register = (at: number): void => {
    onTap(at)
    pad.classList.add('is-hit')
    window.clearTimeout(flash)
    flash = window.setTimeout(
      () => pad.classList.remove('is-hit'),
      TAP_FLASH_MS,
    )
  }
  pad.addEventListener('pointerdown', (e) => {
    const at = pointerTap(e)
    if (at === null || pad.getAttribute('aria-disabled') === 'true') return
    e.preventDefault()
    register(at)
  })
  // the pad's latest pointer up and its latest Space or Enter: the click
  // each makes of itself is no second tap
  let pointerUp = -Infinity
  let keyAt = -Infinity
  pad.addEventListener('pointerup', (e) => {
    pointerUp = e.timeStamp
  })
  pad.addEventListener('keyup', (e) => {
    if (isTapKey(e.key)) keyAt = e.timeStamp
  })
  pad.addEventListener('keydown', (e) => {
    if (isTapKey(e.key)) keyAt = e.timeStamp
    const at = keyTap(e)
    if (at === null) return
    e.preventDefault()
    if (pad.getAttribute('aria-disabled') !== 'true') register(at)
  })
  pad.addEventListener('click', (e) => {
    const at = clickTap(e, { pointerUp, key: keyAt })
    if (at === null || pad.getAttribute('aria-disabled') === 'true') return
    register(at)
  })
}

/** Gaps longer than this start a new run, ms. */
export const RUN_GAP_MS = 2000
/** Gaps shorter than this are a bounce, ms. */
export const BOUNCE_MS = 150
/** The taps a run needs before it reads a tempo. */
export const TAPS_TO_READ = 4

/** What the taps say so far: their tempo from the fourth tap of a run, and whether this tap began one. */
export interface TapReading {
  readonly bpm: number | null
  readonly taps: number
  readonly newRun: boolean
}

function median(values: readonly number[]): number {
  const s = [...values].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m]
}

/** The taps' tempo, tap by tap. */
export function createTapTempo(): {
  tap(atMs: number): TapReading
  reset(): void
} {
  let last: number | null = null
  let taps = 0
  let gaps: number[] = []
  return {
    tap(atMs) {
      const gap = last === null ? null : atMs - last
      if (gap !== null && gap < BOUNCE_MS)
        return { bpm: reading(), taps, newRun: false }
      last = atMs
      if (gap === null || gap > RUN_GAP_MS) {
        taps = 1
        gaps = []
        return { bpm: null, taps, newRun: true }
      }
      taps += 1
      gaps = [...gaps, gap].slice(-8)
      return { bpm: reading(), taps, newRun: false }
    },
    reset() {
      last = null
      taps = 0
      gaps = []
    },
  }

  function reading(): number | null {
    return taps >= TAPS_TO_READ ? Math.round(60000 / median(gaps)) : null
  }
}

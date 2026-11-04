// ============================================================
// Lesson 13 four words tests — Harmonic's two tones, and three silent Shows
// ============================================================
//
// On the page's own markup, its runs recorded (kit/run-recorder.test-
// fixtures.ts), WEB-SPEC, Toys 3: each button carries LESSON.md's label;
// Harmonic plays 220 Hz, then 440 Hz, pure tones in the soft tone, 1.0 s
// each with 0.3 s of silence between, each column lit while its tone
// sounds, and is the page's one sound, so it stops the sound before it and
// a newer sound stops it; the three Shows sound nothing, claim nothing and
// ask nothing of the sound switch; a Show replays its drawing from its
// start, ending on the figure as drawn; under reduced motion it lands on
// its end at once.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type * as MotionSwitch from '@/features/lessons/kit/motion-switch'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type * as RunModule from '@/features/lessons/kit/run'
import { live, resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { Sound } from '@/features/lessons/kit/sound'
import { initColdOpen } from './cold-open'
import { el, loadPage, settle, soundOn } from './page-dom.test-fixtures'
import { PURE } from './vowel-voice'
import { GAP_SEC, initWords, SHOW_SEC, TONE_SEC } from './words'

const motion = vi.hoisted(() => ({ reduced: false }))

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))

vi.mock('@/features/lessons/kit/motion-switch', async (actual) => ({
  ...(await actual<typeof MotionSwitch>()),
  reducedMotion: () => motion.reduced,
}))

const button = (word: string): HTMLButtonElement =>
  el<HTMLButtonElement>(`[data-word-play="${word}"]`)
const stub = (word: string): SVGSVGElement =>
  el(`[data-word="${word}"] .stub svg`) as unknown as SVGSVGElement
/** Harmonic's two columns' lit shares, as fill opacities. */
const columns = (): (string | null)[] =>
  Array.from(stub('harmonic').querySelectorAll('.lit'), (r) =>
    r.getAttribute('fill-opacity'),
  )
/** Each attribute `name` of the elements `selector` finds in `word`'s figure. */
const attrs = (
  word: string,
  selector: string,
  name: string,
): (string | null)[] =>
  Array.from(stub(word).querySelectorAll(selector), (e) => e.getAttribute(name))

beforeEach(() => {
  localStorage.clear()
  motion.reduced = false
  resetRuns()
  loadPage()
})

afterEach(async () => {
  NowPlaying.claim(() => undefined)
  await settle()
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.textContent = ''
})

describe("Lesson 13's four words", () => {
  it("carries LESSON.md's label on each button", () => {
    // Arrange
    initWords()

    // Act
    const names = ['harmonic', 'spectrum', 'resonance', 'formant'].map((w) =>
      (button(w).textContent ?? '').replace(/\s+/g, ' ').trim(),
    )

    // Assert
    expect(names).toEqual([
      'Play: the 1st harmonic of A3, then the 2nd',
      'Show: the strip lights',
      'Show: a curve over the strip, peaking at one resonance',
      'Show: the two peaks of ‘ee’ marked',
    ])
  })

  it('plays 220 Hz, then 440 Hz, pure, 1.0 s each with 0.3 s of silence between', () => {
    // Arrange
    soundOn()
    initWords()

    // Act
    button('harmonic').click()

    // Assert
    const [r] = runs
    expect(r.kind).toBe('line')
    expect([r.o.kind, r.o.timbre, r.o.gain]).toEqual(['soft', PURE, undefined])
    const sounding = r.points.filter((p) => (p.level ?? 1) > 0)
    expect(sounding.map((p) => [p.t, p.hz])).toEqual([
      [0, 220],
      [TONE_SEC, 220],
      [TONE_SEC + GAP_SEC, 440],
      [2 * TONE_SEC + GAP_SEC, 440],
    ])
    const silent = r.points.filter((p) => p.level === 0)
    expect(silent).toHaveLength(2)
    for (const p of silent) {
      expect(p.t).toBeGreaterThan(TONE_SEC)
      expect(p.t).toBeLessThan(TONE_SEC + GAP_SEC)
    }
    expect([TONE_SEC, GAP_SEC]).toEqual([1, 0.3])
  })

  it('lights each column while its tone sounds, and both once it ends', async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    soundOn()
    initWords()
    const seen: (string | null)[][] = [columns()]

    // Act
    button('harmonic').click()
    seen.push(columns())
    vi.advanceTimersByTime(TONE_SEC * 1000 + 10)
    seen.push(columns())
    vi.advanceTimersByTime(GAP_SEC * 1000)
    seen.push(columns())
    runs[0].end(true)
    await settle()
    seen.push(columns())

    // Assert
    expect(seen).toEqual([
      [null, null],
      ['1', '.2'],
      ['.2', '.2'],
      ['.2', '1'],
      ['1', '1'],
    ])
  })

  it("is the page's one sound: it stops the cold open's play, and the cold open's next play stops it", async () => {
    // Arrange
    soundOn()
    initColdOpen()
    initWords()

    // Act
    el('#heroPlay').click()
    await settle()
    button('harmonic').click()
    const coldOpen = runs[0].stopped
    // the predict ignores a tap until its cut-short play has let go
    await settle()
    el('#heroPlay').click()
    await settle()

    // Assert
    expect(coldOpen).toBe(true)
    expect(runs[1].stopped).toBe(true)
    expect(button('harmonic').classList.contains('is-on')).toBe(false)
    expect(columns()).toEqual(['1', '1'])
    expect(live()).toHaveLength(1)
  })

  it('shows silently: no run, no claim on the sound, and nothing asked of the sound switch', async () => {
    // Arrange
    motion.reduced = true
    const canPlay = vi.spyOn(Sound, 'canPlay')
    initWords()
    button('harmonic').click()
    runs[0].end(true)
    await settle()
    resetRuns()
    canPlay.mockClear()
    const other = vi.fn()
    NowPlaying.claim(other)

    // Act
    for (const w of ['spectrum', 'resonance', 'formant']) button(w).click()
    await settle()

    // Assert
    expect(runs).toEqual([])
    expect(other).not.toHaveBeenCalled()
    expect(canPlay).not.toHaveBeenCalled()
  })

  it('replays Spectrum from the foot, ending on the strip as drawn', async () => {
    // Arrange
    const frames: FrameRequestCallback[] = []
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((f) => {
      frames.push(f)
      return frames.length
    })
    vi.spyOn(performance, 'now').mockReturnValue(0)
    initWords()
    const drawn = attrs('spectrum', '.lit', 'height')

    // Act: the first frame, then halfway, then the end
    button('spectrum').click()
    const start = attrs('spectrum', '.lit', 'height')
    frames.shift()?.(SHOW_SEC * 500)
    const half = attrs('spectrum', '.lit', 'height').map(Number)
    frames.shift()?.(SHOW_SEC * 1000)
    await settle()

    // Assert
    expect(start.every((h) => h === '0')).toBe(true)
    expect(half).toEqual(drawn.map((h) => +(Number(h) / 2).toFixed(2)))
    expect(attrs('spectrum', '.lit', 'height')).toEqual(drawn)
    expect(button('spectrum').classList.contains('is-on')).toBe(false)
  })

  it('draws the curve and caps the two peaks in turn, the 1st and then the 10th', () => {
    // Arrange
    const frames: FrameRequestCallback[] = []
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((f) => {
      frames.push(f)
      return frames.length
    })
    vi.spyOn(performance, 'now').mockReturnValue(0)
    initWords()

    // Act
    button('resonance').click()
    button('formant').click()
    const start = {
      dash: attrs('resonance', '.curve', 'stroke-dashoffset'),
      caps: attrs('formant', '.peak', 'opacity'),
    }
    for (const f of frames.splice(0)) f(SHOW_SEC * 600)
    const later = {
      dash: attrs('resonance', '.curve', 'stroke-dashoffset'),
      caps: attrs('formant', '.peak', 'opacity'),
    }

    // Assert
    expect(start).toEqual({ dash: ['1'], caps: ['1', '0'] })
    expect(later).toEqual({ dash: ['0.4'], caps: ['1', '1'] })
  })

  it('lands each Show on its end at once under reduced motion', () => {
    // Arrange
    motion.reduced = true
    initWords()
    const drawn = attrs('spectrum', '.lit', 'height')

    // Act
    for (const w of ['spectrum', 'resonance', 'formant']) button(w).click()

    // Assert
    expect(attrs('spectrum', '.lit', 'height')).toEqual(drawn)
    expect(attrs('resonance', '.curve', 'stroke-dashoffset')).toEqual([null])
    expect(attrs('formant', '.peak', 'opacity')).toEqual(['1', '1'])
  })
})

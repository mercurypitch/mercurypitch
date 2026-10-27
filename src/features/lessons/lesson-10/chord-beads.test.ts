// ============================================================
// Lesson 10 chord beads tests — every state's buttons, its motions and its rest
// ============================================================
//
// On the page's own markup, its runs recorded (kit/run-recorder.test-
// fixtures.ts): every state the toy draws (WEB-SPEC, Toys 1) shows the
// parts the spec lists, with its beads' and gaps' buttons named and laid at
// chord-layout.ts's rectangles, after the stage's controls in the tab
// order, the beads from the root up and then the gaps. A slide respells
// the names by letter, so C minor's third is E♭4, never D♯4, and lands as
// its name changes; the halo glows once as the third lands; under reduced
// motion every motion lands at once and the halo does not glow. Only the
// chord's third is gold, and only once there is a chord. A bead plays its
// note and a gap its two notes, each the page's one sound, and so does a
// run the page builds itself. The figure draws its compact layout below
// 340 px, its strip's text at 12 px. And the toy asks the frame loop for
// frames only while something moves: at rest it asks for none.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type * as MotionModule from '@/features/lessons/kit/motion-switch'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import { easeOutExpo } from '@/features/lessons/kit/reveal'
import type * as RunModule from '@/features/lessons/kit/run'
import type { RunNote } from '@/features/lessons/kit/run'
import type { RecordedRun } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import type { ChordBeads } from './chord-beads'
import { HALO_REST, haloGlow, MOTION, mountChordBeads, TAP_SEC, } from './chord-beads'
import type { BeadsScene } from './chord-beads-draw'
import { paintBeads, STRIP_PX } from './chord-beads-draw'
import type { BeadState } from './chord-layout'
import { chordLayout } from './chord-layout'
import { FIFTH_LABEL, gapLabel, nameStrip, patternReadout, qualityLine, summary, } from './lines'
import { el, loadPage, settle, soundOn } from './page-dom.test-fixtures'
import { gapSound, slow } from './sounds'

const motion = vi.hoisted(() => ({ reduced: false }))

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))

vi.mock('@/features/lessons/kit/motion-switch', async (actual) => ({
  ...(await actual<typeof MotionModule>()),
  reducedMotion: () => motion.reduced,
}))

/** A phone's figure at 390 x 844 (FACTS 82), and the compact one at 844 x 390. */
const FULL = { w: 356, h: 340 }
const COMPACT = { w: 812, h: 162 }

/** The figure's canvas, sized as the browser would lay it out. */
function sizeFigure(size: { w: number; h: number }): void {
  vi.spyOn(
    el<HTMLCanvasElement>('#toyChord [data-chord-viz] canvas'),
    'getBoundingClientRect',
  ).mockReturnValue(new DOMRect(0, 0, size.w, size.h))
}

/** The stage's toy, mounted on the page's markup in `state`. */
function mount(
  state: BeadState = 'thirds',
  size: { w: number; h: number } = FULL,
): ChordBeads {
  loadPage()
  sizeFigure(size)
  return mountChordBeads(el('#toyChord'), {
    state,
    active: () => true,
    owner: NowPlaying,
  })
}

/** The buttons over the drawing, in the tab order. */
const hits = (): HTMLButtonElement[] =>
  Array.from(
    document.querySelectorAll<HTMLButtonElement>(
      '#toyChord [data-chord-targets] button',
    ),
  )
const names = (): string[] =>
  hits().map((b) => b.getAttribute('aria-label') ?? '')
const box = (b: HTMLElement): number[] =>
  ['left', 'top', 'width', 'height'].map((k) =>
    parseFloat(b.style.getPropertyValue(k)),
  )
const said = (): string => el('#toyChord [data-chord-said]').textContent ?? ''

/** The scene, which the toy has once its figure has a size. */
function sceneOf(t: ChordBeads): BeadsScene {
  const s = t.scene()
  if (s === null) throw new Error('no scene')
  return s
}

/** Moves the page's clock on by `seconds`. */
const later = (seconds: number): void => {
  vi.advanceTimersByTime(seconds * 1000)
}

beforeEach(() => {
  motion.reduced = false
  resetRuns()
  soundOn()
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.textContent = ''
})

describe("Lesson 10's chord beads, state by state", () => {
  it.each<[BeadState, string[]]>([
    [
      'thirds',
      [
        'C 4, the bottom note',
        'E 4, the top note',
        '4, major third: C 4 up to E 4',
      ],
    ],
    [
      'stack',
      [
        'C 4, the bottom note',
        'E 4, the top note',
        '4, major third: C 4 up to E 4',
      ],
    ],
    [
      'slide',
      [
        'C 4, the root',
        'E 4, the third',
        'G 4, the fifth',
        '4, major third: C 4 up to E 4',
        '3, minor third: E 4 up to G 4',
      ],
    ],
    ['pattern', ['C 4, the root', 'E 4, the third', 'G 4, the fifth']],
    ['scale', ['C 4, the root', 'E 4, the third', 'G 4, the fifth']],
    [
      'free',
      [
        'C 4, the root',
        'E 4, the third',
        'G 4, the fifth',
        '4, major third: C 4 up to E 4',
        '3, minor third: E 4 up to G 4',
      ],
    ],
  ])(
    'names the %s state’s beads from the root up, then its gaps, each at its layout’s rectangle',
    (state, want) => {
      // Act
      const toy = mount(state)

      // Assert
      const L = toy.layout
      expect(names()).toEqual(want)
      expect(hits().map(box)).toEqual(
        [...(L?.beads ?? []), ...(L?.gaps ?? [])].map((r) => [
          r.x,
          r.y,
          r.w,
          r.h,
        ]),
      )
      expect(hits().every((b) => b.type === 'button')).toBe(true)
    },
  )

  it("puts its buttons after the stage's controls in the tab order", () => {
    // Arrange
    mount('slide')
    const controls = Array.from(
      document.querySelectorAll('#toyChord .chord-row button'),
    )

    // Act
    const after = controls.map(
      (c) =>
        (c.compareDocumentPosition(hits()[0]) &
          Node.DOCUMENT_POSITION_FOLLOWING) !==
        0,
    )

    // Assert
    expect(controls.length).toBeGreaterThan(0)
    expect(after.every(Boolean)).toBe(true)
  })

  it.each<[BeadState, number, number, boolean, string | null]>([
    ['thirds', 2, 1, false, 'Major third · 4 semitones'],
    ['stack', 2, 1, false, 'Major third · 4 semitones'],
    ['slide', 3, 2, true, 'C major · do-mi-so'],
    ['pattern', 3, 0, true, 'C major · do-mi-so'],
    ['scale', 3, 0, false, null],
    ['free', 3, 2, true, null],
  ])(
    'draws the %s state with %i beads, %i gaps, the bracket where it shows, and its strip',
    (state, beads, gaps, bracket, strip) => {
      // Act
      const s = sceneOf(mount(state))

      // Assert
      expect(s.beads).toHaveLength(beads)
      expect(s.gaps).toHaveLength(gaps)
      expect(s.bracket !== null).toBe(bracket)
      expect(s.strip?.text ?? null).toBe(strip)
      expect(s.stairs).toEqual([])
    },
  )

  it("labels the gaps, the bracket and Step 4's readout in lines.ts's words", () => {
    // Arrange
    const toy = mount('pattern')

    // Act
    toy.setTempo('fast')
    const pattern = sceneOf(toy)
    toy.setState('slide')
    const slide = sceneOf(toy)

    // Assert
    expect(pattern.strip?.readout).toBe(patternReadout(60, 'major', 'fast'))
    expect(slide.strip?.readout).toBeNull()
    expect(slide.gaps.map((g) => g.label)).toEqual([gapLabel(4), gapLabel(3)])
    expect(slide.bracket?.label.join(' ')).toBe(FIFTH_LABEL.replace(' ·', ''))
  })

  it('stacks a third in Step 2: the fifth drops in, the bracket and second gap come, and the middle bead turns gold', () => {
    // Arrange
    const toy = mount('stack')
    const before = sceneOf(toy)

    // Act
    toy.stack()
    later(MOTION.drop / 2)
    const dropping = sceneOf(toy)
    later(MOTION.drop)
    const after = sceneOf(toy)

    // Assert
    expect(before.beads.map((b) => b.gold)).toEqual([false, false])
    expect(dropping.beads[2].y).toBeLessThan(after.beads[2].y)
    expect(dropping.beads[2].alpha).toBeLessThan(1)
    expect(after.beads.map((b) => [b.name, b.gold])).toEqual([
      ['C4', false],
      ['E4', true],
      ['G4', false],
    ])
    expect(after.bracket).not.toBeNull()
    expect(names().at(-1)).toBe('3, minor third: E 4 up to G 4')
    expect(said()).toBe('Stacked: C, E, G. C major.')
  })

  it('keeps both of Step 1’s beads chrome, and gives a spread scale’s mi its gold', () => {
    // Arrange
    const thirds = mount('thirds')
    const step1 = sceneOf(thirds).beads.map((b) => b.gold)
    const scale = mount('scale')

    // Act
    scale.setSpread(true)
    later(MOTION.spread)

    // Assert
    expect(step1).toEqual([false, false])
    expect(sceneOf(scale).stairs.map((s) => s.gold)).toEqual([
      false,
      false,
      true,
      false,
      false,
      false,
      false,
      false,
    ])
  })
})

describe("Lesson 10's chord beads, in motion", () => {
  it('slides the third down a row in 0.4 s and respells it E♭4, never D♯4, as it lands', () => {
    // Arrange
    const toy = mount('slide')
    const atRest = sceneOf(toy).beads[1]

    // Act
    const lands = toy.setQuality('minor')
    later(MOTION.third / 2)
    const halfway = sceneOf(toy).beads[1]
    later(MOTION.third)
    const landed = sceneOf(toy).beads[1]

    // Assert
    expect(lands).toBe(MOTION.third)
    expect(halfway.name).toBe('E4')
    expect(halfway.y).toBeGreaterThan(atRest.y)
    expect(landed.y - atRest.y).toBeCloseTo(15, 5)
    expect(landed.name).toBe('E♭4')
    expect(sceneOf(toy).gaps.map((g) => g.label)).toEqual([
      gapLabel(3),
      gapLabel(4),
    ])
    expect(names()[1]).toBe('E flat 4, the third')
    expect(said()).toBe(
      qualityLine({ kind: 'chord', root: 60, quality: 'minor' }),
    )
    expect(el('#toyChord [data-chord-summary]').textContent).toBe(
      summary({ kind: 'chord', root: 60, quality: 'minor' }),
    )
  })

  it('spells every chord a slide reaches by letter: B minor is B, D, F♯, and D major’s third F♯4', () => {
    // Arrange
    const toy = mount('slide')

    // Act
    toy.slideRoot(1)
    later(MOTION.root)
    const d = sceneOf(toy).beads.map((b) => b.name)
    for (let i = 0; i < 5; i++) toy.slideRoot(1)
    toy.setQuality('minor')
    later(MOTION.root + MOTION.third)
    const b = sceneOf(toy).beads.map((x) => x.name)

    // Assert
    expect(d).toEqual(['D4', 'F♯4', 'A4'])
    expect(b).toEqual(['B4', 'D5', 'F♯5'])
    expect(toy.slideRoot(1)).toBe(false)
  })

  it('glows the halo once as the third lands, and back to rest', () => {
    // Arrange
    const toy = mount('slide')
    const rest = sceneOf(toy).halo?.glow

    // Act: every 10 ms through two seconds
    toy.setQuality('minor')
    const glows: number[] = []
    for (let i = 0; i < 200; i++) {
      glows.push(sceneOf(toy).halo?.glow ?? 0)
      later(0.01)
    }

    // Assert
    const peaks = glows.filter(
      (g, i) => i > 0 && g > glows[i - 1] && (glows[i + 1] ?? 0) < g,
    )
    expect(rest).toBe(HALO_REST)
    expect(peaks).toHaveLength(1)
    expect(Math.max(...glows)).toBeCloseTo(1, 1)
    expect(glows.at(-1)).toBe(HALO_REST)
    expect(glows.slice(0, 40).every((g) => g === HALO_REST)).toBe(true)
  })

  it('peaks the glow once, 0.12 s after the third lands', () => {
    // Act
    const curve = Array.from({ length: 160 }, (_, i) => haloGlow(i / 100))

    // Assert
    expect(curve.indexOf(Math.max(...curve))).toBe(12)
    expect(curve.at(-1)).toBeCloseTo(0, 5)
  })

  it('slides a root up a white key in 0.5 s, the whole chord with it', () => {
    // Arrange
    const toy = mount('slide')
    const at = sceneOf(toy).beads.map((b) => b.y)

    // Act
    toy.slideRoot(1)
    later(MOTION.root * 0.6)
    const going = sceneOf(toy).beads.map((b) => b.y)
    later(MOTION.root)
    const there = sceneOf(toy).beads.map((b) => b.y)

    // Assert
    going.forEach((y, i) => expect(y).toBeLessThan(at[i]))
    there.forEach((y, i) => expect(at[i] - y).toBeCloseTo(30, 5))
    expect(said()).toBe('Root higher: D, F sharp, A. D major.')
  })

  it('keeps the beads in place in the compact layout as a root slides, its rows renamed', () => {
    // Arrange
    const toy = mount('slide', COMPACT)
    const at = sceneOf(toy).beads.map((b) => b.y)

    // Act
    toy.slideRoot(1)
    later(MOTION.root / 2)
    const going = sceneOf(toy).beads.map((b) => b.y)
    later(MOTION.root)

    // Assert
    going.forEach((y, i) => expect(y).toBeCloseTo(at[i], 6))
    expect(sceneOf(toy).beads.map((b) => b.name)).toEqual(['D4', 'F♯4', 'A4'])
  })

  it('spreads the chord into its scale in 0.6 s on the expo-out curve, and folds it back', () => {
    // Arrange
    const toy = mount('scale')

    // Act
    toy.setSpread(true)
    later(MOTION.spread / 2)
    const half = sceneOf(toy).spread
    later(MOTION.spread)
    const spread = sceneOf(toy)
    toy.setSpread(false)
    later(MOTION.spread)

    // Assert
    expect(half).toBeCloseTo(easeOutExpo(0.5), 5)
    expect(spread.spread).toBe(1)
    expect(spread.stairs.map((s) => s.name)).toEqual([
      'C4',
      'D4',
      'E4',
      'F4',
      'G4',
      'A4',
      'B4',
      'C5',
    ])
    expect(sceneOf(toy).spread).toBe(0)
    expect(said()).toBe('Chord: C, E, G. C major.')
  })

  it('lowers mi, la and ti a row in a spread minor scale, renamed me, le and te on Do-re-mi', () => {
    // Arrange
    const toy = mount('scale')
    toy.setSpread(true)
    later(MOTION.spread)
    const major = sceneOf(toy).stairs.map((s) => s.box.y)

    // Act
    toy.setQuality('minor')
    later(MOTION.third)
    const minor = sceneOf(toy)
    toy.setNames('solfege')

    // Assert
    expect(minor.stairs.map((s, i) => Math.round(s.box.y - major[i]))).toEqual([
      0, 0, 15, 0, 0, 15, 15, 0,
    ])
    expect(minor.stairs.map((s) => s.name)).toEqual([
      'C4',
      'D4',
      'E♭4',
      'F4',
      'G4',
      'A♭4',
      'B♭4',
      'C5',
    ])
    expect(sceneOf(toy).stairs.map((s) => s.name)).toEqual([
      'do',
      're',
      'me',
      'fa',
      'so',
      'le',
      'te',
      'do',
    ])
  })

  it('lands every motion at once under reduced motion, and never glows the halo', () => {
    // Arrange
    motion.reduced = true
    const slide = mount('slide')
    const before = sceneOf(slide).beads.map((b) => b.y)

    // Act
    const lands = slide.setQuality('minor')
    const third = sceneOf(slide)
    slide.slideRoot(1)
    const rooted = sceneOf(slide).beads.map((b) => b.y)
    const stack = mount('stack')
    stack.stack()
    const stacked = sceneOf(stack).beads[2]
    const scale = mount('scale')
    scale.setSpread(true)
    const spread = sceneOf(scale).spread

    // Assert
    expect(lands).toBe(0)
    expect(third.beads[1].y - before[1]).toBeCloseTo(15, 5)
    expect(third.beads[1].name).toBe('E♭4')
    expect(third.halo?.glow).toBe(HALO_REST)
    expect(rooted[0] - before[0]).toBeCloseTo(-30, 5)
    expect(stacked.alpha).toBe(1)
    expect(spread).toBe(1)
  })
})

describe("Lesson 10's chord beads, played", () => {
  /** The last run started. */
  const last = (): RecordedRun => runs[runs.length - 1]

  it('plays a bead’s note in the soft tone, the page’s one sound, and lights it as it sounds', async () => {
    // Arrange
    const toy = mount('slide')
    const claim = vi.spyOn(NowPlaying, 'claim')

    // Act
    hits()[1].click()
    last().note(0)
    const lit = sceneOf(toy).beads.map((b) => b.lit)
    last().end(true)
    await settle()
    later(1)

    // Assert
    expect(runs.map((r) => [r.notes, r.o.kind, r.o.audible])).toEqual([
      [[{ t: 0, midi: 64, dur: TAP_SEC }], 'soft', true],
    ])
    expect(claim).toHaveBeenCalledOnce()
    expect(lit).toEqual([0, 1, 0])
    expect(sceneOf(toy).beads.map((b) => b.lit)).toEqual([0, 0, 0])
  })

  it('plays a gap’s two notes as Step 1 plays a third, and at twice its lengths with Slow', () => {
    // Arrange
    const toy = mount('slide')

    // Act
    hits()[4].click()
    toy.setSlow(true)
    hits()[3].click()

    // Assert
    expect(runs.map((r) => r.notes)).toEqual([
      gapSound(64, 67),
      slow(gapSound(60, 64)),
    ])
    expect(runs[0].stopped).toBe(true)
  })

  it('plays a run the page builds as the page’s one sound, lighting each note as the run starts it, and stops it for any other sound', async () => {
    // Arrange: a run of the page's own, as Step 4's pattern is
    const toy = mount('pattern')
    const claim = vi.spyOn(NowPlaying, 'claim')
    // the run's own note callback, as the toy hands it over
    const run: { onNote?: (n: RunNote) => void } = {}
    let settleRun: (heard: boolean) => void = () => undefined
    const stopRun = vi.fn(() => settleRun(false))
    const played = toy.playRun((onNote) => {
      run.onNote = onNote
      return {
        done: new Promise<boolean>((resolve) => {
          settleRun = resolve
        }),
        stop: stopRun,
      }
    })
    run.onNote?.({ t: 0, midi: 67, dur: 1 })
    const lit = sceneOf(toy).beads.map((b) => b.lit)

    // Act
    NowPlaying.claim(() => undefined)

    // Assert
    expect(claim).toHaveBeenCalledTimes(2)
    expect(lit).toEqual([0, 0, 1])
    expect(stopRun).toHaveBeenCalledOnce()
    await expect(played).resolves.toBe(false)
    expect(sceneOf(toy).beads.map((b) => b.lit)).toEqual([0, 0, 0])
  })

  it('stops for any other sound on the page, and its lights go out', async () => {
    // Arrange
    const toy = mount('thirds')
    hits()[0].click()
    last().note(0)

    // Act
    NowPlaying.claim(() => undefined)
    await settle()

    // Assert
    expect(last().stopped).toBe(true)
    expect(sceneOf(toy).beads.map((b) => b.lit)).toEqual([0, 0])
  })

  it('stops its sound for a change of step, a slide, a stack or a spread, and plays on through Step 4’s switches', () => {
    // Arrange
    const toy = mount('slide')
    const playing = (): boolean => !last().over

    // Act
    const stoppedBy: boolean[] = []
    for (const change of [
      () => toy.setQuality('minor'),
      () => toy.slideRoot(1),
      () => toy.setState('stack'),
      () => toy.stack(),
    ]) {
      void toy.play([{ t: 0, midi: 60, dur: 1 }], true)
      change()
      stoppedBy.push(!playing())
    }
    toy.setState('pattern')
    void toy.play([{ t: 0, midi: 60, dur: 1 }], true)
    toy.setQuality('minor')
    toy.setTempo('fast')

    // Assert
    expect(stoppedBy).toEqual([true, true, true, true])
    expect(playing()).toBe(true)
  })

  it('opens each state on C4, major, unstacked and folded, at once', () => {
    // Arrange
    const toy = mount('slide')
    toy.setQuality('minor')
    toy.slideRoot(1)

    // Act
    toy.setState('scale')

    // Assert
    expect(toy.settings).toMatchObject({
      state: 'scale',
      root: 60,
      quality: 'major',
      stacked: false,
      spread: false,
    })
    expect(sceneOf(toy).beads.map((b) => b.name)).toEqual(['C4', 'E4', 'G4'])
  })
})

describe("Lesson 10's chord beads, compact", () => {
  it('draws the compact layout below 340 px tall and the full one at 340', () => {
    // Act
    const compact = sceneOf(mount('slide', COMPACT))
    const full = sceneOf(mount('slide', FULL))

    // Assert
    expect(compact.rows[0].layout.mode).toBe('compact')
    expect(compact.strip?.compact).toBe(true)
    expect(full.rows[0].layout.mode).toBe('full')
    expect(full.strip?.compact).toBe(false)
  })

  it('sets the compact strip’s text at 12 px or less, inside its 14.5 px corner', () => {
    // Arrange
    const toy = mount('pattern', COMPACT)
    const fonts: string[] = []
    let font = ''
    const ctx = new Proxy({} as Record<string, unknown>, {
      get: (target, k) =>
        k === 'font'
          ? font
          : k in target
            ? target[k as string]
            : k === 'createRadialGradient'
              ? () => ({ addColorStop: () => undefined })
              : (...args: unknown[]) => {
                  if (k === 'fillText') fonts.push(`${String(args[0])}|${font}`)
                },
      set: (target, k, v: unknown) => {
        if (k === 'font') font = String(v)
        else target[k as string] = v
        return true
      },
    }) as unknown as CanvasRenderingContext2D
    const s = sceneOf(toy)

    // Act
    paintBeads(ctx, s)

    // Assert
    const strip = nameStrip({ kind: 'chord', root: 60, quality: 'major' })
    const px = (text: string): number =>
      Number(
        /(\d+)px/.exec(fonts.find((f) => f.startsWith(`${text}|`)) ?? '')?.[1],
      )
    expect(s.strip?.box.h).toBeLessThanOrEqual(14.5)
    expect(STRIP_PX.compact).toBeLessThanOrEqual(12)
    expect(px(strip)).toBeLessThanOrEqual(12)
    expect(px(patternReadout(60, 'major', 'slow'))).toBeLessThanOrEqual(12)
  })

  it('keeps every button at 44 px or more in the compact layout', () => {
    // Act
    mount('free', COMPACT)

    // Assert
    expect(hits().length).toBe(5)
    hits().forEach((b) => {
      const [, , w, h] = box(b)
      expect(Math.min(w, h)).toBeGreaterThanOrEqual(44)
    })
  })

  it('lays its targets at the layout of the notes it shows', () => {
    // Act
    const toy = mount('thirds', COMPACT)

    // Assert
    const want = chordLayout({
      width: COMPACT.w,
      height: COMPACT.h,
      state: 'thirds',
      notes: [60, 64],
    })
    expect([toy.layout?.mode, toy.layout?.beads, toy.layout?.gaps]).toEqual([
      'compact',
      want.beads,
      want.gaps,
    ])
  })
})

describe("Lesson 10's chord beads, at rest", () => {
  it('wants no frame once drawn and still, and wants frames while a motion runs and its halo glows', async () => {
    // Arrange: a fresh frame loop, run by hand
    const { handLoop } =
      await import('@/features/lessons/kit/frame-loop.test-fixtures')
    const hand = await handLoop(false)
    const fresh = await import('./chord-beads')
    loadPage()
    sizeFigure(FULL)
    const toy = fresh.mountChordBeads(el('#toyChord'), {
      state: 'slide',
      active: () => true,
    })

    // Act
    const drawn = hand.settle()
    const atRest = { wants: toy.wants(), asked: hand.asked.length }
    toy.setQuality('minor')
    const moving = toy.wants()
    const frames = hand.settle()

    // Assert
    expect(drawn).toBeGreaterThan(0)
    expect(atRest).toEqual({ wants: false, asked: 0 })
    expect(moving).toBe(true)
    // the slide (0.4 s) and the glow after it (1.32 s), at 16 ms a frame
    expect(frames).toBeGreaterThanOrEqual(Math.floor(1.7 / 0.016))
    expect(toy.wants()).toBe(false)
  })
})

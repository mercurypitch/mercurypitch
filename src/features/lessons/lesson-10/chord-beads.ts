// ============================================================
// Lesson 10 chord beads — the chord whose third slides, on semitone rows
// ============================================================
//
// The page's one object (WEB-SPEC, Toys 1): each note a bead on faint
// semitone rows, pitch as height, a chord's notes in one column, each named
// beside it one letter per chord tone, so C minor's third reads E♭4, never
// D♯4 (FACTS 10, 19). It draws in the states the steps use: a third (Step
// 1), a third with a third stacked on it (Step 2), the third moved and the
// root slid (Step 3), the chord's pattern (Step 4), the chord spread into
// its scale (Step 5), and every control at once (free play). It is generic
// over a white-key root and a quality, and it lays its beads and gap
// buttons over the drawing as real buttons at chord-layout.ts's
// rectangles, the beads from the root up, then the gaps, so they come
// after the stage's controls in the tab order and a keyboard reaches them.
//
// Its motions: the third slides a row in 0.4 s and lands as its name
// changes, E to E♭, the gap numbers swap and the chord's halo brightens
// once; a stacked bead drops in from above in 0.4 s; a root slides in 0.5
// s; the spread into a scale and the fold back take 0.6 s on the kit's
// expo-out curve. Under reduced motion or Pause animations each lands at
// once and the halo does not pulse; a play still lights its beads. A bead
// plays its note, and a gap button its two notes, in the soft tone; every
// play is the page's one sound (kit/now-playing.ts), and so is a sound
// the page builds of the kit's runs itself (`playRun`), as Step 4's
// pattern, which books one quaver at a time. It draws only while
// something it shows moves or has changed (kit/frame-loop.ts, `wants`),
// and reads its figure's size as it changes: below 340 px tall it draws
// the compact layout. Every word is lines.ts's; the toy only places them.

import { clamp, lerp, q } from '@/features/lessons/kit/dom'
import { addDrawer, surface, wake, watchPixelRatio, } from '@/features/lessons/kit/frame-loop'
import { MAJOR_DEGREES } from '@/features/lessons/kit/major-scale'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import type { LettersSolfegeMode } from '@/features/lessons/kit/names-modes'
import { MAJOR_SOLFEGE, MINOR_SOLFEGE, } from '@/features/lessons/kit/names-modes'
import { signName } from '@/features/lessons/kit/notes'
import type { SoundOwner } from '@/features/lessons/kit/now-playing'
import { easeOut3, easeOutExpo } from '@/features/lessons/kit/reveal'
import type { Run, RunNote } from '@/features/lessons/kit/run'
import { playNotes } from '@/features/lessons/kit/run'
import { Sound } from '@/features/lessons/kit/sound'
import type { Rect } from '@/features/lessons/kit/tune-line-layout'
import { AFTERGLOW_SEC, GLOW_RISE_SEC, GLOW_SEC, lightAt, } from '@/features/lessons/kit/tune-line-motion'
import type { BeadMark, BeadsScene, GapMark, StairMark, } from './chord-beads-draw'
import { paintBeads } from './chord-beads-draw'
import type { BeadState, ChordLayout } from './chord-layout'
import { chordLayout } from './chord-layout'
import type { ChordTone, Quality } from './chords'
import { FIFTH, LOWERED_DEGREES, nextRoot, scaleOf, THIRD_OF, thirdOf, triad, } from './chords'
import type { Action, ChordOrScale, View } from './lines'
import { beadNames, changedLine, FIFTH_LABEL, gapLabel, gapNames, nameStrip, patternReadout, qualityLine, summary, } from './lines'
import type { Tempo } from './sounds'
import { gapSound, slow, THIRD } from './sounds'

/** Each motion's length, seconds (WEB-SPEC, Toys 1). */
export const MOTION = { third: 0.4, drop: 0.4, root: 0.5, spread: 0.6 } as const
/** A tapped bead's note: one note of a third as the toy plays it (FACTS 75). */
export const TAP_SEC = THIRD.each
/** A stacked bead starts this many rows above its own, over the window's top. */
const DROP_ROWS = 12
/** The halo's light at rest, and how much more it takes as a third lands. */
export const HALO_REST = 0.2
/** The chord's notes in its scale: do, mi and so, degrees 1, 3 and 5. */
const CHORD_DEGREES = [0, 2, 4]

/** What the toy shows, settled: every motion landed. */
export interface BeadsSettings {
  readonly state: BeadState
  /** A white-key root, C4 to B4. */
  readonly root: number
  readonly quality: Quality
  /** Step 2: the third stacked on the first. */
  readonly stacked: boolean
  /** Step 5 and free play: the chord spread into its scale. */
  readonly spread: boolean
  /** Step 4's readout. */
  readonly tempo: Tempo
  /** Slow: a gap button's play at twice its lengths. */
  readonly slow: boolean
  /** The names on the beads and stairs in Step 5 and free play. */
  readonly names: LettersSolfegeMode
}

export interface ChordBeadsOptions {
  /** When it draws: on screen and on its step (a deck's `toyActive`). */
  readonly active: () => boolean
  readonly state?: BeadState
  /** The page's one-sound owner, on a page that plays one sound at a time. */
  readonly owner?: SoundOwner
}

export interface ChordBeads {
  readonly settings: BeadsSettings
  /** What it shows, for lines.ts: a third, a chord or its scale. */
  readonly view: View
  /** Where its buttons sit, as last laid out; null before its figure has a size. */
  readonly layout: ChordLayout | null
  /** A state's opening: on C4, in `quality` (major by default), unstacked and folded, at once and silent. */
  setState(state: BeadState, quality?: Quality): void
  /** Major or minor: the third slides; returns the seconds until it lands (0 under reduced motion). */
  setQuality(quality: Quality): number
  /** The root a white key lower or higher; false at C4 or B4, where nothing moves. */
  slideRoot(dir: -1 | 1): boolean
  /** Step 2: the fifth drops onto the third. */
  stack(): void
  /** Chord · Scale: spread into the scale, or fold back. */
  setSpread(on: boolean): void
  setTempo(tempo: Tempo): void
  setSlow(on: boolean): void
  setNames(mode: LettersSolfegeMode): void
  /** Plays notes in the soft tone, lighting each bead or stair as it sounds; false when cut short. */
  play(notes: readonly RunNote[], audible: boolean): Promise<boolean>
  /**
   * Plays a sound the page builds of the kit's runs itself, as `play`
   * plays its notes: the page's one sound, each note lit as the run starts
   * it (`onNote`, never called before `start` returns, as the kit's runs
   * never call it); false when cut short.
   */
  playRun(start: (onNote: (n: RunNote) => void) => Run): Promise<boolean>
  /** Stops a play where it stands: its notes fall silent and its lights go out. */
  stop(): void
  /** The frame it would draw now, at its figure's last size; null before it has one. */
  scene(): BeadsScene | null
  /** Whether it has a frame to draw (frame-loop.ts). */
  wants(): boolean
}

// -------------------------------------------------------------- motion, pure

/** A value on its way from one place to another, from `t0` seconds for `dur`. */
interface Tween {
  readonly from: number
  readonly to: number
  readonly t0: number
  readonly dur: number
  readonly ease: (u: number) => number
}

const endOf = (tw: Tween): number => tw.t0 + tw.dur

/** Where a tween is at `t`; with none, the settled value. */
function valueAt(tw: Tween | null, settled: number, t: number): number {
  if (tw === null || t >= endOf(tw)) return settled
  return lerp(tw.from, tw.to, tw.ease(clamp((t - tw.t0) / tw.dur, 0, 1)))
}

const moving = (tw: Tween | null, t: number): boolean =>
  tw !== null && t < endOf(tw)

/**
 * The halo's glow `since` seconds after a third lands: up in 0.12 s, down
 * over 1.2 s, the kit's glow as the tune line's gap numbers take it, once.
 */
export function haloGlow(since: number): number {
  if (since < 0) return 0
  if (since < GLOW_RISE_SEC) return since / GLOW_RISE_SEC
  return 1 - clamp((since - GLOW_RISE_SEC) / GLOW_SEC, 0, 1)
}

/** How long the halo glows once a third lands. */
const HALO_SEC = GLOW_RISE_SEC + GLOW_SEC

// -------------------------------------------------------------- what it shows

const OPENING: Omit<BeadsSettings, 'state' | 'tempo' | 'slow' | 'names'> = {
  root: 60,
  quality: 'major',
  stacked: false,
  spread: false,
}

/** The view lines.ts words: Step 1's third and Step 2 before its stack, a triad, or its scale. */
export function viewOf(s: BeadsSettings): View {
  const pair = s.state === 'thirds' || (s.state === 'stack' && !s.stacked)
  const at = { root: s.root, quality: s.quality }
  if (s.spread) return { kind: 'scale', ...at }
  return { kind: pair ? 'third' : 'chord', ...at }
}

/** The beads a view shows, from the root up: a third's two or a triad's three. */
function beadTones(v: View): ChordTone[] {
  return v.kind === 'third'
    ? thirdOf(v.root, v.quality)
    : triad(v.root, v.quality)
}

/** The sung names, by degree, for a quality. */
const solfegeOf = (quality: Quality): readonly string[] =>
  quality === 'major' ? MAJOR_SOLFEGE : MINOR_SOLFEGE

/** Where a chord bead sits in its scale: do, mi and so. */
const degreeOf = (i: number): number => CHORD_DEGREES[i] ?? i

/** The FIFTH_LABEL on the bracket's lines: "7", "perfect", "fifth". */
function bracketWords(): string[] {
  const [size, words] = FIFTH_LABEL.split(' · ')
  return [size, ...words.split(' ')]
}

// -------------------------------------------------------------- the toy

/** Places a button over a rectangle of the drawing. */
function place(b: HTMLElement, r: Rect): void {
  b.style.left = `${r.x}px`
  b.style.top = `${r.y}px`
  b.style.width = `${r.w}px`
  b.style.height = `${r.h}px`
}

export function mountChordBeads(
  root: HTMLElement,
  opts: ChordBeadsOptions,
): ChordBeads {
  const canvas = q<HTMLCanvasElement>('[data-chord-viz] canvas', root)
  const layer = q('[data-chord-targets]', root)
  const summaryEl = q('[data-chord-summary]', root)
  const said = q('[data-chord-said]', root)
  const cv = surface(canvas)
  let settings: BeadsSettings = {
    ...OPENING,
    state: opts.state ?? 'thirds',
    tempo: 'slow',
    slow: false,
    names: 'letters',
  }
  // the motions in flight, and what the names said before each began: a
  // name changes as its bead lands
  let minor: Tween | null = null
  let rootT: Tween | null = null
  let drop: Tween | null = null
  let spreadT: Tween | null = null
  let qualityWas: Quality = settings.quality
  let rootWas = settings.root
  let lits: { midi: number; from: number; to: number }[] = []
  let run: Run | null = null
  let dirty = true
  let size: { w: number; h: number } | null = null
  let layout: ChordLayout | null = null
  let placedKey = ''
  let beadBtns: HTMLButtonElement[] = []
  let gapBtns: HTMLButtonElement[] = []

  const now = (): number => performance.now() / 1000
  const minorOf = (qy: Quality): number => (qy === 'minor' ? 1 : 0)

  function invalidate(): void {
    dirty = true
    wake()
  }

  // ------------------------------------------------------------ the scene

  /** The quality and root the names show at `t`: each one's old value until its bead lands. */
  function namedAt(t: number): { quality: Quality; root: number } {
    return {
      quality: moving(minor, t) ? qualityWas : settings.quality,
      root: moving(rootT, t) ? rootWas : settings.root,
    }
  }

  /** How much a note is lit at `t`: full while it sounds, then its afterglow. */
  function litOf(midi: number, t: number): number {
    let best = 0
    for (const l of lits)
      if (l.midi === midi) best = Math.max(best, lightAt(l.from, l.to, t))
    return best
  }

  /** The halo's glow at `t`: once, as the third lands; never under reduced motion, which starts no slide. */
  function glowAt(t: number): number {
    return minor === null ? 0 : haloGlow(t - endOf(minor))
  }

  /** The chord's pitches as drawn at `t`: fractional while they slide. */
  function chordPitches(t: number, v: View): number[] {
    const m = valueAt(minor, minorOf(settings.quality), t)
    const r = valueAt(rootT, settings.root, t)
    const pitches = [r, r + THIRD_OF.major - m]
    if (v.kind === 'third') return pitches
    const d = valueAt(drop, 0, t)
    return [...pitches, r + FIFTH + d * DROP_ROWS]
  }

  /** The scale's eight pitches as drawn at `t`: mi, la and ti a row lower in minor. */
  function scalePitches(t: number): number[] {
    const m = valueAt(minor, minorOf(settings.quality), t)
    const r = valueAt(rootT, settings.root, t)
    return MAJOR_DEGREES.map(
      (d, i) => r + d - (LOWERED_DEGREES.includes(i + 1) ? m : 0),
    )
  }

  /** A name as drawn: its letter and sign with its octave, or its syllable with the names on Do-re-mi. */
  function nameOf(tone: ChordTone, degree: number, quality: Quality): string {
    const sung =
      settings.names === 'solfege' &&
      (settings.state === 'scale' || settings.state === 'free')
    return sung ? solfegeOf(quality)[degree] : signName(tone.spelled)
  }

  function beadMarks(
    t: number,
    v: View,
    L: ChordLayout,
    S: ChordLayout | null,
    u: number,
  ): BeadMark[] {
    const named = namedAt(t)
    const tones = beadTones({ ...v, ...named })
    const settled = beadTones(v)
    const pitches = chordPitches(t, v)
    const chord = pitches.length === 3
    return pitches.map((p, i) => {
      const stair = S?.stairs[degreeOf(i)]
      const sx = stair === undefined ? 0 : stair.x + stair.w / 2
      const sy = stair?.y ?? 0
      const x = lerp(L.columnX ?? 0, sx, u)
      const y = lerp(L.yOf(p), sy, u)
      return {
        x,
        y,
        name: nameOf(tones[i], degreeOf(i), named.quality),
        nameBox: L.names[i] ?? null,
        gold: chord && i === 1,
        lit: litOf(settled[i].midi, t),
        alpha: i === 2 ? 1 - valueAt(drop, 0, t) : 1,
      }
    })
  }

  function stairMarks(t: number, S: ChordLayout | null): StairMark[] {
    if (S === null) return []
    const named = namedAt(t)
    const tones = scaleOf(named.root, named.quality)
    const settled = scaleOf(settings.root, settings.quality)
    return S.stairs.map((box, i) => ({
      box,
      name: nameOf(tones[i], i, named.quality),
      gold: i === 2,
      lit: litOf(settled[i].midi, t),
    }))
  }

  function gapMarks(t: number, L: ChordLayout): GapMark[] {
    const third = THIRD_OF[namedAt(t).quality]
    const sizes = [third, FIFTH - third]
    return L.gaps.map((box, i) => ({ box, label: gapLabel(sizes[i]) }))
  }

  function stripOf(t: number, v: View, L: ChordLayout): BeadsScene['strip'] {
    if (L.strip === null) return null
    const named = { ...v, ...namedAt(t) }
    const compact = L.mode === 'compact'
    return {
      box: L.strip,
      text: nameStrip(named),
      readout:
        settings.state === 'pattern'
          ? patternReadout(named.root, named.quality, settings.tempo)
          : null,
      readoutX: compact ? L.width - 4 : L.strip.x + L.strip.w - 14,
      compact,
    }
  }

  function haloOf(
    t: number,
    beads: readonly BeadMark[],
    L: ChordLayout,
  ): BeadsScene['halo'] {
    if (beads.length !== 3) return null
    // round the chord, inside the compact figure's 22 px above and below
    const pad = L.mode === 'compact' ? 18 : 26
    const ys = beads.map((b) => b.y)
    const top = Math.min(...ys) - pad
    const x = beads[0].x - 30
    return {
      box: { x, y: top, w: 60, h: Math.max(...ys) + pad - top },
      glow: HALO_REST + (1 - HALO_REST) * glowAt(t),
    }
  }

  /** The frame at `t` for a `w` by `h` figure. */
  function sceneAt(t: number, w: number, h: number): BeadsScene {
    const v = viewOf(settings)
    const chordView: View = v.kind === 'scale' ? { ...v, kind: 'chord' } : v
    const u = valueAt(spreadT, settings.spread ? 1 : 0, t)
    const L = chordLayout({
      width: w,
      height: h,
      state: settings.state,
      notes: chordPitches(t, chordView),
    })
    const S =
      u > 0
        ? chordLayout({
            width: w,
            height: h,
            state: settings.state,
            notes: scalePitches(t),
          })
        : null
    const beads = beadMarks(t, chordView, L, S, u)
    return {
      rows: [
        { layout: L, alpha: 1 - u },
        ...(S === null ? [] : [{ layout: S, alpha: u }]),
      ],
      halo: haloOf(t, beads, L),
      beads,
      stairs: stairMarks(t, S),
      spread: u,
      gaps: gapMarks(t, L),
      bracket:
        L.bracket === null ? null : { box: L.bracket, label: bracketWords() },
      strip: stripOf(t, chordView, L),
    }
  }

  // ------------------------------------------------------------ the buttons

  /** The settled notes the buttons sit on: none in a spread scale, where no stair is a target. */
  function targetNotes(v: View): number[] {
    return v.kind === 'scale' ? [] : beadTones(v).map((n) => n.midi)
  }

  /** Lays the buttons out for a `w` by `h` figure, when what they sit on has changed. */
  function placeTargets(w: number, h: number): void {
    const v = viewOf(settings)
    const notes = targetNotes(v)
    const key = `${w} ${h} ${settings.state} ${notes.join(',')}`
    if (key === placedKey && layout !== null) return
    placedKey = key
    layout =
      notes.length === 0
        ? null
        : chordLayout({ width: w, height: h, state: settings.state, notes })
    beadBtns.forEach((b, i) => {
      const r = layout?.beads[i]
      if (r !== undefined) place(b, r)
    })
    gapBtns.forEach((b, i) => {
      const r = layout?.gaps[i]
      if (r !== undefined) place(b, r)
    })
  }

  function makeButton(kind: 'bead' | 'gap', i: number): HTMLButtonElement {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = `chord-hit chord-hit-${kind}`
    b.dataset[kind] = String(i)
    return b
  }

  /** The buttons for what the toy now shows, named, in the tab order: beads from the root up, then gaps. */
  function syncTargets(): void {
    const v = viewOf(settings)
    const beads = beadNames(v)
    const gaps =
      settings.state === 'pattern' || settings.state === 'scale'
        ? []
        : gapNames(v)
    if (beadBtns.length !== beads.length || gapBtns.length !== gaps.length) {
      beadBtns = beads.map((_, i) => makeButton('bead', i))
      gapBtns = gaps.map((_, i) => makeButton('gap', i))
      layer.replaceChildren(...beadBtns, ...gapBtns)
      placedKey = ''
    }
    beadBtns.forEach((b, i) => b.setAttribute('aria-label', beads[i]))
    gapBtns.forEach((b, i) => b.setAttribute('aria-label', gaps[i]))
    layer.hidden = beadBtns.length + gapBtns.length === 0
    summaryEl.textContent = summary(v)
    size ??= measure()
    if (size !== null) placeTargets(size.w, size.h)
  }

  /** The figure's size now, if it has one. */
  function measure(): { w: number; h: number } | null {
    const r = canvas.getBoundingClientRect()
    if (r.width <= 0 || r.height <= 0) return null
    return { w: Math.round(r.width), h: Math.round(r.height) }
  }

  // ------------------------------------------------------------ sound

  /** Stops the toy's play where it stands, and lets the page's sound go. */
  function stop(): void {
    const r = run
    run = null
    r?.stop()
    if (lits.length > 0) invalidate()
    lits = []
    opts.owner?.release(stop)
  }

  function playRun(
    start: (onNote: (n: RunNote) => void) => Run,
  ): Promise<boolean> {
    stop()
    opts.owner?.claim(stop)
    const r = start((n) => {
      if (run !== r) return
      const t = now()
      lits.push({ midi: n.midi, from: t, to: t + n.dur })
      invalidate()
    })
    run = r
    return r.done.then((heard) => {
      if (run === r) {
        run = null
        opts.owner?.release(stop)
      }
      return heard
    })
  }

  function play(notes: readonly RunNote[], audible: boolean): Promise<boolean> {
    return playRun((onNote) =>
      playNotes(notes, { audible, kind: 'soft', onNote }),
    )
  }

  layer.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>('.chord-hit')
    if (b === null) return
    const v = viewOf(settings)
    const tones = beadTones(v)
    const audible = Sound.canPlay()
    if (b.dataset.bead !== undefined) {
      const tone = tones[Number(b.dataset.bead)]
      void play([{ t: 0, midi: tone.midi, dur: TAP_SEC }], audible)
      return
    }
    const g = Number(b.dataset.gap)
    const notes = gapSound(tones[g].midi, tones[g + 1].midi)
    void play(settings.slow ? slow(notes) : notes, audible)
  })

  // ------------------------------------------------------------ changes

  /** Starts a tween from where its value is now, or none under reduced motion, which lands at once. */
  function tween(
    from: number,
    to: number,
    dur: number,
    ease: (u: number) => number,
  ): Tween | null {
    return reducedMotion() ? null : { from, to, t0: now(), dur, ease }
  }

  function say(line: string): void {
    said.textContent = line
  }

  /** What the toy shows has changed: its buttons, its summary and its next frame follow. */
  function changed(): void {
    syncTargets()
    invalidate()
  }

  function announce(action: Action): void {
    const v = viewOf(settings)
    if (v.kind !== 'third') say(changedLine(action, v as ChordOrScale))
  }

  const toy: ChordBeads = {
    get settings() {
      return settings
    },
    get view() {
      return viewOf(settings)
    },
    get layout() {
      return layout
    },
    setState(state, quality = 'major') {
      stop()
      minor = null
      rootT = null
      drop = null
      spreadT = null
      settings = { ...settings, ...OPENING, state, quality }
      qualityWas = quality
      rootWas = settings.root
      changed()
    },
    setQuality(quality) {
      if (quality === settings.quality) return 0
      // Step 4's switches act from the next quaver, so its sound plays on
      if (settings.state !== 'pattern') stop()
      const t = now()
      qualityWas = namedAt(t).quality
      minor = tween(
        valueAt(minor, minorOf(settings.quality), t),
        minorOf(quality),
        MOTION.third,
        easeOut3,
      )
      settings = { ...settings, quality }
      changed()
      say(qualityLine(viewOf(settings)))
      return minor === null ? 0 : MOTION.third
    },
    slideRoot(dir) {
      const next = nextRoot(settings.root, dir)
      if (next === null) return false
      stop()
      const t = now()
      rootWas = namedAt(t).root
      rootT = tween(
        valueAt(rootT, settings.root, t),
        next,
        MOTION.root,
        easeOut3,
      )
      settings = { ...settings, root: next }
      changed()
      announce(dir < 0 ? 'root-lower' : 'root-higher')
      return true
    },
    stack() {
      if (settings.state !== 'stack' || settings.stacked) return
      stop()
      drop = tween(1, 0, MOTION.drop, easeOut3)
      settings = { ...settings, stacked: true }
      changed()
      announce('stack')
    },
    setSpread(on) {
      const can = settings.state === 'scale' || settings.state === 'free'
      if (!can || on === settings.spread) return
      stop()
      const t = now()
      spreadT = tween(
        valueAt(spreadT, settings.spread ? 1 : 0, t),
        on ? 1 : 0,
        MOTION.spread,
        easeOutExpo,
      )
      settings = { ...settings, spread: on }
      changed()
      announce(on ? 'scale' : 'chord')
    },
    setTempo(tempo) {
      settings = { ...settings, tempo }
      invalidate()
    },
    setSlow(on) {
      settings = { ...settings, slow: on }
    },
    setNames(mode) {
      if (mode === settings.names) return
      stop()
      settings = { ...settings, names: mode }
      invalidate()
    },
    play,
    playRun,
    stop,
    scene() {
      const s = size ?? measure()
      return s === null ? null : sceneAt(now(), s.w, s.h)
    },
    wants() {
      if (dirty) return true
      const t = now()
      const glowing = minor !== null && t < endOf(minor) + HALO_SEC
      return (
        glowing ||
        [minor, rootT, drop, spreadT].some((tw) => moving(tw, t)) ||
        lits.some((l) => t < l.to + AFTERGLOW_SEC)
      )
    },
  }

  function draw(): void {
    dirty = false
    const { ctx, w, h } = cv.fit()
    size = { w, h }
    placeTargets(w, h)
    paintBeads(ctx, sceneAt(now(), w, h))
    const t = now()
    lits = lits.filter((l) => t < l.to + AFTERGLOW_SEC)
  }

  addDrawer({ active: opts.active, wants: toy.wants, draw })
  // a new size draws at once, before the page paints, and the buttons move
  // with it, on screen or off, so none hangs past a narrower figure
  new ResizeObserver(() => {
    if (opts.active()) draw()
    else {
      size = measure()
      if (size !== null) placeTargets(size.w, size.h)
      invalidate()
    }
  }).observe(canvas)
  watchPixelRatio(invalidate)
  void document.fonts?.ready.then(invalidate)
  document.fonts?.addEventListener('loadingdone', invalidate)
  syncTargets()
  return toy
}

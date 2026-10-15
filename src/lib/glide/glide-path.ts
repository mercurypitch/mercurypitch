// ============================================================
// Glide path — the moving target of Ng slides and Lip roll, as segments
// ============================================================
//
// A run is a row of arches. Each arch is an up glide, a short top, a down
// glide and a short landing on the root; a rest sits between arches: a
// pause, then the breath (where the room plays the next root, if the level
// does). The rest is one segment, phase 'breath'. The arch's sung part (up,
// top and down) is what the engine judges; the landing gives a trailing
// voice a root to arrive on, and the rest is never judged.
//
// The arch's shape is the room's drawing: the bridge's rim was measured as
// y = deck - h * g(|x - x_c| / a), with g flat for u <= f and
// 1 - S((u - f) / (1 - f)) after it, S the smoothstep 3t^2 - 2t^3 and
// f = top / (up + top + down) (ng-geometry, 14 Oct 2026). With x linear in
// time inside a slide, that is exactly a smoothstep up, a flat top and a
// smoothstep down, which is what `ease: 'smooth'` draws here. The room
// draws the target line from targetAt, so the two cannot disagree. The
// landing is time on the root: the room may draw it narrower than its
// time, and nothing here ties a time to a width.
//
// Segments carry the fields the web warm-up's glides carry (a start and an
// end in seconds, a start and an end note, ResolvedZenTarget in
// src/features/zen/types.ts), so pathFromTargets takes those patterns as
// they are, with the warm-up's linear glides.

/** What a segment asks of the voice: nothing, a moving note, a held note. */
export type GlideSegmentKind = 'rest' | 'glide' | 'hold'

/** Where in an arch a segment sits. */
export type GlidePhase = 'breath' | 'up' | 'top' | 'down' | 'landing'

/** How a glide moves between its notes. */
export type GlideEase = 'smooth' | 'linear'

export interface GlideSegment {
  readonly kind: GlideSegmentKind
  readonly phase: GlidePhase
  /**
   * The arch it belongs to. A breath belongs to the arch it leads into, so
   * the room can draw that arch's root from the start of the breath.
   */
  readonly arch: number
  /** Seconds on the path's clock; the segment covers [start, end). */
  readonly start: number
  readonly end: number
  /** MIDI at the start and the end; a rest carries the next root. */
  readonly fromMidi: number
  readonly toMidi: number
  readonly ease: GlideEase
}

export interface GlideArch {
  readonly index: number
  readonly rootMidi: number
  readonly topMidi: number
  /** The up glide starts: the judged part begins. */
  readonly start: number
  /** The top: where the Pro level asks for the top note. */
  readonly topStart: number
  readonly topEnd: number
  /** The down glide ends: the judged part ends. */
  readonly end: number
  /** The landing ends. */
  readonly landingEnd: number
}

export interface GlidePath {
  readonly segments: readonly GlideSegment[]
  readonly arches: readonly GlideArch[]
  /** The end of the last segment, seconds. */
  readonly duration: number
}

/** One arch's timing, seconds. */
export interface ArchTiming {
  readonly upSec: number
  readonly topSec: number
  readonly downSec: number
  readonly landingSec: number
  /**
   * Silence after a landing, before the breath: the room stands still and
   * plays nothing, so the next root's tone is heard as the next arch's.
   */
  readonly pauseSec: number
  /** The breath before the next arch (the count-in ends with one too). */
  readonly breathSec: number
}

/** Ng slides: each slide goes up a fifth. */
export const NG_SLIDE_SEMITONES = 7

/** Ng slides: five slides, each a semitone above the last. */
export const NG_SLIDE_COUNT = 5

/** Lip roll: three waves. */
export const LIP_ROLL_WAVES = 3

/** Lip roll: each wave goes up an octave, unless the voice is narrow. */
export const LIP_ROLL_SEMITONES = 12

/** S(t) = 3t^2 - 2t^3: zero slope at both ends. */
export function smoothstep(t: number): number {
  const x = t <= 0 ? 0 : t >= 1 ? 1 : t
  return x * x * (3 - 2 * x)
}

/** The segment's note at `t`, MIDI; a rest has none. */
function segmentMidi(segment: GlideSegment, t: number): number | null {
  if (segment.kind === 'rest') return null
  if (segment.kind === 'hold') return segment.fromMidi
  const span = segment.end - segment.start
  const linear = span > 0 ? (t - segment.start) / span : 1
  const progress = linear <= 0 ? 0 : linear >= 1 ? 1 : linear
  const eased = segment.ease === 'smooth' ? smoothstep(progress) : progress
  return segment.fromMidi + (segment.toMidi - segment.fromMidi) * eased
}

/**
 * The index of the segment `t` falls in, or -1 outside the path. A time on
 * a boundary belongs to the segment that starts there; the path's end
 * belongs to its last segment.
 */
export function segmentIndexAt(path: GlidePath, t: number): number {
  const segments = path.segments
  const count = segments.length
  if (count === 0 || t < segments[0].start || t > path.duration) return -1
  let lo = 0
  let hi = count - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (segments[mid].start <= t) lo = mid
    else hi = mid - 1
  }
  return lo
}

/** Which segment, so which arch and phase, `t` belongs to; null outside. */
export function segmentAt(path: GlidePath, t: number): GlideSegment | null {
  const index = segmentIndexAt(path, t)
  return index < 0 ? null : path.segments[index]
}

/**
 * The target at `t`, MIDI (fractional while it moves); null in a breath
 * and outside the path. Allocation-free: the engine calls it about fifteen
 * times a frame.
 */
export function targetAt(path: GlidePath, t: number): number | null {
  const index = segmentIndexAt(path, t)
  return index < 0 ? null : segmentMidi(path.segments[index], t)
}

/**
 * The arch whose sung part (up, top and down) holds `t`, or -1. The
 * landing and the breath belong to none: they are not judged.
 */
export function judgedArchAt(path: GlidePath, t: number): number {
  const segment = segmentAt(path, t)
  if (segment === null) return -1
  const arch = path.arches[segment.arch]
  return arch !== undefined && t >= arch.start && t <= arch.end
    ? arch.index
    : -1
}

/**
 * A row of arches on `roots`, each rising `semitones` and back, eased as
 * the room draws them. A rest (the pause and the breath) separates
 * arches; none comes before the first or after the last. The first arch
 * starts at `startAt`.
 */
export function buildArchPath(
  roots: readonly number[],
  semitones: number,
  timing: ArchTiming,
  startAt = 0,
): GlidePath {
  const segments: GlideSegment[] = []
  const arches: GlideArch[] = []
  let t = startAt
  roots.forEach((root, arch) => {
    const top = root + semitones
    if (arch > 0) {
      const restSec = timing.pauseSec + timing.breathSec
      segments.push(rest(arch, t, t + restSec, root))
      t += restSec
    }
    const start = t
    const topStart = start + timing.upSec
    const topEnd = topStart + timing.topSec
    const end = topEnd + timing.downSec
    const landingEnd = end + timing.landingSec
    segments.push(
      glide('up', arch, start, topStart, root, top, 'smooth'),
      hold('top', arch, topStart, topEnd, top),
      glide('down', arch, topEnd, end, top, root, 'smooth'),
      hold('landing', arch, end, landingEnd, root),
    )
    arches.push({
      index: arch,
      rootMidi: root,
      topMidi: top,
      start,
      topStart,
      topEnd,
      end,
      landingEnd,
    })
    t = landingEnd
  })
  return { segments, arches, duration: t }
}

/**
 * The arch whose root a room plays at `t`, or null: in a rest, once its
 * pause is over, at a level that plays the next root, and only once a
 * rest (`played` keeps the arches already played, and gains this one).
 */
export function restToneDue(
  path: GlidePath,
  timing: Pick<ArchTiming, 'pauseSec'> & { readonly playsNextRoot: boolean },
  t: number,
  played: Set<number>,
): number | null {
  if (!timing.playsNextRoot) return null
  const segment = segmentAt(path, t)
  if (segment === null || segment.phase !== 'breath') return null
  if (t < segment.start + timing.pauseSec || played.has(segment.arch)) {
    return null
  }
  played.add(segment.arch)
  return segment.arch
}

function rest(
  arch: number,
  start: number,
  end: number,
  nextRoot: number,
): GlideSegment {
  return {
    kind: 'rest',
    phase: 'breath',
    arch,
    start,
    end,
    fromMidi: nextRoot,
    toMidi: nextRoot,
    ease: 'linear',
  }
}

function hold(
  phase: GlidePhase,
  arch: number,
  start: number,
  end: number,
  midi: number,
): GlideSegment {
  return {
    kind: 'hold',
    phase,
    arch,
    start,
    end,
    fromMidi: midi,
    toMidi: midi,
    ease: 'linear',
  }
}

function glide(
  phase: GlidePhase,
  arch: number,
  start: number,
  end: number,
  fromMidi: number,
  toMidi: number,
  ease: GlideEase,
): GlideSegment {
  return { kind: 'glide', phase, arch, start, end, fromMidi, toMidi, ease }
}

/** Ng slides' roots: five slides from `root`, a semitone apart. */
export function ngSlideRoots(root: number): number[] {
  return Array.from({ length: NG_SLIDE_COUNT }, (_, k) => root + k)
}

/** Ng slides: one slide a root, each up a fifth and back. */
export function ngSlidesPath(
  roots: readonly number[],
  timing: ArchTiming,
  startAt = 0,
): GlidePath {
  return buildArchPath(roots, NG_SLIDE_SEMITONES, timing, startAt)
}

/** Lip roll: one wave a root, each up `semitones` (an octave) and back. */
export function lipRollPath(
  roots: readonly number[],
  semitones: number,
  timing: ArchTiming,
  startAt = 0,
): GlidePath {
  return buildArchPath(roots, semitones, timing, startAt)
}

/**
 * A web warm-up target once resolved to seconds and notes: the fields of
 * ResolvedZenTarget (src/features/zen/types.ts) the path needs. Spelled
 * here so lib does not import a feature.
 */
export interface TimedTarget {
  readonly startSec: number
  readonly endSec: number
  readonly startMidi: number
  readonly endMidi: number
}

/** Up, down or a held note, from a target's two notes. */
function phaseOfTarget(target: TimedTarget, previous: GlidePhase | null) {
  if (target.endMidi > target.startMidi) return 'up'
  if (target.endMidi < target.startMidi) return 'down'
  return previous === 'up' ? 'top' : 'landing'
}

/** A new arch starts after a breath, and at an up after the arch came down. */
function startsArch(phase: GlidePhase, previous: GlidePhase | null): boolean {
  if (previous === null || previous === 'breath') return true
  return phase === 'up' && (previous === 'down' || previous === 'landing')
}

/**
 * The web warm-up's pitch targets as a path, glides linear as the warm-up
 * moves them (targetMidiAt in src/features/zen/zen-model.ts), a gap between
 * targets a breath. Each arch's judged part runs from its first target's
 * start to its last target's end, so a pattern of plain notes (the web lip
 * trill) is a row of one-note arches. Targets must be in time order.
 */
export function pathFromTargets(targets: readonly TimedTarget[]): GlidePath {
  const segments: GlideSegment[] = []
  const arches: GlideArch[] = []
  let previous: GlidePhase | null = null
  let arch = -1
  for (const target of targets) {
    const last = segments[segments.length - 1]
    if (last !== undefined && target.startSec > last.end) {
      segments.push(rest(arch + 1, last.end, target.startSec, target.startMidi))
      previous = 'breath'
    }
    const phase = phaseOfTarget(target, previous)
    if (startsArch(phase, previous)) arch += 1
    segments.push(
      phase === 'up' || phase === 'down'
        ? glide(
            phase,
            arch,
            target.startSec,
            target.endSec,
            target.startMidi,
            target.endMidi,
            'linear',
          )
        : hold(phase, arch, target.startSec, target.endSec, target.startMidi),
    )
    previous = phase
  }
  for (let index = 0; index <= arch; index++) {
    arches.push(archOf(segments, index))
  }
  const end = segments[segments.length - 1]?.end ?? 0
  return { segments, arches, duration: end }
}

/** An arch read back off its segments (pathFromTargets). */
function archOf(segments: readonly GlideSegment[], index: number): GlideArch {
  const own = segments.filter((s) => s.arch === index && s.kind !== 'rest')
  const first = own[0]
  const last = own[own.length - 1]
  const top = own.find((s) => s.phase === 'top')
  let topMidi = first.fromMidi
  for (const s of own) topMidi = Math.max(topMidi, s.fromMidi, s.toMidi)
  return {
    index,
    rootMidi: first.fromMidi,
    topMidi,
    start: first.start,
    topStart: top?.start ?? last.end,
    topEnd: top?.end ?? last.end,
    end: last.end,
    landingEnd: last.end,
  }
}

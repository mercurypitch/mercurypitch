// ============================================================
// Glide presets — Ng slides and Lip roll at each exercise level
// ============================================================
//
// The level is the Settings accuracy tier (src/stores/exercise-level.ts;
// owner, 12 Oct 2026): Learning is the designs' Beginner, Singer is
// Singer, Professional is Pro. Keyed by the tier ids, as ECHO_LEVELS and
// LANTERN_LEVELS are, so a tier with no glide level fails to compile where
// the level is looked up.
//
// The numbers are the designs' tables (DESIGN-ng-slides.md §3,
// DESIGN-lip-roll.md §3). Three are not in them and were chosen here:
//
// - The landing (the hold on the root after the down glide) is as long as
//   the top. That puts each run within a second of the designs' run
//   lengths with a one-second count-in.
// - The lead (how far ahead of the line a voice may run and still count)
//   is a third of the lag at every level: singers trail a moving target
//   far more often than they lead it.
// - Lip roll's Pro top asks for the same 200 ms on the crest as Ng's.

import type { ArchTiming } from './glide-path'

/** The top note, judged: within `tolCents` of it for `holdMs` together. */
export interface TopRule {
  readonly tolCents: number
  readonly holdMs: number
}

export interface GlidePreset extends ArchTiming {
  /** Half-width of the band around the path, cents. */
  readonly bandCents: number
  /** How far behind the path a voice may run and still be on it, ms. */
  readonly lagMs: number
  /** How far ahead of it, ms. */
  readonly leadMs: number
  /** Unvoiced this long inside an arch, once the voice started there, ms. */
  readonly breakMs: number
  /** An arch counts as lit at this share of its sung time on the path. */
  readonly litShare: number
  /** The top note, judged at Pro only; null where it is not judged. */
  readonly top: TopRule | null
  /**
   * Gaps in the voice up to this long are bridged: the voice counts as
   * still there, on or off the path as it was, and no break is called.
   * 0 bridges nothing.
   */
  readonly bridgeGapMs: number
  /** The room plays the next arch's root during each breath. */
  readonly playsNextRoot: boolean
}

/**
 * Ng slides at each level (DESIGN-ng-slides.md §3, Levels). The next root
 * plays in the breath at Beginner and Singer; at Pro only before slide 1,
 * which is the room's count-in, not a breath.
 */
export const NG_SLIDES_LEVELS = {
  learning: {
    upSec: 1.5,
    topSec: 0.5,
    downSec: 1.5,
    landingSec: 0.5,
    breathSec: 1.6,
    bandCents: 80,
    lagMs: 300,
    leadMs: 100,
    breakMs: 300,
    litShare: 0.7,
    top: null,
    bridgeGapMs: 0,
    playsNextRoot: true,
  },
  singer: {
    upSec: 1.2,
    topSec: 0.4,
    downSec: 1.2,
    landingSec: 0.4,
    breathSec: 1.3,
    bandCents: 55,
    lagMs: 200,
    leadMs: 67,
    breakMs: 200,
    litShare: 0.8,
    top: null,
    bridgeGapMs: 0,
    playsNextRoot: true,
  },
  professional: {
    upSec: 0.9,
    topSec: 0.3,
    downSec: 0.9,
    landingSec: 0.3,
    breathSec: 1.0,
    bandCents: 35,
    lagMs: 120,
    leadMs: 40,
    breakMs: 150,
    litShare: 0.9,
    top: { tolCents: 30, holdMs: 200 },
    bridgeGapMs: 0,
    playsNextRoot: false,
  },
} satisfies Record<string, GlidePreset>

/**
 * Lip roll bridges tracker gaps up to this long before calling a break.
 * On until the tracker check (DESIGN-lip-roll.md, build order step 1)
 * shows the stream holds a phone's lip trill with no gap over 150 ms.
 */
export const LIP_ROLL_BRIDGE_GAP_MS = 150

/**
 * Lip roll at each level (DESIGN-lip-roll.md §3, Levels): a wider band and
 * lag than Ng's, because a trill's pitch wobbles with the lips.
 */
export const LIP_ROLL_LEVELS = {
  learning: {
    upSec: 2.4,
    topSec: 0.4,
    downSec: 2.4,
    landingSec: 0.4,
    breathSec: 1.8,
    bandCents: 100,
    lagMs: 350,
    leadMs: 117,
    breakMs: 300,
    litShare: 0.65,
    top: null,
    bridgeGapMs: LIP_ROLL_BRIDGE_GAP_MS,
    playsNextRoot: true,
  },
  singer: {
    upSec: 2.0,
    topSec: 0.3,
    downSec: 2.0,
    landingSec: 0.3,
    breathSec: 1.5,
    bandCents: 70,
    lagMs: 250,
    leadMs: 83,
    breakMs: 200,
    litShare: 0.75,
    top: null,
    bridgeGapMs: LIP_ROLL_BRIDGE_GAP_MS,
    playsNextRoot: true,
  },
  professional: {
    upSec: 1.6,
    topSec: 0.2,
    downSec: 1.6,
    landingSec: 0.2,
    breathSec: 1.2,
    bandCents: 50,
    lagMs: 150,
    leadMs: 50,
    breakMs: 150,
    litShare: 0.85,
    top: { tolCents: 40, holdMs: 200 },
    bridgeGapMs: LIP_ROLL_BRIDGE_GAP_MS,
    playsNextRoot: false,
  },
} satisfies Record<string, GlidePreset>

export type GlideLevelId = keyof typeof NG_SLIDES_LEVELS &
  keyof typeof LIP_ROLL_LEVELS

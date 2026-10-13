// ============================================================
// Sky scene: what the sky shows at one moment, in plate places
// ============================================================
//
// The room's controller (and the dev fixtures) describe the sky as a
// scene: the rings still waiting, the stars lit, the lines between them,
// and whether the result's lit town and celebration star show. EchoSky
// draws a scene; nothing here touches the page.
//
// Places are plate fractions at the content's own size (k = 1); EchoSky
// gathers them toward the open sky's floor by the layout's k (the take's,
// or the result's when `result` is set), so a short room shows the same
// shapes smaller.

import type { StarTint } from './echo-art'
import type { StarSize } from './echo-geometry'

export type RingStyle = 'waiting' | 'active' | 'missed'
export type LineStyle = 'phrase' | 'finished' | 'result'

export interface SceneRing {
  readonly key: string
  readonly u: number
  readonly v: number
  /** Radius, W at k = 1. */
  readonly rW: number
  readonly style: RingStyle
  /** It fades in after this, ms from the scene's start (the call). */
  readonly appearMs?: number
}

export interface SceneStar {
  readonly key: string
  readonly u: number
  readonly v: number
  /** Tip to tip, W at k = 1. */
  readonly widthW: number
  readonly size: StarSize
  /** The painted tint laid over the base sprite, and how much of it. */
  readonly tint: StarTint
  readonly mix: number
  /** It has just lit: it pops in. */
  readonly pop?: boolean
}

export interface SceneLine {
  readonly key: string
  readonly a: readonly [number, number]
  readonly b: readonly [number, number]
  readonly style: LineStyle
}

export interface SkyScene {
  readonly rings: readonly SceneRing[]
  readonly stars: readonly SceneStar[]
  readonly lines: readonly SceneLine[]
  /** The result: the town lit, every place at the result's k. */
  readonly result: boolean
  /** The result's celebration star over the town. */
  readonly celebration: boolean
}

export const EMPTY_SCENE: SkyScene = {
  rings: [],
  stars: [],
  lines: [],
  result: false,
  celebration: false,
}

/** The tints a live star is drawn with, over its base sprite. */
const LIVE_TINTS: readonly StarTint[] = ['violet', 'cyan', 'bright']

/**
 * A live star's tint, the same every time for the same key: one of the
 * painted tints over the base sprite, by a share between a quarter and
 * all of it, so no two stars in a constellation need look alike and all of
 * them stay inside the storyboard's range.
 */
export function liveTint(key: string): { tint: StarTint; mix: number } {
  let hash = 2166136261
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i)
    hash = Math.imul(hash, 16777619) >>> 0
  }
  const tint = LIVE_TINTS[hash % LIVE_TINTS.length]
  const mix = 0.25 + (((hash >>> 8) % 1000) / 1000) * 0.75
  return { tint, mix: Math.round(mix * 100) / 100 }
}

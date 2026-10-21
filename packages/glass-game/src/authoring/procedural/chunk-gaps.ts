// Assembled gaps — classify every authored connection and emit compiler-compatible flat gaps.

import type { CloudwayCourseGapSource, CloudwayCourseGapState, } from '../cloudway-course-source.ts'
import { platformContactAtState } from '../compile-cloudway-platforms.ts'
import { compileAssembledPlatform } from './chunk-envelopes.ts'
import type { AssembledCourseData, AssembledGap } from './chunk-stitcher.ts'

export interface AssembledGapClassification {
  readonly id: string
  readonly kind:
    | 'flat-gap'
    | 'touching-seam'
    | 'elevated-route'
    | 'diagonal-route'
    | 'invalid'
  readonly fromState: CloudwayCourseGapState
  readonly toState: CloudwayCourseGapState
  readonly distance: number
  readonly heightDelta: number
  readonly source?: CloudwayCourseGapSource
}

export function classifyAssembledCourseGaps(
  assembled: Pick<AssembledCourseData, 'platforms'> & {
    readonly gaps?: readonly AssembledGap[]
  },
): readonly AssembledGapClassification[] {
  const platforms = new Map(
    assembled.platforms.map((p) => [p.id, compileAssembledPlatform(p)]),
  )
  return (assembled.gaps ?? []).map(
    (gap: AssembledGap): AssembledGapClassification => {
      const from = platforms.get(gap.platformAId),
        to = platforms.get(gap.platformBId)
      if (from === undefined || to === undefined)
        throw new Error(`Gap ${gap.id} references a missing platform`)
      const axis = gap.axis
      const direction = to.center[axis] > from.center[axis] ? 1 : -1
      const fromState =
        gap.fromState ??
        (from.definition.behavior?.kind === 'glide'
          ? 'glide-end'
          : from.definition.behavior?.kind === 'scroll' &&
              from.definition.behavior.axis === axis
            ? 'scroll-extended'
            : 'base')
      const toState =
        gap.toState ??
        (to.definition.behavior?.kind === 'scroll' &&
        to.definition.behavior.axis === axis
          ? 'scroll-extended'
          : 'base')
      const a = platformContactAtState(
        from,
        fromState,
        axis,
        direction,
        `gaps.${gap.id}.fromState`,
      )
      const b = platformContactAtState(
        to,
        toState,
        axis,
        direction === 1 ? -1 : 1,
        `gaps.${gap.id}.toState`,
      )
      const distance =
        axis === 'x'
          ? direction === 1
            ? b.bounds.minX - a.bounds.maxX
            : a.bounds.minX - b.bounds.maxX
          : direction === 1
            ? b.bounds.minZ - a.bounds.maxZ
            : a.bounds.minZ - b.bounds.maxZ
      const crossOverlap =
        axis === 'x'
          ? Math.min(a.bounds.maxZ, b.bounds.maxZ) -
            Math.max(a.bounds.minZ, b.bounds.minZ)
          : Math.min(a.bounds.maxX, b.bounds.maxX) -
            Math.max(a.bounds.minX, b.bounds.minX)
      const heightDelta = b.top - a.top
      const common = { id: gap.id, fromState, toState, distance, heightDelta }
      if (crossOverlap <= 0) return { ...common, kind: 'diagonal-route' }
      if (Math.abs(heightDelta) > 0.0801)
        return { ...common, kind: 'elevated-route' }
      if (distance < -0.001) return { ...common, kind: 'invalid' }
      if (distance <= 0.001) return { ...common, kind: 'touching-seam' }
      return {
        ...common,
        kind: 'flat-gap',
        source: {
          id: gap.id,
          fromPlatformId: gap.platformAId,
          toPlatformId: gap.platformBId,
          axis,
          fromState,
          toState,
          distance,
        },
      }
    },
  )
}

/** Elevated and diagonal links remain classified route obligations, never fake flat gaps. */
export function buildAssembledCourseGaps(
  assembled: AssembledCourseData,
): CloudwayCourseGapSource[] {
  return classifyAssembledCourseGaps(assembled).flatMap((gap) => {
    if (gap.kind === 'invalid') throw new Error(`Invalid route gap: ${gap.id}`)
    return gap.source === undefined ? [] : [gap.source]
  })
}

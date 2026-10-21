// Assembled geometry audit — reject colliding volumes and unsupported gameplay anchors.

import { CLOUDWAY_LABORATORY_COURSE_PROFILES } from '../../content/cloudway-laboratory-profiles.ts'
import { PROCEDURAL_COURT_BARRIERS } from '../../content/procedural-court-barriers.ts'
import type { PlatformRenderQuarterTurns } from '../../contracts.ts'
import { MOVEMENT } from '../../core/movement.ts'
import { barrierSolid } from '../compile-cloudway-encounters.ts'
import { compileAssembledPlatform, envelopesIntersect, isPearlButtSeam, platformContactEnvelope, platformVisualEnvelope, sweepEnvelope, } from './chunk-envelopes.ts'
import { classifyAssembledCourseGaps } from './chunk-gaps.ts'
import type { AssembledCourseData, AssembledPlatform, } from './chunk-stitcher.ts'

export interface AssembledGeometryIssue {
  readonly id:
    | 'unknown-profile'
    | 'invalid-platform'
    | 'contact-overlap'
    | 'visual-overlap'
    | 'decorative-seam-overlap'
    | 'invalid-join'
    | 'unsupported-anchor'
    | 'invalid-route-gap'
    | 'gap-clearance'
    | 'barrier-route-intersection'
    | 'headroom-obstruction'
  readonly severity: 'error' | 'notice'
  readonly platformIds: readonly string[]
  readonly detail: string
}

export function getAssembledGeometryIssues(
  assembled: Pick<AssembledCourseData, 'platforms'> &
    Partial<
      Pick<AssembledCourseData, 'joins' | 'encounters' | 'checkpoints' | 'gaps'>
    >,
): readonly AssembledGeometryIssue[] {
  const issues: AssembledGeometryIssue[] = []
  const entries = assembled.platforms.flatMap((p) => {
    try {
      const compiled = compileAssembledPlatform(p)
      const translation =
        compiled.definition.behavior?.kind === 'glide'
          ? compiled.definition.behavior.translation
          : undefined
      return [
        {
          p,
          contact: sweepEnvelope(platformContactEnvelope(p), translation),
          visual: sweepEnvelope(platformVisualEnvelope(p), translation),
        },
      ]
    } catch (error) {
      const detail = String(error)
      issues.push({
        id:
          detail.includes('unknown') || detail.includes('Unknown')
            ? 'unknown-profile'
            : 'invalid-platform',
        severity: 'error',
        platformIds: [p.id],
        detail,
      })
      return []
    }
  })
  const pairKey = (a: string, b: string) => [a, b].sort().join('|')
  const joins = new Set<string>()
  for (const join of assembled.joins ?? []) {
    const a = assembled.platforms.find((p) => p.id === join.platformAId)
    const b = assembled.platforms.find((p) => p.id === join.platformBId)
    if (a !== undefined && b !== undefined && isPearlButtSeam(a, b))
      joins.add(pairKey(a.id, b.id))
    else
      issues.push({
        id: 'invalid-join',
        severity: 'error',
        platformIds: [join.platformAId, join.platformBId],
        detail:
          'Only matching static, coplanar Pearl butt seams may be declared.',
      })
  }
  for (let i = 0; i < entries.length; i++)
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i],
        b = entries[j],
        platformIds = [a.p.id, b.p.id]
      const overlapXZ =
        Math.min(a.contact.maxX, b.contact.maxX) -
          Math.max(a.contact.minX, b.contact.minX) >
          0.001 &&
        Math.min(a.contact.maxZ, b.contact.maxZ) -
          Math.max(a.contact.minZ, b.contact.minZ) >
          0.001
      const standingBlocked = (
        floor: typeof a.contact,
        ceiling: typeof a.contact,
      ) =>
        ceiling.minY >= floor.maxY &&
        ceiling.minY < floor.maxY + MOVEMENT.height - 0.001
      if (
        overlapXZ &&
        (standingBlocked(a.contact, b.contact) ||
          standingBlocked(b.contact, a.contact))
      )
        issues.push({
          id: 'headroom-obstruction',
          severity: 'error',
          platformIds,
          detail:
            'An overlapping route has less than standing-player clearance beneath another platform.',
        })
      if (envelopesIntersect(a.contact, b.contact))
        issues.push({
          id: 'contact-overlap',
          severity: 'error',
          platformIds,
          detail: 'Certified platform volumes or their swept motion intersect.',
        })
      else if (envelopesIntersect(a.visual, b.visual)) {
        const seam = joins.has(pairKey(a.p.id, b.p.id))
        issues.push({
          id: seam ? 'decorative-seam-overlap' : 'visual-overlap',
          severity: seam ? 'notice' : 'error',
          platformIds,
          detail: seam
            ? 'Known Pearl decorative rim overlap at an authored continuous floor seam; art is unchanged.'
            : 'Measured intact art envelopes or their swept motion intersect.',
        })
      }
    }
  const anchors = [
    ...(assembled.encounters ?? []).map((e) => ({
      id: e.id,
      position: e.anchor,
    })),
    ...(assembled.checkpoints ?? []).map((cp) => ({
      id: cp.id,
      position: cp.position,
    })),
  ]
  for (const anchor of anchors) {
    const supported = entries.some(({ p }) => {
      if (p.behavior !== undefined) return false
      const b = platformContactEnvelope(p),
        a = anchor.position
      return (
        Math.abs(a.y - b.maxY) <= 0.001 &&
        a.x >= b.minX &&
        a.x <= b.maxX &&
        a.z >= b.minZ &&
        a.z <= b.maxZ
      )
    })
    if (!supported)
      issues.push({
        id: 'unsupported-anchor',
        severity: 'error',
        platformIds: [],
        detail: `${anchor.id} is not supported by stationary floor.`,
      })
  }
  const barriers = {
    ...CLOUDWAY_LABORATORY_COURSE_PROFILES.barriers,
    ...PROCEDURAL_COURT_BARRIERS,
  }
  for (const encounter of assembled.encounters ?? []) {
    const placement = encounter.presentationBarrier
    if (placement === undefined) continue
    const profile = barriers[placement.profileId]
    if (profile === undefined) {
      issues.push({
        id: 'unknown-profile',
        severity: 'error',
        platformIds: [],
        detail: `Unknown barrier profile: ${placement.profileId}`,
      })
      continue
    }
    const turns = (((Math.round(placement.facingYaw / (Math.PI / 2)) % 4) + 4) %
      4) as PlatformRenderQuarterTurns
    const boxes = [
      ...(profile.gateParts ??
        (profile.gate === undefined ? [] : [profile.gate])),
      ...profile.frameSides,
    ]
    for (const box of boxes) {
      const solid = barrierSolid(
        encounter.id,
        encounter.position,
        turns,
        box,
        false,
      )
      const volume = {
        ...solid,
        minY: solid.top - solid.thickness,
        maxY: solid.top,
      }
      for (const entry of entries) {
        if (encounter.courtPlatformIds.includes(entry.p.id)) continue
        const route = {
          ...entry.contact,
          minX: entry.contact.minX - MOVEMENT.radius,
          maxX: entry.contact.maxX + MOVEMENT.radius,
          minZ: entry.contact.minZ - MOVEMENT.radius,
          maxZ: entry.contact.maxZ + MOVEMENT.radius,
          maxY: entry.contact.maxY + MOVEMENT.height,
        }
        if (
          envelopesIntersect(volume, route) ||
          envelopesIntersect(volume, entry.visual)
        )
          issues.push({
            id: 'barrier-route-intersection',
            severity: 'error',
            platformIds: [entry.p.id],
            detail: `${encounter.id}/${box.id} intrudes on another chunk's floor, art or swept travel volume.`,
          })
      }
    }
  }
  if (
    assembled.gaps !== undefined &&
    !issues.some(
      (issue) =>
        issue.id === 'unknown-profile' || issue.id === 'invalid-platform',
    )
  ) {
    try {
      for (const gap of classifyAssembledCourseGaps(assembled)) {
        const declaration = assembled.gaps.find((g) => g.id === gap.id)!
        const platformIds = [declaration.platformAId, declaration.platformBId]
        if (gap.kind === 'invalid')
          issues.push({
            id: 'invalid-route-gap',
            severity: 'error',
            platformIds,
            detail: `${gap.id} overlaps rather than forming a supported route gap.`,
          })
        else if (gap.distance + 0.001 < declaration.minimumClearanceMeters)
          issues.push({
            id: 'gap-clearance',
            severity: 'error',
            platformIds,
            detail: `${gap.id} measures ${gap.distance}m, below declared ${declaration.minimumClearanceMeters}m.`,
          })
      }
    } catch (error) {
      issues.push({
        id: 'invalid-route-gap',
        severity: 'error',
        platformIds: [],
        detail: String(error),
      })
    }
  }
  return issues
}

export function hasPlatformGeometryErrors(
  platforms: readonly AssembledPlatform[],
): boolean {
  return getAssembledGeometryIssues({ platforms }).some(
    (issue) => issue.severity === 'error',
  )
}

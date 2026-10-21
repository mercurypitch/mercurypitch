// Procedural court gates — visible stone wings prevent walking or jumping beside the intact pane.

import type { CloudwayBarrierProfile } from '../authoring/cloudway-course-profiles.ts'
import { FROST_GOLD_ARCH_PROFILE } from './frost-gold-arch-profile.ts'
import { FROSTED_SCROLL_WALL_PROFILE } from './frost-wall-profile.ts'

export function proceduralCourtBarrierId(id: string): string {
  return `${id}-procedural-court`
}

function withCourtWings(
  profile: CloudwayBarrierProfile,
): CloudwayBarrierProfile {
  return {
    ...profile,
    id: proceduralCourtBarrierId(profile.id),
    frameSides: [
      ...(profile.frameSides ?? []),
      ...([-1, 1] as const).map((side) => ({
        id: side < 0 ? 'court-left-wing' : 'court-right-wing',
        bottomCenter: { x: side * 2.2, y: 0, z: 0 },
        width: 1.8,
        height: 1.2,
        depth: 0.5,
        // No bundle fallback: these authored wings stay visible after the gate art loads.
        presentation: { role: 'wall' as const, material: 'stone' as const },
      })),
    ],
  }
}

export const PROCEDURAL_COURT_BARRIERS: Readonly<
  Record<string, CloudwayBarrierProfile>
> = Object.fromEntries(
  [FROSTED_SCROLL_WALL_PROFILE, FROST_GOLD_ARCH_PROFILE].map((profile) => {
    const guarded = withCourtWings(profile)
    return [guarded.id, guarded]
  }),
)

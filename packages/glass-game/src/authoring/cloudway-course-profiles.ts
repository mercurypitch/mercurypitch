// Cloudway course profiles — certified contacts stay outside editable route JSON.

import type { MelodyLessonDefinition, PlatformBehaviorDefinition, PlatformScrollEdgeSupportDefinition, PlatformSurfaceDefinition, PointXZ, SolidMaterialRole, SolidProxyRole, Vec3, } from '../contracts'

export type CloudwayPlatformBehaviorKind = PlatformBehaviorDefinition['kind']

export interface CloudwayPlatformProfile {
  id: string
  width: number
  depth: number
  top: number
  thickness: number
  renderId: string
  /** Certified donor-local convex contact outline; width/depth must match it. */
  supportPolygon?: readonly PointXZ[]
  behaviorKind?: CloudwayPlatformBehaviorKind
  surface?: PlatformSurfaceDefinition
  /** Donor-local extension axis, rotated cardinally by the course compiler. */
  scrollLocalAxis?: 'x' | 'z'
  /** Certified bands applied to the negative and positive compiled scroll edges. */
  scrollEdgeSupports?: {
    negative: PlatformScrollEdgeSupportDefinition
    positive: PlatformScrollEdgeSupportDefinition
  }
}

/** One collision box measured from the barrier's floor-centred authoring pose. */
export interface CloudwayBarrierBoxProfile {
  id: string
  /** Local bottom-centre; the target position is the pane's floor datum. */
  bottomCenter: Vec3
  width: number
  height: number
  depth: number
  presentation?: {
    role: SolidProxyRole
    material: SolidMaterialRole
  }
  /** Detailed art node which replaces the visible fallback collision proxy. */
  fallback?: {
    replacedByBundle: string
    replacedByNode: string
  }
}

/** Certified collision/profile data; editable course JSON supplies only its pose. */
export interface CloudwayBarrierProfile {
  id: string
  variant: string
  /** One rectangular pane, retained for existing certified barriers. */
  gate?: CloudwayBarrierBoxProfile
  /** Non-overclaiming decomposition for a non-rectangular intact barrier. */
  gateParts?: readonly CloudwayBarrierBoxProfile[]
  /** Permanent physical frame pieces. At least two are required. */
  frameSides: readonly CloudwayBarrierBoxProfile[]
}

export interface CloudwayCourseProfileCatalog {
  platforms: Readonly<Partial<Record<string, CloudwayPlatformProfile>>>
  barriers: Readonly<Partial<Record<string, CloudwayBarrierProfile>>>
  /** Ordinary exhibit recipes accepted by this course family. */
  encounterVariants: readonly string[]
  /** Certified intact exhibit envelopes; removed with their own completed target. */
  intactExhibits?: Readonly<
    Partial<
      Record<
        string,
        {
          width: number
          height: number
          depth: number
          mountHeight: number
        }
      >
    >
  >
  melodyLessons?: Readonly<
    Partial<
      Record<
        string,
        Omit<
          MelodyLessonDefinition,
          'id' | 'revision' | 'stations' | 'finaleEncounterId'
        >
      >
    >
  >
}

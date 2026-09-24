// Cloudway layout auditions — isolated crescent, ribbon and terrace routes built from one proven trial envelope.

import type { CheckpointDefinition, IntentionalGapDefinition, LevelDefinition, PlatformDefinition, RoomDecorationInstanceDefinition, SolidPropDefinition, } from '../contracts'
import { CLOUDWAY_ENCOUNTER_IDS, CLOUDWAY_GLASS_RIBBON, CLOUDWAY_PLATFORM_IDS,cloudwayExhibitSolids,  } from './cloudway-trial'

export type CloudwayLayoutId = 'crescent' | 'ribbon' | 'terrace'

export const CLOUDWAY_LAYOUT_SAVE_IDS: Readonly<
  Record<CloudwayLayoutId, string>
> = {
  crescent: 'cloudway-trial-audition-crescent',
  ribbon: 'cloudway-trial-audition-ribbon',
  terrace: 'cloudway-trial-audition-terrace',
}

export const CLOUDWAY_CURRENT_TRIAL_SAVE_ID =
  'cloudway-trial-current-crescent-v1'

type PlatformKey = keyof typeof CLOUDWAY_PLATFORM_IDS

interface CloudwayLayoutSpec {
  readonly id: CloudwayLayoutId
  readonly title: string
  readonly subtitle: string
  readonly centers: Readonly<Record<PlatformKey, number>>
  readonly glideTranslationX: number
  readonly landmark: { readonly x: number; readonly z: number }
}

export interface CloudwayRouteWaypoint {
  readonly platformId: string
  readonly x: number
  readonly z: number
  readonly role:
    | 'arrival-rest'
    | 'frost'
    | 'recovery-rest'
    | 'glide'
    | 'voice-rest'
    | 'crackle'
    | 'finale-rest'
}

export interface CloudwayLayoutRoute {
  readonly layoutId: CloudwayLayoutId
  readonly recommendedTravelDirection: { readonly x: 0; readonly z: 1 }
  readonly safeRestPlatformIds: readonly string[]
  readonly landmark: { readonly x: number; readonly z: number }
  readonly waypoints: readonly CloudwayRouteWaypoint[]
}

export interface CloudwayLayoutAudition {
  readonly id: CloudwayLayoutId
  readonly saveId: string
  readonly level: LevelDefinition
  readonly route: CloudwayLayoutRoute
}

const PLATFORM_TOP = 0
const ROOM_HEIGHT = 6
const LANDMARK_RADIUS = 0.82
const PLANTER_RADIUS_TOP = 0.29
const PLANTER_RADIUS_BOTTOM = 0.17
const PLANTER_HEIGHT = 0.48

const SPECS: Readonly<Record<CloudwayLayoutId, CloudwayLayoutSpec>> = {
  crescent: {
    id: 'crescent',
    title: 'The Cloudway Crescent',
    subtitle: 'A broad arc around a planted pearl island',
    centers: {
      arrival: -2.6,
      frostOne: -2.45,
      frostTwo: -1.85,
      frostCatch: -1.25,
      glideDockWest: -0.72,
      glideRaft: -0.25,
      glideDockEast: 0.82,
      crackleOne: 1.38,
      crackleRecovery: 1.88,
      crackleTwo: 2.38,
      finale: 2.72,
    },
    glideTranslationX: 0.88,
    landmark: { x: 3.72, z: 15.95 },
  },
  ribbon: {
    id: 'ribbon',
    title: 'The Cloudway Ribbon',
    subtitle: 'Two easy bends with broad places to stop and look',
    centers: {
      arrival: 0.15,
      frostOne: -0.15,
      frostTwo: -0.75,
      frostCatch: -1.15,
      glideDockWest: -0.65,
      glideRaft: -0.15,
      glideDockEast: 0.75,
      crackleOne: 1.4,
      crackleRecovery: 1.55,
      crackleTwo: 0.8,
      finale: 0,
    },
    glideTranslationX: 0.72,
    landmark: { x: -3.15, z: 16.05 },
  },
  terrace: {
    id: 'terrace',
    title: 'The Cloudway Terraces',
    subtitle: 'Staggered crossings joined by generous straight landings',
    centers: {
      arrival: -0.95,
      frostOne: -0.95,
      frostTwo: 0.1,
      frostCatch: 0.1,
      glideDockWest: 0.1,
      glideRaft: 0.1,
      glideDockEast: 0.1,
      crackleOne: 1.2,
      crackleRecovery: 1.2,
      crackleTwo: 0.05,
      finale: 0.05,
    },
    glideTranslationX: 0,
    landmark: { x: -2.7, z: 24.45 },
  },
}

const PLATFORM_KEYS = Object.keys(
  CLOUDWAY_PLATFORM_IDS,
) as readonly PlatformKey[]

const WAYPOINT_Z: Readonly<Record<PlatformKey, number>> = {
  arrival: 2.8,
  frostOne: 4.75,
  frostTwo: 7.05,
  frostCatch: 9.5,
  glideDockWest: 12.35,
  glideRaft: 14.4,
  glideDockEast: 18.45,
  crackleOne: 21.8,
  crackleRecovery: 24.3,
  crackleTwo: 27.15,
  finale: 29.5,
}

const WAYPOINT_ROLE: Readonly<
  Record<PlatformKey, CloudwayRouteWaypoint['role']>
> = {
  arrival: 'arrival-rest',
  frostOne: 'frost',
  frostTwo: 'frost',
  frostCatch: 'recovery-rest',
  glideDockWest: 'recovery-rest',
  glideRaft: 'glide',
  glideDockEast: 'voice-rest',
  crackleOne: 'crackle',
  crackleRecovery: 'recovery-rest',
  crackleTwo: 'crackle',
  finale: 'finale-rest',
}

const SAFE_REST_PLATFORM_IDS = [
  CLOUDWAY_PLATFORM_IDS.arrival,
  CLOUDWAY_PLATFORM_IDS.frostCatch,
  CLOUDWAY_PLATFORM_IDS.glideDockWest,
  CLOUDWAY_PLATFORM_IDS.glideDockEast,
  CLOUDWAY_PLATFORM_IDS.crackleRecovery,
  CLOUDWAY_PLATFORM_IDS.finale,
] as const

const CHECKPOINT_PLATFORM: Readonly<Record<string, PlatformKey>> = {
  'cloudway-checkpoint-arrival': 'arrival',
  'cloudway-checkpoint-frost-catch': 'frostCatch',
  'cloudway-checkpoint-glide-east': 'glideDockEast',
  'cloudway-checkpoint-crackle-recovery': 'crackleRecovery',
  'cloudway-checkpoint-finale': 'finale',
}

const CHECKPOINT_NEXT_PLATFORM: Readonly<Record<string, PlatformKey>> = {
  'cloudway-checkpoint-arrival': 'frostOne',
  'cloudway-checkpoint-frost-catch': 'glideDockWest',
  'cloudway-checkpoint-glide-east': 'crackleOne',
  'cloudway-checkpoint-crackle-recovery': 'crackleTwo',
  'cloudway-checkpoint-finale': 'finale',
}

const ENCOUNTER_PLATFORM: Readonly<Record<string, PlatformKey>> = {
  [CLOUDWAY_ENCOUNTER_IDS.arrival]: 'arrival',
  [CLOUDWAY_ENCOUNTER_IDS.crossing]: 'glideDockEast',
  [CLOUDWAY_ENCOUNTER_IDS.finale]: 'finale',
}

const GAP_PLATFORM_PAIRS: Readonly<
  Record<string, readonly [PlatformKey, PlatformKey]>
> = {
  'cloudway-gap-arrival-frost-one': ['arrival', 'frostOne'],
  'cloudway-gap-frost-one-two': ['frostOne', 'frostTwo'],
  'cloudway-gap-frost-two-catch': ['frostTwo', 'frostCatch'],
  'cloudway-gap-dock-west-raft': ['glideDockWest', 'glideRaft'],
  'cloudway-gap-raft-dock-east': ['glideRaft', 'glideDockEast'],
  'cloudway-gap-dock-east-crackle-one': ['glideDockEast', 'crackleOne'],
  'cloudway-gap-crackle-one-recovery': ['crackleOne', 'crackleRecovery'],
  'cloudway-gap-recovery-crackle-two': ['crackleRecovery', 'crackleTwo'],
  'cloudway-gap-crackle-two-finale': ['crackleTwo', 'finale'],
}

function platformKey(id: string): PlatformKey {
  const key = PLATFORM_KEYS.find(
    (candidate) => CLOUDWAY_PLATFORM_IDS[candidate] === id,
  )
  if (key === undefined) throw new Error(`Unknown Cloudway platform "${id}".`)
  return key
}

function shiftedPlatform(
  source: PlatformDefinition,
  spec: CloudwayLayoutSpec,
): PlatformDefinition {
  const key = platformKey(source.id)
  const width = source.maxX - source.minX
  const center = spec.centers[key]
  const behavior = source.behavior
  return {
    ...source,
    minX: center - width / 2,
    maxX: center + width / 2,
    ...(behavior?.kind === 'glide'
      ? {
          behavior: {
            ...behavior,
            translation: {
              ...behavior.translation,
              x: spec.glideTranslationX,
            },
          },
        }
      : {}),
  }
}

function finalBounds(
  platform: PlatformDefinition,
): Pick<PlatformDefinition, 'minX' | 'maxX'> {
  if (platform.behavior?.kind !== 'glide') return platform
  return {
    minX: platform.minX + platform.behavior.translation.x,
    maxX: platform.maxX + platform.behavior.translation.x,
  }
}

function shiftedGap(
  source: IntentionalGapDefinition,
  platforms: ReadonlyMap<PlatformKey, PlatformDefinition>,
): IntentionalGapDefinition {
  const pair = GAP_PLATFORM_PAIRS[source.id]
  if (pair === undefined)
    throw new Error(`Unknown Cloudway gap "${source.id}".`)
  const from = platforms.get(pair[0])!
  const to = platforms.get(pair[1])!
  const fromBounds = pair[0] === 'glideRaft' ? finalBounds(from) : from
  const minX = Math.max(fromBounds.minX, to.minX)
  const maxX = Math.min(fromBounds.maxX, to.maxX)
  if (maxX - minX < 0.64)
    throw new Error(`Cloudway ${source.id} has no forgiving landing overlap.`)
  return { ...source, minX, maxX }
}

function facingYaw(
  from: { readonly x: number; readonly z: number },
  to: { readonly x: number; readonly z: number },
): number {
  return Math.atan2(-(to.x - from.x), -(to.z - from.z))
}

function shiftedCheckpoint(
  source: CheckpointDefinition,
  spec: CloudwayLayoutSpec,
): CheckpointDefinition {
  const key = CHECKPOINT_PLATFORM[source.id]
  const nextKey = CHECKPOINT_NEXT_PLATFORM[source.id]
  if (key === undefined || nextKey === undefined)
    throw new Error(`Unknown Cloudway checkpoint "${source.id}".`)
  const position = {
    x: spec.centers[key],
    y: PLATFORM_TOP,
    z: source.position.z,
  }
  return {
    ...source,
    position,
    facingYaw: facingYaw(position, {
      x: spec.centers[nextKey],
      z: WAYPOINT_Z[nextKey],
    }),
  }
}

function planter(
  id: string,
  roomId: string,
  x: number,
  z: number,
  platformId?: string,
): {
  readonly solid: SolidPropDefinition
  readonly decoration: RoomDecorationInstanceDefinition
} {
  const solidId = `${id}-bowl`
  return {
    solid: {
      id: solidId,
      kind: 'prop',
      shape: 'cylinder',
      x,
      z,
      radiusTop: PLANTER_RADIUS_TOP,
      radiusBottom: PLANTER_RADIUS_BOTTOM,
      top: PLANTER_HEIGHT,
      thickness: PLANTER_HEIGHT,
      ...(platformId === undefined ? {} : { platformId }),
      presentation: { role: 'plinth', material: 'stone' },
    },
    decoration: {
      id,
      roomId,
      recipeId: 'crystal-planter-v5',
      position: { x, y: PLATFORM_TOP, z },
      yaw: 0,
      scale: 0.82,
      coveredSolidIds: [solidId],
    },
  }
}

function routeFor(spec: CloudwayLayoutSpec): CloudwayLayoutRoute {
  return {
    layoutId: spec.id,
    recommendedTravelDirection: { x: 0, z: 1 },
    safeRestPlatformIds: SAFE_REST_PLATFORM_IDS,
    landmark: spec.landmark,
    waypoints: PLATFORM_KEYS.map((key) => ({
      platformId: CLOUDWAY_PLATFORM_IDS[key],
      x: spec.centers[key],
      z: WAYPOINT_Z[key],
      role: WAYPOINT_ROLE[key],
    })),
  }
}

function buildCloudwayLayout(
  spec: CloudwayLayoutSpec,
  saveId: string,
): LevelDefinition {
  const platforms = CLOUDWAY_GLASS_RIBBON.platforms.map((source) =>
    shiftedPlatform(source, spec),
  )
  const platformByKey = new Map(
    platforms.map((platform) => [platformKey(platform.id), platform]),
  )
  const roomId = `${saveId}-route-room`
  const arrival = platformByKey.get('arrival')!
  const frostCatch = platformByKey.get('frostCatch')!
  const recovery = platformByKey.get('crackleRecovery')!
  const finale = platformByKey.get('finale')!
  const planters = [
    planter(
      `${saveId}-arrival-planter`,
      roomId,
      arrival.maxX - 0.42,
      arrival.maxZ - 0.45,
      arrival.id,
    ),
    planter(
      `${saveId}-frost-rest-planter`,
      roomId,
      frostCatch.minX + 0.42,
      frostCatch.maxZ - 0.48,
      frostCatch.id,
    ),
    planter(
      `${saveId}-crackle-rest-planter`,
      roomId,
      recovery.maxX - 0.42,
      recovery.maxZ - 0.48,
      recovery.id,
    ),
    planter(
      `${saveId}-finale-left-planter`,
      roomId,
      finale.minX + 0.42,
      finale.minZ + 0.48,
      finale.id,
    ),
    planter(
      `${saveId}-finale-right-planter`,
      roomId,
      finale.maxX - 0.42,
      finale.minZ + 0.48,
      finale.id,
    ),
    planter(
      `${saveId}-landmark-planter`,
      roomId,
      spec.landmark.x,
      spec.landmark.z,
    ),
  ]
  const landmark: SolidPropDefinition = {
    id: `${saveId}-planted-landmark`,
    kind: 'prop',
    shape: 'cylinder',
    x: spec.landmark.x,
    z: spec.landmark.z,
    radiusTop: LANDMARK_RADIUS,
    radiusBottom: LANDMARK_RADIUS * 0.68,
    top: PLATFORM_TOP,
    thickness: 1.15,
    presentation: { role: 'plinth', material: 'stone' },
  }
  const sourcePresentation = CLOUDWAY_GLASS_RIBBON.presentation!
  const minPlatformX = Math.min(...platforms.map((item) => item.minX))
  const maxPlatformX = Math.max(...platforms.map((item) => item.maxX))
  const minX = Math.min(minPlatformX, spec.landmark.x - LANDMARK_RADIUS) - 4
  const maxX = Math.max(maxPlatformX, spec.landmark.x + LANDMARK_RADIUS) + 4
  const checkpoints = CLOUDWAY_GLASS_RIBBON.checkpoints.map((checkpoint) =>
    shiftedCheckpoint(checkpoint, spec),
  )
  const spawnDx = spec.centers.arrival
  const finaleDx = spec.centers.finale - 1
  const breakables = CLOUDWAY_GLASS_RIBBON.breakables.map((breakable) => {
    const key = ENCOUNTER_PLATFORM[breakable.id]
    if (key === undefined)
      throw new Error(`Unknown Cloudway encounter "${breakable.id}".`)
    const base = CLOUDWAY_GLASS_RIBBON.platforms.find(
      (platform) => platform.id === CLOUDWAY_PLATFORM_IDS[key],
    )!
    const dx = spec.centers[key] - (base.minX + base.maxX) / 2
    return {
      ...breakable,
      position: { ...breakable.position, x: breakable.position.x + dx },
      anchor: { ...breakable.anchor, x: breakable.anchor.x + dx },
    }
  })
  const baseExhibitSolidIds = new Set(
    cloudwayExhibitSolids(CLOUDWAY_GLASS_RIBBON.breakables).map(
      (solid) => solid.id,
    ),
  )

  return {
    ...CLOUDWAY_GLASS_RIBBON,
    id: saveId,
    title: spec.title,
    authored: {
      levelId: saveId,
      layoutId: `cloudway-${spec.id}`,
      contentRevision: 1,
    },
    guidance: {
      ...CLOUDWAY_GLASS_RIBBON.guidance,
      subtitle: spec.subtitle,
    },
    spawn: {
      ...CLOUDWAY_GLASS_RIBBON.spawn,
      position: {
        ...CLOUDWAY_GLASS_RIBBON.spawn.position,
        x: CLOUDWAY_GLASS_RIBBON.spawn.position.x + spawnDx,
      },
      facingYaw: checkpoints[0]!.facingYaw,
    },
    platforms,
    solids: [
      ...(CLOUDWAY_GLASS_RIBBON.solids ?? []).filter(
        (solid) => !baseExhibitSolidIds.has(solid.id),
      ),
      ...cloudwayExhibitSolids(breakables),
      landmark,
      ...planters.map((item) => item.solid),
    ],
    intentionalGaps: (CLOUDWAY_GLASS_RIBBON.intentionalGaps ?? []).map((gap) =>
      shiftedGap(gap, platformByKey),
    ),
    checkpoints,
    breakables,
    exit: {
      ...CLOUDWAY_GLASS_RIBBON.exit,
      minX: CLOUDWAY_GLASS_RIBBON.exit.minX + finaleDx,
      maxX: CLOUDWAY_GLASS_RIBBON.exit.maxX + finaleDx,
    },
    presentation: {
      ...sourcePresentation,
      worldBounds: { ...sourcePresentation.worldBounds, minX, maxX },
      lightBounds: {
        ...sourcePresentation.lightBounds,
        minX: minPlatformX - 1,
        maxX: maxPlatformX + 1,
      },
      rooms: [
        {
          id: roomId,
          bounds: {
            minX,
            maxX,
            minY: sourcePresentation.worldBounds.minY,
            maxY: ROOM_HEIGHT,
            minZ: sourcePresentation.worldBounds.minZ,
            maxZ: sourcePresentation.worldBounds.maxZ,
          },
        },
      ],
      decorations: planters.map((item) => item.decoration),
      floorArt: [
        {
          platformId: CLOUDWAY_PLATFORM_IDS.arrival,
          recipeId: 'hero-petal',
          palette: 'garden',
        },
        {
          platformId: CLOUDWAY_PLATFORM_IDS.frostCatch,
          recipeId: 'quiet-marble',
          palette: 'garden',
        },
        {
          platformId: CLOUDWAY_PLATFORM_IDS.glideDockEast,
          recipeId: 'sound-wave',
          palette: 'garden',
        },
        {
          platformId: CLOUDWAY_PLATFORM_IDS.crackleRecovery,
          recipeId: 'quiet-marble',
          palette: 'garden',
        },
        {
          platformId: CLOUDWAY_PLATFORM_IDS.finale,
          recipeId: 'orbital-rings',
          palette: 'portrait',
        },
      ],
      assetRecipeIds: [
        ...sourcePresentation.assetRecipeIds,
        'crystal-planter-v5',
      ],
    },
  }
}

function audition(spec: CloudwayLayoutSpec): CloudwayLayoutAudition {
  const saveId = CLOUDWAY_LAYOUT_SAVE_IDS[spec.id]
  return {
    id: spec.id,
    saveId,
    level: buildCloudwayLayout(spec, saveId),
    route: routeFor(spec),
  }
}

export const CLOUDWAY_LAYOUT_AUDITIONS: Readonly<
  Record<CloudwayLayoutId, CloudwayLayoutAudition>
> = {
  crescent: audition(SPECS.crescent),
  ribbon: audition(SPECS.ribbon),
  terrace: audition(SPECS.terrace),
}

export function selectCloudwayLayout(
  layoutId: CloudwayLayoutId,
): CloudwayLayoutAudition {
  return CLOUDWAY_LAYOUT_AUDITIONS[layoutId]
}

export const CLOUDWAY_CRESCENT_AUDITION =
  CLOUDWAY_LAYOUT_AUDITIONS.crescent.level
export const CLOUDWAY_RIBBON_AUDITION = CLOUDWAY_LAYOUT_AUDITIONS.ribbon.level
export const CLOUDWAY_TERRACE_AUDITION = CLOUDWAY_LAYOUT_AUDITIONS.terrace.level

/**
 * The current-trial candidate has a separate save identity from every audition
 * and the legacy straight Ribbon. Campaign code must opt into this export.
 */
export const CLOUDWAY_CURRENT_LAYOUT_ID: CloudwayLayoutId = 'crescent'
export const CLOUDWAY_CURRENT_TRIAL = buildCloudwayLayout(
  SPECS[CLOUDWAY_CURRENT_LAYOUT_ID],
  CLOUDWAY_CURRENT_TRIAL_SAVE_ID,
)

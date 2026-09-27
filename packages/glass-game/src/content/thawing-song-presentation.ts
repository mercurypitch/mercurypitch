// Thawing Song presentation — open-air garden rooms, honest gate planters and five ordered melody cues.

import type { LevelDefinition, MelodyStationMarkerDefinition, PlatformDefinition, RoomDecorationInstanceDefinition, RoomPresentationDefinition, SolidPropDefinition, Vec3, } from '../contracts'
import { crystalPlanter } from './museum-room-dressings.ts'

const ROOM_SECTION_IDS = [
  'thaw-north',
  'thaw-first-gate',
  'thaw-east',
  'thaw-second-gate',
  'thaw-south',
  'thaw-finale',
] as const

type ThawingSongRoomSectionId = (typeof ROOM_SECTION_IDS)[number]

const ROOM_HORIZONTAL_MARGIN = 0.55
const ROOM_TOP = 3.9
// These courts float in open air. Their render ownership stays tight, while
// the camera volume leaves enough sky around a narrow slab for portrait shots.
const OPEN_AIR_CAMERA_MARGIN = 6
const GATE_SIDE_PLANTER_LOCAL_X = 1.43
const PLANTER_SCALE = 0.82
// The V5 planter donor is 1.4m tall, so its route scale reaches 1.148m. This
// narrow guard stays inside the dense central crystal cluster while preventing
// Merc's 0.5m jump from turning the decorative bowl into a gate-side step.
const GATE_PLANTER_GUARD_HEIGHT = 1.08
const GATE_PLANTER_GUARD_RADIUS_TOP = 0.1

const MARKER_POSES: Readonly<
  Record<
    string,
    {
      roomSectionId: ThawingSongRoomSectionId
      offset: Pick<Vec3, 'x' | 'z'>
      yaw: number
    }
  >
> = {
  'thaw-note-home': {
    roomSectionId: 'thaw-north',
    offset: { x: 0.75, z: 0 },
    yaw: Math.PI,
  },
  'thaw-gate-rise': {
    roomSectionId: 'thaw-first-gate',
    offset: { x: 0.75, z: 0 },
    yaw: Math.PI,
  },
  'thaw-note-crown': {
    roomSectionId: 'thaw-east',
    offset: { x: 0.75, z: 0 },
    yaw: Math.PI,
  },
  'thaw-gate-return': {
    roomSectionId: 'thaw-second-gate',
    offset: { x: 0, z: -0.75 },
    yaw: -Math.PI / 2,
  },
  'thaw-note-homecoming': {
    roomSectionId: 'thaw-south',
    offset: { x: 0, z: -0.75 },
    yaw: -Math.PI / 2,
  },
}

function requiredPlatform(
  level: LevelDefinition,
  id: string,
): PlatformDefinition {
  const platform = level.platforms.find((candidate) => candidate.id === id)
  if (platform === undefined)
    throw new Error(`The Thawing Song presentation needs platform "${id}".`)
  return platform
}

function roomPrefix(level: LevelDefinition, sectionId: string): string {
  return `${level.id}/${sectionId}`
}

function roomId(level: LevelDefinition, sectionId: string): string {
  return `${roomPrefix(level, sectionId)}/room/route`
}

function createRooms(
  level: LevelDefinition,
): readonly RoomPresentationDefinition[] {
  if (level.camera?.kind !== 'route-sections')
    throw new Error(
      'The Thawing Song presentation needs route camera sections.',
    )
  const sections = new Map(
    level.camera.sections.map((section) => [section.id, section]),
  )
  return ROOM_SECTION_IDS.map((sectionId) => {
    const section = sections.get(sectionId)
    if (section === undefined)
      throw new Error(
        `The Thawing Song presentation needs camera section "${sectionId}".`,
      )
    const platforms = section.platformIds.map((id) =>
      requiredPlatform(level, id),
    )
    const minX = Math.min(...platforms.map((platform) => platform.minX))
    const maxX = Math.max(...platforms.map((platform) => platform.maxX))
    const minZ = Math.min(...platforms.map((platform) => platform.minZ))
    const maxZ = Math.max(...platforms.map((platform) => platform.maxZ))
    const minY = Math.min(
      ...platforms.map((platform) => platform.top - platform.thickness),
    )
    return {
      id: roomId(level, sectionId),
      bounds: {
        minX: minX - ROOM_HORIZONTAL_MARGIN,
        maxX: maxX + ROOM_HORIZONTAL_MARGIN,
        minY,
        maxY: ROOM_TOP,
        minZ: minZ - ROOM_HORIZONTAL_MARGIN,
        maxZ: maxZ + ROOM_HORIZONTAL_MARGIN,
      },
      cameraBounds: {
        minX: minX - OPEN_AIR_CAMERA_MARGIN,
        maxX: maxX + OPEN_AIR_CAMERA_MARGIN,
        minY: 0,
        maxY: 3.2,
        minZ: minZ - OPEN_AIR_CAMERA_MARGIN,
        maxZ: maxZ + OPEN_AIR_CAMERA_MARGIN,
      },
    }
  })
}

function transformLocalX(position: Vec3, yaw: number, localX: number): Vec3 {
  return {
    x: position.x + Math.cos(yaw) * localX,
    y: position.y,
    z: position.z - Math.sin(yaw) * localX,
  }
}

function createGatePlanters(level: LevelDefinition): {
  solids: readonly SolidPropDefinition[]
  decorations: readonly RoomDecorationInstanceDefinition[]
} {
  const gates = [
    {
      encounterId: 'thaw-gate-rise',
      roomSectionId: 'thaw-first-gate',
      platformId: 'thaw-rise-5',
    },
    {
      encounterId: 'thaw-gate-return',
      roomSectionId: 'thaw-second-gate',
      platformId: 'thaw-return-5',
    },
  ] as const
  const solids: SolidPropDefinition[] = []
  const decorations: RoomDecorationInstanceDefinition[] = []
  for (const gate of gates) {
    const encounter = level.breakables.find(
      (candidate) => candidate.id === gate.encounterId,
    )
    if (encounter?.presentation?.kind !== 'barrier')
      throw new Error(
        `The Thawing Song presentation needs barrier "${gate.encounterId}".`,
      )
    requiredPlatform(level, gate.platformId)
    const prefix = roomPrefix(level, gate.roomSectionId)
    for (const side of [-1, 1] as const) {
      const position = transformLocalX(
        encounter.position,
        encounter.presentation.facingYaw,
        side * GATE_SIDE_PLANTER_LOCAL_X,
      )
      const id = `${prefix}/decoration/${gate.encounterId}-${side < 0 ? 'left' : 'right'}-planter`
      const planter = crystalPlanter(
        id,
        position.x,
        position.z,
        gate.platformId,
      )
      if (planter.solid.shape !== 'cylinder')
        throw new Error('The crystal planter needs a round physical proxy.')
      solids.push({
        ...planter.solid,
        radiusTop: GATE_PLANTER_GUARD_RADIUS_TOP,
        top: encounter.position.y + GATE_PLANTER_GUARD_HEIGHT,
        thickness: GATE_PLANTER_GUARD_HEIGHT,
      })
      decorations.push({
        id: planter.decoration.id,
        roomId: roomId(level, gate.roomSectionId),
        recipeId: planter.decoration.recipeId,
        position: { ...planter.decoration.position, y: encounter.position.y },
        yaw: encounter.presentation.facingYaw,
        scale: PLANTER_SCALE,
        coveredSolidIds: planter.decoration.coversSolidIds,
      })
    }
  }
  return { solids, decorations }
}

function createMelodyMarkers(
  level: LevelDefinition,
): readonly MelodyStationMarkerDefinition[] {
  const lesson = level.melodyLesson
  if (lesson === undefined)
    throw new Error('The Thawing Song presentation needs its melody lesson.')
  const offsets = new Map(
    lesson.melody.phrases.flatMap((phrase) =>
      phrase.anchors.map(
        (anchor) => [anchor.id, anchor.offsetSemitones] as const,
      ),
    ),
  )
  return lesson.stations.map((station, index) => {
    const encounter = level.breakables.find(
      (candidate) => candidate.id === station.encounterId,
    )
    const pose = MARKER_POSES[station.encounterId]
    const pitchOffsetSemitones = offsets.get(station.anchorId)
    if (
      encounter === undefined ||
      pose === undefined ||
      pitchOffsetSemitones === undefined
    )
      throw new Error(
        `The Thawing Song station "${station.encounterId}/${station.anchorId}" has no presentation pose.`,
      )
    return {
      id: `${roomPrefix(level, pose.roomSectionId)}/marker/${index + 1}`,
      roomId: roomId(level, pose.roomSectionId),
      encounterId: station.encounterId,
      anchorId: station.anchorId,
      position: {
        x: encounter.anchor.x + pose.offset.x,
        y: encounter.anchor.y,
        z: encounter.anchor.z + pose.offset.z,
      },
      yaw: pose.yaw,
      pitchOffsetSemitones,
    }
  })
}

function floorArt() {
  return [
    { platformId: 'thaw-arrival-2', recipeId: 'sound-wave', palette: 'garden' },
    { platformId: 'thaw-rise-1', recipeId: 'quiet-marble', palette: 'garden' },
    { platformId: 'thaw-east-1-2', recipeId: 'hero-petal', palette: 'garden' },
    { platformId: 'thaw-east-2-2', recipeId: 'hero-petal', palette: 'garden' },
    { platformId: 'thaw-south-1-2', recipeId: 'sound-wave', palette: 'garden' },
    {
      platformId: 'thaw-pavilion-3',
      recipeId: 'hero-petal',
      palette: 'portrait',
    },
  ] as const
}

/** Add bounded route art without changing the compiler-owned course geometry. */
export function dressThawingSong(level: LevelDefinition): LevelDefinition {
  const presentation = level.presentation
  if (presentation === undefined)
    throw new Error('The Thawing Song presentation manifest is missing.')
  const gatePlanters = createGatePlanters(level)
  for (const art of floorArt()) requiredPlatform(level, art.platformId)
  return {
    ...level,
    solids: [...(level.solids ?? []), ...gatePlanters.solids],
    presentation: {
      ...presentation,
      rooms: createRooms(level),
      decorations: [
        ...(presentation.decorations ?? []),
        ...gatePlanters.decorations,
      ],
      melodyMarkers: createMelodyMarkers(level),
      floorArt: [...(presentation.floorArt ?? []), ...floorArt()],
      assetRecipeIds: [
        ...new Set([...presentation.assetRecipeIds, 'crystal-planter-v5']),
      ].sort(),
    },
  }
}

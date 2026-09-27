// Thawing Song alcove presentation — mark and bound the optional static side path.

import type { LevelDefinition, PlatformDefinition, RoomPresentationDefinition, } from '../contracts.ts'
import { THAWING_SONG_ALCOVE_BEACON_POSE } from './thawing-song-alcove-source.ts'
import { dressThawingSong } from './thawing-song-presentation.ts'

const ALCOVE_SECTION_ID = 'thaw-alcove'

function requiredPlatform(
  level: LevelDefinition,
  id: string,
): PlatformDefinition {
  const platform = level.platforms.find((candidate) => candidate.id === id)
  if (platform === undefined)
    throw new Error(`The Thawing Song alcove needs platform "${id}".`)
  return platform
}

function alcoveRoom(level: LevelDefinition): RoomPresentationDefinition {
  if (level.camera?.kind !== 'route-sections')
    throw new Error('The Thawing Song alcove needs route camera sections.')
  const section = level.camera.sections.find(
    (candidate) => candidate.id === ALCOVE_SECTION_ID,
  )
  if (section === undefined)
    throw new Error('The Thawing Song alcove camera section is missing.')
  const platforms = section.platformIds.map((id) => requiredPlatform(level, id))
  const minX = Math.min(...platforms.map((platform) => platform.minX))
  const maxX = Math.max(...platforms.map((platform) => platform.maxX))
  const minZ = Math.min(...platforms.map((platform) => platform.minZ))
  const maxZ = Math.max(...platforms.map((platform) => platform.maxZ))
  const minY = Math.min(
    ...platforms.map((platform) => platform.top - platform.thickness),
  )
  return {
    id: `${level.id}/${ALCOVE_SECTION_ID}/room/route`,
    bounds: {
      minX: minX - 0.55,
      maxX: maxX + 0.55,
      minY,
      maxY: 3.9,
      minZ: minZ - 0.55,
      maxZ: maxZ + 0.55,
    },
    cameraBounds: {
      minX: minX - 6,
      maxX: maxX + 6,
      minY: 0,
      maxY: 3.2,
      minZ: minZ - 6,
      maxZ: maxZ + 6,
    },
  }
}

/** Keep the canonical route dressing while adding one visibly marked side room. */
export function dressThawingSongAlcove(
  level: LevelDefinition,
): LevelDefinition {
  const dressed = dressThawingSong(level)
  if (dressed.presentation === undefined)
    throw new Error('The Thawing Song alcove presentation is missing.')
  const beacon = THAWING_SONG_ALCOVE_BEACON_POSE
  const beaconId = `${level.id}/pearl-lantern`
  const beaconRoom = alcoveRoom(level)
  return {
    ...dressed,
    solids: [
      ...(dressed.solids ?? []),
      {
        id: beaconId,
        kind: 'prop',
        shape: 'cylinder',
        platformId: beacon.supportingPlatformId,
        x: beacon.position.x,
        z: beacon.position.z,
        top: beacon.position.y + 1.401,
        thickness: 1.401,
        radiusTop: 0.351,
        radiusBottom: 0.351,
        fallback: {
          replacedByBundle: 'pearl-ribbon-lantern-v1',
          replacedByNode: 'Cloudway_PearlRibbonLantern_OptionalExhibitV1',
        },
      },
    ],
    presentation: {
      ...dressed.presentation,
      rooms: [...dressed.presentation.rooms, beaconRoom],
      decorations: [
        ...(dressed.presentation.decorations ?? []),
        {
          id: beaconId,
          roomId: beaconRoom.id,
          recipeId: 'pearl-ribbon-lantern-v1',
          position: { ...beacon.position },
          yaw: beacon.facingYaw,
          scale: 1,
          coveredSolidIds: [beaconId],
        },
      ],
      floorArt: [
        ...(dressed.presentation.floorArt ?? []),
        {
          platformId: 'thaw-alcove-approach',
          recipeId: 'sound-wave',
          palette: 'garden',
        },
        {
          platformId: 'thaw-alcove-court-2',
          recipeId: 'hero-petal',
          palette: 'garden',
        },
      ],
    },
  }
}

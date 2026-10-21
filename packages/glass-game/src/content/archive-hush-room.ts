// Archive Hush route — three protected rooms, authored curtain displays and a walkable final passage.
import { composeLevel } from '../authoring/compose-level'
import type { LevelAuthoringCatalog, RoomPrefab } from '../authoring/contracts'
import type { LevelDefinition } from '../contracts'
import { ENCLOSED_CHAMBER_HALF, ENCLOSED_CORRIDOR_HALF_LENGTH, ENCLOSED_ENTRY_ROOM, } from './enclosed-museum-kit'
import { UNBROKEN_ARCHIVE_CATALOG, UNBROKEN_ARCHIVE_ROOM, UNBROKEN_ARCHIVE_ROUTE, UNBROKEN_ARCHIVE_SOURCE, } from './unbroken-archive'

export const ARCHIVE_HUSH_LEVEL_ID = 'glassworks-unbroken-archive/archive-hush'
export const ARCHIVE_HUSH_DISPLAYS = [
  { id: 'laurel', label: 'Laurel goblet', variant: 'goblet', x: 1.35, z: 0.8 },
  {
    id: 'diadem',
    label: 'Sunlit Diadem',
    variant: 'g01-sunlit-diadem',
    x: 0,
    z: 0.8,
  },
  { id: 'pearl', label: 'Pearl vase', variant: 'vase', x: -1.35, z: 0.8 },
] as const

const rooms = [
  {
    id: 'diadem',
    title: 'The first watch',
    description:
      'Two hummed shields and one glass cover. Keep all three whole.',
    centerZ: UNBROKEN_ARCHIVE_ROUTE.diadem,
    curtainLabel: '',
    curtainIds: [],
    displays: ARCHIVE_HUSH_DISPLAYS,
  },
  {
    id: 'tide',
    title: 'Behind the curtain',
    description:
      'Close the curtain over the side display. Protect the other three with two shields and the cover.',
    centerZ: UNBROKEN_ARCHIVE_ROUTE.tide,
    curtainLabel: 'Bowl curtain',
    curtainIds: ['tide-bowl'],
    displays: [
      {
        id: 'tide-goblet',
        label: 'Tide goblet',
        variant: 'goblet',
        x: 1.35,
        z: 0.8,
      },
      {
        id: 'tide-carafe',
        label: 'Tidal Wave Carafe',
        variant: 'g14-tidal-wave-carafe',
        x: 0,
        z: 0.8,
      },
      {
        id: 'tide-bowl',
        label: 'Sheltered Lotus Bowl',
        variant: 'g22-aurora-lotus-bowl',
        x: 2.7,
        z: 1.8,
      },
      {
        id: 'tide-vase',
        label: 'Tide vase',
        variant: 'vase',
        x: -1.35,
        z: 0.8,
      },
    ],
  },
  {
    id: 'lotus',
    title: 'The last watch',
    description:
      'One curtain protects the two side displays. Hum two shields and cover the last glass, then find the exit.',
    centerZ: UNBROKEN_ARCHIVE_ROUTE.lotus,
    curtainLabel: 'Paired display curtain',
    curtainIds: ['lotus-vase', 'lotus-diadem'],
    displays: [
      {
        id: 'lotus-goblet',
        label: 'Lotus goblet',
        variant: 'goblet',
        x: 1.35,
        z: 0.8,
      },
      {
        id: 'lotus-bowl',
        label: 'Aurora Lotus Bowl',
        variant: 'g22-aurora-lotus-bowl',
        x: 0,
        z: 0.8,
      },
      { id: 'lotus-vase', label: 'Moon vase', variant: 'vase', x: 2.7, z: 1.2 },
      {
        id: 'lotus-diadem',
        label: 'Sheltered Diadem',
        variant: 'g01-sunlit-diadem',
        x: 2.7,
        z: 2.6,
      },
      {
        id: 'lotus-pearl',
        label: 'West Lotus Bowl',
        variant: 'g22-aurora-lotus-bowl',
        x: -1.35,
        z: 0.8,
      },
    ],
  },
] as const

/** Canonical room and vessel order shared by content, protection, controls and art. */
export const ARCHIVE_HUSH_ROOMS = rooms.map((room) => ({
  id: room.id,
  title: room.title,
  description: room.description,
  centerZ: room.centerZ,
  vesselIds: room.displays.map(
    (display) => `${ARCHIVE_HUSH_LEVEL_ID}/${room.id}/encounter/${display.id}`,
  ),
  curtainVesselIds: room.curtainIds.map(
    (id) => `${ARCHIVE_HUSH_LEVEL_ID}/${room.id}/encounter/${id}`,
  ),
  curtainLabel: room.curtainLabel,
}))

const prefabs: RoomPrefab[] = rooms.map((room, index) => ({
  ...UNBROKEN_ARCHIVE_ROOM,
  id: `archive-hush-${room.id}`,
  checkpoints: UNBROKEN_ARCHIVE_ROOM.checkpoints.map((checkpoint) =>
    checkpoint.id === 'entry'
      ? {
          ...checkpoint,
          position: { ...checkpoint.position, z: index === 0 ? -0.8 : -2.2 },
        }
      : checkpoint,
  ),
  exhibitMounts: room.displays.map((display) => ({
    id: display.id,
    position: { x: display.x, y: 0, z: display.z },
    anchor: {
      x: display.x > 2 ? 1.8 : display.x,
      y: 0,
      z: display.x > 2 ? display.z + 0.5 : display.z - 0.85,
    },
    facingYaw: Math.PI,
    platformId: 'floor',
  })),
  exits: [],
}))
const escapeCenterZ =
  UNBROKEN_ARCHIVE_ROUTE.lotus +
  ENCLOSED_CHAMBER_HALF +
  ENCLOSED_CORRIDOR_HALF_LENGTH
const escapePassage: RoomPrefab = {
  ...ENCLOSED_ENTRY_ROOM,
  id: 'archive-hush-escape-passage',
  exits: [
    { id: 'archive-exit', minX: -0.8, maxX: 0.8, minZ: 1.7, maxZ: 2.2, top: 0 },
  ],
}
const allDisplays = rooms.flatMap<{
  id: string
  label: string
  variant: string
  x: number
  z: number
}>((room) => room.displays)
const catalog: LevelAuthoringCatalog = {
  ...UNBROKEN_ARCHIVE_CATALOG,
  rooms: {
    ...UNBROKEN_ARCHIVE_CATALOG.rooms,
    ...Object.fromEntries(
      [...prefabs, escapePassage].map((room) => [room.id, room]),
    ),
  },
  exhibits: Object.fromEntries(
    allDisplays.map((display) => [
      display.id,
      {
        id: display.id,
        variant: display.variant,
        plinth: {
          height: 0.3,
          radiusTop: 0.38,
          radiusBottom: 0.42,
          presentation: { role: 'plinth', material: 'stone' },
        },
      },
    ]),
  ),
  availableAssetRecipeIds: [
    ...UNBROKEN_ARCHIVE_CATALOG.availableAssetRecipeIds,
    'goblet',
    'vase',
  ],
}
const compiled = composeLevel(
  {
    ...UNBROKEN_ARCHIVE_SOURCE,
    layoutId: 'archive-hush',
    contentRevision: 3,
    title: 'The Archive After Dark',
    guidance: {
      subtitle: 'Protect three rooms. Keep every glass whole. Find the exit.',
      tutorial: {
        id: 'archive-hush-route',
        version: 2,
        pages: [
          {
            title: 'Keep the glass whole.',
            body: 'Slide the glass cover over one display. Hum the written note to shield two others. Close each curtain over its side displays.',
            aside:
              'Start the chime when you are ready. It tests your protection after three seconds. Everyday sounds never damage the glass.',
          },
          {
            title: 'Follow the open doors.',
            body: 'Protect every display in a room to open its door. Walk through the passage to the next room. After the third room, follow the last passage to the exit.',
            aside:
              'You can move while listening. Pausing stops the chime. A missed attempt leaves every glass whole, ready to try again.',
          },
        ],
      },
      completionTitle: 'The archive is safe',
      completionNext: 'All three rooms are protected. You reached the exit.',
    },
    rooms: [
      ...rooms.map((room, index) => ({
        id: room.id,
        prefabId: prefabs[index]!.id,
        translate: { x: 0, y: 0, z: room.centerZ },
        yawQuarterTurns: 0 as const,
        ...(index === 0
          ? {}
          : {
              checkpointRequiresCompleted: {
                entry: rooms[index - 1]!.displays.map((display) => display.id),
              },
            }),
        floorArt: {
          recipeId: 'hero-petal' as const,
          palette: 'archive' as const,
        },
        audioSceneId: 'gallery' as const,
      })),
      ...[
        { id: 'first-passage', z: UNBROKEN_ARCHIVE_ROUTE.firstPassage },
        { id: 'second-passage', z: UNBROKEN_ARCHIVE_ROUTE.secondPassage },
        { id: 'escape-passage', z: escapeCenterZ },
      ].map((passage) => ({
        id: passage.id,
        prefabId:
          passage.id === 'escape-passage'
            ? escapePassage.id
            : ENCLOSED_ENTRY_ROOM.id,
        translate: { x: 0, y: 0, z: passage.z },
        yawQuarterTurns: 0 as const,
        floorArt: {
          recipeId: 'quiet-marble' as const,
          palette: 'archive' as const,
        },
        audioSceneId: 'gallery' as const,
      })),
    ],
    exhibits: rooms.flatMap((room, index) =>
      room.displays.map((display) => ({
        id: display.id,
        roomId: room.id,
        mountId: display.id,
        prefabId: display.id,
        label: display.label,
        optional: false,
        completion: 'awaken' as const,
        requiresCompleted:
          index === 0
            ? []
            : rooms[index - 1]!.displays.map((previous) => previous.id),
        challenge: {
          kind: 'hold' as const,
          step: {
            target: 'comfortable' as const,
            hold: {
              requiredSeconds: 1.2,
              toleranceCents: 100,
              confidenceFloor: 0.65,
              dropoutGraceSeconds: 0.1,
              decayPerSecond: 0.25,
              maximumSampleGapSeconds: 0.1,
              maximumSampleAgeMs: 150,
            },
          },
        },
      })),
    ),
    connections: [
      { from: 'diadem.north', to: 'first-passage.south' },
      { from: 'first-passage.north', to: 'tide.south' },
      { from: 'tide.north', to: 'second-passage.south' },
      { from: 'second-passage.north', to: 'lotus.south' },
      { from: 'lotus.north', to: 'escape-passage.south' },
    ],
    solidActivations: rooms.map((room) => ({
      solid: `${room.id}.north-gate-body`,
      activation: { noneCompleted: room.displays.map((display) => display.id) },
      requiredForRoute: true,
    })),
    spawnCheckpoint: 'diadem.entry',
    exit: {
      zone: 'escape-passage.archive-exit',
      requiresCompleted: allDisplays.map((display) => display.id),
    },
    worldBounds: {
      minX: -5.2,
      maxX: 5.2,
      minY: -1.6,
      maxY: 10.5,
      minZ: -5.2,
      maxZ: escapeCenterZ + ENCLOSED_CORRIDOR_HALF_LENGTH + 0.2,
    },
    lightBounds: {
      minX: -4.8,
      maxX: 4.8,
      minY: 0,
      maxY: 8,
      minZ: -4.8,
      maxZ: escapeCenterZ + ENCLOSED_CORRIDOR_HALF_LENGTH,
    },
  },
  catalog,
)

/** Protection membership is explicit; these targets cannot be completed by pitch encounters. */
export const GLASS_ARCHIVE_HUSH: LevelDefinition = {
  ...compiled,
  protectionRooms: ARCHIVE_HUSH_ROOMS.map((room) => ({
    id: room.id,
    vesselIds: room.vesselIds,
    bounds: {
      minX: -4.2,
      maxX: 4.2,
      minZ: room.centerZ - 4.2,
      maxZ: room.centerZ + 4.2,
    },
    top: 0,
  })),
}

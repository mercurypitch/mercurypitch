// Unbroken Archive — a three-room awakening study using existing measured museum rooms and intact glassware.

import { composeLevel } from '../authoring/compose-level'
import type { AuthoredLevelSource, ExhibitPrefab, LevelAuthoringCatalog, RoomPrefab, } from '../authoring/contracts'
import type { ChallengeDefinition } from '../contracts'
import { ENCLOSED_CHAMBER_HALF, ENCLOSED_CORRIDOR_HALF_LENGTH, } from './enclosed-museum-kit'
import { GLASSWORKS_JOURNEY_ARCHIVE_ROOM, GLASSWORKS_JOURNEY_AUTHORING_CATALOG, } from './glassworks-journey-kit'

const GALLERY_TO_PASSAGE = ENCLOSED_CHAMBER_HALF + ENCLOSED_CORRIDOR_HALF_LENGTH
const GALLERY_SPACING = GALLERY_TO_PASSAGE * 2

export const UNBROKEN_ARCHIVE_ROUTE = {
  diadem: 0,
  firstPassage: GALLERY_TO_PASSAGE,
  tide: GALLERY_SPACING,
  secondPassage: GALLERY_SPACING + GALLERY_TO_PASSAGE,
  lotus: GALLERY_SPACING * 2,
} as const

// Keep the camera clear of the rear wall at entry and after restoring progress.
const ARCHIVE_ROOM: RoomPrefab = {
  ...GLASSWORKS_JOURNEY_ARCHIVE_ROOM,
  id: 'unbroken-archive-room',
  checkpoints: GLASSWORKS_JOURNEY_ARCHIVE_ROOM.checkpoints.map((checkpoint) =>
    checkpoint.id === 'entry'
      ? { ...checkpoint, position: { ...checkpoint.position, z: -1.4 } }
      : checkpoint,
  ),
}

/** The first room's cabinet contact stays independent of its decorative glassware. */
export const UNBROKEN_ARCHIVE_ROOM: RoomPrefab = {
  ...ARCHIVE_ROOM,
  id: 'unbroken-archive-dark-room',
  solids: [
    ...ARCHIVE_ROOM.solids,
    ...([-1, 1] as const).map((side) => ({
      id: side < 0 ? 'archive-west-cabinet' : 'archive-east-cabinet',
      kind: 'prop' as const,
      shape: 'box' as const,
      minX: side < 0 ? -4.44 : 3.72,
      maxX: side < 0 ? -3.72 : 4.44,
      minZ: -3.8,
      maxZ: 3.8,
      top: 3.1,
      thickness: 3.1,
      presentation: { role: 'wall' as const, material: 'stone' as const },
    })),
    ...([-1, 1] as const).map((side) => ({
      id:
        side < 0 ? 'archive-north-west-cabinet' : 'archive-north-east-cabinet',
      kind: 'prop' as const,
      shape: 'box' as const,
      minX: side < 0 ? -3.96 : 1.74,
      maxX: side < 0 ? -1.74 : 3.96,
      minZ: 3.94,
      maxZ: 4.44,
      top: 3.1,
      thickness: 3.1,
      presentation: { role: 'wall' as const, material: 'stone' as const },
    })),
  ],
}

const EXIT_ROOM: RoomPrefab = {
  ...ARCHIVE_ROOM,
  id: 'unbroken-archive-final-room',
  exits: [
    { id: 'archive-exit', minX: -0.8, maxX: 0.8, minZ: 2.8, maxZ: 3.3, top: 0 },
  ],
}

const EXHIBITS = [
  {
    id: 'sunlit-diadem',
    room: 'diadem',
    label: 'Sunlit Diadem',
    variant: 'g01-sunlit-diadem',
    archiveNoteDegree: 0,
  },
  {
    id: 'tidal-wave',
    room: 'tide',
    label: 'Tidal Wave Carafe',
    variant: 'g14-tidal-wave-carafe',
    archiveNoteDegree: 1,
  },
  {
    id: 'aurora-lotus',
    room: 'lotus',
    label: 'Aurora Lotus Bowl',
    variant: 'g22-aurora-lotus-bowl',
    archiveNoteDegree: 2,
  },
] as const

export const UNBROKEN_ARCHIVE_CATALOG: LevelAuthoringCatalog = {
  ...GLASSWORKS_JOURNEY_AUTHORING_CATALOG,
  rooms: {
    ...GLASSWORKS_JOURNEY_AUTHORING_CATALOG.rooms,
    [ARCHIVE_ROOM.id]: ARCHIVE_ROOM,
    [UNBROKEN_ARCHIVE_ROOM.id]: UNBROKEN_ARCHIVE_ROOM,
    [EXIT_ROOM.id]: EXIT_ROOM,
  },
  exhibits: Object.fromEntries(
    EXHIBITS.map((exhibit): [string, ExhibitPrefab] => [
      exhibit.id,
      {
        id: exhibit.id,
        variant: exhibit.variant,
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
    ...GLASSWORKS_JOURNEY_AUTHORING_CATALOG.availableAssetRecipeIds,
    ...EXHIBITS.map((exhibit) => exhibit.variant),
  ],
}

const AWAKENING_HOLD: ChallengeDefinition = {
  kind: 'hold',
  step: {
    target: 'comfortable',
    hold: {
      requiredSeconds: 1.2,
      toleranceCents: 150,
      confidenceFloor: 0.5,
      dropoutGraceSeconds: 0.15,
      decayPerSecond: 0.25,
      maximumSampleGapSeconds: 0.1,
      maximumSampleAgeMs: 150,
    },
  },
}

export const UNBROKEN_ARCHIVE_SOURCE: AuthoredLevelSource = {
  levelId: 'glassworks-unbroken-archive',
  layoutId: 'archive-awakening',
  contentRevision: 2,
  title: 'The Unbroken Archive',
  movement: {
    walkSpeed: 1.55,
    runSpeed: 2.7,
    runDelaySeconds: 0.6,
    runRampSeconds: 0.8,
  },
  guidance: {
    subtitle: 'Give each glass a note. Keep every glass whole.',
    tutorial: {
      id: 'unbroken-archive-awakening',
      version: 1,
      pages: [
        {
          title: 'Wake the first glass.',
          body: 'Walk to the Diadem and choose a comfortable note. Listen, then hold the note until the glass answers. It stays whole and opens the next room.',
          aside:
            'Use Change note whenever you need it. You can cancel to rest. There is no time limit.',
        },
        {
          title: 'Three rooms, three answers.',
          body: 'Follow the passage to the carafe, then the lotus bowl. Sing at each display, then walk past the last glass to finish.',
          aside:
            'Move with the thumbstick or WASD. Each written note follows your calibration. Without a saved vocal range, all three glasses use your easy note.',
        },
      ],
    },
    openingNotice:
      'Find the Sunlit Diadem. Choose a note that feels easy to sing.',
    encounterSuccessNotices: [
      {
        encounterId: 'sunlit-diadem',
        notice: 'The Diadem is awake. Follow the passage to the carafe.',
      },
      {
        encounterId: 'tidal-wave',
        notice: 'The carafe is awake. The lotus bowl is in the last room.',
      },
      {
        encounterId: 'aurora-lotus',
        notice: 'Every glass is whole. Walk past the lotus bowl to finish.',
      },
    ],
    completionTitle: 'Three answers. Every glass whole.',
    completionNext:
      'Return to the creator gallery whenever you want another listen.',
  },
  rooms: [
    {
      id: 'diadem',
      prefabId: UNBROKEN_ARCHIVE_ROOM.id,
      translate: { x: 0, y: 0, z: UNBROKEN_ARCHIVE_ROUTE.diadem },
      yawQuarterTurns: 0,
      floorArt: { recipeId: 'hero-petal', palette: 'neutral' },
      audioSceneId: 'gallery',
    },
    {
      id: 'first-passage',
      prefabId: 'enclosed-entry',
      translate: { x: 0, y: 0, z: UNBROKEN_ARCHIVE_ROUTE.firstPassage },
      yawQuarterTurns: 0,
      floorArt: { recipeId: 'quiet-marble', palette: 'neutral' },
      audioSceneId: 'gallery',
    },
    {
      id: 'tide',
      prefabId: ARCHIVE_ROOM.id,
      translate: { x: 0, y: 0, z: UNBROKEN_ARCHIVE_ROUTE.tide },
      yawQuarterTurns: 0,
      checkpointRequiresCompleted: { entry: ['sunlit-diadem'] },
      floorArt: { recipeId: 'angular-parquet', palette: 'archive' },
      audioSceneId: 'gallery',
    },
    {
      id: 'second-passage',
      prefabId: 'enclosed-entry',
      translate: { x: 0, y: 0, z: UNBROKEN_ARCHIVE_ROUTE.secondPassage },
      yawQuarterTurns: 0,
      floorArt: { recipeId: 'quiet-marble', palette: 'neutral' },
      audioSceneId: 'gallery',
    },
    {
      id: 'lotus',
      prefabId: EXIT_ROOM.id,
      translate: { x: 0, y: 0, z: UNBROKEN_ARCHIVE_ROUTE.lotus },
      yawQuarterTurns: 0,
      checkpointRequiresCompleted: { entry: ['tidal-wave'] },
      floorArt: { recipeId: 'sound-wave', palette: 'portrait' },
      audioSceneId: 'gallery',
    },
  ],
  exhibits: EXHIBITS.map((exhibit, index) => ({
    id: exhibit.id,
    roomId: exhibit.room,
    mountId: 'required-display',
    prefabId: exhibit.id,
    label: exhibit.label,
    optional: false,
    completion: 'awaken',
    challenge: {
      ...AWAKENING_HOLD,
      step: {
        ...AWAKENING_HOLD.step,
        archiveNoteDegree: exhibit.archiveNoteDegree,
      },
    },
    requiresCompleted: index === 0 ? [] : [EXHIBITS[index - 1]!.id],
  })),
  connections: [
    { from: 'diadem.north', to: 'first-passage.south' },
    { from: 'first-passage.north', to: 'tide.south' },
    { from: 'tide.north', to: 'second-passage.south' },
    { from: 'second-passage.north', to: 'lotus.south' },
  ],
  solidActivations: [
    {
      solid: 'diadem.north-gate-body',
      activation: { noneCompleted: ['sunlit-diadem'] },
      requiredForRoute: true,
    },
    {
      solid: 'tide.north-gate-body',
      activation: { noneCompleted: ['tidal-wave'] },
      requiredForRoute: true,
    },
  ],
  spawnCheckpoint: 'diadem.entry',
  exit: {
    zone: 'lotus.archive-exit',
    requiresCompleted: EXHIBITS.map((exhibit) => exhibit.id),
  },
  fallBelow: -1.6,
  worldBounds: {
    minX: -5.2,
    maxX: 5.2,
    minY: -1.6,
    maxY: 10.5,
    minZ: -5.2,
    maxZ: UNBROKEN_ARCHIVE_ROUTE.lotus + 5.2,
  },
  lightBounds: {
    minX: -4.8,
    maxX: 4.8,
    minY: 0,
    maxY: 8,
    minZ: -4.8,
    maxZ: UNBROKEN_ARCHIVE_ROUTE.lotus + 4.8,
  },
}

export const GLASS_UNBROKEN_ARCHIVE = composeLevel(
  UNBROKEN_ARCHIVE_SOURCE,
  UNBROKEN_ARCHIVE_CATALOG,
)

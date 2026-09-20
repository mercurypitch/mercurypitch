// Glassworks Journey blockout — a long held-note route built only from reusable museum data.

import { composeLevel } from '../authoring/compose-level'
import type { AuthoredLevelSource } from '../authoring/contracts'
import { ENCLOSED_CHAMBER_HALF, ENCLOSED_CORRIDOR_HALF_LENGTH, ENCLOSED_CORRIDOR_HALF_WIDTH, } from './enclosed-museum-kit'
import { GLASSWORKS_JOURNEY_AUTHORING_CATALOG } from './glassworks-journey-kit'

const WINDOW_EAST_X = ENCLOSED_CHAMBER_HALF + ENCLOSED_CORRIDOR_HALF_LENGTH
const ROUTE_SPINE_X =
  WINDOW_EAST_X + ENCLOSED_CORRIDOR_HALF_LENGTH + ENCLOSED_CORRIDOR_HALF_WIDTH
const WINDOW_NORTH_Z =
  ENCLOSED_CORRIDOR_HALF_WIDTH + ENCLOSED_CORRIDOR_HALF_LENGTH
const GARDEN_Z =
  WINDOW_NORTH_Z + ENCLOSED_CORRIDOR_HALF_LENGTH + ENCLOSED_CHAMBER_HALF
const GARDEN_PASSAGE_Z =
  GARDEN_Z + ENCLOSED_CHAMBER_HALF + ENCLOSED_CORRIDOR_HALF_LENGTH
const EAST_TURN_Z =
  GARDEN_PASSAGE_Z +
  ENCLOSED_CORRIDOR_HALF_LENGTH +
  ENCLOSED_CORRIDOR_HALF_WIDTH
const EAST_PASSAGE_X =
  ROUTE_SPINE_X + ENCLOSED_CORRIDOR_HALF_WIDTH + ENCLOSED_CORRIDOR_HALF_LENGTH
const ARCHIVE_SPINE_X =
  EAST_PASSAGE_X + ENCLOSED_CORRIDOR_HALF_LENGTH + ENCLOSED_CORRIDOR_HALF_WIDTH
const ARCHIVE_APPROACH_Z =
  EAST_TURN_Z + ENCLOSED_CORRIDOR_HALF_WIDTH + ENCLOSED_CORRIDOR_HALF_LENGTH
const ARCHIVE_Z =
  ARCHIVE_APPROACH_Z + ENCLOSED_CORRIDOR_HALF_LENGTH + ENCLOSED_CHAMBER_HALF
const PORTRAIT_PASSAGE_Z =
  ARCHIVE_Z + ENCLOSED_CHAMBER_HALF + ENCLOSED_CORRIDOR_HALF_LENGTH
const PORTRAIT_Z =
  PORTRAIT_PASSAGE_Z + ENCLOSED_CORRIDOR_HALF_LENGTH + ENCLOSED_CHAMBER_HALF
const PANORAMA_PASSAGE_Z =
  PORTRAIT_Z + ENCLOSED_CHAMBER_HALF + ENCLOSED_CORRIDOR_HALF_LENGTH
const PANORAMA_Z =
  PANORAMA_PASSAGE_Z +
  ENCLOSED_CORRIDOR_HALF_LENGTH +
  ENCLOSED_CORRIDOR_HALF_WIDTH

export const GLASSWORKS_JOURNEY_ROUTE = {
  vestibule: { x: 0, z: 0 },
  windowEast: { x: WINDOW_EAST_X, z: 0 },
  windowTurn: { x: ROUTE_SPINE_X, z: 0 },
  windowNorth: { x: ROUTE_SPINE_X, z: WINDOW_NORTH_Z },
  garden: { x: ROUTE_SPINE_X, z: GARDEN_Z },
  gardenPassage: { x: ROUTE_SPINE_X, z: GARDEN_PASSAGE_Z },
  eastTurn: { x: ROUTE_SPINE_X, z: EAST_TURN_Z },
  eastPassage: { x: EAST_PASSAGE_X, z: EAST_TURN_Z },
  northTurn: { x: ARCHIVE_SPINE_X, z: EAST_TURN_Z },
  archiveApproach: { x: ARCHIVE_SPINE_X, z: ARCHIVE_APPROACH_Z },
  archive: { x: ARCHIVE_SPINE_X, z: ARCHIVE_Z },
  portraitPassage: { x: ARCHIVE_SPINE_X, z: PORTRAIT_PASSAGE_Z },
  portrait: { x: ARCHIVE_SPINE_X, z: PORTRAIT_Z },
  panoramaPassage: { x: ARCHIVE_SPINE_X, z: PANORAMA_PASSAGE_Z },
  panorama: { x: ARCHIVE_SPINE_X, z: PANORAMA_Z },
} as const

export const GLASSWORKS_JOURNEY_SOURCE: AuthoredLevelSource = {
  levelId: 'glassworks-journey',
  layoutId: 'journey',
  contentRevision: 1,
  title: 'Glassworks Journey',
  movement: {
    walkSpeed: 1.55,
    runSpeed: 2.7,
    runDelaySeconds: 0.6,
    runRampSeconds: 0.8,
  },
  guidance: {
    subtitle: 'From first light to open sky',
    openingNotice: 'Follow the gold inlay to the laurel goblet.',
    encounterSuccessNotices: [
      {
        encounterId: 'vestibule-goblet',
        notice: 'The window passage is open. Follow its turn into the garden.',
      },
      {
        encounterId: 'garden-decanter',
        notice: 'The archive route is open beyond the garden.',
      },
      {
        encounterId: 'archive-carafe',
        notice: 'The portrait salon is open. Follow the quiet gallery north.',
      },
      {
        encounterId: 'portrait-finale',
        notice: 'The panorama is open. Take the last passage into the sky.',
      },
    ],
    completionTitle: 'The journey is singing.',
    completionNext: 'Take a moment. You made every gallery sing.',
  },
  rooms: [
    {
      id: 'vestibule',
      prefabId: 'enclosed-chamber',
      translate: { ...GLASSWORKS_JOURNEY_ROUTE.vestibule, y: 0 },
      yawQuarterTurns: 0,
      audioSceneId: 'museum',
    },
    {
      id: 'window-east',
      prefabId: 'enclosed-entry',
      translate: { ...GLASSWORKS_JOURNEY_ROUTE.windowEast, y: 0 },
      yawQuarterTurns: 1,
      audioSceneId: 'gallery',
    },
    {
      id: 'window-turn',
      prefabId: 'enclosed-corner',
      translate: { ...GLASSWORKS_JOURNEY_ROUTE.windowTurn, y: 0 },
      yawQuarterTurns: 0,
      audioSceneId: 'gallery',
    },
    {
      id: 'window-north',
      prefabId: 'enclosed-entry',
      translate: { ...GLASSWORKS_JOURNEY_ROUTE.windowNorth, y: 0 },
      yawQuarterTurns: 0,
      audioSceneId: 'gallery',
    },
    {
      id: 'garden',
      prefabId: 'glassworks-journey-gallery',
      translate: { ...GLASSWORKS_JOURNEY_ROUTE.garden, y: 0 },
      yawQuarterTurns: 0,
      checkpointRequiresCompleted: { entry: ['vestibule-goblet'] },
      audioSceneId: 'garden',
    },
    {
      id: 'garden-passage',
      prefabId: 'enclosed-entry',
      translate: { ...GLASSWORKS_JOURNEY_ROUTE.gardenPassage, y: 0 },
      yawQuarterTurns: 0,
      audioSceneId: 'garden',
    },
    {
      id: 'east-turn',
      prefabId: 'enclosed-corner',
      translate: { ...GLASSWORKS_JOURNEY_ROUTE.eastTurn, y: 0 },
      yawQuarterTurns: 2,
      audioSceneId: 'gallery',
    },
    {
      id: 'east-passage',
      prefabId: 'enclosed-entry',
      translate: { ...GLASSWORKS_JOURNEY_ROUTE.eastPassage, y: 0 },
      yawQuarterTurns: 1,
      audioSceneId: 'gallery',
    },
    {
      id: 'north-turn',
      prefabId: 'enclosed-corner',
      translate: { ...GLASSWORKS_JOURNEY_ROUTE.northTurn, y: 0 },
      yawQuarterTurns: 0,
      audioSceneId: 'gallery',
    },
    {
      id: 'archive-approach',
      prefabId: 'enclosed-entry',
      translate: { ...GLASSWORKS_JOURNEY_ROUTE.archiveApproach, y: 0 },
      yawQuarterTurns: 0,
      audioSceneId: 'gallery',
    },
    {
      id: 'archive',
      prefabId: 'glassworks-journey-gallery',
      translate: { ...GLASSWORKS_JOURNEY_ROUTE.archive, y: 0 },
      yawQuarterTurns: 0,
      checkpointRequiresCompleted: { entry: ['garden-decanter'] },
      audioSceneId: 'gallery',
    },
    {
      id: 'portrait-passage',
      prefabId: 'enclosed-entry',
      translate: { ...GLASSWORKS_JOURNEY_ROUTE.portraitPassage, y: 0 },
      yawQuarterTurns: 0,
      audioSceneId: 'museum',
    },
    {
      id: 'portrait',
      prefabId: 'glassworks-journey-gallery',
      translate: { ...GLASSWORKS_JOURNEY_ROUTE.portrait, y: 0 },
      yawQuarterTurns: 0,
      checkpointRequiresCompleted: { entry: ['archive-carafe'] },
      audioSceneId: 'museum',
    },
    {
      id: 'panorama-passage',
      prefabId: 'enclosed-entry',
      translate: { ...GLASSWORKS_JOURNEY_ROUTE.panoramaPassage, y: 0 },
      yawQuarterTurns: 0,
      audioSceneId: 'garden',
    },
    {
      id: 'panorama',
      prefabId: 'glassworks-journey-terrace',
      translate: { ...GLASSWORKS_JOURNEY_ROUTE.panorama, y: 0 },
      yawQuarterTurns: 0,
      checkpointRequiresCompleted: { panorama: ['portrait-finale'] },
      audioSceneId: 'garden',
    },
    {
      id: 'panorama-camera',
      prefabId: 'enclosed-terrace-panorama',
      translate: { ...GLASSWORKS_JOURNEY_ROUTE.panorama, y: 0 },
      yawQuarterTurns: 0,
    },
  ],
  exhibits: [
    {
      id: 'vestibule-goblet',
      roomId: 'vestibule',
      mountId: 'threshold-display',
      prefabId: 'enclosed-threshold-goblet',
      label: 'Laurel goblet',
      optional: false,
    },
    {
      id: 'garden-decanter',
      roomId: 'garden',
      mountId: 'required-display',
      prefabId: 'enclosed-passage-decanter',
      label: 'Garden decanter',
      optional: false,
      requiresCompleted: ['vestibule-goblet'],
    },
    {
      id: 'garden-amphora',
      roomId: 'garden',
      mountId: 'west-display',
      prefabId: 'glassworks-journey-amphora',
      label: 'Courtyard amphora',
      optional: true,
      requiresCompleted: ['vestibule-goblet'],
    },
    {
      id: 'garden-coupe',
      roomId: 'garden',
      mountId: 'east-display',
      prefabId: 'enclosed-window-coupe',
      label: 'Garden coupe',
      optional: true,
      requiresCompleted: ['vestibule-goblet'],
    },
    {
      id: 'archive-carafe',
      roomId: 'archive',
      mountId: 'required-display',
      prefabId: 'glassworks-journey-fluted',
      label: 'Archive carafe',
      optional: false,
      requiresCompleted: ['garden-decanter'],
    },
    {
      id: 'portrait-finale',
      roomId: 'portrait',
      mountId: 'required-display',
      prefabId: 'glassworks-journey-portrait',
      label: 'Glass portrait',
      optional: false,
      requiresCompleted: ['archive-carafe'],
    },
    {
      id: 'panorama-amphora',
      roomId: 'panorama',
      mountId: 'west-overlook',
      prefabId: 'glassworks-journey-amphora',
      label: 'Moon amphora',
      optional: true,
      requiresCompleted: ['portrait-finale'],
    },
    {
      id: 'panorama-coupe',
      roomId: 'panorama',
      mountId: 'east-overlook',
      prefabId: 'enclosed-window-coupe',
      label: 'Sky coupe',
      optional: true,
      requiresCompleted: ['portrait-finale'],
    },
  ],
  connections: [
    { from: 'vestibule.east', to: 'window-east.south' },
    { from: 'window-east.north', to: 'window-turn.west' },
    { from: 'window-turn.north', to: 'window-north.south' },
    { from: 'window-north.north', to: 'garden.south' },
    { from: 'garden.north', to: 'garden-passage.south' },
    { from: 'garden-passage.north', to: 'east-turn.north' },
    { from: 'east-turn.west', to: 'east-passage.south' },
    { from: 'east-passage.north', to: 'north-turn.west' },
    { from: 'north-turn.north', to: 'archive-approach.south' },
    { from: 'archive-approach.north', to: 'archive.south' },
    { from: 'archive.north', to: 'portrait-passage.south' },
    { from: 'portrait-passage.north', to: 'portrait.south' },
    { from: 'portrait.north', to: 'panorama-passage.south' },
    { from: 'panorama-passage.north', to: 'panorama.south' },
  ],
  solidActivations: [
    {
      solid: 'vestibule.east-center-body',
      activation: { noneCompleted: ['vestibule-goblet'] },
      requiredForRoute: true,
    },
    {
      solid: 'garden.north-gate-body',
      activation: { noneCompleted: ['garden-decanter'] },
      requiredForRoute: true,
    },
    {
      solid: 'archive.north-gate-body',
      activation: { noneCompleted: ['archive-carafe'] },
      requiredForRoute: true,
    },
    {
      solid: 'portrait.north-gate-body',
      activation: { noneCompleted: ['portrait-finale'] },
      requiredForRoute: true,
    },
  ],
  spawnCheckpoint: 'vestibule.arrival',
  exit: {
    zone: 'panorama.exit',
    requiresCompleted: ['portrait-finale'],
  },
  fallBelow: -1.6,
  worldBounds: {
    minX: -5.1,
    maxX: 29,
    minY: -1.6,
    maxY: 10.5,
    minZ: -5.1,
    maxZ: 70.5,
  },
  lightBounds: {
    minX: -4.7,
    maxX: 27,
    minY: 0,
    maxY: 8,
    minZ: -4.7,
    maxZ: 70,
  },
}

export const GLASSWORKS_JOURNEY = composeLevel(
  GLASSWORKS_JOURNEY_SOURCE,
  GLASSWORKS_JOURNEY_AUTHORING_CATALOG,
)

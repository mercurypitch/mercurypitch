// Twin Galleries — a folded low/high teaching route through two galleries, a listening court and panorama.

import { composeLevel } from '../authoring/compose-level'
import type { AuthoredLevelSource } from '../authoring/contracts'
import type { ChallengeDefinition, HoldDefinition } from '../contracts'
import { ENCLOSED_CHAMBER_HALF, ENCLOSED_CORRIDOR_HALF_LENGTH, ENCLOSED_CORRIDOR_HALF_WIDTH, ENCLOSED_PANORAMA_CAMERA_NORTH, ENCLOSED_TERRACE_NORTH, } from './enclosed-museum-kit'
import { TWIN_GALLERY_REWARDS } from './gallery-rewards'
import { TWIN_GALLERIES_AUTHORING_CATALOG } from './twin-galleries-kit'

const GALLERY_TO_PASSAGE = ENCLOSED_CHAMBER_HALF + ENCLOSED_CORRIDOR_HALF_LENGTH
const PASSAGE_TO_TURN =
  ENCLOSED_CORRIDOR_HALF_LENGTH + ENCLOSED_CORRIDOR_HALF_WIDTH
const CHAPTER_OFFSET = GALLERY_TO_PASSAGE + PASSAGE_TO_TURN

export const TWIN_GALLERIES_ROUTE = {
  warm: { x: 0, z: 0 },
  warmPassage: { x: 0, z: GALLERY_TO_PASSAGE },
  eastTurn: { x: 0, z: CHAPTER_OFFSET },
  eastPassage: { x: PASSAGE_TO_TURN, z: CHAPTER_OFFSET },
  cool: { x: CHAPTER_OFFSET, z: CHAPTER_OFFSET },
  coolPassage: {
    x: CHAPTER_OFFSET + GALLERY_TO_PASSAGE,
    z: CHAPTER_OFFSET,
  },
  northTurn: { x: CHAPTER_OFFSET * 2, z: CHAPTER_OFFSET },
  listeningBridge: {
    x: CHAPTER_OFFSET * 2,
    z: CHAPTER_OFFSET + PASSAGE_TO_TURN,
  },
  court: { x: CHAPTER_OFFSET * 2, z: CHAPTER_OFFSET * 2 },
  courtPassage: {
    x: CHAPTER_OFFSET * 2,
    z: CHAPTER_OFFSET * 2 + GALLERY_TO_PASSAGE,
  },
  westTurn: { x: CHAPTER_OFFSET * 2, z: CHAPTER_OFFSET * 3 },
  westPassage: {
    x: CHAPTER_OFFSET * 2 - PASSAGE_TO_TURN,
    z: CHAPTER_OFFSET * 3,
  },
  portrait: { x: CHAPTER_OFFSET, z: CHAPTER_OFFSET * 3 },
  portraitWest: { x: PASSAGE_TO_TURN, z: CHAPTER_OFFSET * 3 },
  panoramaTurn: { x: 0, z: CHAPTER_OFFSET * 3 },
  panoramaPassage: {
    x: 0,
    z: CHAPTER_OFFSET * 3 + PASSAGE_TO_TURN,
  },
  panorama: {
    x: 0,
    z: CHAPTER_OFFSET * 3 + PASSAGE_TO_TURN * 2,
  },
} as const

export const TWIN_GALLERIES_HOLD: HoldDefinition = {
  requiredSeconds: 1.2,
  toleranceCents: 150,
  confidenceFloor: 0.5,
  dropoutGraceSeconds: 0.15,
  decayPerSecond: 0.25,
  maximumSampleGapSeconds: 0.1,
  maximumSampleAgeMs: 150,
}

export const TWIN_GALLERIES_PAIR_HOLD: HoldDefinition = {
  ...TWIN_GALLERIES_HOLD,
  requiredSeconds: 0.9,
}

function holdChallenge(target: 'low' | 'high'): ChallengeDefinition {
  return {
    kind: 'hold',
    step: { target, hold: { ...TWIN_GALLERIES_HOLD } },
  }
}

function pairChallenge(): ChallengeDefinition {
  return {
    kind: 'ordered-pair',
    steps: [
      { target: 'low', hold: { ...TWIN_GALLERIES_PAIR_HOLD } },
      { target: 'high', hold: { ...TWIN_GALLERIES_PAIR_HOLD } },
    ],
    wrongOrder: 'reset',
  }
}

export const TWIN_GALLERIES_SOURCE: AuthoredLevelSource = {
  levelId: 'glassworks-twin-galleries',
  layoutId: 'twin-galleries',
  contentRevision: 1,
  title: 'Twin Galleries',
  rewards: TWIN_GALLERY_REWARDS,
  movement: {
    walkSpeed: 1.55,
    runSpeed: 2.7,
    runDelaySeconds: 0.6,
    runRampSeconds: 0.8,
  },
  guidance: {
    subtitle: 'Two lights, two notes, one shared answer',
    tutorial: {
      id: 'comfortable-pair',
      version: 1,
      pages: [
        {
          title: 'Choose two easy notes.',
          body: 'Movement is familiar: walk, look around and follow the gold path. At the first circle, choose Sing. Merc helps you find one comfortable lower note and one comfortable higher note; neither should feel like a stretch.',
          aside:
            'Jump is optional. Keep moving to ease into a run, and begin with the amber urn.',
        },
        {
          title: 'Listen low, then high.',
          body: 'At paired exhibits, listen to both notes first. When it is your turn, sing your lower note, then your higher note. The portrait asks for the same order.',
          aside:
            'Use Hear example or Change notes whenever you need it. There is no need to shout and no time limit; cancel to rest.',
        },
      ],
    },
    openingNotice:
      'Begin with the amber gallery. Let a comfortable low note settle.',
    encounterSuccessNotices: [
      {
        encounterId: 'lower-urn',
        notice:
          'The celadon gallery is open. Carry that low note toward its brighter answer.',
      },
      {
        encounterId: 'upper-decanter',
        notice:
          'The listening bridge is open. Follow the windows to hear both notes together.',
      },
      {
        encounterId: 'bridge-pair',
        notice:
          'Low, then high. The portrait gallery is ready for the same gentle pair.',
      },
      {
        encounterId: 'portrait-pair',
        notice:
          'The panorama is open. Follow the returning gallery into the sky.',
      },
    ],
    completionTitle: 'The Twin Galleries answer together.',
    completionNext: 'Return to the gallery map to choose what comes next.',
  },
  rooms: [
    {
      id: 'warm',
      prefabId: 'twin-galleries-warm',
      translate: { ...TWIN_GALLERIES_ROUTE.warm, y: 0 },
      yawQuarterTurns: 0,
      floorArt: { recipeId: 'hero-petal', palette: 'garden' },
      audioSceneId: 'museum',
    },
    {
      id: 'warm-passage',
      prefabId: 'enclosed-entry',
      translate: { ...TWIN_GALLERIES_ROUTE.warmPassage, y: 0 },
      yawQuarterTurns: 0,
      floorArt: { recipeId: 'quiet-marble', palette: 'garden' },
      audioSceneId: 'gallery',
    },
    {
      id: 'east-turn',
      prefabId: 'enclosed-corner',
      translate: { ...TWIN_GALLERIES_ROUTE.eastTurn, y: 0 },
      yawQuarterTurns: 2,
      floorArt: { recipeId: 'quiet-marble', palette: 'neutral' },
      audioSceneId: 'gallery',
    },
    {
      id: 'east-passage',
      prefabId: 'enclosed-entry',
      translate: { ...TWIN_GALLERIES_ROUTE.eastPassage, y: 0 },
      yawQuarterTurns: 1,
      floorArt: { recipeId: 'quiet-marble', palette: 'neutral' },
      audioSceneId: 'gallery',
    },
    {
      id: 'cool',
      prefabId: 'twin-galleries-cool',
      translate: { ...TWIN_GALLERIES_ROUTE.cool, y: 0 },
      yawQuarterTurns: 1,
      checkpointRequiresCompleted: { entry: ['lower-urn'] },
      floorArt: { recipeId: 'angular-parquet', palette: 'archive' },
      audioSceneId: 'gallery',
    },
    {
      id: 'cool-passage',
      prefabId: 'enclosed-entry',
      translate: { ...TWIN_GALLERIES_ROUTE.coolPassage, y: 0 },
      yawQuarterTurns: 1,
      floorArt: { recipeId: 'quiet-marble', palette: 'archive' },
      audioSceneId: 'gallery',
    },
    {
      id: 'north-turn',
      prefabId: 'enclosed-corner',
      translate: { ...TWIN_GALLERIES_ROUTE.northTurn, y: 0 },
      yawQuarterTurns: 0,
      floorArt: { recipeId: 'quiet-marble', palette: 'neutral' },
      audioSceneId: 'gallery',
    },
    {
      id: 'listening-bridge',
      prefabId: 'twin-galleries-listening-bridge',
      translate: { ...TWIN_GALLERIES_ROUTE.listeningBridge, y: 0 },
      yawQuarterTurns: 0,
      floorArt: { recipeId: 'sound-wave', palette: 'neutral' },
      audioSceneId: 'garden',
    },
    {
      id: 'court',
      prefabId: 'twin-galleries-court',
      translate: { ...TWIN_GALLERIES_ROUTE.court, y: 0 },
      yawQuarterTurns: 0,
      checkpointRequiresCompleted: { entry: ['upper-decanter'] },
      floorArt: { recipeId: 'sound-wave', palette: 'portrait' },
      audioSceneId: 'garden',
    },
    {
      id: 'court-passage',
      prefabId: 'enclosed-entry',
      translate: { ...TWIN_GALLERIES_ROUTE.courtPassage, y: 0 },
      yawQuarterTurns: 0,
      floorArt: { recipeId: 'quiet-marble', palette: 'neutral' },
      audioSceneId: 'gallery',
    },
    {
      id: 'west-turn',
      prefabId: 'enclosed-corner',
      translate: { ...TWIN_GALLERIES_ROUTE.westTurn, y: 0 },
      yawQuarterTurns: 3,
      floorArt: { recipeId: 'quiet-marble', palette: 'neutral' },
      audioSceneId: 'gallery',
    },
    {
      id: 'west-passage',
      prefabId: 'enclosed-entry',
      translate: { ...TWIN_GALLERIES_ROUTE.westPassage, y: 0 },
      yawQuarterTurns: 3,
      floorArt: { recipeId: 'quiet-marble', palette: 'neutral' },
      audioSceneId: 'gallery',
    },
    {
      id: 'portrait',
      prefabId: 'twin-galleries-portrait',
      translate: { ...TWIN_GALLERIES_ROUTE.portrait, y: 0 },
      yawQuarterTurns: 3,
      checkpointRequiresCompleted: { entry: ['bridge-pair'] },
      floorArt: { recipeId: 'orbital-rings', palette: 'portrait' },
      audioSceneId: 'museum',
    },
    {
      id: 'portrait-west',
      prefabId: 'enclosed-entry',
      translate: { ...TWIN_GALLERIES_ROUTE.portraitWest, y: 0 },
      yawQuarterTurns: 3,
      floorArt: { recipeId: 'quiet-marble', palette: 'portrait' },
      audioSceneId: 'museum',
    },
    {
      id: 'panorama-turn',
      prefabId: 'enclosed-corner',
      translate: { ...TWIN_GALLERIES_ROUTE.panoramaTurn, y: 0 },
      yawQuarterTurns: 1,
      floorArt: { recipeId: 'quiet-marble', palette: 'neutral' },
      audioSceneId: 'gallery',
    },
    {
      id: 'panorama-passage',
      prefabId: 'enclosed-entry',
      translate: { ...TWIN_GALLERIES_ROUTE.panoramaPassage, y: 0 },
      yawQuarterTurns: 0,
      floorArt: { recipeId: 'quiet-marble', palette: 'garden' },
      audioSceneId: 'garden',
    },
    {
      id: 'panorama',
      prefabId: 'twin-galleries-panorama',
      translate: { ...TWIN_GALLERIES_ROUTE.panorama, y: 0 },
      yawQuarterTurns: 0,
      checkpointRequiresCompleted: { panorama: ['portrait-pair'] },
      floorArt: { recipeId: 'quiet-marble', palette: 'garden' },
      audioSceneId: 'garden',
    },
    {
      id: 'panorama-camera',
      prefabId: 'twin-galleries-panorama-camera',
      translate: { ...TWIN_GALLERIES_ROUTE.panorama, y: 0 },
      yawQuarterTurns: 0,
    },
  ],
  exhibits: [
    {
      id: 'lower-urn',
      roomId: 'warm',
      mountId: 'required-display',
      prefabId: 'twin-galleries-amber-urn',
      label: 'Amber cadence urn',
      optional: false,
      challenge: holdChallenge('low'),
    },
    {
      id: 'lower-coupe',
      roomId: 'warm',
      mountId: 'west-display',
      prefabId: 'enclosed-window-coupe',
      label: 'Amber side coupe',
      optional: true,
      challenge: holdChallenge('low'),
    },
    {
      id: 'upper-decanter',
      roomId: 'cool',
      mountId: 'required-display',
      prefabId: 'twin-galleries-celadon-decanter',
      label: 'Celadon lark decanter',
      optional: false,
      requiresCompleted: ['lower-urn'],
      challenge: holdChallenge('high'),
    },
    {
      id: 'upper-goblet',
      roomId: 'cool',
      mountId: 'east-display',
      prefabId: 'enclosed-threshold-goblet',
      label: 'Celadon side goblet',
      optional: true,
      requiresCompleted: ['lower-urn'],
      challenge: holdChallenge('high'),
    },
    {
      id: 'bridge-pair',
      roomId: 'court',
      mountId: 'required-display',
      prefabId: 'enclosed-passage-decanter',
      label: 'Twin-tone answer',
      optional: false,
      requiresCompleted: ['upper-decanter'],
      challenge: pairChallenge(),
    },
    {
      id: 'court-echo',
      roomId: 'court',
      mountId: 'west-display',
      prefabId: 'twin-galleries-opaline-echo',
      label: 'Opaline echo amphora',
      optional: true,
      requiresCompleted: ['upper-decanter'],
      challenge: pairChallenge(),
    },
    {
      id: 'portrait-pair',
      roomId: 'portrait',
      mountId: 'required-display',
      prefabId: 'twin-galleries-portrait-exhibit',
      label: 'Portrait of two voices',
      optional: false,
      requiresCompleted: ['bridge-pair'],
      challenge: pairChallenge(),
    },
  ],
  connections: [
    { from: 'warm.north', to: 'warm-passage.south' },
    { from: 'warm-passage.north', to: 'east-turn.north' },
    { from: 'east-turn.west', to: 'east-passage.south' },
    { from: 'east-passage.north', to: 'cool.south' },
    { from: 'cool.north', to: 'cool-passage.south' },
    { from: 'cool-passage.north', to: 'north-turn.west' },
    { from: 'north-turn.north', to: 'listening-bridge.south' },
    { from: 'listening-bridge.north', to: 'court.south' },
    { from: 'court.north', to: 'court-passage.south' },
    { from: 'court-passage.north', to: 'west-turn.west' },
    { from: 'west-turn.north', to: 'west-passage.south' },
    { from: 'west-passage.north', to: 'portrait.south' },
    { from: 'portrait.north', to: 'portrait-west.south' },
    { from: 'portrait-west.north', to: 'panorama-turn.north' },
    { from: 'panorama-turn.west', to: 'panorama-passage.south' },
    { from: 'panorama-passage.north', to: 'panorama.south' },
  ],
  solidActivations: [
    {
      solid: 'warm.north-gate-body',
      activation: { noneCompleted: ['lower-urn'] },
      requiredForRoute: true,
    },
    {
      solid: 'cool.north-gate-body',
      activation: { noneCompleted: ['upper-decanter'] },
      requiredForRoute: true,
    },
    {
      solid: 'court.north-gate-body',
      activation: { noneCompleted: ['bridge-pair'] },
      requiredForRoute: true,
    },
    {
      solid: 'portrait.north-gate-body',
      activation: { noneCompleted: ['portrait-pair'] },
      requiredForRoute: true,
    },
  ],
  spawnCheckpoint: 'warm.entry',
  exit: {
    zone: 'panorama.exit',
    requiresCompleted: ['portrait-pair'],
  },
  fallBelow: -1.6,
  worldBounds: {
    minX: -5.1,
    maxX: TWIN_GALLERIES_ROUTE.court.x + 5.1,
    minY: -1.6,
    maxY: 10.5,
    minZ: -5.1,
    maxZ: TWIN_GALLERIES_ROUTE.panorama.z + ENCLOSED_PANORAMA_CAMERA_NORTH,
  },
  lightBounds: {
    minX: -4.7,
    maxX: TWIN_GALLERIES_ROUTE.court.x + 4.7,
    minY: 0,
    maxY: 8,
    minZ: -4.7,
    maxZ: TWIN_GALLERIES_ROUTE.panorama.z + ENCLOSED_TERRACE_NORTH,
  },
}

export const TWIN_GALLERIES = composeLevel(
  TWIN_GALLERIES_SOURCE,
  TWIN_GALLERIES_AUTHORING_CATALOG,
)

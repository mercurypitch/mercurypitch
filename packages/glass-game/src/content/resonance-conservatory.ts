// Resonance Conservatory — a handcrafted botanical walk from stillness into gentle pitch waves.

import { composeLevel } from '../authoring/compose-level'
import { CONSERVATORY_REWARDS } from './gallery-rewards'
import type { AuthoredLevelSource, RoomPlacement } from '../authoring/contracts'
import type { ChallengeDefinition, HoldDefinition } from '../contracts'
import { CONSERVATORY_AUTHORING_CATALOG } from './conservatory-kit'
import { ENCLOSED_CHAMBER_HALF, ENCLOSED_CORRIDOR_HALF_LENGTH, ENCLOSED_CORRIDOR_HALF_WIDTH, } from './enclosed-museum-kit'

const HALL_STEP = ENCLOSED_CHAMBER_HALF + ENCLOSED_CORRIDOR_HALF_LENGTH
const TURN_STEP = ENCLOSED_CORRIDOR_HALF_WIDTH + ENCLOSED_CORRIDOR_HALF_LENGTH
const SPAN = HALL_STEP + TURN_STEP
const FERN_Z = HALL_STEP * 2
const CROSS_Z = FERN_Z + SPAN
const GARDEN_Z = CROSS_Z + SPAN
const RETURN_Z = GARDEN_Z + SPAN

export const CONSERVATORY_ROUTE = {
  foyer: { x: 0, z: 0 },
  fern: { x: 0, z: FERN_Z },
  court: { x: SPAN, z: CROSS_Z },
  orchid: { x: SPAN * 2, z: GARDEN_Z },
  salon: { x: SPAN, z: RETURN_Z },
  panorama: { x: SPAN - HALL_STEP - TURN_STEP, z: RETURN_Z },
} as const

export const CONSERVATORY_SETTLE: HoldDefinition = {
  requiredSeconds: 0.8,
  toleranceCents: 100,
  confidenceFloor: 0.5,
  dropoutGraceSeconds: 0.15,
  decayPerSecond: 0.25,
  maximumSampleGapSeconds: 0.1,
  maximumSampleAgeMs: 150,
}
export const CONSERVATORY_WAVE: ChallengeDefinition & { kind: 'settle-wave' } =
  {
    kind: 'settle-wave',
    step: { target: 'comfortable', hold: CONSERVATORY_SETTLE },
    wave: {
      requiredCycles: 2,
      minimumExcursionCents: 35,
      maximumExcursionCents: 225,
      minimumCycleSeconds: 0.3,
      maximumCycleSeconds: 2.5,
      minimumWaveSeconds: 1.2,
      maximumCentsPerSecond: 2400,
      smoothingSeconds: 0.045,
    },
  }
const STILL: ChallengeDefinition = {
  kind: 'hold',
  step: {
    target: 'comfortable',
    hold: { ...CONSERVATORY_SETTLE, requiredSeconds: 1.2, toleranceCents: 150 },
  },
}

function room(
  id: string,
  prefabId: string,
  x: number,
  z: number,
  yawQuarterTurns: RoomPlacement['yawQuarterTurns'] = 0,
  recipeId:
    | 'quiet-marble'
    | 'sound-wave'
    | 'hero-petal'
    | 'orbital-rings' = 'quiet-marble',
  after?: string,
): RoomPlacement {
  return {
    id,
    prefabId,
    translate: { x, y: 0, z },
    yawQuarterTurns,
    floorArt: { recipeId, palette: 'garden' },
    audioSceneId: 'garden',
    ...(after !== undefined
      ? { checkpointRequiresCompleted: { entry: [after] } }
      : {}),
  }
}

export const CONSERVATORY_SOURCE: AuthoredLevelSource = {
  levelId: 'glassworks-resonance-conservatory',
  layoutId: 'resonance-conservatory',
  contentRevision: 2,
  title: 'Resonance Conservatory',
  rewards: CONSERVATORY_REWARDS,
  movement: {
    walkSpeed: 1.55,
    runSpeed: 2.9,
    runDelaySeconds: 0.6,
    runRampSeconds: 0.8,
  },
  guidance: {
    subtitle: 'A little stillness, a little movement',
    openingNotice: 'Let the entrance goblet hear a familiar steady note.',
    tutorial: {
      id: 'settle-and-wave',
      version: 2,
      pages: [
        {
          title: 'Begin with stillness.',
          body: 'Walk through the conservatory at your own pace. The first goblet asks for your familiar comfortable note. The fern house introduces a new sound: first steady, then gently swaying.',
          aside:
            'Ordinary controls move Merc. Your voice is only for the exhibits; stop on a glowing circle to sing.',
        },
        {
          title: 'Let the note sway.',
          body: 'Listen to the example. Settle your note, then glide gently above, below, above, and below before returning to your starting note. That makes two waves. A semitone each way is plenty; a whole tone is okay. There is no exact beat to catch or need to sing loudly.',
          aside:
            'Use Hear example or Change note at any time. Take a breath to retry the wave; the settled first step stays with you.',
        },
      ],
    },
    encounterSuccessNotices: [
      {
        encounterId: 'entrance-goblet',
        notice: 'The fern house is open. Follow the first golden wave.',
      },
      {
        encounterId: 'fern-wave',
        notice:
          'Stillness became movement. Wander through the listening court toward the orchids.',
      },
      {
        encounterId: 'orchid-wave',
        notice: 'The keeper is listening beyond the returning gallery.',
      },
      {
        encounterId: 'keeper-finale',
        notice:
          'The conservatory answers. Follow the last gallery into the open sky.',
      },
    ],
    completionTitle: 'The garden moves with your voice.',
    completionNext:
      'Keep this gentle wave, and return whenever you want to explore again.',
  },
  rooms: [
    room('foyer', 'conservatory-foyer', 0, 0, 0, 'hero-petal'),
    room('fern-approach', 'enclosed-entry', 0, HALL_STEP),
    room(
      'fern-house',
      'conservatory-fern-house',
      0,
      FERN_Z,
      0,
      'sound-wave',
      'entrance-goblet',
    ),
    room('fern-passage', 'enclosed-entry', 0, FERN_Z + HALL_STEP),
    room('east-turn', 'enclosed-corner', 0, CROSS_Z, 2),
    room(
      'court-approach',
      'twin-galleries-listening-bridge',
      TURN_STEP,
      CROSS_Z,
      1,
    ),
    room(
      'listening-court',
      'conservatory-listening-court',
      SPAN,
      CROSS_Z,
      1,
      'orbital-rings',
      'fern-wave',
    ),
    room('orchid-passage', 'enclosed-entry', SPAN + HALL_STEP, CROSS_Z, 1),
    room('north-turn', 'enclosed-corner', SPAN * 2, CROSS_Z, 0),
    room(
      'orchid-approach',
      'twin-galleries-listening-bridge',
      SPAN * 2,
      CROSS_Z + TURN_STEP,
    ),
    room(
      'orchid-house',
      'conservatory-orchid-house',
      SPAN * 2,
      GARDEN_Z,
      0,
      'hero-petal',
      'fern-wave',
    ),
    room('orchid-return', 'enclosed-entry', SPAN * 2, GARDEN_Z + HALL_STEP),
    room('west-turn', 'enclosed-corner', SPAN * 2, RETURN_Z, 3),
    room('salon-approach', 'enclosed-entry', SPAN * 2 - TURN_STEP, RETURN_Z, 3),
    room(
      'wave-salon',
      'conservatory-wave-salon',
      SPAN,
      RETURN_Z,
      3,
      'sound-wave',
      'orchid-wave',
    ),
    room('sky-passage', 'enclosed-entry', SPAN - HALL_STEP, RETURN_Z, 3),
    {
      ...room(
        'panorama',
        'twin-galleries-panorama',
        CONSERVATORY_ROUTE.panorama.x,
        RETURN_Z,
        3,
      ),
      checkpointRequiresCompleted: { panorama: ['keeper-finale'] },
    },
    {
      id: 'panorama-camera',
      prefabId: 'twin-galleries-panorama-camera',
      translate: { ...CONSERVATORY_ROUTE.panorama, y: 0 },
      yawQuarterTurns: 3,
    },
  ],
  exhibits: [
    {
      id: 'entrance-goblet',
      roomId: 'foyer',
      mountId: 'required-display',
      prefabId: 'enclosed-threshold-goblet',
      label: 'A note at the garden gate',
      optional: false,
      challenge: STILL,
    },
    {
      id: 'fern-wave',
      roomId: 'fern-house',
      mountId: 'required-display',
      prefabId: 'enclosed-passage-decanter',
      label: 'The first gentle wave',
      optional: false,
      requiresCompleted: ['entrance-goblet'],
      challenge: CONSERVATORY_WAVE,
    },
    {
      id: 'court-coupe',
      roomId: 'listening-court',
      mountId: 'west-display',
      prefabId: 'enclosed-window-coupe',
      label: 'A quiet note beside the harp',
      optional: true,
      requiresCompleted: ['fern-wave'],
      challenge: STILL,
    },
    {
      id: 'orchid-wave',
      roomId: 'orchid-house',
      mountId: 'required-display',
      prefabId: 'twin-galleries-opaline-echo',
      label: 'The orchid answers',
      optional: false,
      requiresCompleted: ['fern-wave'],
      challenge: CONSERVATORY_WAVE,
    },
    {
      id: 'orchid-echo',
      roomId: 'orchid-house',
      mountId: 'east-display',
      prefabId: 'glassworks-journey-fluted',
      label: 'A wave among the leaves',
      optional: true,
      requiresCompleted: ['fern-wave'],
      challenge: CONSERVATORY_WAVE,
    },
    {
      id: 'keeper-finale',
      roomId: 'wave-salon',
      mountId: 'required-display',
      prefabId: 'conservatory-portrait-exhibit',
      label: 'The keeper of gentle waves',
      optional: false,
      requiresCompleted: ['orchid-wave'],
      challenge: CONSERVATORY_WAVE,
    },
    {
      id: 'sky-echo',
      roomId: 'panorama',
      mountId: 'west-overlook',
      prefabId: 'glassworks-journey-amphora',
      label: 'One last wave to the sky',
      optional: true,
      requiresCompleted: ['keeper-finale'],
      challenge: CONSERVATORY_WAVE,
    },
  ],
  connections: [
    { from: 'foyer.north', to: 'fern-approach.south' },
    { from: 'fern-approach.north', to: 'fern-house.south' },
    { from: 'fern-house.north', to: 'fern-passage.south' },
    { from: 'fern-passage.north', to: 'east-turn.north' },
    { from: 'east-turn.west', to: 'court-approach.south' },
    { from: 'court-approach.north', to: 'listening-court.south' },
    { from: 'listening-court.north', to: 'orchid-passage.south' },
    { from: 'orchid-passage.north', to: 'north-turn.west' },
    { from: 'north-turn.north', to: 'orchid-approach.south' },
    { from: 'orchid-approach.north', to: 'orchid-house.south' },
    { from: 'orchid-house.north', to: 'orchid-return.south' },
    { from: 'orchid-return.north', to: 'west-turn.west' },
    { from: 'west-turn.north', to: 'salon-approach.south' },
    { from: 'salon-approach.north', to: 'wave-salon.south' },
    { from: 'wave-salon.north', to: 'sky-passage.south' },
    { from: 'sky-passage.north', to: 'panorama.south' },
  ],
  solidActivations: [
    {
      solid: 'foyer.north-gate-body',
      activation: { noneCompleted: ['entrance-goblet'] },
      requiredForRoute: true,
    },
    {
      solid: 'fern-house.north-gate-body',
      activation: { noneCompleted: ['fern-wave'] },
      requiredForRoute: true,
    },
    {
      solid: 'listening-court.north-gate-body',
      activation: { noneCompleted: ['fern-wave'] },
      requiredForRoute: true,
    },
    {
      solid: 'orchid-house.north-gate-body',
      activation: { noneCompleted: ['orchid-wave'] },
      requiredForRoute: true,
    },
    {
      solid: 'wave-salon.north-gate-body',
      activation: { noneCompleted: ['keeper-finale'] },
      requiredForRoute: true,
    },
  ],
  spawnCheckpoint: 'foyer.entry',
  exit: { zone: 'panorama.exit', requiresCompleted: ['keeper-finale'] },
  fallBelow: -1.6,
  worldBounds: {
    minX: -12,
    maxX: SPAN * 2 + 5.1,
    minY: -1.6,
    maxY: 10.5,
    minZ: -5.1,
    maxZ: RETURN_Z + 5.1,
  },
  lightBounds: {
    minX: -11,
    maxX: SPAN * 2 + 4.7,
    minY: 0,
    maxY: 8,
    minZ: -4.7,
    maxZ: RETURN_Z + 4.7,
  },
}

export const RESONANCE_CONSERVATORY = composeLevel(
  CONSERVATORY_SOURCE,
  CONSERVATORY_AUTHORING_CATALOG,
)

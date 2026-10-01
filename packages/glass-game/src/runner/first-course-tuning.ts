// ============================================================
// Singing Current tuning — typed authored pacing controls for course variants.
// ============================================================

import type { RunnerTempoPoint } from './tempo'

interface SingingCurrentPhraseTuning<Durations extends readonly number[]> {
  readonly noteDurationsBeats: Durations
  readonly breathAfterBeats: number
}

interface SingingCurrentBeatTuning {
  readonly atBeat: number
}

interface SingingCurrentCheckpointTuning extends SingingCurrentBeatTuning {
  readonly countInBeats: number
}

interface SingingCurrentObstacleTuning extends SingingCurrentBeatTuning {
  readonly telegraphLeadBeats: number
}

interface SingingCurrentGapTuning extends SingingCurrentObstacleTuning {
  readonly landingRunwayMeters: number
}

export interface SingingCurrentTuning {
  readonly tempoMap: readonly [
    RunnerTempoPoint,
    RunnerTempoPoint,
    RunnerTempoPoint,
  ]
  readonly track: {
    readonly metersPerBeat: number
    readonly spawnRunwayBeats: number
    readonly vocalLookaheadBeats: number
    readonly vocalEmphasisBeats: number
  }
  readonly movement: {
    readonly laneChangeSeconds: number
    readonly jumpVelocityMetersPerSecond: number
    readonly gravityMetersPerSecondSquared: number
    readonly maxJumpRiseMeters: number
    readonly coyoteSeconds: number
    readonly jumpBufferSeconds: number
  }
  readonly voiceWindow: {
    readonly judgeLeadBeats: number
    readonly protectedLeadBeats: number
    readonly protectedTailBeats: number
  }
  readonly phrases: {
    readonly homeWhole: SingingCurrentPhraseTuning<readonly [number]>
    readonly higherHalf: SingingCurrentPhraseTuning<readonly [number]>
    readonly lowerHalf: SingingCurrentPhraseTuning<readonly [number]>
    readonly twoUp: SingingCurrentPhraseTuning<readonly [number, number]>
    readonly firstArc: SingingCurrentPhraseTuning<
      readonly [number, number, number]
    >
    readonly sunlitSteps: SingingCurrentPhraseTuning<
      readonly [number, number, number, number, number]
    >
  }
  readonly targets: {
    readonly homeWindow: SingingCurrentBeatTuning
    readonly higherCarafe: SingingCurrentBeatTuning
    readonly lowerDiadem: SingingCurrentBeatTuning
    readonly twoNoteWindow: SingingCurrentBeatTuning
    readonly arcDiadem: SingingCurrentBeatTuning
    readonly melodyRehearsal: SingingCurrentBeatTuning
    readonly twoNoteRevisit: SingingCurrentBeatTuning
    readonly melodyFinale: SingingCurrentBeatTuning
  }
  readonly obstacles: {
    readonly firstLaneGate: SingingCurrentObstacleTuning
    readonly firstJump: SingingCurrentGapTuning
    readonly secondLaneGate: SingingCurrentObstacleTuning
    readonly secondJump: SingingCurrentGapTuning
  }
  readonly pickups: {
    readonly pearlLeft60: SingingCurrentBeatTuning
    readonly pearlRight62: SingingCurrentBeatTuning
    readonly pearlRight114: SingingCurrentBeatTuning
    readonly pearlLeft118: SingingCurrentBeatTuning
  }
  readonly checkpoints: {
    readonly start: SingingCurrentCheckpointTuning
    readonly tempoStep: SingingCurrentCheckpointTuning
    readonly melody: SingingCurrentCheckpointTuning
  }
}

const JUMP_RISE_METERS = 0.72
const JUMP_GRAVITY = 8

export const SINGING_CURRENT_CURRENT_TUNING = {
  tempoMap: [
    { atBeat: 0, bpm: 96 },
    { atBeat: 64, bpm: 108 },
    { atBeat: 96, bpm: 116 },
  ],
  track: {
    metersPerBeat: 1.2,
    spawnRunwayBeats: 4,
    vocalLookaheadBeats: 8,
    vocalEmphasisBeats: 4,
  },
  movement: {
    laneChangeSeconds: 0.45,
    jumpVelocityMetersPerSecond: Math.sqrt(2 * JUMP_GRAVITY * JUMP_RISE_METERS),
    gravityMetersPerSecondSquared: JUMP_GRAVITY,
    maxJumpRiseMeters: JUMP_RISE_METERS,
    coyoteSeconds: 0.1,
    jumpBufferSeconds: 0.12,
  },
  voiceWindow: {
    judgeLeadBeats: 0.5,
    protectedLeadBeats: 0.5,
    protectedTailBeats: 0,
  },
  phrases: {
    homeWhole: { noteDurationsBeats: [4], breathAfterBeats: 4 },
    higherHalf: { noteDurationsBeats: [2], breathAfterBeats: 4 },
    lowerHalf: { noteDurationsBeats: [2], breathAfterBeats: 4 },
    twoUp: { noteDurationsBeats: [2, 2], breathAfterBeats: 4 },
    firstArc: { noteDurationsBeats: [2, 2, 2], breathAfterBeats: 4 },
    sunlitSteps: {
      noteDurationsBeats: [1, 1, 2, 1, 3],
      breathAfterBeats: 4,
    },
  },
  targets: {
    homeWindow: { atBeat: 8 },
    higherCarafe: { atBeat: 32 },
    lowerDiadem: { atBeat: 40 },
    twoNoteWindow: { atBeat: 52 },
    arcDiadem: { atBeat: 68 },
    melodyRehearsal: { atBeat: 100 },
    twoNoteRevisit: { atBeat: 120 },
    melodyFinale: { atBeat: 148 },
  },
  obstacles: {
    firstLaneGate: { atBeat: 18, telegraphLeadBeats: 2 },
    firstJump: {
      atBeat: 25,
      telegraphLeadBeats: 2,
      landingRunwayMeters: 1.6,
    },
    secondLaneGate: { atBeat: 77, telegraphLeadBeats: 2.5 },
    secondJump: {
      atBeat: 91,
      telegraphLeadBeats: 2.5,
      landingRunwayMeters: 1.8,
    },
  },
  pickups: {
    pearlLeft60: { atBeat: 60 },
    pearlRight62: { atBeat: 62 },
    pearlRight114: { atBeat: 114 },
    pearlLeft118: { atBeat: 118 },
  },
  checkpoints: {
    start: { atBeat: 0, countInBeats: 4 },
    tempoStep: { atBeat: 64, countInBeats: 4 },
    melody: { atBeat: 96, countInBeats: 4 },
  },
} as const satisfies SingingCurrentTuning

export const SINGING_CURRENT_LEARNING_TUNING = {
  ...SINGING_CURRENT_CURRENT_TUNING,
  tempoMap: [
    { atBeat: 0, bpm: 84 },
    { atBeat: 64, bpm: 96 },
    { atBeat: 96, bpm: 104 },
  ],
} as const satisfies SingingCurrentTuning

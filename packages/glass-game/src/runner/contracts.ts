// ============================================================
// Song runner contracts — immutable compiled content and pure game I/O.
// ============================================================

export type RunnerEpoch = string
export type RunnerLane = 0 | 1 | 2
export type RunnerQualityGrade = 1 | 2 | 3
export type RunnerStatus =
  | 'ready'
  | 'running'
  | 'paused'
  | 'recovering'
  | 'finished'

export interface CompiledRunnerTempoSegment {
  readonly startBeat: number
  readonly endBeat: number
  readonly startCourseSeconds: number
  readonly endCourseSeconds: number
  readonly bpm: number
}

export interface CompiledRunnerMovementProfile {
  readonly id: string
  readonly revision: number
  readonly fixedStepSeconds: number
  readonly maxCatchUpSeconds: number
  readonly laneChangeSeconds: number
  readonly bodyRadius: number
  readonly bodyHeight: number
  readonly jumpVelocityMetersPerSecond: number
  readonly gravityMetersPerSecondSquared: number
  readonly maxJumpRiseMeters: number
  readonly coyoteSeconds: number
  readonly jumpBufferSeconds: number
}

export interface CompiledRunnerJudgeProfile {
  readonly id: string
  readonly revision: number
  readonly evidenceVersion: 'pitch-accuracy-v1'
  readonly minimumConfidence: number
  readonly centsTolerance: number
  readonly maximumEvidenceGapSeconds: number
  readonly minimumReliableRatio: number
  readonly maximumDeliveryLatencySeconds: number
  readonly gradeBands: readonly {
    readonly grade: RunnerQualityGrade
    readonly maximumMeanAbsoluteCents: number
  }[]
}

export interface CompiledRunnerVoiceProfile {
  readonly id: string
  readonly revision: number
  readonly comfortableRootOffsetSemitones: number
  readonly minimumComfortableMidi: number
  readonly maximumComfortableMidi: number
  readonly judge: CompiledRunnerJudgeProfile
}

export interface CompiledRunnerCheckpoint {
  readonly id: string
  readonly beat: number
  readonly courseSeconds: number
  readonly courseDistanceMeters: number
  readonly respawnLane: RunnerLane
  readonly respawnFeetY: number
  readonly countInBeats: number
  readonly runwayEndBeat: number
  readonly runwayEndCourseSeconds: number
}

export interface CompiledRunnerNote {
  readonly index: number
  readonly startOffsetSemitones: number
  readonly endOffsetSemitones: number
  readonly connection: 'separate' | 'glide'
  readonly startBeat: number
  readonly endBeat: number
  readonly startCourseSeconds: number
  readonly endCourseSeconds: number
  readonly minimumReliableSeconds: number
}

export interface CompiledRunnerTarget {
  readonly id: string
  readonly chunkId: string
  readonly displayLane: RunnerLane
  readonly glassProfileId: string
  readonly requiredForGrade: boolean
  readonly notes: readonly CompiledRunnerNote[]
  readonly visibleFromCourseSeconds: number
  readonly emphasizedFromCourseSeconds: number
  readonly onsetCourseSeconds: number
  readonly endCourseSeconds: number
  readonly judgeOpenCourseSeconds: number
  readonly judgeCloseCourseSeconds: number
  readonly settleAfterCourseSeconds: number
  readonly protectedFromCourseSeconds: number
  readonly protectedUntilCourseSeconds: number
}

export interface CompiledRunnerActionWindow {
  readonly kind: 'lane-transition' | 'jump'
  readonly launchOpenCourseSeconds: number
  readonly launchCloseCourseSeconds: number
  readonly landingOpenCourseSeconds: number
  readonly landingCloseCourseSeconds: number
  readonly reachableLanes: readonly RunnerLane[]
}

export interface CompiledRunnerBlocker {
  readonly kind: 'blocker'
  readonly id: string
  readonly chunkId: string
  readonly profileId: string
  readonly telegraphFromCourseSeconds: number
  readonly minCourseDistanceMeters: number
  readonly maxCourseDistanceMeters: number
  readonly minLateralX: number
  readonly maxLateralX: number
  readonly minY: number
  readonly maxY: number
  readonly authoredLaneMask: readonly RunnerLane[]
  readonly certifiedActions: readonly CompiledRunnerActionWindow[]
}

export interface CompiledRunnerGap {
  readonly kind: 'gap'
  readonly id: string
  readonly chunkId: string
  readonly profileId: string
  readonly telegraphFromCourseSeconds: number
  readonly minCourseDistanceMeters: number
  readonly maxCourseDistanceMeters: number
  readonly lateralSpans: readonly {
    readonly minLateralX: number
    readonly maxLateralX: number
  }[]
  readonly landingStartCourseDistanceMeters: number
  readonly landingEndCourseDistanceMeters: number
  readonly certifiedActions: readonly CompiledRunnerActionWindow[]
}

export type CompiledRunnerObstacle = CompiledRunnerBlocker | CompiledRunnerGap

export interface CompiledRunnerChunk {
  readonly id: string
  readonly index: number
  readonly startBeat: number
  readonly endBeat: number
  readonly startCourseSeconds: number
  readonly endCourseSeconds: number
  readonly minCourseDistanceMeters: number
  readonly maxCourseDistanceMeters: number
  readonly targetIds: readonly string[]
  readonly obstacleIds: readonly string[]
  readonly rewardIds: readonly string[]
  readonly assetProfileIds: readonly string[]
}

export interface CompiledRunnerRewardDefinition {
  readonly revision: number
  readonly pickups: readonly {
    readonly id: string
    readonly chunkId: string
    readonly beat: number
    readonly courseSeconds: number
    readonly courseDistanceMeters: number
    readonly lateralX: number
    readonly radius: number
  }[]
  readonly singingStarTargetIds: readonly string[]
  readonly finishRewardIds: readonly string[]
}

export interface CompiledRunnerCourse {
  readonly schema: 'mercurypitch.song-runner.compiled'
  readonly version: 1
  readonly id: string
  readonly revision: number
  readonly title: string
  readonly seed: number
  readonly meter: { readonly beatsPerBar: 4; readonly beatUnit: 4 }
  readonly lengthBeats: number
  readonly lengthCourseSeconds: number
  readonly metersPerBeat: number
  readonly lengthMeters: number
  readonly groundFeetY: number
  readonly fallBelowFeetY: number
  readonly laneCenters: readonly [number, number, number]
  readonly tempoSegments: readonly CompiledRunnerTempoSegment[]
  readonly movement: CompiledRunnerMovementProfile
  readonly voice: CompiledRunnerVoiceProfile
  readonly checkpoints: readonly CompiledRunnerCheckpoint[]
  readonly targets: readonly CompiledRunnerTarget[]
  readonly obstacles: readonly CompiledRunnerObstacle[]
  readonly chunks: readonly CompiledRunnerChunk[]
  readonly rewards: CompiledRunnerRewardDefinition
  readonly presentation: {
    readonly environmentProfileId: string
    readonly musicProfileId: string
    readonly notationProfileId: string
  }
  readonly preloadAssetProfileIds: readonly string[]
}

export interface RunnerInput {
  readonly epoch: RunnerEpoch
  readonly sequence: number
  readonly atCourseSeconds: number
  readonly action: 'lane-left' | 'lane-right' | 'jump'
}

export interface RunnerVoiceEvidence {
  readonly epoch: RunnerEpoch
  readonly sequence: number
  readonly captureCourseSeconds: number
  readonly receivedCourseSeconds: number
  readonly midi: number | null
  readonly confidence: number
}

export interface RunnerTargetResult {
  readonly targetId: string
  readonly outcome: 'hit' | 'miss'
  readonly grade: RunnerQualityGrade | null
  readonly resolvedAtCourseSeconds: number
  readonly reliableSeconds: number
  readonly meanAbsoluteCents: number | null
}

export type RunnerTargetPhase =
  | 'approaching'
  | 'emphasized'
  | 'judging'
  | 'settling'

export type RunnerPitchFeedback =
  | {
      readonly state: 'neutral'
      readonly observedMidi: null
      readonly comparedTargetMidi: null
      readonly errorCents: null
      readonly correction: null
    }
  | {
      readonly state: 'accepted'
      readonly observedMidi: number
      readonly comparedTargetMidi: number
      readonly errorCents: number
      readonly correction: null
    }
  | {
      readonly state: 'wrong'
      readonly observedMidi: number
      readonly comparedTargetMidi: number
      readonly errorCents: number
      readonly correction: 'higher' | 'lower'
    }

export interface RunnerTargetSnapshot {
  readonly id: string
  readonly phase: RunnerTargetPhase
  readonly phaseStartCourseSeconds: number
  readonly phaseEndCourseSeconds: number
  readonly phaseProgress: number
  readonly noteIndex: number
  readonly currentTargetMidi: number
  readonly pitchFeedback: RunnerPitchFeedback
  readonly notes: readonly {
    readonly index: number
    readonly startMidi: number
    readonly endMidi: number
    readonly targetMidi: number
    readonly fillProgress: number
    readonly state: 'hollow' | 'filling' | 'filled'
  }[]
}

export interface SavedRunnerTargetQuality {
  readonly targetId: string
  readonly grade: RunnerQualityGrade
  readonly courseRevision: number
  readonly judgeProfileId: string
  readonly judgeProfileRevision: number
  readonly evidenceVersion: 'pitch-accuracy-v1'
  readonly reliableSeconds: number
  readonly meanAbsoluteCents: number
}

export interface RunnerSnapshot {
  readonly courseId: string
  readonly courseRevision: number
  readonly epoch: RunnerEpoch | null
  readonly status: RunnerStatus
  readonly courseSeconds: number
  readonly courseBeat: number
  readonly courseDistanceMeters: number
  readonly activeChunkId: string
  readonly residentChunkIds: readonly string[]
  readonly player: {
    readonly targetLane: RunnerLane
    readonly lateralX: number
    readonly feetY: number
    readonly verticalVelocityMetersPerSecond: number
    readonly grounded: boolean
    readonly forwardSpeedMetersPerSecond: number
  }
  readonly lastCheckpointId: string
  readonly recoveryCheckpointId: string | null
  readonly activeTarget: RunnerTargetSnapshot | null
  readonly upcomingTargetIds: readonly string[]
  readonly resolvedTargets: readonly RunnerTargetResult[]
  readonly bestTargetQualities: readonly SavedRunnerTargetQuality[]
  readonly combo: number
  readonly collectedRewardIds: readonly string[]
}

interface RunnerEventBase {
  readonly eventSequence: number
  readonly epoch: RunnerEpoch
  readonly atCourseSeconds: number
  readonly atBeat: number
}

export type RunnerEvent =
  | (RunnerEventBase & {
      readonly type: 'target-hit'
      readonly result: RunnerTargetResult & {
        readonly outcome: 'hit'
        readonly grade: RunnerQualityGrade
      }
    })
  | (RunnerEventBase & {
      readonly type: 'target-miss'
      readonly result: RunnerTargetResult & {
        readonly outcome: 'miss'
        readonly grade: null
      }
    })
  | (RunnerEventBase & {
      readonly type: 'reward-collected'
      readonly rewardId: string
    })
  | (RunnerEventBase & {
      readonly type: 'recovery-required'
      readonly reason: 'fall' | 'frame-gap'
      readonly checkpointId: string
    })
  | (RunnerEventBase & {
      readonly type: 'course-finished'
      readonly finishRewardIds: readonly string[]
    })

export interface SavedRunnerProgress {
  readonly version: 1
  readonly courseId: string
  readonly courseRevision: number
  readonly rewardsRevision: number
  readonly completed: boolean
  readonly bestTargetQualities: readonly SavedRunnerTargetQuality[]
  readonly collectedRewardIds: readonly string[]
}

export interface CreateSongRunnerGameOptions {
  readonly comfortableMidi: number
  readonly progress?: unknown
}

export type RunnerBeginEpochResult =
  | {
      readonly ok: true
      readonly checkpointId: string
      readonly startCourseSeconds: number
    }
  | {
      readonly ok: false
      readonly reason:
        | 'epoch-reused'
        | 'invalid-state'
        | 'unknown-checkpoint'
        | 'checkpoint-not-reached'
    }

export interface SongRunnerGame {
  /** Rewind presentation to a safe checkpoint before capture readiness begins. */
  prepareCheckpoint(checkpointId?: string): RunnerBeginEpochResult
  beginEpoch(epoch: RunnerEpoch, checkpointId?: string): RunnerBeginEpochResult
  pause(): void
  input(input: RunnerInput): boolean
  observe(evidence: RunnerVoiceEvidence): boolean
  advanceTo(epoch: RunnerEpoch, courseSeconds: number): void
  snapshot(): RunnerSnapshot
  drainEvents(): readonly RunnerEvent[]
  saveProgress(): SavedRunnerProgress
}

// Adventure voice router — keeps legacy pitch holds and melody lessons behind one UI lifecycle.

import type {
  ChallengeDefinition,
  GameEvent,
  GlassGame,
  LevelDefinition,
  PitchTargetId,
  PitchTargets,
} from '../contracts'
import type { CompiledMelody } from '../core/melody-contour'
import type { GlassGameHost } from '../host'
import type { MelodyJudgeSnapshot } from '../melody-contracts'
import type {
  MelodyAdventureMode,
  MelodyAdventureSnapshot,
} from './melody-adventure-challenge'
import { createMelodyAdventureChallenge } from './melody-adventure-challenge'
import type { MicrophoneIssue } from './mic-error'
import type {
  VoiceChallengeMode,
  VoiceChallengeSnapshot,
} from './voice-challenge'
import { createVoiceChallenge } from './voice-challenge'

export type AdventureVoiceMode = VoiceChallengeMode | MelodyAdventureMode

export interface AdventureVoiceSnapshot {
  mode: AdventureVoiceMode
  challengeKind: ChallengeDefinition['kind'] | null
  pitch: number | null
  target: number | null
  encounterId: string | null
  findingTarget: PitchTargetId | null
  message: string
  hint: string
  pair: boolean
  stepIndex: number
  stepCount: number
  stepCharge: number
  targets: PitchTargets
  contour: CompiledMelody | null
  melodyJudge: MelodyJudgeSnapshot | null
  timelineSeconds: number
  comfortableMidi: number | null
  rootMidi: number | null
  pace: number | null
  allowedPaces: readonly number[]
  melodyFrozen: boolean
  needsFreshAttempt: boolean
}

interface AdventureVoiceOptions {
  host: GlassGameHost
  game: GlassGame
  level: LevelDefinition
  canPlay(): boolean
  beforeCapture(): Promise<void>
  onChange(snapshot: AdventureVoiceSnapshot): void
  onEvents(events: GameEvent[]): void
  onError(message: string, microphone?: MicrophoneIssue): void
  onPauseAudio(): void
  onReleaseVoice(): void
  now?: () => number
  createAttemptId?(): string
}

export interface AdventureVoiceController {
  snapshot(): AdventureVoiceSnapshot
  start(encounterId: string): Promise<void>
  begin(): Promise<void>
  hear(): Promise<void>
  replay(): Promise<void>
  setPace(pace: number): void
  refind(): void
  cancel(): void
  completeBreak(): void
  dispose(): void
}

function pitchSnapshot(
  snapshot: VoiceChallengeSnapshot,
  level: LevelDefinition,
): AdventureVoiceSnapshot {
  const challengeKind =
    level.breakables.find((item) => item.id === snapshot.encounterId)?.challenge
      .kind ?? null
  return {
    ...snapshot,
    challengeKind,
    contour: null,
    melodyJudge: null,
    timelineSeconds: 0,
    comfortableMidi: snapshot.targets.comfortable ?? null,
    rootMidi: null,
    pace: null,
    allowedPaces: [],
    melodyFrozen: false,
    needsFreshAttempt: false,
  }
}

function melodySnapshot(snapshot: MelodyAdventureSnapshot): AdventureVoiceSnapshot {
  return {
    mode: snapshot.mode,
    challengeKind: snapshot.challengeKind,
    pitch: snapshot.pitch,
    target: snapshot.target,
    encounterId: snapshot.encounterId,
    findingTarget: null,
    message: snapshot.message,
    hint: snapshot.hint,
    pair: false,
    stepIndex: snapshot.stepIndex,
    stepCount: snapshot.stepCount,
    stepCharge: snapshot.stepCharge,
    targets: {},
    contour: snapshot.contour,
    melodyJudge: snapshot.judge,
    timelineSeconds: snapshot.timelineSeconds,
    comfortableMidi: snapshot.comfortableMidi,
    rootMidi: snapshot.rootMidi,
    pace: snapshot.pace,
    allowedPaces: snapshot.allowedPaces,
    melodyFrozen: snapshot.frozen,
    needsFreshAttempt: snapshot.needsFreshAttempt,
  }
}

const OFF_SNAPSHOT: AdventureVoiceSnapshot = {
  mode: 'off',
  challengeKind: null,
  pitch: null,
  target: null,
  encounterId: null,
  findingTarget: null,
  message: '',
  hint: '',
  pair: false,
  stepIndex: 0,
  stepCount: 1,
  stepCharge: 0,
  targets: {},
  contour: null,
  melodyJudge: null,
  timelineSeconds: 0,
  comfortableMidi: null,
  rootMidi: null,
  pace: null,
  allowedPaces: [],
  melodyFrozen: false,
  needsFreshAttempt: false,
}

export function createAdventureVoiceChallenge(
  options: AdventureVoiceOptions,
): AdventureVoiceController {
  let active: 'pitch' | 'melody' | null = null
  let state = OFF_SNAPSHOT
  const update = (next: AdventureVoiceSnapshot): void => {
    state = next
    options.onChange(next)
  }
  const pitch = createVoiceChallenge({
    ...options,
    onChange: (next) => {
      if (active !== 'pitch') return
      update(pitchSnapshot(next, options.level))
      if (next.mode === 'off') active = null
    },
  })
  const melody =
    options.level.melodyLesson === undefined
      ? null
      : createMelodyAdventureChallenge({
          ...options,
          onChange: (next) => {
            if (active !== 'melody') return
            update(melodySnapshot(next))
            if (next.mode === 'off') active = null
          },
        })

  const start = async (encounterId: string): Promise<void> => {
    if (active !== null) return
    const encounter = options.level.breakables.find(
      (candidate) => candidate.id === encounterId,
    )
    if (encounter === undefined) return
    if (
      encounter.challenge.kind === 'melody-anchor' ||
      encounter.challenge.kind === 'melody-contour'
    ) {
      if (melody === null) return
      active = 'melody'
      melody.open(encounterId)
      return
    }
    active = 'pitch'
    await pitch.start(encounterId)
    if (pitch.snapshot().mode === 'off') active = null
  }

  const cancel = (): void => {
    if (active === 'pitch') pitch.cancel()
    else if (active === 'melody') melody?.cancel()
    active = null
  }

  const completeBreak = (): void => {
    if (active === 'pitch') pitch.completeBreak()
    else if (active === 'melody') melody?.completeBreak()
    active = null
  }

  return {
    snapshot: () => state,
    start,
    begin: async () => {
      if (active === 'melody') await melody?.begin()
    },
    hear: async () => {
      if (active === 'melody') await melody?.hear()
    },
    replay: async () => {
      if (active === 'pitch') await pitch.replay()
      else if (active === 'melody') await melody?.replay()
    },
    setPace: (pace) => {
      if (active === 'melody') melody?.setPace(pace)
    },
    refind: () => {
      if (active === 'pitch') {
        pitch.refind()
        active = null
      } else if (active === 'melody') melody?.changeKey()
    },
    cancel,
    completeBreak,
    dispose() {
      pitch.dispose()
      melody?.dispose()
      active = null
    },
  }
}

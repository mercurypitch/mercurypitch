// Melody adventure UI contract — snapshots and actions shared by the route controller and panel.

import type { GameEvent, GlassGame, LevelDefinition, MelodyChallengeDefinition, } from '../contracts'
import type { CompiledMelody } from '../core/melody-contour'
import type { GlassGameHost } from '../host'
import type { MelodyJudgeSnapshot } from '../melody-contracts'
import type { MercMelodyReferenceFactory } from './merc-melody-reference'
import type { MicrophoneIssue } from './mic-error'

export type MelodyAdventureMode =
  | 'off'
  | 'setup'
  | 'permission'
  | 'finding'
  | 'reference'
  | 'singing'

export interface MelodyAdventureSnapshot {
  mode: MelodyAdventureMode
  challengeKind: MelodyChallengeDefinition['kind'] | null
  encounterId: string | null
  pitch: number | null
  target: number | null
  message: string
  hint: string
  stepIndex: number
  stepCount: number
  stepCharge: number
  contour: CompiledMelody | null
  judge: MelodyJudgeSnapshot | null
  timelineSeconds: number
  comfortableMidi: number | null
  rootMidi: number | null
  pace: number
  allowedPaces: readonly number[]
  frozen: boolean
  needsFreshAttempt: boolean
}

export interface MelodyAdventureOptions {
  host: Pick<
    GlassGameHost,
    | 'assetUrl'
    | 'createMelodyReference'
    | 'createMemoryPlayback'
    | 'createSound'
    | 'createVoice'
    | 'readPreference'
    | 'saveProgress'
    | 'writePreference'
  >
  game: GlassGame
  level: LevelDefinition
  canPlay(): boolean
  beforeCapture(): Promise<void>
  onChange(snapshot: MelodyAdventureSnapshot): void
  onEvents(events: GameEvent[]): void
  onError(message: string, microphone?: MicrophoneIssue): void
  onPauseAudio(): void
  onReleaseVoice(): void
  createAttemptId?(): string
  references?: MercMelodyReferenceFactory
  now?: () => number
}

export interface MelodyAdventureController {
  snapshot(): MelodyAdventureSnapshot
  open(encounterId: string): void
  begin(): Promise<void>
  hear(): Promise<void>
  replay(): Promise<void>
  setPace(pace: number): void
  changeKey(): void
  cancel(): void
  completeBreak(): void
  dispose(): void
}

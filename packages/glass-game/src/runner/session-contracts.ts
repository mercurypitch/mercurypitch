// Runner session boundary — UI and rendering observe one microphone and audio-clock owner.
import type { GlassGameHost } from '../host'
import type { MicrophoneIssue } from '../ui/mic-error'
import type { CompiledRunnerCheckpoint, CompiledRunnerCourse, RunnerEvent, RunnerInput, RunnerSnapshot, SavedRunnerProgress, } from './contracts'

export type RunnerSessionPhase =
  | 'idle'
  | 'preparing'
  | 'readiness'
  | 'count-in'
  | 'running'
  | 'paused'
  | 'recovering'
  | 'finished'
  | 'error'
  | 'disposed'
export type RunnerPauseReason =
  | 'manual'
  | 'background'
  | 'audio-interrupted'
  | 'microphone-interrupted'
  | 'renderer-unavailable'

export interface RunnerSessionState {
  readonly phase: RunnerSessionPhase
  readonly game: RunnerSnapshot
  readonly microphone: 'closed' | 'opening' | 'ready' | 'interrupted'
  readonly readiness: {
    readonly targetMidi: number
    readonly fillProgress: number
  } | null
  readonly countIn: {
    readonly beatsRemaining: number
    readonly beatProgress: number
  } | null
  readonly musicMuted: boolean
  readonly pauseReason: RunnerPauseReason | null
  readonly error: {
    readonly code:
      | 'audio-unavailable'
      | 'microphone-unavailable'
      | 'assets-unavailable'
      | 'start-failed'
    readonly message: string
    readonly canRetry: boolean
    readonly microphoneIssue?: MicrophoneIssue
  } | null
}

export interface RunnerSessionFrame {
  readonly state: RunnerSessionState
  readonly events: readonly RunnerEvent[]
  /** Session frames and one authoritative terminal flush permit GPU presentation; evidence remains immediate. */
  readonly presentation?: boolean
}

export interface SongRunnerSession {
  state(): RunnerSessionState
  /** Immediately emits current state with no historical events. */
  subscribe(listener: (frame: RunnerSessionFrame) => void): () => void
  start(): Promise<void>
  resume(): Promise<void>
  restart(): Promise<void>
  /** Direct gesture, closed capture only; listening never starts the run. */
  hearReference(): Promise<void>
  takeOverMicrophone?(): Promise<void>
  pause(reason?: RunnerPauseReason): void
  input(action: RunnerInput['action']): boolean
  setMusicMuted(muted: boolean): void
  setPresentationReady(ready: boolean): void
  dispose(): void
}

/** All timestamps share the capture AudioContext; count-in is outside course time. */
export interface RunnerAudioSchedule {
  readonly countInStartAudioSeconds: number
  readonly audioStartSeconds: number
  readonly courseStartSeconds: number
  readonly secondsPerBeat: number
  readonly countInBeats: number
}

/** Session-owned service; presentation never reads or advances this clock. */
export interface RunnerAudioTransport {
  /** Resolves after release tails and all owned audio resources have closed. */
  readonly finished: Promise<void>
  unlock(): Promise<boolean>
  currentAudioSeconds(): number | null
  schedule(checkpoint: CompiledRunnerCheckpoint): RunnerAudioSchedule
  hearReference(midi: number): Promise<void>
  setMuted(muted: boolean): void
  setVoiceActive(active: boolean): void
  subscribeInterruption(listener: () => void): () => void
  dispose(): void
}

export interface SongRunnerHost extends Pick<
  GlassGameHost,
  | 'assetUrl'
  | 'prepareVoiceGesture'
  | 'createVoice'
  | 'microphoneInput'
  | 'takeOverMicrophone'
  | 'releaseUnusedMicrophoneTakeover'
  | 'readPreference'
  | 'writePreference'
  | 'subscribeForeground'
  | 'onExit'
> {
  loadRunnerProgress(courseId: string): unknown
  saveRunnerProgress(progress: SavedRunnerProgress): void
  createRunnerAudio(
    course: CompiledRunnerCourse,
    comfortableMidi: number,
  ): RunnerAudioTransport
}

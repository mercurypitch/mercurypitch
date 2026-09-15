// Glass adventure host — platform services stay outside simulation and rendering.
import type { PitchObservation, SavedProgress } from './contracts'

export interface GlassVoiceSession {
  /** Called synchronously from the player's Start gesture. */
  start(): Promise<void>
  latest(nowMs: number): PitchObservation | null
  /** Deliver detector observations independently of rendering cadence. */
  subscribe(
    listener: (observation: PitchObservation, nowMs: number) => void,
    onStopped?: () => void,
  ): () => void
  stop(): void
}

export interface GlassSound {
  reference(midi: number): Promise<void>
  shatter(): void
  dispose(): void
}

export interface GlassGameHost {
  assetUrl(id: string): string
  createVoice(): GlassVoiceSession
  createSound(): GlassSound
  loadProgress(levelId: string): unknown
  saveProgress(progress: SavedProgress): void
  readPreference(key: string): string | null
  writePreference(key: string, value: string): void
  /** Emits false for app background; capture never resumes automatically. */
  subscribeForeground(listener: (foreground: boolean) => void): () => void
  onExit(): void
}

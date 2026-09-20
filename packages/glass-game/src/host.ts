// Glass adventure host — platform services stay outside simulation and rendering.
import type { PitchObservation, SavedProgress } from './contracts'

export interface GlassVoiceSession {
  /** Called synchronously from the player's Start gesture. */
  start(beforeCapture?: Promise<void>): Promise<void>
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

export type MuseumAudioScene = 'museum' | 'garden' | 'gallery'

export interface MuseumAudioPreferences {
  muted: boolean
  musicVolume: number
  ambienceVolume: number
}

export interface GlassMuseumAudio {
  start(scene?: MuseumAudioScene): Promise<boolean>
  /** Suppress new playback immediately; resolve once the audible tail is gone. */
  silenceForVoice(): Promise<void>
  pause(): void
  preferences(): MuseumAudioPreferences
  setPreferences(patch: Partial<MuseumAudioPreferences>): void
  dispose(): void
}

export type MercNarrationCue =
  | 'tutorial-note'
  | 'required-break'
  | 'optional-break'
  | 'beautiful-mess'
  | 'little-disaster'
  | 'sparkling'
  | 'glass-had-plans'
  | 'music-to-my-ears'
  | 'cracking-performance'

export interface MercNarrationLine {
  readonly cue: MercNarrationCue
  readonly caption: string
}

export interface MercNarrationPreferences {
  enabled: boolean
}

export interface GlassMercNarration {
  /** Replace any older cue; false means playback was unavailable or retired. */
  play(cue: MercNarrationCue): Promise<boolean>
  /** Invalidate pending work immediately; resolve once the audible tail is gone. */
  silenceForVoice(): Promise<void>
  pause(): void
  preferences(): MercNarrationPreferences
  setPreferences(patch: Partial<MercNarrationPreferences>): void
  dispose(): void
}

export interface GlassGameHost {
  assetUrl(id: string): string
  createVoice(): GlassVoiceSession
  createSound(): GlassSound
  createMusic?(): GlassMuseumAudio
  createNarration?(): GlassMercNarration
  loadProgress(levelId: string): unknown
  saveProgress(progress: SavedProgress): void
  readPreference(key: string): string | null
  writePreference(key: string, value: string): void
  /** Emits false for app background; capture never resumes automatically. */
  subscribeForeground(listener: (foreground: boolean) => void): () => void
  onExit(): void
}

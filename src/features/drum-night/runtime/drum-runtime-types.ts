// Drum Night runtime contracts — live hits stay separate from audio details.
// ============================================================

export type DrumHitSource = 'touch' | 'keyboard' | 'midi'

export interface DrumLiveHit {
  readonly gmKey: number
  /** General MIDI velocity, kept losslessly in the 1–127 range. */
  readonly velocity: number
  /** DOMHighResTimeStamp on the runtime's shared performance timeline. */
  readonly timestampMs: number
  readonly source: DrumHitSource
  readonly sourceId?: string
  readonly rawMidiKey?: number
  /** Original zero-based MIDI channel; present on e-kit hits. */
  readonly midiChannel?: number
}

/** Independent gain routes inside the one shared Drum Night kit player. */
export type DrumKitPlaybackLane = 'authored' | 'live'

/** GP choked cymbals strike normally, then receive this bounded grab tail. */
export const DRUM_KIT_AUTHORED_CHOKE_TAIL_SECONDS = 0.11

export interface DrumKitTrigger {
  readonly gmKey: number
  readonly velocity: number
  readonly atContextTime?: number
  readonly sourceId?: string
  /** Live input remains the default for every existing caller. */
  readonly lane?: DrumKitPlaybackLane
}

/**
 * Release one General MIDI percussion articulation without inventing a
 * player-specific choke-group name. The lane keeps authored score releases
 * from cutting a concurrent live performance.
 */
export interface DrumKitChoke {
  readonly gmKey: number
  readonly atContextTime?: number
  readonly sourceId?: string
  readonly lane?: DrumKitPlaybackLane
}

/** Player truth retained for authored playback fidelity reporting. */
export type DrumKitTriggerOutcome =
  | 'dropped'
  | 'sampled'
  | 'synthesized'
  | 'synth-fallback'
  | 'unmapped'

/** Routing truth for a GM-target release, never a claim about output audibility. */
export type DrumKitChokeOutcome =
  | 'choked'
  | 'idle'
  | 'unsupported'
  | 'dropped'
  | 'unmapped'

export interface DrumKitPrewarmHit {
  readonly gmKey: number
  readonly velocity: number
}

/**
 * Injected live-audio boundary. Construction must be inert; `activate` is
 * called only from a Play, pad, keyboard, or MIDI-connect user gesture.
 */
export interface DrumKitPlayerPort {
  activate(): boolean | Promise<boolean>
  /** Legacy/test ports may return undefined when routing truth is unavailable. */
  trigger(hit: DrumKitTrigger): DrumKitTriggerOutcome | undefined
  /** Optional only for legacy injected ports; concrete players implement it. */
  choke?(request: DrumKitChoke): DrumKitChokeOutcome | undefined
  /** Omit the lane to release every voice owned by the player. */
  panic(lane?: DrumKitPlaybackLane): void
  dispose(): void | Promise<void>
}

export function createSilentDrumKitPlayer(): DrumKitPlayerPort {
  return {
    activate: () => true,
    trigger: () => undefined,
    choke: () => undefined,
    panic: () => undefined,
    dispose: () => undefined,
  }
}

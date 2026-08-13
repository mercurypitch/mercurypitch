// ============================================================
// Piano instrument port — shared synchronous voice contract for piano engines
// ============================================================
//
// Instruments prepare asynchronously, but note events stay synchronous on the
// input and scheduler hot paths. A false noteOn result lets the router fall
// back without delaying an audible strike.

export type PianoInstrumentKind = 'fallback' | 'sampled'

export type PianoInstrumentPedal = 'sustain' | 'sostenuto' | 'soft'

export interface PianoInstrumentDescriptor {
  readonly id: string
  readonly name: string
  readonly kind: PianoInstrumentKind
  readonly maximumVoices: number
}

export interface PianoInstrumentNoteOn {
  /** Stable live or score voice identity. */
  readonly id: string
  readonly midi: number
  /** Normalized strike velocity in the inclusive range 0..1. */
  readonly velocity: number
  /** Normalized soft-pedal value captured when the note began. */
  readonly softPedalValue?: number
  /** AudioContext time. Omit for an immediate live note. */
  readonly atContextTime?: number
}

export interface PianoInstrumentNoteOff {
  /** The same stable voice identity supplied to noteOn. */
  readonly id: string
  /** Normalized key-release velocity in the inclusive range 0..1. */
  readonly releaseVelocity?: number
  /** AudioContext time. Omit for an immediate live release. */
  readonly atContextTime?: number
}

export interface PianoInstrumentPedalEvent {
  readonly pedal: PianoInstrumentPedal
  /** Normalized pedal position in the inclusive range 0..1. */
  readonly value: number
  /** AudioContext time. Omit for an immediate live change. */
  readonly atContextTime?: number
}

export interface PianoInstrumentVoicePort {
  noteOn(note: PianoInstrumentNoteOn): boolean
  noteOff(note: PianoInstrumentNoteOff): boolean
}

export interface PianoInstrumentPort extends PianoInstrumentVoicePort {
  descriptor(): PianoInstrumentDescriptor
  load(signal?: AbortSignal): Promise<void>
  prewarm(midis: readonly number[], signal?: AbortSignal): Promise<void>
  /**
   * Set normalized master output in the inclusive range 0..1.
   * This configuration call must not construct or activate an audio graph.
   */
  setVolume(volume: number): void
  pedal(event: PianoInstrumentPedalEvent): void
  panic(atContextTime?: number): void
  activeVoiceIds(): readonly string[]
  /** Must be safe to call more than once. */
  dispose(): void
}

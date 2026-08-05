// ============================================================
// Drum Machine — synthesized drum sounds + pattern sequencer
// ============================================================

import { DRUM_VOICES } from '@/lib/drum-voices'

export type DrumSound =
  | 'kick'
  | 'snare'
  | 'hh-closed'
  | 'hh-open'
  | 'tom-high'
  | 'tom-mid'
  | 'tom-low'
  | 'crash'

export const DRUM_SOUNDS: DrumSound[] = [
  'kick',
  'snare',
  'hh-closed',
  'hh-open',
  'tom-high',
  'tom-mid',
  'tom-low',
  'crash',
]

export type DrumPattern = Record<DrumSound, boolean[]>

export type PresetName =
  | 'basic-rock'
  | 'funk'
  | 'hip-hop'
  | 'jazz'
  | 'latin'
  | 'empty'

export interface DrumMachineState {
  playing: boolean
  bpm: number
  currentStep: number
  pattern: DrumPattern
  volumes: Record<DrumSound, number>
}

const STEPS = 16

function emptyPattern(): DrumPattern {
  const pattern = {} as DrumPattern
  for (const sound of DRUM_SOUNDS) {
    pattern[sound] = new Array(STEPS).fill(false)
  }
  return pattern
}

// ── Preset patterns ──────────────────────────────────────────

const PRESETS: Record<PresetName, DrumPattern> = {
  'basic-rock': makePattern({
    kick: [0, 4, 8, 12],
    snare: [4, 12],
    'hh-closed': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  }),
  funk: makePattern({
    kick: [0, 4, 8, 10, 12, 14],
    snare: [4, 12],
    'hh-closed': [0, 2, 4, 6, 8, 10, 12, 14],
    'hh-open': [3, 7, 11, 15],
  }),
  'hip-hop': makePattern({
    kick: [0, 4, 8, 11, 14],
    snare: [5, 13],
    'hh-closed': [0, 2, 4, 6, 8, 10, 12, 14],
    'hh-open': [3, 15],
  }),
  jazz: makePattern({
    kick: [0, 8],
    snare: [4, 12],
    'hh-closed': [0, 2, 4, 6, 8, 10, 12, 14],
    'tom-high': [11],
    'tom-mid': [3, 15],
    crash: [0],
  }),
  latin: makePattern({
    kick: [0, 8, 14],
    snare: [4, 10],
    'hh-closed': [0, 3, 6, 9, 12, 15],
    'tom-high': [2, 11],
    'tom-mid': [5, 13],
    'tom-low': [7],
  }),
  empty: emptyPattern(),
}

function makePattern(
  active: Partial<Record<DrumSound, number[]>>,
): DrumPattern {
  const p = emptyPattern()
  for (const [sound, steps] of Object.entries(active)) {
    for (const step of steps) {
      p[sound as DrumSound][step % STEPS] = true
    }
  }
  return p
}

// ── Drum sound synthesis ─────────────────────────────────────
// The voice recipes live in the shared module (src/lib/drum-voices.ts);
// the drum machine plays them straight into its own context's destination.

const SOUND_FACTORIES: Record<
  DrumSound,
  (ctx: BaseAudioContext, now: number, volume: number) => void
> = {
  kick: (ctx, now, vol) => DRUM_VOICES.kick(ctx, now, vol, ctx.destination),
  snare: (ctx, now, vol) => DRUM_VOICES.snare(ctx, now, vol, ctx.destination),
  'hh-closed': (ctx, now, vol) =>
    DRUM_VOICES['hh-closed'](ctx, now, vol, ctx.destination),
  'hh-open': (ctx, now, vol) =>
    DRUM_VOICES['hh-open'](ctx, now, vol, ctx.destination),
  'tom-high': (ctx, now, vol) =>
    DRUM_VOICES['tom-high'](ctx, now, vol, ctx.destination),
  'tom-mid': (ctx, now, vol) =>
    DRUM_VOICES['tom-mid'](ctx, now, vol, ctx.destination),
  'tom-low': (ctx, now, vol) =>
    DRUM_VOICES['tom-low'](ctx, now, vol, ctx.destination),
  crash: (ctx, now, vol) => DRUM_VOICES.crash(ctx, now, vol, ctx.destination),
}

// ── DrumMachine class ────────────────────────────────────────

export class DrumMachine {
  private ctx: AudioContext | null = null
  private _playing = false
  private _bpm = 120
  private _currentStep = 0
  private _pattern: DrumPattern = PRESETS['basic-rock']
  private _volumes: Record<DrumSound, number>
  private _timer: ReturnType<typeof setInterval> | null = null
  private _transportGeneration = 0
  private _listeners: Set<() => void> = new Set()

  constructor() {
    this._volumes = {} as Record<DrumSound, number>
    for (const sound of DRUM_SOUNDS) {
      this._volumes[sound] = 0.8
    }
  }

  /** Must be called after user gesture to initialize AudioContext */
  async init(): Promise<void> {
    if (!this.ctx) {
      this.ctx = new AudioContext({ latencyHint: 'interactive' })
    }
    // Initiate resume inside the originating gesture. Deferring this to
    // start() through a Promise continuation loses browser activation.
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume()
    }
  }

  get playing(): boolean {
    return this._playing
  }

  get bpm(): number {
    return this._bpm
  }

  get currentStep(): number {
    return this._currentStep
  }

  get pattern(): DrumPattern {
    return this._pattern
  }

  get volumes(): Record<DrumSound, number> {
    return this._volumes
  }

  /** Step duration in seconds */
  private stepDuration(): number {
    return 60 / this._bpm / 4 // 16th notes
  }

  setBpm(bpm: number): void {
    this._bpm = Math.max(40, Math.min(300, bpm))
    this.notify()
  }

  setVolume(sound: DrumSound, value: number): void {
    this._volumes[sound] = Math.max(0, Math.min(1, value))
  }

  toggleStep(sound: DrumSound, step: number): void {
    if (step >= 0 && step < STEPS) {
      this._pattern[sound][step] = !this._pattern[sound][step]
    }
  }

  setStep(sound: DrumSound, step: number, active: boolean): void {
    if (step >= 0 && step < STEPS) {
      this._pattern[sound][step] = active
    }
  }

  loadPreset(name: PresetName): void {
    this._pattern = structuredClone(PRESETS[name])
    this.notify()
  }

  clearPattern(): void {
    this._pattern = emptyPattern()
    this.notify()
  }

  /** Subscribe to state changes (step advance, play/stop) */
  onChange(fn: () => void): () => void {
    this._listeners.add(fn)
    return () => this._listeners.delete(fn)
  }

  private notify(): void {
    for (const fn of this._listeners) fn()
  }

  async start(): Promise<void> {
    const ctx = this.ctx
    if (!ctx || this._playing) return

    const transportGeneration = ++this._transportGeneration
    // Resume suspended context (iOS Safari)
    if (ctx.state === 'suspended') {
      await ctx.resume()
    }

    // stop() and dispose() invalidate starts that are waiting on resume().
    if (transportGeneration !== this._transportGeneration || this.ctx !== ctx)
      return

    this._playing = true
    this._currentStep = -1
    this.notify()
    this._schedule()
  }

  stop(): void {
    this._transportGeneration++
    this._playing = false
    if (this._timer !== null) {
      clearTimeout(this._timer)
      this._timer = null
    }
    this.notify()
  }

  /** Play a single step — useful for preview/editing */
  playStep(step: number): void {
    if (!this.ctx) return
    step = ((step % STEPS) + STEPS) % STEPS
    const now = this.ctx.currentTime
    for (const sound of DRUM_SOUNDS) {
      if (this._pattern[sound][step]) {
        SOUND_FACTORIES[sound](this.ctx, now, this._volumes[sound])
      }
    }
  }

  /** Trigger a single drum sound directly */
  trigger(sound: DrumSound): void {
    if (!this.ctx) return
    SOUND_FACTORIES[sound](this.ctx, this.ctx.currentTime, this._volumes[sound])
  }

  private _schedule(): void {
    if (!this._playing || !this.ctx) return

    const stepTime = this.stepDuration()
    const now = this.ctx.currentTime

    this._currentStep = (this._currentStep + 1) % STEPS
    const step = this._currentStep

    for (const sound of DRUM_SOUNDS) {
      if (this._pattern[sound][step]) {
        SOUND_FACTORIES[sound](this.ctx, now, this._volumes[sound])
      }
    }

    this.notify()

    // Schedule next step with drift compensation
    const elapsed = this.ctx.currentTime - now
    const delay = Math.max(5, (stepTime - elapsed) * 1000)
    this._timer = setTimeout(() => this._schedule(), delay)
  }

  dispose(): void {
    this.stop()
    if (this.ctx) {
      this.ctx
        .close()
        .catch((err) => console.info('[DrumMachine] AudioContext close:', err))
    }
    this.ctx = null
    this._listeners.clear()
  }
}

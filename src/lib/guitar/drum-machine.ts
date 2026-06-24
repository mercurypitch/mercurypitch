// ============================================================
// Drum Machine — synthesized drum sounds + pattern sequencer
// ============================================================

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

function createKick(ctx: BaseAudioContext, now: number, volume: number): void {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(150, now)
  osc.frequency.exponentialRampToValueAtTime(40, now + 0.08)
  gain.gain.setValueAtTime(volume * 0.9, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(now)
  osc.stop(now + 0.35)
}

function createSnare(ctx: BaseAudioContext, now: number, volume: number): void {
  // Noise burst
  const noiseLen = Math.floor(ctx.sampleRate * 0.12)
  const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate)
  const data = noiseBuf.getChannelData(0)
  for (let i = 0; i < noiseLen; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / noiseLen)
  }
  const noise = ctx.createBufferSource()
  noise.buffer = noiseBuf
  const noiseGain = ctx.createGain()
  noiseGain.gain.setValueAtTime(volume * 0.5, now)
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12)
  noise.connect(noiseGain)
  noiseGain.connect(ctx.destination)
  noise.start(now)
  noise.stop(now + 0.15)

  // Tonal body
  const tone = ctx.createOscillator()
  const toneGain = ctx.createGain()
  tone.type = 'triangle'
  tone.frequency.setValueAtTime(200, now)
  tone.frequency.exponentialRampToValueAtTime(120, now + 0.05)
  toneGain.gain.setValueAtTime(volume * 0.35, now)
  toneGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1)
  tone.connect(toneGain)
  toneGain.connect(ctx.destination)
  tone.start(now)
  tone.stop(now + 0.12)
}

function createHihatClosed(
  ctx: BaseAudioContext,
  now: number,
  volume: number,
): void {
  const noiseLen = Math.floor(ctx.sampleRate * 0.04)
  const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate)
  const data = noiseBuf.getChannelData(0)
  for (let i = 0; i < noiseLen; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / noiseLen)
  }
  const noise = ctx.createBufferSource()
  noise.buffer = noiseBuf
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 8000
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(volume * 0.2, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03)
  noise.connect(hp)
  hp.connect(gain)
  gain.connect(ctx.destination)
  noise.start(now)
  noise.stop(now + 0.05)
}

function createHihatOpen(
  ctx: BaseAudioContext,
  now: number,
  volume: number,
): void {
  const noiseLen = Math.floor(ctx.sampleRate * 0.25)
  const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate)
  const data = noiseBuf.getChannelData(0)
  for (let i = 0; i < noiseLen; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / noiseLen)
  }
  const noise = ctx.createBufferSource()
  noise.buffer = noiseBuf
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 7000
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(volume * 0.25, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18)
  noise.connect(hp)
  hp.connect(gain)
  gain.connect(ctx.destination)
  noise.start(now)
  noise.stop(now + 0.2)
}

function createTom(
  ctx: BaseAudioContext,
  now: number,
  startFreq: number,
  volume: number,
): void {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(startFreq, now)
  osc.frequency.exponentialRampToValueAtTime(startFreq * 0.5, now + 0.06)
  gain.gain.setValueAtTime(volume * 0.5, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(now)
  osc.stop(now + 0.22)
}

function createCrash(ctx: BaseAudioContext, now: number, volume: number): void {
  const noiseLen = Math.floor(ctx.sampleRate * 0.9)
  const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate)
  const data = noiseBuf.getChannelData(0)
  for (let i = 0; i < noiseLen; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / noiseLen)
  }
  const noise = ctx.createBufferSource()
  noise.buffer = noiseBuf
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 4000
  bp.Q.value = 1.2
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(volume * 0.4, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7)
  noise.connect(bp)
  bp.connect(gain)
  gain.connect(ctx.destination)
  noise.start(now)
  noise.stop(now + 0.8)
}

const SOUND_FACTORIES: Record<
  DrumSound,
  (ctx: BaseAudioContext, now: number, volume: number) => void
> = {
  kick: createKick,
  snare: createSnare,
  'hh-closed': createHihatClosed,
  'hh-open': createHihatOpen,
  'tom-high': (ctx, now, vol) => createTom(ctx, now, 350, vol),
  'tom-mid': (ctx, now, vol) => createTom(ctx, now, 240, vol),
  'tom-low': (ctx, now, vol) => createTom(ctx, now, 150, vol),
  crash: createCrash,
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
  private _listeners: Set<() => void> = new Set()

  constructor() {
    this._volumes = {} as Record<DrumSound, number>
    for (const sound of DRUM_SOUNDS) {
      this._volumes[sound] = 0.8
    }
  }

  /** Must be called after user gesture to initialize AudioContext */
  async init(): Promise<void> {
    if (this.ctx) return
    this.ctx = new AudioContext({ latencyHint: 'interactive' })
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
    if (!this.ctx || this._playing) return
    // Resume suspended context (iOS Safari)
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume()
    }
    this._playing = true
    this._currentStep = -1
    this.notify()
    this._schedule()
  }

  stop(): void {
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
      this.ctx.close().catch(() => {})
    }
    this.ctx = null
    this._listeners.clear()
  }
}

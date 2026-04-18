// ============================================================
// Audio Engine — Web Audio API playback and microphone input
// ============================================================

import type { MelodyItem, MelodyNote, AudioEngineCallbacks, EffectType, } from '@/types'

export type InstrumentType = 'sine' | 'piano' | 'organ' | 'strings' | 'synth'

export class AudioEngine {
  private audioCtx: AudioContext | null = null
  private mainGain: GainNode | null = null
  // Microphone
  private micStream: MediaStream | null = null
  private micSource: MediaStreamAudioSourceNode | null = null
  // Shared analyser used for both mic input and pitch detection (mirrors old JS behavior)
  private analyser: AnalyserNode | null = null
  private playbackAnalyser: AnalyserNode | null = null
  private micGain: GainNode | null = null
  // Legacy aliases for compatibility
  private micAnalyser: AnalyserNode | null = null
  private toneOscillator: OscillatorNode | null = null
  private toneGain: GainNode | null = null
  private isRecording = false
  private isPlaying = false
  private callbacks: AudioEngineCallbacks = {}
  private volume = 0.8
  private currentInstrument: InstrumentType = 'sine'
  private bufferSize = 2048
  private _frequencyData = new Float32Array(0)
  private _timeData = new Float32Array(0)
  private _playbackTimeData = new Float32Array(0)
  private _frequencyByteData = new Uint8Array(0)
  private _activeVoices = new Map<
    number,
    {
      oscillators: OscillatorNode[]
      gains: GainNode[]
      stopTime: number
      lfos?: OscillatorNode[]
      lfoGains?: GainNode[]
    }
  >()

  // ADSR Envelope configuration (default values)
  private adsrAttack = 0.01 // seconds (10ms)
  private adsrDecay = 0.1 // seconds (100ms)
  private adsrSustain = 0.7 // 0-1 level (70%)
  private adsrRelease = 0.2 // seconds (200ms)

  // Reverb configuration
  private reverbNode: ConvolverNode | null = null
  private reverbSendGain: GainNode | null = null
  private reverbReturnGain: GainNode | null = null
  private currentReverbType: 'off' | 'room' | 'hall' | 'cathedral' = 'room'
  private currentReverbWetness = 0.3

  // ============================================================
  // Lifecycle
  // ============================================================

  async init(): Promise<void> {
    if (this.audioCtx) return

    this.audioCtx = new AudioContext({ latencyHint: 'interactive' })
    // Playback analyser for pitch track visualization (mirrors old JS)
    this.playbackAnalyser = this.audioCtx.createAnalyser()
    this.playbackAnalyser.fftSize = this.bufferSize
    this.playbackAnalyser.smoothingTimeConstant = 0.0
    if (
      this.audioCtx.destination &&
      typeof this.playbackAnalyser.connect === 'function'
    ) {
      this.playbackAnalyser.connect(this.audioCtx.destination)
    }
    this.mainGain = this.audioCtx.createGain()
    this.mainGain.gain.value = this.volume

    // Reverb send/return gain nodes for dry/wet mix
    this.reverbSendGain = this.audioCtx.createGain()
    this.reverbReturnGain = this.audioCtx.createGain()
    this.reverbSendGain.gain.value = 0
    this.reverbReturnGain.gain.value = 0

    if (this.playbackAnalyser && typeof this.mainGain.connect === 'function') {
      // Dry path: mainGain → playbackAnalyser (always full volume)
      this.mainGain.connect(this.playbackAnalyser)
      // Wet send tap: mainGain → reverbSendGain (gain = wetness, only active when reverb on)
      this.mainGain.connect(this.reverbSendGain)
    }

    // Create shared analyser for mic input and pitch detection (mirrors old JS)
    this.analyser = this.audioCtx.createAnalyser()
    this.analyser.fftSize = this.bufferSize
    this.analyser.smoothingTimeConstant = 0.1
    // Alias for compatibility
    this.micAnalyser = this.analyser

    // Initialize frequency data array with default size for visualizer
    if (this._frequencyData.length === 0) {
      this._frequencyData = new Float32Array(this.analyser.frequencyBinCount)
      this._timeData = new Float32Array(this.analyser.fftSize)
      this._playbackTimeData = new Float32Array(this.playbackAnalyser.fftSize)
      this._frequencyByteData = new Uint8Array(this.analyser.frequencyBinCount)
    }
  }

  /** Resume audio context if suspended (needed after user gesture) */
  async resume(): Promise<void> {
    if (this.audioCtx?.state === 'suspended') {
      await this.audioCtx.resume()
    }
  }

  /** Get the AudioContext */
  getAudioContext(): AudioContext | null {
    return this.audioCtx
  }

  /** Get the sample rate */
  getSampleRate(): number {
    return this.audioCtx?.sampleRate ?? 44100
  }

  /** Get the analyser buffer size (fftSize) */
  getBufferSize(): number {
    return this.bufferSize
  }

  // ============================================================
  // Volume
  // ============================================================

  setVolume(value: number): void {
    this.volume = Math.max(0, Math.min(1, value))
    if (this.mainGain) {
      this.mainGain.gain.value = this.volume
    }
  }

  // ============================================================
  // Reverb / Effects
  // ============================================================

  /**
   * Set the reverb wet mix (0–100). The dry signal always goes through at
   * full volume; this only controls how much of the signal is fed into reverb.
   */
  setReverbWetness(wetness: number): void {
    this.currentReverbWetness = Math.max(0, Math.min(100, wetness)) / 100
    if (this.reverbSendGain && this.reverbReturnGain) {
      this.reverbSendGain.gain.value = this.currentReverbWetness
      this.reverbReturnGain.gain.value = this.currentReverbWetness
    }
  }

  /**
   * Set the reverb type and generate the corresponding impulse response.
   */
  async setReverbType(
    type: 'off' | 'room' | 'hall' | 'cathedral',
  ): Promise<void> {
    this.currentReverbType = type
    if (!this.audioCtx) return

    if (type === 'off') {
      this.reverbNode = null
      this._connectReverbChain()
      return
    }

    const sampleRate = this.audioCtx.sampleRate
    const ir = this._generateImpulseResponse(type, sampleRate)
    const irBuffer = this.audioCtx.createBuffer(2, ir[0].length, sampleRate)
    irBuffer.copyToChannel(Float32Array.from(ir[0]), 0)
    irBuffer.copyToChannel(Float32Array.from(ir[1]), 1)
    this.reverbNode = this.audioCtx.createConvolver()
    this.reverbNode.buffer = irBuffer
    this._connectReverbChain()
    // Re-apply wetness now that the convolver exists
    this.setReverbWetness(this.currentReverbWetness * 100)
  }

  /**
   * Generate a stereo impulse response buffer for a given reverb type.
   * Uses exponential-decay noise — no external files required.
   */
  private _generateImpulseResponse(
    type: 'room' | 'hall' | 'cathedral',
    sampleRate: number,
  ): [Float32Array, Float32Array] {
    const durations: Record<string, number> = {
      room: 0.15,
      hall: 0.6,
      cathedral: 2.0,
    }
    const decayRates: Record<string, number> = {
      room: 8,
      hall: 4,
      cathedral: 2,
    }
    const duration = durations[type] ?? 0.5
    const decayRate = decayRates[type] ?? 5
    const length = Math.floor(sampleRate * duration)
    const left = new Float32Array(length)
    const right = new Float32Array(length)

    for (let i = 0; i < length; i++) {
      // Exponential decay with random noise for natural reverb tail
      const decay = Math.exp(-i / ((sampleRate * duration) / decayRate))
      left[i] = (Math.random() * 2 - 1) * decay
      right[i] = (Math.random() * 2 - 1) * decay
    }

    // Normalize to prevent clipping
    let maxAmp = 0
    for (let i = 0; i < length; i++) {
      const a = Math.abs(left[i])
      if (a > maxAmp) maxAmp = a
      const b = Math.abs(right[i])
      if (b > maxAmp) maxAmp = b
    }
    if (maxAmp > 0) {
      const norm = 0.9 / maxAmp
      for (let i = 0; i < length; i++) {
        left[i] *= norm
        right[i] *= norm
      }
    }

    return [left, right]
  }

  /**
   * Connect the reverb chain: send → convolver → return → playbackAnalyser.
   * Disconnects old chain first to avoid duplicate connections.
   */
  private _connectReverbChain(): void {
    if (!this.audioCtx) return

    // Disconnect any existing reverb connections
    if (this.reverbSendGain && this.reverbNode) {
      try {
        this.reverbSendGain.disconnect(this.reverbNode)
      } catch {}
    }
    if (this.reverbNode && this.reverbReturnGain) {
      try {
        this.reverbNode.disconnect(this.reverbReturnGain)
      } catch {}
    }

    if (!this.reverbNode || !this.reverbSendGain || !this.reverbReturnGain)
      return
    if (!this.playbackAnalyser) return

    // Wire: mainGain → reverbSendGain → reverbNode → reverbReturnGain → playbackAnalyser
    try {
      this.reverbSendGain.connect(this.reverbNode)
    } catch {}
    try {
      this.reverbNode.connect(this.reverbReturnGain)
    } catch {}
    try {
      this.reverbReturnGain.connect(this.playbackAnalyser)
    } catch {}
  }

  getVolume(): number {
    return this.volume
  }

  // ============================================================
  // Instrument selection
  // ============================================================

  /** Set the instrument for note playback */
  setInstrument(type: InstrumentType): void {
    this.currentInstrument = type
  }

  /** Get the current instrument */
  getInstrument(): InstrumentType {
    return this.currentInstrument
  }

  /** Get available instrument names */
  getInstruments(): InstrumentType[] {
    return ['sine', 'piano', 'organ', 'strings', 'synth']
  }

  // ============================================================
  // ADSR Envelope
  // ============================================================

  /** Set ADSR envelope parameters (values in ms) */
  setADSR(
    attack: number,
    decay: number,
    sustain: number,
    release: number,
  ): void {
    this.adsrAttack = Math.max(0.001, attack / 1000) // ms to seconds, min 1ms
    this.adsrDecay = Math.max(0.001, decay / 1000)
    this.adsrSustain = Math.max(0, Math.min(1, sustain / 100)) // percentage to 0-1
    this.adsrRelease = Math.max(0.001, release / 1000)
  }

  /** Get current ADSR values (returns ms and percentage) */
  getADSR(): {
    attack: number
    decay: number
    sustain: number
    release: number
  } {
    return {
      attack: Math.round(this.adsrAttack * 1000),
      decay: Math.round(this.adsrDecay * 1000),
      sustain: Math.round(this.adsrSustain * 100),
      release: Math.round(this.adsrRelease * 1000),
    }
  }

  /** Sync ADSR settings from appStore (call on init and when ADSR changes) */
  syncFromAppStore(adsrConfig: {
    attack: number
    decay: number
    sustain: number
    release: number
  }): void {
    this.adsrAttack = adsrConfig.attack / 1000
    this.adsrDecay = adsrConfig.decay / 1000
    this.adsrSustain = adsrConfig.sustain / 100
    this.adsrRelease = adsrConfig.release / 1000
  }

  // ============================================================
  // Count-in and metronome clicks
  // ============================================================

  /**
   * Play a short click sound for count-in beat
   */
  playClick(): void {
    if (!this.audioCtx || !this.mainGain) return
    // Ensure AudioContext is ready
    this.resume().catch(() => {})

    const osc = this.audioCtx.createOscillator()
    const gain = this.audioCtx.createGain()

    osc.type = 'sine'
    osc.frequency.value = 800 // 800 Hz click (matches old app)

    gain.gain.value = 0.3
    gain.gain.setValueAtTime(0.3, this.audioCtx.currentTime)
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      this.audioCtx.currentTime + 0.05,
    )

    osc.connect(gain)
    gain.connect(this.mainGain)

    osc.start(this.audioCtx.currentTime)
    osc.stop(this.audioCtx.currentTime + 0.05)
  }

  /**
   * Play metronome click - high frequency for downbeat, lower for other beats
   */
  playMetronomeClick(isDownbeat: boolean): void {
    if (!this.audioCtx || !this.mainGain) return
    this.resume().catch(() => {})

    const osc = this.audioCtx.createOscillator()
    const gain = this.audioCtx.createGain()

    osc.type = 'triangle'
    // Downbeat gets a higher pitch (440Hz = A4), other beats lower (220Hz = A3)
    osc.frequency.value = isDownbeat ? 880 : 440

    gain.gain.value = 0.4
    gain.gain.setValueAtTime(0.4, this.audioCtx.currentTime)
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      this.audioCtx.currentTime + 0.08,
    )

    osc.connect(gain)
    gain.connect(this.mainGain)

    osc.start(this.audioCtx.currentTime)
    osc.stop(this.audioCtx.currentTime + 0.08)
  }

  // ============================================================
  // Microphone
  // ============================================================

  async startMic(): Promise<boolean> {
    try {
      await this.init()
      await this.resume()

      if (this.isRecording) {
        console.log('[AudioEngine] Mic already active, returning true')
        return true
      }

      console.log('[AudioEngine] Requesting microphone access...')

      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      })

      const ctx = this.audioCtx
      if (!ctx || !this.analyser) {
        console.error('[AudioEngine] AudioContext or analyser not available')
        return false
      }

      // Connect mic stream to shared analyser (mirrors old JS behavior)
      this.micSource = ctx.createMediaStreamSource(this.micStream)
      this.micGain = ctx.createGain()
      this.micGain.gain.value = 1.0

      this.micSource.connect(this.micGain)
      this.micGain.connect(this.analyser)

      this.isRecording = true
      console.log('[AudioEngine] Microphone started successfully')
      return true
    } catch (err) {
      console.error('[AudioEngine] Microphone access denied:', err)
      return false
    }
  }

  stopMic(): void {
    if (!this.isRecording) {
      console.log('[AudioEngine] Mic already stopped')
      return
    }

    this.isRecording = false
    console.log('[AudioEngine] Stopping microphone...')

    // Disconnect mic chain but keep analyser for visualization
    if (this.micSource) {
      this.micSource.disconnect()
      this.micSource = null
    }
    if (this.micGain) {
      this.micGain.disconnect()
      this.micGain = null
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop())
      this.micStream = null
    }
    console.log('[AudioEngine] Microphone stopped')
    // Note: analyser stays active for visualization
  }

  isMicActive(): boolean {
    return this.isRecording
  }

  isMicRecording(): boolean {
    return this.isRecording
  }

  /** Get waveform data from microphone (for live visualization) */
  getWaveformData(): Float32Array {
    if (this.micAnalyser) {
      this.micAnalyser.getFloatTimeDomainData(this._timeData)
    }
    return this._timeData
  }

  /** Get frequency data from microphone (for pitch detection) */
  getFrequencyData(): Float32Array {
    if (this.micAnalyser) {
      this.micAnalyser.getFloatFrequencyData(this._frequencyData)
    }
    return this._frequencyData
  }

  /** Get frequency-domain byte data from microphone (Uint8Array, 0-255 per bin) */
  getFrequencyDataBytes(): Uint8Array {
    if (this.micAnalyser) {
      this.micAnalyser.getByteFrequencyData(this._frequencyByteData)
    }
    return this._frequencyByteData
  }

  /** Get time-domain data from microphone */
  getTimeData(): Float32Array {
    if (this.micAnalyser) {
      this.micAnalyser.getFloatTimeDomainData(this._timeData)
    }
    return this._timeData
  }

  /** Get playback time-domain buffer for pitch track visualization */
  getPlaybackTimeData(): Float32Array {
    if (this.playbackAnalyser) {
      this.playbackAnalyser.getFloatTimeDomainData(this._playbackTimeData)
    }
    return this._playbackTimeData
  }

  // ============================================================
  // Tone / Oscillator playback
  // ============================================================

  /** Play a tone at the given frequency */
  async playTone(frequency: number, duration?: number): Promise<void> {
    await this.init()
    await this.resume()
    if (!this.audioCtx || !this.mainGain) return

    // Stop any existing oscillator
    this.stopTone()

    this.toneOscillator = this.audioCtx.createOscillator()
    this.toneGain = this.audioCtx.createGain()

    this.toneOscillator.type = 'sine'
    this.toneOscillator.frequency.value = frequency

    // Smooth ramp in
    this.toneGain.gain.setValueAtTime(0, this.audioCtx.currentTime)
    this.toneGain.gain.linearRampToValueAtTime(
      this.volume,
      this.audioCtx.currentTime + 0.01,
    )

    this.toneOscillator.connect(this.toneGain)
    this.toneGain.connect(this.mainGain)
    this.toneOscillator.start()

    this.isPlaying = true

    if (duration !== undefined) {
      const stopTime = this.audioCtx.currentTime + duration / 1000
      this.toneGain.gain.setValueAtTime(this.volume, stopTime - 0.02)
      this.toneGain.gain.linearRampToValueAtTime(0, stopTime)
      this.toneOscillator.stop(stopTime)
      this.toneOscillator.onended = () => {
        this.isPlaying = false
      }
    }
  }

  /** Stop the current tone */
  stopTone(): void {
    if (this.toneOscillator) {
      try {
        this.toneOscillator.stop()
        this.toneOscillator.disconnect()
      } catch {
        // already stopped
      }
      this.toneOscillator = null
    }
    if (this.toneGain) {
      this.toneGain.disconnect()
      this.toneGain = null
    }
    this.isPlaying = false
  }

  /** Change the frequency of the current tone smoothly */
  setToneFrequency(frequency: number): void {
    if (this.toneOscillator && this.audioCtx) {
      this.toneOscillator.frequency.setTargetAtTime(
        frequency,
        this.audioCtx.currentTime,
        0.005,
      )
    }
  }

  isTonePlaying(): boolean {
    return this.isPlaying
  }

  // ============================================================
  // Note / melody playback
  // ============================================================

  /** Play a single note for a given duration (ms) */
  async playNote(
    frequency: number,
    durationMs: number,
    effectType?: EffectType,
  ): Promise<number | undefined> {
    await this.init()
    await this.resume()
    if (!this.audioCtx || !this.mainGain) return undefined

    const now = this.audioCtx.currentTime
    const noteId = Date.now() + Math.random()

    // Create oscillators based on instrument
    const {
      oscillators,
      gain: mainGain,
      lfos,
      lfoGains,
      hasCustomEnvelope,
    } = this._createVoice(frequency, durationMs, effectType)

    if (!hasCustomEnvelope) {
      mainGain.gain.setValueAtTime(0, now)
      mainGain.gain.linearRampToValueAtTime(this.volume, now + 0.01)
    }

    for (const osc of oscillators) {
      osc.connect(mainGain)
      osc.start(now)
      osc.stop(now + durationMs / 1000 + 0.1)
    }
    mainGain.connect(this.mainGain)

    // Store voice reference (with optional LFOs)
    this._activeVoices.set(noteId, {
      oscillators,
      gains: [mainGain],
      stopTime: now + durationMs / 1000,
      lfos,
      lfoGains,
    })

    // Auto-stop after duration
    if (durationMs) {
      setTimeout(() => this.stopNote(noteId), durationMs)
    }

    return noteId
  }

  /**
   * Create oscillators for an instrument. Returns oscillators and a master gain node.
   * The returned `hasCustomEnvelope` flag indicates whether this instrument already
   * schedules its own gain envelope — if so, callers should NOT apply the default ADSR.
   */
  private _createVoice(
    freq: number,
    durationMs: number,
    effectType?: EffectType,
  ): {
    oscillators: OscillatorNode[]
    gain: GainNode
    lfos: OscillatorNode[]
    lfoGains: GainNode[]
    hasCustomEnvelope: boolean
  } {
    const ctx = this.audioCtx!
    const now = ctx.currentTime
    const dur = durationMs / 1000

    const mainGain = ctx.createGain()
    const oscillators: OscillatorNode[] = []
    let hasCustomEnvelope = false

    switch (this.currentInstrument) {
      case 'piano': {
        // Piano: fundamental + harmonics (additive synthesis)
        const harmonics = [1, 2, 3, 4, 5, 6]
        const amplitudes = [1, 0.5, 0.3, 0.2, 0.1, 0.05]
        harmonics.forEach((h, i) => {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = 'sine'
          osc.frequency.value = freq * h
          gain.gain.value = amplitudes[i] * 0.15
          osc.connect(gain)
          gain.connect(mainGain)
          oscillators.push(osc)
        })
        // Piano has its own envelope — smooth attack, decay, sustain
        mainGain.gain.setValueAtTime(0, now)
        mainGain.gain.linearRampToValueAtTime(0.8, now + this.adsrAttack)
        mainGain.gain.exponentialRampToValueAtTime(
          0.4,
          now + this.adsrAttack + this.adsrDecay,
        )
        mainGain.gain.setValueAtTime(
          0.3,
          now + this.adsrAttack + this.adsrDecay + 0.1,
        )
        hasCustomEnvelope = true
        break
      }
      case 'organ': {
        // Organ: fundamental + 5th + octave (drawbar style)
        const ratios = [1, 1.5, 2, 3, 4]
        const levels = [0.5, 0.3, 0.4, 0.2, 0.15]
        ratios.forEach((r, i) => {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = 'sine'
          osc.frequency.value = freq * r
          gain.gain.value = levels[i] * 0.2
          osc.connect(gain)
          gain.connect(mainGain)
          oscillators.push(osc)
        })
        // Smooth attack to prevent click at note start, hold, then release
        mainGain.gain.setValueAtTime(0, now)
        mainGain.gain.linearRampToValueAtTime(0.7, now + 0.015)
        mainGain.gain.setValueAtTime(0.7, now + dur - 0.1)
        mainGain.gain.linearRampToValueAtTime(0, now + dur)
        hasCustomEnvelope = true
        break
      }
      case 'strings': {
        // Strings: three detuned oscillators for warmth and richness
        const detunes = [0, -8, 8]
        const levels = [0.4, 0.3, 0.3]
        detunes.forEach((detune, i) => {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = 'sawtooth'
          osc.frequency.value = freq
          osc.detune.value = detune
          gain.gain.value = levels[i] * 0.1
          osc.connect(gain)
          gain.connect(mainGain)
          oscillators.push(osc)
        })
        // Slow fade in/out for strings feel
        mainGain.gain.setValueAtTime(0, now)
        mainGain.gain.linearRampToValueAtTime(0.6, now + 0.1)
        mainGain.gain.setValueAtTime(0.6, now + dur - 0.1)
        mainGain.gain.linearRampToValueAtTime(0, now + dur)
        hasCustomEnvelope = true
        break
      }
      case 'synth': {
        // Synth: square + sawtooth blend
        const osc1 = ctx.createOscillator()
        osc1.type = 'square'
        osc1.frequency.value = freq
        const gain1 = ctx.createGain()
        gain1.gain.value = 0.08
        osc1.connect(gain1)
        gain1.connect(mainGain)
        oscillators.push(osc1)

        const osc2 = ctx.createOscillator()
        osc2.type = 'sawtooth'
        osc2.frequency.value = freq
        const gain2 = ctx.createGain()
        gain2.gain.value = 0.05
        osc2.connect(gain2)
        gain2.connect(mainGain)
        oscillators.push(osc2)
        // Smooth attack to prevent click, sustain at 70%, then release
        mainGain.gain.setValueAtTime(0, now)
        mainGain.gain.linearRampToValueAtTime(1.0, now + 0.015)
        mainGain.gain.setValueAtTime(1.0, now + dur - 0.1)
        mainGain.gain.linearRampToValueAtTime(0, now + dur)
        hasCustomEnvelope = true
        break
      }
      default: {
        // Sine (default) — smooth attack via ADSR
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.value = freq
        oscillators.push(osc)
        break
      }
    }

    // Apply effect modulation to the primary oscillator (index 0)
    let lfos: OscillatorNode[] = []
    let lfoGains: GainNode[] = []
    if (effectType && oscillators.length > 0) {
      const result = this._applyEffectModulation(
        oscillators[0],
        effectType,
        freq,
        durationMs,
        now,
      )
      if (result) {
        lfos = result.lfos
        lfoGains = result.lfoGains
      }
    }

    // Apply configurable ADSR envelope only for instruments without a custom envelope
    if (!hasCustomEnvelope) {
      this._applyADSREnvelope(mainGain, now, dur)
    }

    return { oscillators, gain: mainGain, lfos, lfoGains, hasCustomEnvelope }
  }

  /**
   * Apply ADSR envelope to a gain node. Override in subclasses for custom envelopes.
   */
  protected _applyADSREnvelope(
    gainNode: GainNode,
    now: number,
    duration: number,
  ): void {
    // Override per-instrument in _createVoice or use this default for sine/synth
    const attackTime = this.adsrAttack
    const decayTime = this.adsrDecay
    const sustainLevel = this.adsrSustain

    gainNode.gain.setValueAtTime(0, now)
    gainNode.gain.linearRampToValueAtTime(1.0, now + attackTime)
    gainNode.gain.exponentialRampToValueAtTime(
      sustainLevel,
      now + attackTime + decayTime,
    )
    // Sustain until release phase (near end of note)
    gainNode.gain.setValueAtTime(
      sustainLevel,
      now + duration - this.adsrRelease,
    )
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration)
  }

  /**
   * Apply effect modulation (vibrato, slide, ease)
   */
  private _applyEffectModulation(
    osc: OscillatorNode,
    effectType: EffectType | undefined,
    freq: number,
    durationMs: number,
    now: number,
  ): { lfos: OscillatorNode[]; lfoGains: GainNode[] } | null {
    if (!effectType) return null

    const dur = durationMs / 1000
    const lfos: OscillatorNode[] = []
    const lfoGains: GainNode[] = []

    switch (effectType) {
      case 'vibrato': {
        // Vibrato: LFO modulates frequency ±5 cents for a wobble effect
        const lfo = this.audioCtx!.createOscillator()
        const lfoGain = this.audioCtx!.createGain()
        lfo.type = 'sine'
        lfo.frequency.value = 5 // 5 Hz wobble
        lfoGain.gain.value = freq * 0.003 // ±0.3% pitch wobble (~5 cents)
        lfo.connect(lfoGain)
        lfoGain.connect(osc.frequency)
        lfo.start(now)
        lfo.stop(now + dur)
        lfos.push(lfo)
        lfoGains.push(lfoGain)
        break
      }
      case 'slide-up': {
        // Slide up: frequency ramps from -1 octave to +0.5 octave over duration
        osc.frequency.setValueAtTime(freq * 0.5, now)
        osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + dur)
        break
      }
      case 'slide-down': {
        // Slide down: frequency ramps from +1 octave to -0.5 octave over duration
        osc.frequency.setValueAtTime(freq * 2, now)
        osc.frequency.exponentialRampToValueAtTime(freq * 0.75, now + dur)
        break
      }
      case 'ease-in': {
        // Ease in: start flat, slide up in the second half of the note
        osc.frequency.setValueAtTime(freq, now)
        osc.frequency.exponentialRampToValueAtTime(freq * 1.25, now + dur)
        break
      }
      case 'ease-out': {
        // Ease out: start at +0.5 octave, ease back to target frequency
        osc.frequency.setValueAtTime(freq * 1.5, now)
        osc.frequency.exponentialRampToValueAtTime(freq, now + dur)
        break
      }
    }

    return { lfos, lfoGains }
  }

  /** Play a beep sound */
  playBeep(type: 'start' | 'stop' = 'start'): void {
    if (!this.audioCtx || !this.mainGain) {
      this.init().then(() => this._doPlayBeep(type))
      return
    }
    this._doPlayBeep(type)
  }

  private _doPlayBeep(type: 'start' | 'stop'): void {
    if (!this.audioCtx || !this.mainGain) return

    const osc = this.audioCtx.createOscillator()
    const gain = this.audioCtx.createGain()

    osc.type = 'square'
    osc.frequency.value = type === 'start' ? 600 : 400
    gain.gain.setValueAtTime(0.2, this.audioCtx.currentTime)
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      this.audioCtx.currentTime + 0.1,
    )

    osc.connect(gain)
    gain.connect(this.mainGain)
    osc.start()
    osc.stop(this.audioCtx.currentTime + 0.1)
  }

  // ============================================================
  // Callbacks
  // ============================================================

  /**
   * Stop a specific note by ID (called automatically by setTimeout in playNote).
   */
  stopNote(noteId: number): void {
    const voice = this._activeVoices.get(noteId)
    if (!voice) return

    const ctx = this.audioCtx
    if (!ctx) return

    const now = ctx.currentTime

    // Release envelope (GH #130 fix: guard for voices with no/null gains, e.g. metronome)
    const firstGain = voice.gains[0]
    if (firstGain) {
      try {
        firstGain.gain.cancelScheduledValues(now)
        firstGain.gain.setValueAtTime(firstGain.gain.value, now)
        firstGain.gain.linearRampToValueAtTime(0, now + 0.1)
      } catch {
        /* gain may be disconnected */
      }
    }

    // Stop oscillators and LFOs after release
    setTimeout(() => {
      for (const osc of voice.oscillators) {
        try {
          osc.stop()
          osc.disconnect()
        } catch {
          /* already stopped */
        }
      }
      ;(voice.lfos || []).forEach((lfo) => {
        try {
          lfo.stop()
          lfo.disconnect()
        } catch {
          /* already stopped */
        }
      })
      ;(voice.lfoGains || []).forEach((g) => {
        try {
          g.disconnect()
        } catch {
          /* already stopped */
        }
      })
      // Only disconnect if gains exist (GH #130 fix)
      if (firstGain) {
        try {
          firstGain.disconnect()
        } catch {
          /* already stopped */
        }
      }
      this._activeVoices.delete(noteId)
    }, 150)
  }

  /**
   * Stop all active notes.
   */
  stopAllNotes(): void {
    for (const noteId of this._activeVoices.keys()) {
      this.stopNote(noteId)
    }
  }

  onNoteChange(callback: (note: MelodyNote, noteIndex: number) => void): void {
    this.callbacks.onNoteChange = callback
  }

  onPlaybackEnd(callback: () => void): void {
    this.callbacks.onPlaybackEnd = callback
  }

  protected emitNoteChange(note: MelodyNote, noteIndex: number): void {
    this.callbacks.onNoteChange?.(note, noteIndex)
  }

  protected emitPlaybackEnd(): void {
    this.callbacks.onPlaybackEnd?.()
  }

  // ============================================================
  // Cleanup
  // ============================================================

  destroy(): void {
    this.stopMic()
    this.stopTone()
    if (this.audioCtx) {
      this.audioCtx.close()
      this.audioCtx = null
    }
    this.mainGain = null
    this.reverbNode = null
    this.reverbSendGain = null
    this.reverbReturnGain = null
  }

  // ============================================================
  // WAV Export
  // ============================================================

  /**
   * Render a melody to a WAV file using offline audio rendering.
   * Returns a Blob containing the WAV audio data.
   *
   * @param melody - Array of melody items to render
   * @param bpm - Beats per minute for timing
   * @param instrument - Instrument type to use (defaults to current)
   */
  async renderMelodyToWAV(
    melody: MelodyItem[],
    bpm: number,
    instrument?: InstrumentType,
  ): Promise<Blob | null> {
    if (!melody || melody.length === 0) return null

    const sampleRate = 44100
    const beatDuration = 60 / bpm // seconds per beat
    const totalBeats = Math.max(
      ...melody.map((item) => item.startBeat + item.duration),
      4,
    )
    const totalDuration = totalBeats * beatDuration + 0.5 // +0.5s tail for release
    const totalSamples = Math.ceil(totalDuration * sampleRate)

    // Create offline context
    const offlineCtx = new OfflineAudioContext(1, totalSamples, sampleRate)
    const offlineGain = offlineCtx.createGain()
    offlineGain.gain.value = this.volume
    offlineGain.connect(offlineCtx.destination)

    // Save current instrument and temporarily switch if needed
    const prevInstrument = this.currentInstrument
    if (instrument) this.currentInstrument = instrument

    // Schedule all notes
    for (const item of melody) {
      const freq = item.note.freq
      const startTime = item.startBeat * beatDuration
      const durationMs = item.duration * beatDuration * 1000

      // Render each note using the same voice creation logic
      await this._renderNoteToContext(
        offlineCtx,
        offlineGain,
        freq,
        startTime,
        durationMs,
      )
    }

    // Restore instrument
    this.currentInstrument = prevInstrument

    // Render
    const renderedBuffer = await offlineCtx.startRendering()

    // Convert to WAV
    return this._bufferToWAV(renderedBuffer)
  }

  /**
   * Download a melody as a WAV file.
   */
  async downloadMelodyAsWAV(
    melody: MelodyItem[],
    bpm: number,
    filename = 'melody.wav',
    instrument?: InstrumentType,
  ): Promise<boolean> {
    const blob = await this.renderMelodyToWAV(melody, bpm, instrument)
    if (!blob) return false

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    return true
  }

  /**
   * Render a single note to an offline context.
   */
  private async _renderNoteToContext(
    ctx: OfflineAudioContext | AudioContext,
    destination: AudioNode,
    freq: number,
    startTime: number,
    durationMs: number,
  ): Promise<void> {
    const dur = durationMs / 1000
    const now = startTime

    const { oscillators, gain: mainGain } = this._createVoiceForContext(
      ctx,
      freq,
      durationMs,
    )

    mainGain.connect(destination)

    for (const osc of oscillators) {
      osc.start(now)
      osc.stop(now + dur + 0.1)
    }
  }

  /**
   * Create oscillators for offline rendering (same logic as _createVoice but for any context).
   */
  private _createVoiceForContext(
    ctx: OfflineAudioContext | AudioContext,
    freq: number,
    durationMs: number,
  ): { oscillators: OscillatorNode[]; gain: GainNode } {
    const now = ctx.currentTime
    const dur = durationMs / 1000

    const mainGain = ctx.createGain()
    const oscillators: OscillatorNode[] = []

    switch (this.currentInstrument) {
      case 'piano': {
        const harmonics = [1, 2, 3, 4, 5, 6]
        const amplitudes = [1, 0.5, 0.3, 0.2, 0.1, 0.05]
        harmonics.forEach((h, i) => {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = 'sine'
          osc.frequency.value = freq * h
          gain.gain.value = amplitudes[i] * 0.15
          osc.connect(gain)
          gain.connect(mainGain)
          oscillators.push(osc)
        })
        // Piano envelope
        mainGain.gain.setValueAtTime(0, now)
        mainGain.gain.linearRampToValueAtTime(0.8, now + this.adsrAttack)
        mainGain.gain.exponentialRampToValueAtTime(
          0.4,
          now + this.adsrAttack + this.adsrDecay,
        )
        mainGain.gain.setValueAtTime(
          0.3,
          now + this.adsrAttack + this.adsrDecay + 0.1,
        )
        break
      }
      case 'organ': {
        const ratios = [1, 1.5, 2, 3, 4]
        const levels = [0.5, 0.3, 0.4, 0.2, 0.15]
        ratios.forEach((r, i) => {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = 'sine'
          osc.frequency.value = freq * r
          gain.gain.value = levels[i] * 0.25
          osc.connect(gain)
          gain.connect(mainGain)
          oscillators.push(osc)
        })
        // Organ: slow attack, no decay
        mainGain.gain.setValueAtTime(0, now)
        mainGain.gain.linearRampToValueAtTime(0.9, now + 0.02)
        break
      }
      case 'strings': {
        // Strings: detuned sawtooth for warmth
        for (let i = 0; i < 3; i++) {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = 'sawtooth'
          osc.frequency.value = freq * (1 + (i - 1) * 0.003)
          gain.gain.value = 0.07 / 3
          osc.connect(gain)
          gain.connect(mainGain)
          oscillators.push(osc)
        }
        // Strings: slow attack (vibrato starts after attack)
        mainGain.gain.setValueAtTime(0, now)
        mainGain.gain.linearRampToValueAtTime(0.8, now + 0.08)
        // Slight vibrato via detune modulation
        break
      }
      case 'synth': {
        // Synth: square + sine for rich tone
        const osc1 = ctx.createOscillator()
        const gain1 = ctx.createGain()
        osc1.type = 'square'
        osc1.frequency.value = freq
        gain1.gain.value = 0.15
        osc1.connect(gain1)
        gain1.connect(mainGain)
        oscillators.push(osc1)

        const osc2 = ctx.createOscillator()
        const gain2 = ctx.createGain()
        osc2.type = 'sine'
        osc2.frequency.value = freq
        gain2.gain.value = 0.2
        osc2.connect(gain2)
        gain2.connect(mainGain)
        oscillators.push(osc2)
        // Synth envelope
        mainGain.gain.setValueAtTime(0, now)
        mainGain.gain.linearRampToValueAtTime(0.7, now + 0.005)
        mainGain.gain.exponentialRampToValueAtTime(0.5, now + 0.05)
        break
      }
      case 'sine':
      default: {
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.value = freq
        oscillators.push(osc)
        // Simple sine with release
        mainGain.gain.setValueAtTime(0, now)
        mainGain.gain.linearRampToValueAtTime(0.8, now + 0.01)
        break
      }
    }

    return { oscillators, gain: mainGain }
  }

  /**
   * Encode an AudioBuffer as a WAV Blob.
   */
  private _bufferToWAV(buffer: AudioBuffer): Blob {
    const numChannels = buffer.numberOfChannels
    const sampleRate = buffer.sampleRate
    const format = 1 // PCM
    const bitDepth = 16

    let interleaved: Float32Array
    if (numChannels === 1) {
      interleaved = buffer.getChannelData(0)
    } else {
      // Interleave channels (average stereo to mono if needed)
      const left = buffer.getChannelData(0)
      const right =
        buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left
      interleaved = new Float32Array(left.length)
      for (let i = 0; i < left.length; i++) {
        interleaved[i] = (left[i] + right[i]) / 2
      }
    }

    const dataLength = interleaved.length * (bitDepth / 8)
    const bufferLength = 44 + dataLength
    const arrayBuffer = new ArrayBuffer(bufferLength)
    const view = new DataView(arrayBuffer)

    // RIFF header
    this._writeString(view, 0, 'RIFF')
    view.setUint32(4, 36 + dataLength, true)
    this._writeString(view, 8, 'WAVE')

    // fmt chunk
    this._writeString(view, 12, 'fmt ')
    view.setUint32(16, 16, true) // chunk size
    view.setUint16(20, format, true)
    view.setUint16(22, 1, true) // mono
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true) // byte rate
    view.setUint16(32, numChannels * (bitDepth / 8), true) // block align
    view.setUint16(34, bitDepth, true)

    // data chunk
    this._writeString(view, 36, 'data')
    view.setUint32(40, dataLength, true)

    // Write PCM samples (clip to [-1, 1])
    let offset = 44
    for (let i = 0; i < interleaved.length; i++) {
      const sample = Math.max(-1, Math.min(1, interleaved[i]))
      const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7fff
      view.setInt16(offset, int16, true)
      offset += 2
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' })
  }

  private _writeString(view: DataView, offset: number, str: string): void {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i))
    }
  }
}

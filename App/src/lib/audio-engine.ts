// ============================================================
// Audio Engine — Web Audio API playback and microphone input
// ============================================================

import type { MelodyItem, MelodyNote, AudioEngineCallbacks, EffectType } from '@/types';

export type InstrumentType = 'sine' | 'piano' | 'organ' | 'strings' | 'synth';

export class AudioEngine {
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private micStream: MediaStream | null = null;
  private micAnalyser: AnalyserNode | null = null;
  private toneOscillator: OscillatorNode | null = null;
  private toneGain: GainNode | null = null;
  private isRecording = false;
  private isPlaying = false;
  private callbacks: AudioEngineCallbacks = {};
  private volume = 0.8;
  private currentInstrument: InstrumentType = 'sine';
  private _frequencyData = new Float32Array(0);
  private _timeData = new Float32Array(0);
  private _activeVoices = new Map<number, { oscillators: OscillatorNode[]; gains: GainNode[]; stopTime: number }>();

  // ============================================================
  // Lifecycle
  // ============================================================

  async init(): Promise<void> {
    if (this.audioCtx) return;

    this.audioCtx = new AudioContext();
    this.masterGain = this.audioCtx.createGain();
    this.masterGain.gain.value = this.volume;
    this.masterGain.connect(this.audioCtx.destination);

    // Initialize frequency data array with default size for visualizer
    if (this._frequencyData.length === 0) {
      this._frequencyData = new Float32Array(1024);
      this._timeData = new Float32Array(1024);
    }
  }

  /** Resume audio context if suspended (needed after user gesture) */
  async resume(): Promise<void> {
    if (this.audioCtx?.state === 'suspended') {
      await this.audioCtx.resume();
    }
  }

  /** Get the AudioContext */
  getAudioContext(): AudioContext | null {
    return this.audioCtx;
  }

  /** Get the sample rate */
  getSampleRate(): number {
    return this.audioCtx?.sampleRate ?? 44100;
  }

  // ============================================================
  // Volume
  // ============================================================

  setVolume(value: number): void {
    this.volume = Math.max(0, Math.min(1, value));
    if (this.masterGain) {
      this.masterGain.gain.value = this.volume;
    }
  }

  getVolume(): number {
    return this.volume;
  }

  // ============================================================
  // Instrument selection
  // ============================================================

  /** Set the instrument for note playback */
  setInstrument(type: InstrumentType): void {
    this.currentInstrument = type;
  }

  /** Get the current instrument */
  getInstrument(): InstrumentType {
    return this.currentInstrument;
  }

  /** Get available instrument names */
  getInstruments(): InstrumentType[] {
    return ['sine', 'piano', 'organ', 'strings', 'synth'];
  }

  // ============================================================
  // Count-in click
  // ============================================================

  /**
   * Play a short click sound for count-in beat
   */
  playClick(): void {
    if (!this.audioCtx || !this.masterGain) return;
    // Ensure AudioContext is ready
    this.resume().catch(() => {});

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.value = 880; // A5 click

    gain.gain.value = 0.3;
    gain.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(this.audioCtx.currentTime);
    osc.stop(this.audioCtx.currentTime + 0.05);
  }

  // ============================================================
  // Microphone
  // ============================================================

  async startMic(): Promise<boolean> {
    try {
      await this.init();
      await this.resume();

      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      const ctx = this.audioCtx;
      if (!ctx) return false;

      const source = ctx.createMediaStreamSource(this.micStream);

      this.micAnalyser = ctx.createAnalyser();
      this.micAnalyser.fftSize = 2048;
      this.micAnalyser.smoothingTimeConstant = 0.1;

      source.connect(this.micAnalyser);
      // Don't connect to destination — avoid feedback

      const bufferLength = this.micAnalyser.frequencyBinCount;
      this._frequencyData = new Float32Array(bufferLength);
      this._timeData = new Float32Array(bufferLength);

      this.isRecording = true;
      return true;
    } catch {
      return false;
    }
  }

  stopMic(): void {
    this.isRecording = false;

    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
    }

    this.micAnalyser = null;
    // Note: _frequencyData and _timeData intentionally not reset
    // They still contain valid data for the visualizer
  }

  isMicActive(): boolean {
    return this.isRecording;
  }

  /** Get frequency data from microphone (for pitch detection) */
  getFrequencyData(): Float32Array {
    if (this.micAnalyser) {
      this.micAnalyser.getFloatFrequencyData(this._frequencyData);
    }
    return this._frequencyData;
  }

  /** Get time-domain data from microphone */
  getTimeData(): Float32Array {
    if (this.micAnalyser) {
      this.micAnalyser.getFloatTimeDomainData(this._timeData);
    }
    return this._timeData;
  }

  // ============================================================
  // Tone / Oscillator playback
  // ============================================================

  /** Play a tone at the given frequency */
  async playTone(frequency: number, duration?: number): Promise<void> {
    await this.init();
    await this.resume();
    if (!this.audioCtx || !this.masterGain) return;

    // Stop any existing oscillator
    this.stopTone();

    this.toneOscillator = this.audioCtx.createOscillator();
    this.toneGain = this.audioCtx.createGain();

    this.toneOscillator.type = 'sine';
    this.toneOscillator.frequency.value = frequency;

    // Smooth ramp in
    this.toneGain.gain.setValueAtTime(0, this.audioCtx.currentTime);
    this.toneGain.gain.linearRampToValueAtTime(this.volume, this.audioCtx.currentTime + 0.01);

    this.toneOscillator.connect(this.toneGain);
    this.toneGain.connect(this.masterGain);
    this.toneOscillator.start();

    this.isPlaying = true;

    if (duration !== undefined) {
      const stopTime = this.audioCtx.currentTime + duration / 1000;
      this.toneGain.gain.setValueAtTime(this.volume, stopTime - 0.02);
      this.toneGain.gain.linearRampToValueAtTime(0, stopTime);
      this.toneOscillator.stop(stopTime);
      this.toneOscillator.onended = () => {
        this.isPlaying = false;
      };
    }
  }

  /** Stop the current tone */
  stopTone(): void {
    if (this.toneOscillator) {
      try {
        this.toneOscillator.stop();
        this.toneOscillator.disconnect();
      } catch {
        // already stopped
      }
      this.toneOscillator = null;
    }
    if (this.toneGain) {
      this.toneGain.disconnect();
      this.toneGain = null;
    }
    this.isPlaying = false;
  }

  /** Change the frequency of the current tone smoothly */
  setToneFrequency(frequency: number): void {
    if (this.toneOscillator && this.audioCtx) {
      this.toneOscillator.frequency.setTargetAtTime(
        frequency,
        this.audioCtx.currentTime,
        0.005
      );
    }
  }

  isTonePlaying(): boolean {
    return this.isPlaying;
  }

  // ============================================================
  // Note / melody playback
  // ============================================================

  /** Play a single note for a given duration (ms) */
  async playNote(frequency: number, durationMs: number, effectType?: EffectType): Promise<void> {
    await this.init();
    await this.resume();
    if (!this.audioCtx || !this.masterGain) return;

    const now = this.audioCtx.currentTime;
    const noteId = Date.now() + Math.random();

    // Create oscillators based on instrument
    const { oscillators, gain: mainGain } = this._createVoice(frequency, durationMs, effectType);

    mainGain.gain.setValueAtTime(0, now);
    mainGain.gain.linearRampToValueAtTime(this.volume, now + 0.01);

    for (const osc of oscillators) {
      osc.connect(mainGain);
      osc.start(now);
      osc.stop(now + durationMs / 1000 + 0.1);
    }
    mainGain.connect(this.masterGain);

    // Store voice reference
    this._activeVoices.set(noteId, {
      oscillators,
      gains: [mainGain],
      stopTime: now + durationMs / 1000,
    });

    // Auto-cleanup
    setTimeout(() => this._activeVoices.delete(noteId), durationMs + 200);
  }

  /**
   * Create oscillators for an instrument. Returns oscillators and a master gain node.
   */
  private _createVoice(freq: number, durationMs: number, effectType?: EffectType): { oscillators: OscillatorNode[]; gain: GainNode } {
    const ctx = this.audioCtx!;
    const now = ctx.currentTime;
    const dur = durationMs / 1000;

    const masterGain = ctx.createGain();
    const oscillators: OscillatorNode[] = [];

    switch (this.currentInstrument) {
      case 'piano': {
        // Piano: fundamental + harmonics (additive synthesis)
        const harmonics = [1, 2, 3, 4, 5, 6];
        const amplitudes = [1, 0.5, 0.3, 0.2, 0.1, 0.05];
        harmonics.forEach((h, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = freq * h;
          gain.gain.value = amplitudes[i] * 0.15;
          osc.connect(gain);
          gain.connect(masterGain);
          oscillators.push(osc);
        });
        // ADSR envelope for piano
        masterGain.gain.setValueAtTime(0, now);
        masterGain.gain.linearRampToValueAtTime(0.8, now + 0.01); // Attack
        masterGain.gain.exponentialRampToValueAtTime(0.4, now + 0.1); // Decay
        masterGain.gain.linearRampToValueAtTime(0.3, now + 0.2); // Sustain
        break;
      }
      case 'organ': {
        // Organ: fundamental + 5th + octave (drawbar style)
        const ratios = [1, 1.5, 2, 3, 4];
        const levels = [0.5, 0.3, 0.4, 0.2, 0.15];
        ratios.forEach((r, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = freq * r;
          gain.gain.value = levels[i] * 0.2;
          osc.connect(gain);
          gain.connect(masterGain);
          oscillators.push(osc);
        });
        masterGain.gain.setValueAtTime(0.7, now);
        break;
      }
      case 'strings': {
        // Strings: two detuned oscillators + warmth
        const detunes = [0, -8, 8];
        const levels = [0.4, 0.3, 0.3];
        detunes.forEach((detune, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.value = freq;
          osc.detune.value = detune;
          gain.gain.value = levels[i] * 0.1;
          osc.connect(gain);
          gain.connect(masterGain);
          oscillators.push(osc);
        });
        // Slow fade in/out for strings feel
        masterGain.gain.setValueAtTime(0, now);
        masterGain.gain.linearRampToValueAtTime(0.6, now + 0.1);
        masterGain.gain.setValueAtTime(0.6, now + dur - 0.1);
        masterGain.gain.linearRampToValueAtTime(0, now + dur);
        break;
      }
      case 'synth': {
        // Synth: square + sawtooth blend
        const osc1 = ctx.createOscillator();
        osc1.type = 'square';
        osc1.frequency.value = freq;
        const gain1 = ctx.createGain();
        gain1.gain.value = 0.08;
        osc1.connect(gain1);
        gain1.connect(masterGain);
        oscillators.push(osc1);

        const osc2 = ctx.createOscillator();
        osc2.type = 'sawtooth';
        osc2.frequency.value = freq;
        const gain2 = ctx.createGain();
        gain2.gain.value = 0.05;
        osc2.connect(gain2);
        gain2.connect(masterGain);
        oscillators.push(osc2);
        break;
      }
      default: {
        // Sine (default)
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        oscillators.push(osc);
        break;
      }
    }

    // Apply effect modulation to the primary oscillator (index 0)
    if (effectType && oscillators.length > 0) {
      this._applyEffectModulation(oscillators[0], effectType, freq, durationMs, now);
    }

    return { oscillators, gain: masterGain };
  }

  /**
   * Apply effect modulation (vibrato, slide, ease)
   */
  private _applyEffectModulation(
    osc: OscillatorNode,
    effectType: EffectType | undefined,
    freq: number,
    durationMs: number,
    now: number
  ): void {
    if (!effectType) return;

    const dur = durationMs / 1000;

    switch (effectType) {
      case 'vibrato': {
        // Vibrato: LFO modulates frequency ±5 cents for a wobble effect
        const lfo = this.audioCtx!.createOscillator();
        const lfoGain = this.audioCtx!.createGain();
        lfo.type = 'sine';
        lfo.frequency.value = 5; // 5 Hz wobble
        lfoGain.gain.value = freq * 0.003; // ±0.3% pitch wobble (~5 cents)
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        lfo.start(now);
        lfo.stop(now + dur);
        break;
      }
      case 'slide-up': {
        // Slide up: frequency ramps from -1 octave to +0.5 octave over duration
        osc.frequency.setValueAtTime(freq * 0.5, now);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + dur);
        break;
      }
      case 'slide-down': {
        // Slide down: frequency ramps from +1 octave to -0.5 octave over duration
        osc.frequency.setValueAtTime(freq * 2, now);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.75, now + dur);
        break;
      }
      case 'ease-in': {
        // Ease in: start flat, slide up in the second half of the note
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.25, now + dur);
        break;
      }
      case 'ease-out': {
        // Ease out: start at +0.5 octave, ease back to target frequency
        osc.frequency.setValueAtTime(freq * 1.5, now);
        osc.frequency.exponentialRampToValueAtTime(freq, now + dur);
        break;
      }
    }
  }

  /** Play a beep sound */
  playBeep(type: 'start' | 'stop' = 'start'): void {
    if (!this.audioCtx || !this.masterGain) {
      this.init().then(() => this._doPlayBeep(type));
      return;
    }
    this._doPlayBeep(type);
  }

  private _doPlayBeep(type: 'start' | 'stop'): void {
    if (!this.audioCtx || !this.masterGain) return;

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'square';
    osc.frequency.value = type === 'start' ? 600 : 400;
    gain.gain.setValueAtTime(0.2, this.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.audioCtx.currentTime + 0.1);
  }

  // ============================================================
  // Callbacks
  // ============================================================

  onNoteChange(callback: (note: MelodyNote, noteIndex: number) => void): void {
    this.callbacks.onNoteChange = callback;
  }

  onPlaybackEnd(callback: () => void): void {
    this.callbacks.onPlaybackEnd = callback;
  }

  protected emitNoteChange(note: MelodyNote, noteIndex: number): void {
    this.callbacks.onNoteChange?.(note, noteIndex);
  }

  protected emitPlaybackEnd(): void {
    this.callbacks.onPlaybackEnd?.();
  }

  // ============================================================
  // Cleanup
  // ============================================================

  destroy(): void {
    this.stopMic();
    this.stopTone();
    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = null;
    }
    this.masterGain = null;
  }
}

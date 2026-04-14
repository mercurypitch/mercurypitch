// ============================================================
// Audio Engine — Web Audio API playback and microphone input
// ============================================================

import type { MelodyItem, MelodyNote, AudioEngineCallbacks, EffectType } from '@/types';

export class AudioEngine {
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private micStream: MediaStream | null = null;
  private micAnalyser: AnalyserNode | null = null;
  private micContext: AudioContext | null = null;
  private toneOscillator: OscillatorNode | null = null;
  private toneGain: GainNode | null = null;
  private isRecording = false;
  private isPlaying = false;
  private callbacks: AudioEngineCallbacks = {};
  private volume = 0.8;
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
  // Microphone
  // ============================================================

  async startMic(): Promise<boolean> {
    try {
      await this.init();

      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      this.micContext = new AudioContext();
      const source = this.micContext.createMediaStreamSource(this.micStream);

      this.micAnalyser = this.micContext.createAnalyser();
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

    if (this.micContext) {
      this.micContext.close();
      this.micContext = null;
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
  playTone(frequency: number, duration?: number): void {
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
  playNote(frequency: number, durationMs: number, effectType?: EffectType): void {
    if (!this.audioCtx || !this.masterGain) return;

    const now = this.audioCtx.currentTime;
    const noteId = Date.now() + Math.random();

    // Create main oscillator
    const mainOsc = this.audioCtx.createOscillator();
    const mainGain = this.audioCtx.createGain();

    mainOsc.type = 'sine';
    mainOsc.frequency.value = frequency;

    // Fade in
    mainGain.gain.setValueAtTime(0, now);
    mainGain.gain.linearRampToValueAtTime(this.volume, now + 0.01);

    // Apply effect modulation
    this._applyEffectModulation(mainOsc, effectType, frequency, durationMs, now);

    mainOsc.connect(mainGain);
    mainGain.connect(this.masterGain);
    mainOsc.start();
    mainOsc.stop(now + durationMs / 1000 + 0.1);

    // Store voice reference
    this._activeVoices.set(noteId, {
      oscillators: [mainOsc],
      gains: [mainGain],
      stopTime: now + durationMs / 1000,
    });

    // Auto-cleanup
    setTimeout(() => this._activeVoices.delete(noteId), durationMs + 200);
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

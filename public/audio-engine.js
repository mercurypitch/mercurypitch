/**
 * Audio engine for PitchPerfect.
 * Handles microphone input, sample tone generation, and audio analysis.
 */
class AudioEngine {
    constructor() {
        this.audioCtx = null;
        this.analyser = null;
        this.micStream = null;
        this.micSource = null;
        this.micGain = null;
        this.isRecording = false;

        // Tone generation
        this.oscillator = null;
        this.oscGain = null;
        this.isPlaying = false;
        this.isPaused = false;

        // Analysis buffers
        this.bufferSize = 2048;
        this.timeBuffer = new Float32Array(this.bufferSize);
        this.freqBuffer = null;

        // Instrument synthesizer
        this.currentInstrument = 'sine';
        this._activeVoices = new Map(); // Note ID -> { oscillators, gain }
    }

    /**
     * Set the current instrument type.
     * Options: 'sine', 'piano', 'organ', 'strings', 'synth'
     */
    setInstrument(type) {
        this.currentInstrument = type;
    }

    /**
     * Get available instrument names.
     */
    getInstruments() {
        return ['sine', 'piano', 'organ', 'strings', 'synth'];
    }

    /**
     * Create a voice (oscillator stack) for an instrument.
     * Returns { oscillators, gain }
     */
    _createVoice(freq) {
        const ctx = this.audioCtx;
        const now = ctx.currentTime;

        const masterGain = ctx.createGain();
        masterGain.gain.value = 0;
        masterGain.connect(ctx.destination);

        const oscillators = [];

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
                    osc.start(now);
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
                    osc.start(now);
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
                    osc.start(now);
                    oscillators.push(osc);
                });
                // Slow attack
                masterGain.gain.setValueAtTime(0, now);
                masterGain.gain.linearRampToValueAtTime(0.6, now + 0.15);
                break;
            }
            case 'synth': {
                // Synth: square + sawtooth combo
                const osc1 = ctx.createOscillator();
                const gain1 = ctx.createGain();
                osc1.type = 'square';
                osc1.frequency.value = freq;
                gain1.gain.value = 0.08;
                osc1.connect(gain1);
                gain1.connect(masterGain);
                osc1.start(now);
                oscillators.push(osc1);

                const osc2 = ctx.createOscillator();
                const gain2 = ctx.createGain();
                osc2.type = 'sawtooth';
                osc2.frequency.value = freq;
                osc2.detune.value = 5;
                gain2.gain.value = 0.06;
                osc2.connect(gain2);
                gain2.connect(masterGain);
                osc2.start(now);
                oscillators.push(osc2);

                masterGain.gain.setValueAtTime(0.5, now);
                break;
            }
            default: // sine
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.value = freq;
                gain.gain.value = 0.15;
                osc.connect(gain);
                gain.connect(masterGain);
                osc.start(now);
                oscillators.push(osc);
                masterGain.gain.setValueAtTime(0.7, now);
                break;
        }

        return { oscillators, gain: masterGain };
    }

    /**
     * Play a note with the current instrument.
     * Returns a note ID for stopping.
     */
    playNote(freq, durationMs) {
        if (!this.audioCtx) return null;

        const noteId = Date.now() + Math.random();
        const voice = this._createVoice(freq);
        this._activeVoices.set(noteId, voice);

        // Auto-stop after duration
        if (durationMs) {
            setTimeout(() => this.stopNote(noteId), durationMs);
        }

        return noteId;
    }

    /**
     * Stop a specific note by ID.
     */
    stopNote(noteId) {
        const voice = this._activeVoices.get(noteId);
        if (!voice) return;

        const ctx = this.audioCtx;
        const now = ctx.currentTime;

        // Release envelope
        voice.gain.gain.cancelScheduledValues(now);
        voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
        voice.gain.gain.linearRampToValueAtTime(0, now + 0.1);

        // Stop oscillators after release
        setTimeout(() => {
            voice.oscillators.forEach(osc => {
                try { osc.stop(); osc.disconnect(); } catch (e) {}
            });
            try { voice.gain.disconnect(); } catch (e) {}
        }, 150);

        this._activeVoices.delete(noteId);
    }

    /**
     * Stop all active notes.
     */
    stopAllNotes() {
        this._activeVoices.forEach((voice, noteId) => {
            this.stopNote(noteId);
        });
    }

    /**
     * Initialize audio context (must be called from user gesture).
     */
    async init() {
        if (this.audioCtx) return;

        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: 44100
        });

        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = this.bufferSize * 2;
        this.analyser.smoothingTimeConstant = 0.1;
        this.freqBuffer = new Uint8Array(this.analyser.frequencyBinCount);
    }

    /**
     * Start microphone input.
     */
    async startMic() {
        await this.init();

        if (this.isRecording) return;

        try {
            this.micStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            });

            this.micSource = this.audioCtx.createMediaStreamSource(this.micStream);
            this.micGain = this.audioCtx.createGain();
            this.micGain.gain.value = 1.0;

            this.micSource.connect(this.micGain);
            this.micGain.connect(this.analyser);

            this.isRecording = true;
            return true;
        } catch (err) {
            console.error('Microphone access denied:', err);
            return false;
        }
    }

    /**
     * Stop microphone input.
     */
    stopMic() {
        if (this.micSource) {
            this.micSource.disconnect();
            this.micSource = null;
        }
        if (this.micGain) {
            this.micGain.disconnect();
            this.micGain = null;
        }
        if (this.micStream) {
            this.micStream.getTracks().forEach(t => t.stop());
            this.micStream = null;
        }
        this.isRecording = false;
    }

    /**
     * Play a sine tone at the given frequency.
     * Used for the sample melody playback.
     */
    playTone(freq) {
        if (!this.audioCtx) return;

        this.stopTone();

        this.oscillator = this.audioCtx.createOscillator();
        this.oscGain = this.audioCtx.createGain();

        this.oscillator.type = 'sine';
        this.oscillator.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
        this.oscGain.gain.setValueAtTime(0, this.audioCtx.currentTime);
        let targetGain = this._toneVolume !== undefined ? this._toneVolume : 0.15;
        this.oscGain.gain.linearRampToValueAtTime(targetGain, this.audioCtx.currentTime + 0.02);

        this.oscillator.connect(this.oscGain);
        this.oscGain.connect(this.audioCtx.destination);
        this.oscillator.start();
        this.isPlaying = true;
    }

    /**
     * Set the tone volume (0.0 - 1.0). Applies immediately to active oscillator.
     */
    setVolume(vol) {
        this._toneVolume = Math.max(0, Math.min(1, vol));
        if (this.oscGain && this.isPlaying) {
            this.oscGain.gain.linearRampToValueAtTime(this._toneVolume, this.audioCtx.currentTime + 0.02);
        }
    }

    /**
     * Smoothly transition to a new frequency.
     */
    setToneFreq(freq) {
        if (this.oscillator && this.isPlaying) {
            this.oscillator.frequency.linearRampToValueAtTime(
                freq, this.audioCtx.currentTime + 0.03
            );
        }
    }

    /**
     * Stop the oscillator tone.
     */
    stopTone() {
        if (this.oscillator) {
            if (this.oscGain) {
                this.oscGain.gain.linearRampToValueAtTime(0, this.audioCtx.currentTime + 0.02);
            }
            setTimeout(() => {
                try {
                    this.oscillator.stop();
                    this.oscillator.disconnect();
                } catch (e) {}
                this.oscillator = null;
            }, 30);
        }
        if (this.oscGain) {
            setTimeout(() => {
                try { this.oscGain.disconnect(); } catch (e) {}
                this.oscGain = null;
            }, 30);
        }
        this.isPlaying = false;
    }

    /**
     * Get the current time-domain audio buffer for pitch detection.
     */
    getTimeData() {
        if (!this.analyser) return this.timeBuffer;
        this.analyser.getFloatTimeDomainData(this.timeBuffer);
        return this.timeBuffer;
    }

    /**
     * Get the current frequency-domain data for visualization.
     */
    getFreqData() {
        if (!this.analyser) return this.freqBuffer;
        this.analyser.getByteFrequencyData(this.freqBuffer);
        return this.freqBuffer;
    }

    /**
     * Get the audio context sample rate.
     */
    getSampleRate() {
        return this.audioCtx ? this.audioCtx.sampleRate : 44100;
    }

    /**
     * Resume audio context if suspended (required after user gesture).
     */
    async resume() {
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            await this.audioCtx.resume();
        }
    }
}

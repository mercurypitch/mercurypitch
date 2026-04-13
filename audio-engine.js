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

/**
 * Pitch detection using YIN algorithm with improved stability.
 * YIN is the same algorithm used internally by aubio - it's considered
 * one of the best time-domain pitch detection algorithms available.
 *
 * Reference: "YIN, a fundamental frequency estimator for speech and music"
 * by Alain de Cheveigne and Hideki Kawahara (2002).
 */
class PitchDetector {
    /**
     * @param {number} sampleRate - Audio sample rate in Hz
     * @param {number} bufferSize - Analysis buffer size (power of 2)
     * @param {number} threshold - YIN threshold (0.05 - 0.20, lower = more selective)
     * @param {number} sensitivity - Sensitivity level 1-10 (higher = more sensitive)
     */
    constructor(sampleRate = 44100, bufferSize = 2048, threshold = 0.10, sensitivity = 5) {
        this.sampleRate = sampleRate;
        this.bufferSize = bufferSize;
        this.threshold = threshold;
        this.sensitivity = sensitivity;
        this.halfBuffer = Math.floor(bufferSize / 2);

        // Pre-allocate working arrays
        this.yinBuffer = new Float32Array(this.halfBuffer);

        // Frequency range limits (MIDI note range roughly C2 to C7)
        this.minFreq = 65;   // ~C2
        this.maxFreq = 2100; // ~C7

        // Smoothing state
        this.prevPitch = 0;
        this.prevPrevPitch = 0;
        this.confidence = 0;

        // Running average for stability
        this.pitchHistory = [];
        this.maxHistoryLen = 5;
    }

    /**
     * Update sensitivity level (1-10)
     */
    setSensitivity(level) {
        this.sensitivity = Math.max(1, Math.min(10, level));
    }

    /**
     * Detect pitch from a Float32Array audio buffer.
     * Returns { freq, confidence } or { freq: 0, confidence: 0 } if no pitch found.
     */
    detect(audioBuffer) {
        const buf = audioBuffer;
        const len = this.halfBuffer;
        const yinBuf = this.yinBuffer;

        // Calculate amplitude threshold based on sensitivity
        // Higher sensitivity = lower threshold = catches quieter signals
        const amplitudeThreshold = 0.02 - (this.sensitivity * 0.0018);

        // Step 1: Check if signal is loud enough (RMS)
        let rms = 0;
        let maxSample = 0;
        for (let i = 0; i < buf.length; i++) {
            const s = buf[i];
            rms += s * s;
            const abs = s < 0 ? -s : s;
            if (abs > maxSample) maxSample = abs;
        }
        rms = Math.sqrt(rms / buf.length);

        // Amplitude check based on sensitivity
        if (maxSample < amplitudeThreshold) {
            this.confidence = 0;
            this.prevPrevPitch = this.prevPitch;
            this.prevPitch = 0;
            this.pitchHistory = [];
            return { freq: 0, confidence: 0 };
        }

        // Step 2: Compute the difference function
        for (let tau = 1; tau < len; tau++) {
            let delta = 0;
            const limit = len - tau;
            for (let j = 0; j < limit; j++) {
                const diff = buf[j] - buf[j + tau];
                delta += diff * diff;
            }
            yinBuf[tau] = delta;
        }

        // Step 3: Cumulative mean normalized difference function
        yinBuf[0] = 1;
        let runningSum = 0;

        for (let tau = 1; tau < len; tau++) {
            runningSum += yinBuf[tau];
            yinBuf[tau] = tau * yinBuf[tau] / runningSum;
        }

        // Step 4: Absolute threshold - find the first dip below threshold
        // Adjust threshold based on sensitivity (lower sens = stricter)
        const adjustedThreshold = this.threshold + (0.15 - (this.sensitivity * 0.012));
        let tauEstimate = -1;
        const minTau = Math.max(1, Math.floor(this.sampleRate / this.maxFreq));
        const maxTau = Math.min(Math.floor(this.sampleRate / this.minFreq), len - 1);

        for (let tau = minTau; tau < maxTau; tau++) {
            if (yinBuf[tau] < adjustedThreshold) {
                // Refine: find the local minimum around this dip
                let bestTau = tau;
                let bestVal = yinBuf[tau];
                while (bestTau + 1 < maxTau && yinBuf[bestTau + 1] < bestVal) {
                    bestTau++;
                    bestVal = yinBuf[bestTau];
                }
                tauEstimate = bestTau;
                break;
            }
        }

        // No pitch found
        if (tauEstimate === -1) {
            this.confidence = 0;
            this.prevPrevPitch = this.prevPitch;
            this.prevPitch = 0;
            return { freq: 0, confidence: 0 };
        }

        // Step 5: Parabolic interpolation for sub-sample accuracy
        const x0 = tauEstimate - 1 < 1 ? 1 : tauEstimate - 1;
        const x2 = tauEstimate + 1 >= len ? tauEstimate : tauEstimate + 1;

        let betterTau;
        if (x0 === tauEstimate) {
            betterTau = yinBuf[tauEstimate] <= yinBuf[x2] ? tauEstimate : x2;
        } else if (x2 === tauEstimate) {
            betterTau = yinBuf[tauEstimate] <= yinBuf[x0] ? tauEstimate : x0;
        } else {
            const s0 = yinBuf[x0];
            const s1 = yinBuf[tauEstimate];
            const s2 = yinBuf[x2];
            betterTau = tauEstimate + (s2 - s0) / (2 * (2 * s1 - s2 - s0));
        }

        // Clamp to valid range
        betterTau = Math.max(1, Math.min(len - 1, betterTau));

        const freq = this.sampleRate / betterTau;
        const conf = 1 - yinBuf[tauEstimate];
        this.confidence = Math.max(0, Math.min(1, conf));

        // Improved stability: require minimum confidence based on sensitivity
        // Lower sensitivity = higher confidence required
        const minConfidence = 0.7 - (this.sensitivity * 0.04);
        if (this.confidence < minConfidence) {
            return { freq: 0, confidence: 0 };
        }

        // Multi-stage smoothing for stability
        // Add to history and compute weighted average
        this.pitchHistory.push(freq);
        if (this.pitchHistory.length > this.maxHistoryLen) {
            this.pitchHistory.shift();
        }

        // Compute median-like average (sort and pick middle-ish value)
        const sortedHistory = this.pitchHistory.slice().sort(function(a, b) { return a - b; });
        let stabilizedFreq;
        if (sortedHistory.length >= 3) {
            // Use average of middle values for more stability
            const midStart = Math.floor(sortedHistory.length * 0.25);
            const midEnd = Math.floor(sortedHistory.length * 0.75);
            let sum = 0;
            for (let i = midStart; i <= midEnd && i < sortedHistory.length; i++) {
                sum += sortedHistory[i];
            }
            stabilizedFreq = sum / (midEnd - midStart + 1);
        } else {
            // For short history, use simple average
            let sum = 0;
            for (let i = 0; i < sortedHistory.length; i++) {
                sum += sortedHistory[i];
            }
            stabilizedFreq = sum / sortedHistory.length;
        }

        // Reject outliers: if candidate is too far from history average, blend more conservatively
        if (this.prevPitch > 0) {
            const maxDeviation = this.prevPitch * (0.25 - (this.sensitivity * 0.015));
            if (Math.abs(stabilizedFreq - this.prevPitch) > maxDeviation) {
                // Blend towards previous pitch for stability
                stabilizedFreq = this.prevPitch * 0.7 + stabilizedFreq * 0.3;
            }
        }

        this.prevPrevPitch = this.prevPitch;
        this.prevPitch = stabilizedFreq;
        return { freq: stabilizedFreq, confidence: this.confidence };
    }
}

// ============================================================
// STFT Engine — PyTorch-compatible STFT/iSTFT
// Uses Bluestein's algorithm (chirp Z-transform) to handle
// arbitrary n_fft values (not just powers of 2).
// Exports: stftForward, stftInverse, periodicHannWindow
// ============================================================

/** Result of forward STFT computation. */
export interface StftResult {
  /** Interleaved real/imag data, length = nFreq * nFrames * 2.
   *  Layout: data[frame * nFreq * 2 + freq * 2 + 0] = real
   *          data[frame * nFreq * 2 + freq * 2 + 1] = imag */
  data: Float32Array
  nFreq: number    // nFft / 2 + 1
  nFrames: number  // number of time frames
  nFft: number
  hopLength: number
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function nextPowerOf2(n: number): number {
  return 2 ** Math.ceil(Math.log2(n))
}

/**
 * In-place radix-2 Cooley-Tukey FFT on interleaved complex data.
 * data.length = 2 * n (alternating real, imag pairs).
 */
function complexFFT(data: Float64Array, n: number, inverse: boolean): void {
  const bits = Math.log2(n)
  // Bit-reversal permutation
  for (let i = 0; i < n; i++) {
    let rev = 0
    let val = i
    for (let b = 0; b < bits; b++) {
      rev = (rev << 1) | (val & 1)
      val >>= 1
    }
    if (rev > i) {
      const ri = i * 2
      const rr = rev * 2
      let tmp = data[ri]
      data[ri] = data[rr]
      data[rr] = tmp
      tmp = data[ri + 1]
      data[ri + 1] = data[rr + 1]
      data[rr + 1] = tmp
    }
  }

  // Cooley-Tukey butterflies
  const sign = inverse ? 1 : -1
  for (let step = 2; step <= n; step <<= 1) {
    const halfStep = step / 2
    const angle = (sign * Math.PI) / halfStep
    const wRe = Math.cos(angle)
    const wIm = Math.sin(angle)

    for (let block = 0; block < n; block += step) {
      let twRe = 1
      let twIm = 0

      for (let k = 0; k < halfStep; k++) {
        const evenR = data[(block + k) * 2]
        const evenI = data[(block + k) * 2 + 1]
        const oddR = data[(block + k + halfStep) * 2]
        const oddI = data[(block + k + halfStep) * 2 + 1]

        const tRe = oddR * twRe - oddI * twIm
        const tIm = oddR * twIm + oddI * twRe

        data[(block + k) * 2] = evenR + tRe
        data[(block + k) * 2 + 1] = evenI + tIm
        data[(block + k + halfStep) * 2] = evenR - tRe
        data[(block + k + halfStep) * 2 + 1] = evenI - tIm

        const nextTwRe = twRe * wRe - twIm * wIm
        const nextTwIm = twRe * wIm + twIm * wRe
        twRe = nextTwRe
        twIm = nextTwIm
      }
    }
  }
}

/**
 * Bluestein's chirp Z-transform — computes DFT of arbitrary length N
 * by reducing it to a convolution computed via power-of-2 FFTs.
 *
 * Input:  real[n], imag[n] (time domain)
 * Output: real[n], imag[n] (frequency domain), overwrites input buffers
 */
function bluesteinDFT(
  real: Float64Array,
  imag: Float64Array,
  n: number,
  inverse: boolean,
): void {
  if (n <= 1) return

  const m = nextPowerOf2(2 * n - 1)
  const sign = inverse ? 1 : -1
  const angleFactor = (sign * Math.PI) / n

  // chirp[k] = exp(j * angleFactor * k²)
  const chirpRe = new Float64Array(n)
  const chirpIm = new Float64Array(n)
  for (let k = 0; k < n; k++) {
    const angle = angleFactor * k * k
    chirpRe[k] = Math.cos(angle)
    chirpIm[k] = Math.sin(angle)
  }

  // a[k] = x[k] * chirp[k]
  const aRe = new Float64Array(m)
  const aIm = new Float64Array(m)
  for (let k = 0; k < n; k++) {
    aRe[k] = real[k] * chirpRe[k] - imag[k] * chirpIm[k]
    aIm[k] = real[k] * chirpIm[k] + imag[k] * chirpRe[k]
  }

  // b[k] = conj(chirp[k]) for k=0..n-1
  // b[m-k] = conj(chirp[k]) for k=1..n-1 (wrap negative indices)
  const bRe = new Float64Array(m)
  const bIm = new Float64Array(m)
  bRe[0] = chirpRe[0]
  bIm[0] = -chirpIm[0]
  for (let k = 1; k < n; k++) {
    bRe[k] = chirpRe[k]
    bIm[k] = -chirpIm[k]
    bRe[m - k] = chirpRe[k]
    bIm[m - k] = -chirpIm[k]
  }

  // FFT of a and b
  const aComplex = new Float64Array(m * 2)
  const bComplex = new Float64Array(m * 2)
  for (let i = 0; i < m; i++) {
    aComplex[i * 2] = aRe[i]
    aComplex[i * 2 + 1] = aIm[i]
    bComplex[i * 2] = bRe[i]
    bComplex[i * 2 + 1] = bIm[i]
  }

  complexFFT(aComplex, m, false)
  complexFFT(bComplex, m, false)

  // C = A ⊙ B (pointwise complex multiply)
  const cComplex = new Float64Array(m * 2)
  for (let i = 0; i < m; i++) {
    const aR = aComplex[i * 2]
    const aI = aComplex[i * 2 + 1]
    const bR = bComplex[i * 2]
    const bI = bComplex[i * 2 + 1]
    cComplex[i * 2] = aR * bR - aI * bI
    cComplex[i * 2 + 1] = aR * bI + aI * bR
  }

  // c = IFFT(C), then X[k] = chirp[k] * c[k] / m
  complexFFT(cComplex, m, true)

  for (let k = 0; k < n; k++) {
    const cr = cComplex[k * 2] / m
    const ci = cComplex[k * 2 + 1] / m
    real[k] = cr * chirpRe[k] - ci * chirpIm[k]
    imag[k] = cr * chirpIm[k] + ci * chirpRe[k]
  }

  // For inverse DFT, divide by N
  if (inverse) {
    for (let k = 0; k < n; k++) {
      real[k] /= n
      imag[k] /= n
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Periodic Hann window matching `torch.hann_window(N, periodic=True)`.
 * Formula: 0.5 * (1 - cos(2π * n / N)) for n = 0..N-1
 */
export function periodicHannWindow(nFft: number): Float32Array {
  const win = new Float32Array(nFft)
  for (let i = 0; i < nFft; i++) {
    win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / nFft))
  }
  return win
}

/**
 * Forward STFT matching PyTorch's `torch.stft`:
 *   torch.stft(input, n_fft, hop_length, window=torch.hann_window(n_fft, periodic=True),
 *              center=True, return_complex=True)
 *
 * @param audio  Mono audio samples (Float32Array)
 * @param nFft   FFT size (can be non-power-of-2, uses Bluestein's algorithm)
 * @param hopLength  Hop length between successive frames
 * @returns StftResult with interleaved complex spectrogram data
 */
export function stftForward(
  audio: Float32Array,
  nFft: number,
  hopLength: number,
): StftResult {
  const window = periodicHannWindow(nFft)
  const padSize = nFft / 2
  const paddedLen = audio.length + nFft // padSize on each side = nFft total
  const nFrames = Math.max(1, Math.floor((paddedLen - nFft) / hopLength) + 1)
  const nFreq = Math.floor(nFft / 2) + 1

  // Build padded signal (center=True: nFft/2 zeros at start and end)
  const padded = new Float64Array(paddedLen)
  padded.fill(0)
  for (let i = 0; i < audio.length; i++) {
    padded[i + padSize] = audio[i]
  }

  const result = new Float32Array(nFreq * nFrames * 2)

  for (let frame = 0; frame < nFrames; frame++) {
    const offset = frame * hopLength

    // Extract windowed frame
    const real = new Float64Array(nFft)
    const imag = new Float64Array(nFft) // zeros
    for (let i = 0; i < nFft; i++) {
      real[i] = padded[offset + i] * window[i]
    }

    // Compute DFT
    bluesteinDFT(real, imag, nFft, false)

    // Store only first nFreq bins (the rest are conjugate symmetric for real input)
    const frameBase = frame * nFreq * 2
    for (let f = 0; f < nFreq; f++) {
      result[frameBase + f * 2] = real[f]
      result[frameBase + f * 2 + 1] = imag[f]
    }
  }

  return { data: result, nFreq, nFrames, nFft, hopLength }
}

/**
 * Inverse STFT matching PyTorch's `torch.istft`:
 *   torch.istft(stft, n_fft, hop_length, window=torch.hann_window(n_fft, periodic=True),
 *               center=True)
 *
 * @param stft     StftResult from stftForward (or compatible structure)
 * @param origLen  Optional: length of original audio (before center padding).
 *                 If omitted, returns the full reconstructed signal.
 * @returns Reconstructed mono audio (Float32Array)
 */
export function stftInverse(
  stft: StftResult,
  origLen?: number,
): Float32Array {
  const { data, nFreq, nFrames, nFft, hopLength } = stft
  const window = periodicHannWindow(nFft)
  const padSize = nFft / 2
  const sigLen = (nFrames - 1) * hopLength + nFft

  // Overlap-add accumulator + window weight normalizer
  const accum = new Float64Array(sigLen)
  const weights = new Float64Array(sigLen)

  for (let frame = 0; frame < nFrames; frame++) {
    const frameBase = frame * nFreq * 2

    // Extract complex spectrum, reconstruct full nFft freq bins via conjugate symmetry
    const real = new Float64Array(nFft)
    const imag = new Float64Array(nFft)
    for (let f = 0; f < nFreq; f++) {
      real[f] = data[frameBase + f * 2]
      imag[f] = data[frameBase + f * 2 + 1]
    }
    // Fill conjugate-symmetric bins for k > N/2
    for (let f = 1; f < nFreq - 1; f++) {
      real[nFft - f] = real[f]
      imag[nFft - f] = -imag[f]
    }

    // Inverse DFT
    bluesteinDFT(real, imag, nFft, true)

    // Apply window and overlap-add
    const offset = frame * hopLength
    for (let i = 0; i < nFft; i++) {
      const w = window[i]
      accum[offset + i] += real[i] * w
      weights[offset + i] += w * w
    }
  }

  // Normalize by window overlap weights
  const totalLen = origLen ?? (sigLen - nFft) // strip center padding by default
  const output = new Float32Array(totalLen)
  const start = origLen !== undefined ? padSize : 0
  const end = origLen !== undefined ? padSize + totalLen : totalLen

  for (let i = start; i < end && i - start < totalLen; i++) {
    if (weights[i] > 1e-10) {
      output[i - start] = accum[i] / weights[i]
    }
  }

  return output
}

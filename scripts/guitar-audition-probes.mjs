// Guitar audition probes — coherent spectral and dynamic measurements, not sound-quality scores.
import { createAuditionHead } from './guitar-audition-head.mjs'

/** Exact-frequency DFT power of a coherent, one-second window (sinusoid RMS squared). */
export function binPower(pcm, rate, frequency, from = rate / 4) {
  if (
    !Number.isInteger(rate) ||
    rate <= 0 ||
    !Number.isInteger(from) ||
    from < 0 ||
    pcm.length < from + rate ||
    !Number.isInteger(frequency) ||
    frequency <= 0 ||
    frequency >= rate / 2
  )
    throw new Error(
      'Coherent probe requires a full second, integer bin and valid offset/rate',
    )
  let real = 0
  let imaginary = 0
  for (let index = 0; index < rate; index++) {
    const sample = pcm[from + index]
    if (!Number.isFinite(sample)) throw new Error('Nonfinite spectral input')
    const phase = (2 * Math.PI * frequency * index) / rate
    real += sample * Math.cos(phase)
    imaginary += sample * Math.sin(phase)
  }
  return (2 * (real * real + imaginary * imaginary)) / (rate * rate)
}

function powerDb(ratio) {
  if (!Number.isFinite(ratio) || ratio < 0)
    throw new Error('Invalid measured power ratio')
  return ratio > 0 ? 10 * Math.log10(ratio) : null
}

export async function measureHeadDefinition(profile, rate = 48000) {
  if (![44100, 48000].includes(rate)) throw new Error('Unsupported probe rate')
  const power = (pcm, frequency) => binPower(pcm, rate, frequency, rate)

  async function render(frequencies, amplitude) {
    const context = new OfflineAudioContext(1, rate * 2.5, rate)
    const source = context.createBufferSource()
    source.buffer = context.createBuffer(1, rate * 2.5, rate)
    const pcm = source.buffer.getChannelData(0)
    for (let index = 0; index < pcm.length; index++)
      pcm[index] = frequencies.reduce(
        (sum, frequency) =>
          sum + amplitude * Math.sin((2 * Math.PI * frequency * index) / rate),
        0,
      )
    const head = createAuditionHead(context, { profile })
    const envelope = context.createGain()
    envelope.gain.setValueAtTime(0.0001, 0)
    envelope.gain.exponentialRampToValueAtTime(1, 0.09)
    source.connect(envelope)
    envelope.connect(head.input)
    head.output.connect(context.destination)
    source.start()
    const rendered = (await context.startRendering()).getChannelData(0)
    source.disconnect()
    envelope.disconnect()
    head.dispose()
    if (!rendered.every(Number.isFinite))
      throw new Error('Nonfinite head probe output')
    return rendered
  }
  const pairs = []
  for (const [low, high] of [
    [110, 173],
    [220, 349],
  ]) {
    const measurements = []
    for (const amplitude of [0.0125, 0.05]) {
      const signal = await render([low, high], amplitude)
      const fundamentals = power(signal, low) + power(signal, high)
      if (fundamentals <= 1e-12)
        throw new Error('Head probe lost its fundamentals')
      const productHz = [
        high - low,
        2 * low - high,
        2 * high - low,
        high + low,
        2 * low + high,
        2 * high + low,
      ]
      const selectedImPower = productHz.reduce(
        (sum, frequency) => sum + power(signal, frequency),
        0,
      )
      measurements.push({
        amplitudePerTone: amplitude,
        fundamentalRms: Math.sqrt(fundamentals),
        selectedImRatioDb: powerDb(selectedImPower / fundamentals),
        productHz,
      })
    }
    pairs.push({
      frequencies: [low, high],
      measurements,
      inputStepDb: 20 * Math.log10(4),
      outputFundamentalStepDb:
        20 *
        Math.log10(
          measurements[1].fundamentalRms / measurements[0].fundamentalRms,
        ),
    })
  }
  const single = await render([220], 0.05)
  const fundamental = power(single, 220)
  if (fundamental <= 1e-12) throw new Error('Head probe lost its fundamental')
  const harmonicPower = [2, 3, 4, 5, 6, 7, 8, 9].reduce(
    (sum, harmonic) => sum + power(single, harmonic * 220),
    0,
  )
  const stress = await render([110, 173], 1)
  return {
    profile,
    sampleRate: rate,
    pairs,
    singleTone: {
      frequency: 220,
      amplitude: 0.05,
      harmonics2To9RatioDb: powerDb(harmonicPower / fundamental),
    },
    stressPeak: stress.reduce(
      (peak, sample) => Math.max(peak, Math.abs(sample)),
      0,
    ),
    method:
      'Head only; same input gain and no output matching; coherent one-second DFT after one-second settling. Selected second/third-order intermodulation products relative to fundamentals, not total IMD/THD or perceptual quality. No speaker, aliasing or CPU benchmark.',
  }
}

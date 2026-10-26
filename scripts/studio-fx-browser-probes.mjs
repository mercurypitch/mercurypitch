// Studio FX browser probes: real OfflineAudioContext renders through the Studio FX graphs.
// Imported by scripts/check-studio-fx-browser.mjs inside a page served by the Vite dev server.
import { autoMixChain, createStudioFxChain, DEFAULT_TARGET_LUFS, MASTER_CHAIN_PRESET, measureChainLatencyFrames, measureLoudness, normalizeEffectParams, REFERENCE_LUFS, renderMasteredMix, renderThroughChain, STUDIO_FX_PRESETS, } from '/src/lib/studio-fx/index.ts'
import { compressorAutoMakeupGain } from '/src/lib/studio-fx/compressor-curve.ts'
import { dbToGain } from '/src/lib/studio-fx/dsp.ts'
import { createIdentityShaperPath, createNullCompressor, } from '/src/lib/studio-fx/effect-shell.ts'
import { createEffectUnit } from '/src/lib/studio-fx/effects/index.ts'

export const SR = 48000
/** Late enough that every DynamicsCompressorNode has finished fading in. */
const SETTLED = Math.round(0.6 * SR)
const FREQS = [
  40, 80, 150, 300, 600, 1000, 2000, 3000, 4500, 6000, 7000, 8000, 10000, 12000,
  16000,
]
const env = {
  isLive: () => false,
  schedule: (callback, ms) => {
    const handle = setTimeout(callback, ms)
    return () => clearTimeout(handle)
  },
}
export const db = (gain) => 20 * Math.log10(Math.max(1e-12, gain))
export const round = (value, digits = 3) => Number(value.toFixed(digits))

async function render({ seconds, input, build }) {
  const length = Math.round(seconds * SR)
  const ctx = new OfflineAudioContext({
    numberOfChannels: 2,
    length,
    sampleRate: SR,
  })
  const buffer = ctx.createBuffer(1, length, SR)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) data[i] = input(i)
  const source = ctx.createBufferSource()
  source.buffer = buffer
  const { inNode, outNode } = build(ctx)
  source.connect(inNode)
  outNode.connect(ctx.destination)
  source.start(0)
  return ctx.startRendering()
}

const effect = (kind, params = {}) => ({
  id: kind,
  kind,
  enabled: true,
  params: normalizeEffectParams(kind, params),
})
const unit = (spec) => (ctx) => {
  const built = createEffectUnit(ctx, spec, env)
  return { inNode: built.input, outNode: built.output }
}
const node = (make) => (ctx) => {
  const built = make(ctx)
  return { inNode: built, outNode: built }
}

export function rms(data, from, to) {
  let sum = 0
  for (let i = from; i < to; i++) sum += data[i] * data[i]
  return Math.sqrt(sum / Math.max(1, to - from))
}

function peakIndex(data, from = 0) {
  let best = from
  for (let i = from + 1; i < data.length; i++)
    if (Math.abs(data[i]) > Math.abs(data[best])) best = i
  return best
}

export function magnitude(data, freq, from, to) {
  let re = 0
  let im = 0
  for (let n = from; n < to; n++) {
    const w = (2 * Math.PI * freq * (n - from)) / SR
    re += data[n] * Math.cos(w)
    im -= data[n] * Math.sin(w)
  }
  return Math.hypot(re, im)
}

/** Magnitude response, in dB, from a small impulse sent once the graph has settled. */
async function response(build, freqs = FREQS) {
  const amp = 0.001
  const out = await render({
    seconds: 1,
    input: (i) => (i === SETTLED ? amp : 0),
    build,
  })
  const y = out.getChannelData(0)
  return freqs.map((f) => ({
    f,
    db: round(db(magnitude(y, f, SETTLED, y.length) / amp), 4),
  }))
}

const spread = (rows) =>
  Math.max(...rows.map((r) => r.db)) - Math.min(...rows.map((r) => r.db))

async function toneGainDb(build, freq, levelDb) {
  const amp = dbToGain(levelDb)
  const out = await render({
    seconds: 1,
    input: (i) => amp * Math.sin((2 * Math.PI * freq * i) / SR),
    build,
  })
  return db(rms(out.getChannelData(0), SR / 2, SR) / (amp / Math.SQRT2))
}

async function makeupProbe() {
  const cases = [
    [-10, 0, 2],
    [-18, 6, 3],
    [-24, 30, 12],
    [-24, 0, 4],
    [-40, 6, 8],
    [-30, 3, 6],
    [-2.5, 0, 20],
    [-20, 10, 2.5],
  ]
  const rows = []
  for (const [threshold, knee, ratio] of cases) {
    const measured = await toneGainDb(
      node((ctx) => {
        const c = ctx.createDynamicsCompressor()
        c.threshold.value = threshold
        c.knee.value = knee
        c.ratio.value = ratio
        return c
      }),
      1000,
      -70,
    )
    const predicted = db(compressorAutoMakeupGain(threshold, knee, ratio))
    rows.push({
      threshold,
      knee,
      ratio,
      measuredDb: round(measured),
      errorDb: round(measured - predicted),
    })
  }
  return { pass: rows.every((r) => Math.abs(r.errorDb) < 0.01), rows }
}

async function latencyProbe() {
  const impulseAt = async (build) => {
    const out = await render({
      seconds: 1,
      input: (i) => (i === SETTLED ? 0.01 : 0),
      build,
    })
    const y = out.getChannelData(0)
    const at = peakIndex(y)
    return {
      frames: at - SETTLED,
      gainDb: round(db(Math.abs(y[at]) / 0.01), 4),
    }
  }
  const compressor = await impulseAt(
    node((ctx) => ctx.createDynamicsCompressor()),
  )
  const twin = await impulseAt(node((ctx) => createNullCompressor(ctx)))
  const shaper = await impulseAt((ctx) => {
    const path = createIdentityShaperPath(ctx)
    return { inNode: path.input, outNode: path.output }
  })
  return {
    pass: compressor.frames === twin.frames && Math.abs(twin.gainDb) < 0.01,
    compressor,
    nullCompressor: twin,
    identityShaper: shaper,
  }
}

async function parallelProbe() {
  const compressorMix = await response(unit(effect('compressor', { mix: 50 })))
  const deesser = await response(unit(effect('deesser')))
  const saturationMix = await response(
    unit(effect('saturation', { driveDb: 0, mix: 50 })),
    FREQS.filter((f) => f <= 12000),
  )
  const eq = await response(unit(effect('eq')))
  const unity = (await response(unit(effect('compressor')), [1000]))[0].db
  const spreads = {
    compressorMix: round(spread(compressorMix)),
    deesser: round(spread(deesser)),
    saturationMix: round(spread(saturationMix)),
    defaultEq: round(spread(eq), 4),
    compressorBelowThresholdDb: unity,
  }
  const pass =
    spreads.compressorMix < 0.1 &&
    spreads.deesser < 0.2 &&
    spreads.saturationMix < 0.3 &&
    spreads.defaultEq < 0.01 &&
    Math.abs(unity) < 0.05
  return { pass, spreads }
}

async function deesserProbe() {
  const build = unit(
    effect('deesser', { frequencyHz: 6500, thresholdDb: -30, ratio: 6 }),
  )
  const ess = await toneGainDb(build, 9000, -10)
  const body = await toneGainDb(build, 500, -10)
  return {
    pass: ess < -8 && Math.abs(body) < 0.3,
    gainDbAt9k: round(ess, 2),
    gainDbAt500: round(body, 2),
  }
}

async function limiterProbe() {
  const cases = [
    {
      name: '+12 dBFS sine',
      input: (i) => 4 * Math.sin((2 * Math.PI * 100 * i) / SR),
      params: {},
    },
    {
      name: 'clicks at 3.0',
      input: (i) => (i % 4800 === 100 ? 3 : 0),
      params: {},
    },
    {
      name: '-6 dBFS sine, +18 dB drive',
      input: (i) => 0.5 * Math.sin((2 * Math.PI * 1000 * i) / SR),
      params: { driveDb: 18 },
    },
    {
      name: '+6 dBFS square, -3 dB ceiling',
      input: (i) => (Math.sin((2 * Math.PI * 60 * i) / SR) >= 0 ? 2 : -2),
      params: { ceilingDb: -3 },
    },
  ]
  const rows = []
  for (const c of cases) {
    const spec = effect('limiter', c.params)
    const out = await render({ seconds: 1, input: c.input, build: unit(spec) })
    let peak = 0
    for (const v of out.getChannelData(0)) peak = Math.max(peak, Math.abs(v))
    rows.push({
      case: c.name,
      ceilingDb: spec.params.ceilingDb,
      peakDb: round(db(peak)),
    })
  }
  return { pass: rows.every((r) => r.peakDb <= r.ceilingDb + 0.001), rows }
}

async function delayProbe() {
  const spec = effect('delay', {
    timeMs: 100,
    feedback: 50,
    pingPong: 100,
    lowCutHz: 20,
    highCutHz: 20000,
    mix: 100,
  })
  const out = await render({
    seconds: 0.5,
    input: (i) => (i === 0 ? 1 : 0),
    build: unit(spec),
  })
  const energy = (data, ms) => {
    const centre = Math.round((ms / 1000) * SR)
    return round(Math.sqrt(rms(data, centre - 600, centre + 600) ** 2 * 1200))
  }
  const [left, right] = [out.getChannelData(0), out.getChannelData(1)]
  const echoes = {
    L100: energy(left, 100),
    R100: energy(right, 100),
    R200: energy(right, 200),
    L200: energy(left, 200),
    L300: energy(left, 300),
  }
  const pass =
    echoes.L100 > 0.9 &&
    echoes.R100 < 0.01 &&
    Math.abs(echoes.R200 - 0.5) < 0.05 &&
    echoes.L200 < 0.01 &&
    Math.abs(echoes.L300 - 0.25) < 0.04
  return { pass, echoes }
}

async function reverbProbe() {
  const spec = effect('reverb', {
    decayS: 1.5,
    preDelayMs: 0,
    damping: 30,
    lowCutHz: 20,
    highCutHz: 20000,
    mix: 100,
  })
  const renderOnce = () =>
    render({ seconds: 2.5, input: (i) => (i === 0 ? 1 : 0), build: unit(spec) })
  const [a, b] = [await renderOnce(), await renderOnce()]
  const [left, right] = [a.getChannelData(0), a.getChannelData(1)]
  let difference = 0
  const other = b.getChannelData(0)
  for (let i = 0; i < left.length; i++)
    difference = Math.max(difference, Math.abs(left[i] - other[i]))
  const decayDb = db(rms(left, 1.45 * SR, 1.55 * SR)) - db(rms(left, 0, 4800))
  let lr = 0
  let ll = 0
  let rr = 0
  for (let i = 0; i < SR / 2; i++) {
    lr += left[i] * right[i]
    ll += left[i] * left[i]
    rr += right[i] * right[i]
  }
  const correlation = lr / Math.sqrt(ll * rr)
  return {
    pass:
      difference === 0 &&
      decayDb < -45 &&
      decayDb > -75 &&
      Math.abs(correlation) < 0.3,
    maxDifference: difference,
    levelAtDecayDb: round(decayDb, 1),
    correlation: round(correlation),
  }
}

export function noiseBurst(seconds) {
  const length = Math.round(seconds * SR)
  const buffer = new AudioBuffer({
    numberOfChannels: 1,
    length,
    sampleRate: SR,
  })
  const data = buffer.getChannelData(0)
  let seed = 12345
  for (let i = 0; i < length; i++) {
    seed = (seed * 1103515245 + 12345) >>> 0
    data[i] = i < length / 2 ? 0.25 * ((seed / 4294967296) * 2 - 1) : 0
  }
  return buffer
}

async function chainProbe() {
  const kinds = [
    'eq',
    'deesser',
    'compressor',
    'saturation',
    'delay',
    'reverb',
    'limiter',
  ]
  const bypassed = await response(
    (ctx) => {
      const chain = createStudioFxChain(ctx, {
        effects: kinds.map((kind) => ({ kind, enabled: false })),
      })
      return { inNode: chain.input, outNode: chain.output }
    },
    FREQS.filter((f) => f <= 12000),
  )
  const presets = []
  for (const preset of [...STUDIO_FX_PRESETS, MASTER_CHAIN_PRESET]) {
    const out = await renderThroughChain(noiseBurst(1), preset.spec)
    let peak = 0
    let finite = true
    for (let c = 0; c < out.numberOfChannels; c++) {
      for (const v of out.getChannelData(c)) {
        if (!Number.isFinite(v)) finite = false
        peak = Math.max(peak, Math.abs(v))
      }
    }
    const y = out.getChannelData(0)
    presets.push({
      preset: preset.id,
      peakDb: round(db(peak), 2),
      endDb: round(db(rms(y, y.length - 960, y.length)) - db(peak), 1),
      finite,
    })
  }
  const pass =
    spread(bypassed) < 0.2 &&
    bypassed.every((r) => Math.abs(r.db) < 0.1) &&
    presets.every((p) => p.finite && p.peakDb < 6 && p.endDb < -55)
  return { pass, bypassedSpreadDb: round(spread(bypassed)), presets }
}

async function bounceProbe() {
  const spec = {
    effects: [
      { kind: 'eq' },
      { kind: 'compressor', params: { thresholdDb: -6 } },
      { kind: 'saturation', params: { driveDb: 0, mix: 0 } },
      { kind: 'limiter' },
    ],
  }
  const latencyFrames = await measureChainLatencyFrames(spec, SR)
  const click = new AudioBuffer({
    numberOfChannels: 1,
    length: SR,
    sampleRate: SR,
  })
  click.getChannelData(0)[1000] = 0.05
  const clickAt = peakIndex(
    (await renderThroughChain(click, spec)).getChannelData(0),
  )
  const tone = new AudioBuffer({
    numberOfChannels: 1,
    length: SR,
    sampleRate: SR,
  })
  const data = tone.getChannelData(0)
  for (let i = 0; i < SR; i++)
    data[i] = 0.05 * Math.sin((2 * Math.PI * 1000 * i) / SR)
  const y = (await renderThroughChain(tone, spec)).getChannelData(0)
  const openingDb = db(rms(y, 0, 960)) - db(rms(y, SR / 2, SR / 2 + 960))
  return {
    pass: clickAt === 1000 && Math.abs(openingDb) < 0.2,
    latencyFrames,
    clickAt,
    openingDb: round(openingDb),
  }
}

async function eqSlopeProbe() {
  const rows = await response(
    unit(effect('eq', { lowCutHz: 300 })),
    [300, 150, 1000],
  )
  const [atCut, octaveBelow, above] = rows.map((r) => r.db)
  return {
    pass:
      Math.abs(atCut + 3.01) < 0.15 &&
      Math.abs(octaveBelow + 24.1) < 0.6 &&
      Math.abs(above) < 0.1,
    rows,
  }
}

async function dynamicEqProbe() {
  const band = {
    frequencyHz: 280,
    q: 1,
    thresholdDb: -24,
    ratio: 2,
    rangeDb: 4,
    attackMs: 25,
    releaseMs: 220,
  }
  const flat = await response(unit(effect('dyneq', band)))
  const atBand = await toneGainDb(unit(effect('dyneq', band)), 280, -6)
  const offBand = await toneGainDb(unit(effect('dyneq', band)), 2500, -6)
  return {
    pass:
      spread(flat) < 0.2 &&
      atBand < -1 &&
      atBand > -4.2 &&
      Math.abs(offBand) < 0.3,
    flatSpreadDb: round(spread(flat)),
    loudBandCutDb: round(atBand, 2),
    loudOffBandDb: round(offBand, 2),
  }
}

async function exciterProbe() {
  const spec = effect('exciter', { frequencyHz: 2500, driveDb: 24, amount: 50 })
  const flat = await response(
    unit(spec),
    FREQS.filter((f) => f <= 12000),
  )
  const amp = dbToGain(-12)
  const out = await render({
    seconds: 1,
    input: (i) => amp * Math.sin((2 * Math.PI * 3000 * i) / SR),
    build: unit(spec),
  })
  const y = out.getChannelData(0)
  const fundamental = magnitude(y, 3000, SR / 2, SR)
  const octave = magnitude(y, 6000, SR / 2, SR)
  const harmonicDb = db(octave) - db(fundamental)
  const fundamentalDb = db(fundamental / ((amp * (SR / 2)) / 2))
  return {
    pass:
      spread(flat) < 0.3 &&
      harmonicDb > -45 &&
      harmonicDb < -6 &&
      Math.abs(fundamentalDb) < 0.5,
    lowLevelSpreadDb: round(spread(flat)),
    octaveBelowFundamentalDb: round(harmonicDb, 1),
    fundamentalChangeDb: round(fundamentalDb, 2),
  }
}

/** A sung vowel: 220 Hz with vibrato through three formants, syllables, and an "s" at each onset. */
export function syntheticVoice(seconds, levelScale = 1) {
  const length = Math.round(seconds * SR)
  const buffer = new AudioBuffer({
    numberOfChannels: 1,
    length,
    sampleRate: SR,
  })
  const data = buffer.getChannelData(0)
  const formants = [
    [700, 1],
    [1200, 0.5],
    [2600, 0.25],
  ]
  let seed = 99
  for (let i = 0; i < length; i++) {
    const t = i / SR
    const syllable = t % 0.55
    const voiced =
      syllable > 0.08 && syllable < 0.45
        ? Math.sin((Math.PI * (syllable - 0.08)) / 0.37)
        : 0
    const f0 = 220 * (1 + 0.01 * Math.sin(2 * Math.PI * 5.5 * t))
    let vowel = 0
    for (let k = 1; k * f0 < 5000; k++) {
      const f = k * f0
      const shape = formants.reduce(
        (sum, [fc, g]) => sum + g / (1 + ((f - fc) / 120) ** 2),
        0.02,
      )
      vowel += (shape / k) * Math.sin(2 * Math.PI * f * t)
    }
    seed = (seed * 1103515245 + 12345) >>> 0
    const hiss = syllable < 0.08 ? ((seed / 4294967296) * 2 - 1) * 0.15 : 0
    data[i] = levelScale * (0.25 * vowel * voiced + hiss)
  }
  return buffer
}

export function scaleTo(buffer, lufs) {
  const gain = dbToGain(lufs - measureLoudness(buffer).integratedLufs)
  const scaled = new AudioBuffer({
    numberOfChannels: 1,
    length: buffer.length,
    sampleRate: SR,
  })
  const from = buffer.getChannelData(0)
  const to = scaled.getChannelData(0)
  for (let i = 0; i < from.length; i++) to[i] = from[i] * gain
  return scaled
}

async function duckProbe() {
  const voice = scaleTo(syntheticVoice(1.65), -18)
  const padded = new AudioBuffer({
    numberOfChannels: 1,
    length: Math.round(3.5 * SR),
    sampleRate: SR,
  })
  padded.getChannelData(0).set(voice.getChannelData(0))
  const wet = async (duck) => {
    const spec = {
      effects: [
        {
          kind: 'reverb',
          params: { decayS: 2, preDelayMs: 20, mix: 100, duck },
        },
      ],
    }
    return (
      await renderThroughChain(padded, spec, { tailSeconds: 0 })
    ).getChannelData(0)
  }
  const [open, ducked] = [await wet(0), await wet(100)]
  const during =
    db(rms(ducked, 0.6 * SR, 1.5 * SR)) - db(rms(open, 0.6 * SR, 1.5 * SR))
  const after =
    db(rms(ducked, 2.1 * SR, 2.6 * SR)) - db(rms(open, 2.1 * SR, 2.6 * SR))
  return {
    pass: during < -6 && Math.abs(after) < 2.5,
    whileSingingDb: round(during, 1),
    afterTheWordsDb: round(after, 1),
  }
}

async function voiceChainProbe() {
  const whisper = scaleTo(syntheticVoice(3), -32)
  const belt = scaleTo(syntheticVoice(3), -12)
  const run = async (clip) =>
    renderThroughChain(clip, autoMixChain('voice', clip, { bpm: 120 }), {
      tailSeconds: 0,
    })
  const [a, b] = [await run(whisper), await run(belt)]
  const [ya, yb] = [a.getChannelData(0), b.getChannelData(0)]
  let difference = 0
  let peak = 0
  for (let i = 0; i < ya.length; i++) {
    difference = Math.max(difference, Math.abs(ya[i] - yb[i]))
    peak = Math.max(peak, Math.abs(ya[i]))
  }
  const loudness = measureLoudness(a).integratedLufs
  return {
    pass:
      difference < 1e-3 &&
      Math.abs(loudness - REFERENCE_LUFS) < 4 &&
      db(peak) < 0,
    whisperVersusBeltMaxDifference: round(difference, 6),
    outputLufs: round(loudness, 1),
    peakDb: round(db(peak), 2),
  }
}

async function masterProbe() {
  const voice = scaleTo(syntheticVoice(4), -24)
  const mastered = await renderMasteredMix(voice)
  const clicks = new AudioBuffer({
    numberOfChannels: 1,
    length: 4 * SR,
    sampleRate: SR,
  })
  const data = clicks.getChannelData(0)
  for (let i = 0; i < data.length; i++)
    data[i] =
      0.01 * Math.sin((2 * Math.PI * 440 * i) / SR) + (i % SR === 0 ? 0.9 : 0)
  const peaky = await renderMasteredMix(clicks)
  const limiting = peaky.before.truePeakDb + peaky.gainDb - -1.5
  return {
    pass:
      Math.abs(mastered.after.integratedLufs - DEFAULT_TARGET_LUFS) < 0.7 &&
      mastered.after.samplePeakDb <= -1.49 &&
      limiting <= 5.01 &&
      peaky.after.integratedLufs < DEFAULT_TARGET_LUFS - 1,
    voice: {
      gainDb: round(mastered.gainDb, 2),
      deliveredLufs: round(mastered.after.integratedLufs, 2),
      peakDb: round(mastered.after.samplePeakDb, 2),
    },
    peakySource: {
      gainDb: round(peaky.gainDb, 2),
      limitingDb: round(limiting, 2),
      deliveredLufs: round(peaky.after.integratedLufs, 2),
    },
  }
}

export async function runStudioFxProbes() {
  return {
    makeupGainMatchesPrediction: await makeupProbe(),
    latencyTwins: await latencyProbe(),
    parallelPathsSumFlat: await parallelProbe(),
    deesserActsOnSibilance: await deesserProbe(),
    limiterHoldsCeiling: await limiterProbe(),
    pingPongDelay: await delayProbe(),
    reverbDeterministicAndWide: await reverbProbe(),
    chainBypassAndPresets: await chainProbe(),
    bounceAlignedAndFullLevel: await bounceProbe(),
    lowCutIs24dbPerOctave: await eqSlopeProbe(),
    dynamicEqCutsOnlyWhenLoud: await dynamicEqProbe(),
    airAddsOctavesNotLevel: await exciterProbe(),
    reverbStepsBackWhileSinging: await duckProbe(),
    voiceChainIsLevelInvariant: await voiceChainProbe(),
    masterHitsTargetWithCappedLimiting: await masterProbe(),
  }
}

// Guitar audition renderer — isolated offline comparisons, never a production audio path.
import { createAuditionHead, getAuditionHeadSettings, } from './guitar-audition-head.mjs'
import { measureHeadDefinition } from './guitar-audition-probes.mjs'

const RATE = 48000
const IR_TRIM_DB = -18
let fixture
let kernel

// These are listening controls from dd3bb629, not today's app presets. Lead
// now selects a different Studio head; feeding its current controls into the
// Lite factory would silently change the reference and mislabel its DSP.
const HISTORICAL_LITE_CONTROLS = Object.freeze({
  edge: Object.freeze({
    enabled: true,
    drive: 0.42,
    bass: 0.08,
    mid: 0.1,
    treble: -0.08,
    presence: 0.1,
    output: 0.6,
    cabinet: 'balanced',
    asymmetry: 0.18,
  }),
  lead: Object.freeze({
    enabled: true,
    drive: 0.84,
    bass: -0.1,
    mid: 0.38,
    treble: -0.22,
    presence: 0.08,
    output: 0.25,
    cabinet: 'dark',
    asymmetry: 0.46,
  }),
})

export function historicalLiteAuditionParameters(id) {
  if (!Object.hasOwn(HISTORICAL_LITE_CONTROLS, id))
    throw new Error(`Unknown historical Lite control: ${id}`)
  return { engine: 'lite', ...HISTORICAL_LITE_CONTROLS[id] }
}

function context(seconds) {
  return new OfflineAudioContext(1, Math.ceil(seconds * RATE), RATE)
}

function encodePcm(buffer) {
  const bytes = new Uint8Array(buffer.getChannelData(0).buffer)
  let binary = ''
  for (let index = 0; index < bytes.length; index += 16384)
    binary += String.fromCharCode(...bytes.subarray(index, index + 16384))
  return globalThis.btoa(binary)
}

async function decoded(url) {
  const response = await globalThis.fetch(url)
  if (!response.ok) throw new Error(`Missing audition asset: ${url}`)
  return context(1).decodeAudioData(await response.arrayBuffer())
}

async function scoreSource(url, name) {
  const { parseGuitarProFile } = await import('/src/lib/tab/gp-import.ts')
  const { createBeatClock } = await import('/src/lib/midi-tempo-clock.ts')
  const { createGuitarVoice, clearPluckCache } =
    await import('/src/lib/guitar/guitar-synth.ts')
  const response = await globalThis.fetch(url)
  if (!response.ok) throw new Error('Missing score fixture')
  const parsed = await parseGuitarProFile(
    new File([await response.arrayBuffer()], name),
  )
  const tracks = parsed.song.tracks.filter(
    (track) =>
      track.kind === 'pitched' && track.instrumentFamily === 'electric-guitar',
  )
  tracks.sort((left, right) => right.notes.length - left.notes.length)
  const track = tracks[0]
  if (track === undefined)
    throw new Error('Score has no explicitly electric-guitar track')
  const clock = createBeatClock(parsed.song)
  const timed = track.notes.map((note) => ({
    ...note,
    seconds: clock(note.startBeat),
    durationSeconds:
      clock(note.startBeat + note.duration) - clock(note.startBeat),
  }))
  // Select a reproducible dense 16-second passage, not a hand-authored replacement.
  const starts = [
    ...new Set(
      timed
        .filter((note) => note.seconds < 180)
        .map((note) => Math.floor(note.seconds / 4) * 4),
    ),
  ]
  const start = starts.reduce((best, candidate) => {
    const count = (value) =>
      timed.filter((note) => note.seconds >= value && note.seconds < value + 16)
        .length
    return count(candidate) > count(best) ? candidate : best
  }, starts[0] ?? 0)
  const notes = timed.filter(
    (note) => note.seconds >= start && note.seconds < start + 16,
  )
  if (notes.length === 0 || notes.length > 512)
    throw new Error('Unbounded or empty score excerpt')
  const ctx = context(18)
  const voices = []
  const originalRandom = Math.random
  let seed = 20260905
  clearPluckCache()
  Math.random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 2 ** 32
  }
  try {
    for (const note of notes) {
      const at = 0.1 + note.seconds - start
      const voice = createGuitarVoice(
        ctx,
        440 * 2 ** ((note.midi - 69) / 12),
        note.durationSeconds * 1000,
        'electric',
        at,
        'shared',
      )
      voice.gain.gain.setValueAtTime(((note.velocity ?? 96) / 127) * 0.35, at)
      voice.gain.gain.setTargetAtTime(
        0,
        at + Math.max(0.03, note.durationSeconds),
        0.015,
      )
      voice.gain.connect(ctx.destination)
      voices.push(voice)
    }
  } finally {
    Math.random = originalRandom
  }
  const buffer = await ctx.startRendering()
  for (const voice of voices) voice.dispose()
  clearPluckCache()
  return {
    buffer,
    metadata: {
      name: parsed.name,
      track: {
        id: track.id,
        name: track.name,
        sourceProgram: track.sourceProgram,
        instrumentFamily: track.instrumentFamily,
      },
      startSeconds: start,
      windowSeconds: 16,
      notes,
      seed: 20260905,
      rendering:
        'Shipped shared electric pluck source; isolated track; authored tempo/pitch/velocity/note lengths. Not the full score-player articulation path.',
    },
  }
}

/** Allow floating-point rerender noise, never a changed/silent source under a frozen control. */
export function verifyReferencePcm(regenerated, saved) {
  if (regenerated.length !== saved.length || saved.length === 0)
    throw new Error('Reference source length changed')
  let maxDifference = 0
  let energy = 0
  for (let index = 0; index < saved.length; index++) {
    if (!Number.isFinite(saved[index]) || !Number.isFinite(regenerated[index]))
      throw new Error('Nonfinite reference source')
    maxDifference = Math.max(
      maxDifference,
      Math.abs(saved[index] - regenerated[index]),
    )
    energy += regenerated[index] * regenerated[index]
  }
  if (energy / saved.length <= 1e-12)
    throw new Error('Regenerated reference source is silent')
  if (maxDifference > 1e-6)
    throw new Error(
      'Regenerated reference source exceeds floating-point tolerance',
    )
  return maxDifference
}

export async function prepareFixture(config) {
  kernel ??= await decoded(config.irUrl)
  const prepared =
    config.kind === 'score'
      ? await scoreSource(config.url, config.name)
      : {
          buffer: await decoded(config.url),
          metadata: {
            input:
              'Recording at unchanged input level; capture-chain evidence is recorded separately in the fixture manifest',
          },
        }
  if (prepared.buffer.numberOfChannels !== 1 || prepared.buffer.duration > 30)
    throw new Error('Audition expects a bounded mono source')
  if (config.frozenSource !== undefined) {
    const frozen = await decoded(config.frozenSource.url)
    if (
      frozen.numberOfChannels !== 1 ||
      frozen.sampleRate !== RATE ||
      frozen.length !== prepared.buffer.length
    )
      throw new Error('Frozen reference must match the prepared source format')
    const regenerated = prepared.buffer.getChannelData(0)
    const saved = frozen.getChannelData(0)
    const maxDifference = verifyReferencePcm(regenerated, saved)
    prepared.metadata.referenceSource = {
      mode: 'Verified frozen PCM; score metadata re-parsed and checked against reference',
      regeneratedMaxSampleDifference: maxDifference,
    }
    prepared.buffer = frozen
  }
  fixture = prepared.buffer
  return {
    ...prepared.metadata,
    durationSeconds: fixture.duration,
    sampleRate: RATE,
    pcm: encodePcm(fixture),
  }
}

function cabinet(ctx) {
  const convolver = ctx.createConvolver()
  convolver.normalize = false
  convolver.buffer = kernel
  const output = ctx.createGain()
  output.gain.value = 10 ** (IR_TRIM_DB / 20)
  convolver.connect(output)
  return {
    input: convolver,
    output,
    nodes: [convolver, output],
    dispose() {
      convolver.disconnect()
      convolver.buffer = null
      output.disconnect()
    },
  }
}

export async function renderVariant(id) {
  if (fixture === undefined) throw new Error('Prepare fixture before rendering')
  const { createGuitarElectricAmpStage } =
    await import('/src/lib/guitar/guitar-electric-amp.ts')
  const ctx = context(fixture.duration + 1.5)
  const source = ctx.createBufferSource()
  source.buffer = fixture
  const envelope = ctx.createGain()
  // Identical boundary treatment for every head. Never normalize or compress DI input.
  envelope.gain.setValueAtTime(0.0001, 0)
  envelope.gain.exponentialRampToValueAtTime(1, 0.09)
  envelope.gain.setValueAtTime(1, fixture.duration - 0.24)
  envelope.gain.setTargetAtTime(0, fixture.duration - 0.24, 0.036)
  source.connect(envelope)
  const stages = []
  const profile =
    id === 'articulate-ir'
      ? 'articulate'
      : id === 'tight-ir'
        ? 'tight'
        : 'original'
  let headSettings = null
  let tail = envelope
  const attach = (stage) => {
    tail.connect(stage.input)
    tail = stage.output
    stages.push(stage)
  }
  if (id === 'baseline-old') {
    const baselineUrl = '/__audition_baseline.js'
    const baseline = await import(/* @vite-ignore */ baselineUrl)
    attach(
      baseline.createGuitarElectricAmpStage(
        ctx,
        historicalLiteAuditionParameters('edge'),
      ),
    )
  } else if (id === 'edge' || id === 'lead') {
    attach(
      createGuitarElectricAmpStage(ctx, historicalLiteAuditionParameters(id)),
    )
  } else if (id === 'lead-ir') {
    attach(
      createGuitarElectricAmpStage(
        ctx,
        historicalLiteAuditionParameters('lead'),
        { cabinet },
      ),
    )
  } else if (
    [
      'prototype-ir',
      'prototype-no-sag-ir',
      'articulate-ir',
      'tight-ir',
    ].includes(id)
  ) {
    attach(
      createAuditionHead(ctx, { sag: id !== 'prototype-no-sag-ir', profile }),
    )
    headSettings = getAuditionHeadSettings(profile)
    attach(cabinet(ctx))
  } else if (id !== 'dry') throw new Error(`Unknown variant ${id}`)
  tail.connect(ctx.destination)
  source.start(0)
  const rendered = await ctx.startRendering()
  source.disconnect()
  envelope.disconnect()
  for (const stage of stages) stage.dispose()
  return {
    pcm: encodePcm(rendered),
    sampleRate: RATE,
    irTrimDb: IR_TRIM_DB,
    durationSeconds: rendered.duration,
    parameters:
      headSettings !== null
        ? headSettings
        : id === 'dry'
          ? null
          : historicalLiteAuditionParameters(
              id === 'edge' || id === 'baseline-old' ? 'edge' : 'lead',
            ),
  }
}

/** Actual browser DSP checks; mock AudioNodes cannot establish these properties. */
export async function verifyHead(profile = 'original') {
  async function probe(
    rate,
    { conditioned = false, sag = true, silent = false } = {},
  ) {
    const ctx = new OfflineAudioContext(1, Math.round(rate * 1.3), rate)
    const source = ctx.createBufferSource()
    source.buffer = ctx.createBuffer(1, Math.round(rate * 1.3), rate)
    const pcm = source.buffer.getChannelData(0)
    for (let index = 0; index < pcm.length; index++) {
      const seconds = index / rate
      const level = silent ? 0 : seconds < 0.8 ? (conditioned ? 0.2 : 0) : 0.003
      pcm[index] = level * Math.sin(2 * Math.PI * 200 * seconds)
    }
    const head = createAuditionHead(ctx, { sag, profile })
    source.connect(head.input)
    head.output.connect(ctx.destination)
    source.start()
    const rendered = (await ctx.startRendering()).getChannelData(0)
    source.disconnect()
    head.dispose()
    if (!rendered.every(Number.isFinite))
      throw new Error('Nonfinite prototype probe')
    return rendered
  }
  const report = []
  for (const rate of [44100, 48000]) {
    const silence = await probe(rate, { silent: true })
    const silentPeak = silence.reduce(
      (peak, sample) => Math.max(peak, Math.abs(sample)),
      0,
    )
    if (silentPeak > 1e-7)
      throw new Error('Prototype generates sound on silence')
    const conditioned = await probe(rate, { conditioned: true })
    const quiet = await probe(rate)
    const conditionedNoSag = await probe(rate, {
      conditioned: true,
      sag: false,
    })
    const quietNoSag = await probe(rate, { sag: false })
    let energy = 0
    const from = Math.round(rate * 0.805)
    const to = Math.round(rate * 0.85)
    for (let index = from; index < to; index++) {
      const historyDelta =
        conditioned[index] -
        quiet[index] -
        (conditionedNoSag[index] - quietNoSag[index])
      energy += historyDelta * historyDelta
    }
    const additionalHistoryRms = Math.sqrt(energy / (to - from))
    if (additionalHistoryRms < 1e-5)
      throw new Error('No measurable sidechain history dependence')
    const repeat = await probe(rate, { conditioned: true })
    const repeatMaxDifference = repeat.reduce(
      (peak, value, index) =>
        Math.max(peak, Math.abs(value - conditioned[index])),
      0,
    )
    if (repeatMaxDifference !== 0)
      throw new Error('Prototype render is not repeatable')
    report.push({
      profile,
      sampleRate: rate,
      silentPeak,
      additionalHistoryRms,
      repeatMaxDifference,
      method:
        'Identical 200 Hz quiet probe after loud vs silent prefix, subtract sag-disabled history delta; measure 5–50ms into probe.',
    })
  }
  return report
}

export async function verifyProfiles() {
  const results = []
  for (const profile of ['original', 'articulate', 'tight']) {
    const safety = await verifyHead(profile)
    const definition = []
    for (const rate of [44100, 48000])
      definition.push(await measureHeadDefinition(profile, rate))
    results.push({ profile, safety, definition })
  }
  return results
}

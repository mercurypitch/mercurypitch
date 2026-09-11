// Guitar amp browser probes use real offline/live Web Audio; live destination samples are always zero.
import { createAuditionHead } from './guitar-audition-head.mjs'

const PARAMETERS = {
  enabled: true,
  engine: 'studio',
  head: 'definition',
  character: 1,
  drive: 0.7,
  output: 0.6,
  bass: 0,
  mid: 0,
  treble: 0,
  presence: 0,
}

const assert = (condition, message) => {
  if (condition !== true) throw new Error(message)
}

function stats(pcm, rate) {
  let energy = 0
  let sum = 0
  let peak = 0
  let maxStep = 0
  let maxStepFrame = 0
  let tailPeak = 0
  for (let index = 0; index < pcm.length; index++) {
    const value = pcm[index]
    assert(Number.isFinite(value), 'Nonfinite audio sample')
    energy += value * value
    sum += value
    peak = Math.max(peak, Math.abs(value))
    if (index > 0 && Math.abs(value - pcm[index - 1]) > maxStep) {
      maxStep = Math.abs(value - pcm[index - 1])
      maxStepFrame = index
    }
    if (index > pcm.length - rate / 4)
      tailPeak = Math.max(tailPeak, Math.abs(value))
  }
  return {
    frames: pcm.length,
    peak,
    rms: Math.sqrt(energy / pcm.length),
    dc: sum / pcm.length,
    tailPeak,
    maxStep,
    maxStepSeconds: maxStepFrame / rate,
    maxStepNeighborhood: Array.from(
      pcm.subarray(Math.max(0, maxStepFrame - 8), maxStepFrame + 8),
    ),
  }
}

function difference(actual, reference) {
  assert(actual.length === reference.length, 'PCM lengths differ')
  let max = 0
  let energy = 0
  let referenceEnergy = 0
  for (let index = 0; index < actual.length; index++) {
    const delta = actual[index] - reference[index]
    max = Math.max(max, Math.abs(delta))
    energy += delta * delta
    referenceEnergy += reference[index] * reference[index]
  }
  assert(
    referenceEnergy > 1e-10,
    'Silent reference cannot establish equivalence',
  )
  return {
    maxSampleDifference: max,
    relativeRmsError: Math.sqrt(energy / referenceEnergy),
  }
}

function pickBuffer(ctx) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate)
  const samples = buffer.getChannelData(0)
  const notes = [82.4069, 123.4708, 164.8138, 196, 246.9417, 329.6276]
  for (let index = 0; index < samples.length; index++) {
    const time = index / ctx.sampleRate
    let value = 0
    for (let pick = 0; pick < 18; pick++) {
      const age = time - 0.1 - pick * 0.17
      if (age < 0) continue
      const phase = 2 * Math.PI * notes[pick % notes.length] * age
      const envelope = (1 - Math.exp(-age / 0.003)) * Math.exp(-age / 0.55)
      value +=
        0.035 *
        envelope *
        (Math.sin(phase) +
          0.23 * Math.sin(2 * phase) +
          0.09 * Math.sin(3 * phase))
    }
    samples[index] = value
  }
  return buffer
}

async function cabinet(ctx) {
  const response = await globalThis.fetch(
    '/src/assets/audio/guitar/cookie-monster.wav',
  )
  assert(response.ok, 'Cabinet asset unavailable')
  const bytes = await response.arrayBuffer()
  assert(bytes.byteLength === 172304, 'Cabinet byte length changed')
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  const hash = Array.from(new Uint8Array(digest), (value) =>
    value.toString(16).padStart(2, '0'),
  ).join('')
  assert(
    hash === '48b4e8dc8bde8595f8b8153128e99debd981c30b2b7a427e8bf8f3db0a84f49f',
    'Cabinet bytes changed',
  )
  const decoded = await ctx.decodeAudioData(bytes)
  assert(
    decoded.numberOfChannels === 1 && decoded.sampleRate === ctx.sampleRate,
    'Cabinet decode format changed',
  )
  assert(
    Math.abs(decoded.duration - 1.19625) <= 2 / ctx.sampleRate,
    'Cabinet tail was truncated',
  )
  return decoded
}

async function render(
  rate,
  profile,
  kernel,
  production = true,
  tracks = 1,
  addDi = false,
) {
  const { createGuitarAmpStage } =
    await import('/src/lib/guitar/guitar-amp-stage.ts')
  const ctx = new OfflineAudioContext(1, rate * 6, rate)
  const stages = []
  const owned = []
  const sourceBuffer = pickBuffer(ctx)
  const setupStart = globalThis.performance.now()
  let ownedNodeCount = 0
  const count = tracks + (addDi ? 1 : 0)
  for (let track = 0; track < count; track++) {
    const source = ctx.createBufferSource()
    source.buffer = sourceBuffer
    const boundary = ctx.createGain()
    boundary.gain.setValueAtTime(0.0001, 0)
    boundary.gain.exponentialRampToValueAtTime(1, 0.09)
    boundary.gain.setValueAtTime(1, 3.76)
    boundary.gain.setTargetAtTime(0, 3.76, 0.036)
    const output = ctx.createGain()
    output.gain.value = 1 / count
    source.connect(boundary)
    const selected =
      track === tracks ? { head: 'heavy', character: 1 } : profile
    if (production) {
      const stage = createGuitarAmpStage(
        ctx,
        { ...PARAMETERS, ...selected },
        { cabinetBuffer: kernel },
      )
      assert(
        stage.getStatus() === 'ready',
        'Prepared Studio stage did not become ready',
      )
      boundary.connect(stage.input)
      stage.output.connect(output)
      stages.push(stage)
      ownedNodeCount += stage.nodes.length
    } else {
      const name =
        selected.head === 'heavy'
          ? 'original'
          : selected.character === 0
            ? 'articulate'
            : 'tight'
      const head = createAuditionHead(ctx, { profile: name })
      const convolver = ctx.createConvolver()
      convolver.normalize = false
      convolver.buffer = kernel
      const trim = ctx.createGain()
      trim.gain.value = 10 ** (-18 / 20)
      boundary.connect(head.input)
      head.output.connect(convolver)
      convolver.connect(trim)
      trim.connect(output)
      stages.push(head)
      owned.push(convolver, trim)
    }
    output.connect(ctx.destination)
    owned.push(source, boundary, output)
    source.start(0)
  }
  const setupMs = globalThis.performance.now() - setupStart
  const start = globalThis.performance.now()
  try {
    const buffer = await ctx.startRendering()
    return {
      pcm: buffer.getChannelData(0),
      parameters: stages.map((stage) => stage.getParameters?.()),
      setupMs,
      renderMs: globalThis.performance.now() - start,
      ownedNodeCount,
    }
  } finally {
    for (const stage of stages) stage.dispose()
    for (const node of owned) node.disconnect()
  }
}

async function verifyStudioLead(rate, kernel) {
  const { guitarNightAmpSettingsForPreset, normalizeGuitarNightAmpSettings } =
    await import('/src/features/guitar-night/guitar-amp-settings.ts')
  const { version, presetId, ...parameters } =
    guitarNightAmpSettingsForPreset('lead')
  assert(
    version === 2 &&
      presetId === 'lead' &&
      parameters.engine === 'studio' &&
      parameters.head === 'lead',
    'Factory Lead did not select its Studio head',
  )
  const actual = await render(rate, parameters, kernel)
  const measured = stats(actual.pcm, rate)
  assert(
    Object.entries(parameters).every(
      ([key, value]) => actual.parameters[0]?.[key] === value,
    ),
    'Factory Lead parameters changed inside the facade',
  )
  assert(
    measured.rms > 1e-5 &&
      measured.peak < 1 &&
      Math.abs(measured.dc) < 0.001 &&
      measured.tailPeak < 1e-6,
    'Lead fixture clips, has excessive DC, is silent, or leaves a tail',
  )
  const comparisons = {}
  for (const id of ['tight', 'heavy']) {
    const other = await render(
      rate,
      guitarNightAmpSettingsForPreset(id),
      kernel,
    )
    comparisons[id] = difference(actual.pcm, other.pcm)
    assert(comparisons[id].relativeRmsError > 0.01, `Lead PCM equals ${id}`)
  }
  const restored = normalizeGuitarNightAmpSettings(
    JSON.parse(JSON.stringify({ version, presetId, ...parameters })),
  )
  const repeated = await render(rate, restored, kernel)
  const unusedCharacter = await render(
    rate,
    { ...parameters, character: 0 },
    kernel,
  )
  const roundTripDifference = difference(repeated.pcm, actual.pcm)
  const characterDifference = difference(unusedCharacter.pcm, actual.pcm)
  assert(
    roundTripDifference.maxSampleDifference < 1e-6 &&
      characterDifference.maxSampleDifference < 1e-6,
    'Lead changed after persistence or an unused Character update',
  )
  const quieter = await render(rate, { ...parameters, output: 0.4 }, kernel)
  const expectedOutputGain = 10 ** (-4 / 20)
  const outputGainDifference = difference(
    quieter.pcm,
    Float32Array.from(actual.pcm, (value) => value * expectedOutputGain),
  )
  assert(
    outputGainDifference.maxSampleDifference < 1e-6,
    'Output altered Lead distortion',
  )
  const lowerDrive = await render(rate, { ...parameters, drive: 0.35 }, kernel)
  const driveDifference = difference(lowerDrive.pcm, actual.pcm)
  assert(
    driveDifference.relativeRmsError > 0.01,
    'Lead drive control had no PCM effect',
  )
  return {
    ...measured,
    parameters: actual.parameters[0],
    comparisons,
    roundTripDifference,
    characterDifference,
    expectedOutputGain,
    outputGainDifference,
    driveDifference,
  }
}

export async function verifyOffline() {
  const results = []
  for (const rate of [44100, 48000]) {
    const kernel = await cabinet(new OfflineAudioContext(1, rate, rate))
    const endpoints = []
    let previous
    for (const profile of [
      { head: 'heavy', character: 1 },
      { head: 'definition', character: 0 },
      { head: 'definition', character: 1 },
    ]) {
      const actual = await render(rate, profile, kernel)
      const reference = await render(rate, profile, kernel, false)
      const measured = stats(actual.pcm, rate)
      const delta = difference(actual.pcm, reference.pcm)
      assert(measured.rms > 1e-5, 'Silent production endpoint')
      assert(measured.peak < 1, 'Production endpoint clips')
      assert(
        measured.tailPeak < 1e-6,
        'Production endpoint leaves a non-silent final tail',
      )
      assert(
        delta.maxSampleDifference <= 1e-6 && delta.relativeRmsError <= 2e-6,
        'Production endpoint differs from approved audition',
      )
      endpoints.push({ ...profile, ...measured, ...delta })
      previous = actual.pcm
    }
    const interior = []
    for (const character of [0.25, 0.5, 0.75]) {
      const actual = await render(
        rate,
        { head: 'definition', character },
        kernel,
      )
      const measured = stats(actual.pcm, rate)
      const changed = difference(actual.pcm, previous)
      assert(
        measured.rms > 1e-5 && measured.peak < 1 && measured.tailPeak < 1e-6,
        'Invalid interior output',
      )
      assert(
        changed.relativeRmsError > 1e-4,
        'Character position failed to alter real PCM',
      )
      interior.push({ character, ...measured, differenceFromPrevious: changed })
      previous = actual.pcm
    }
    const scaling = []
    for (const tracks of [1, 2, 4]) {
      const actual = await render(
        rate,
        { head: 'definition', character: 1 },
        kernel,
        true,
        tracks,
        true,
      )
      const measured = stats(actual.pcm, rate)
      assert(
        measured.rms > 1e-5 && measured.peak < 1,
        'Invalid multi-track output',
      )
      scaling.push({
        electricTracks: tracks,
        separateSyntheticDiProcessors: 1,
        renderedSeconds: 6,
        renderMs: actual.renderMs,
        setupMs: actual.setupMs,
        offlineWallTimeToAudioDuration: actual.renderMs / 6000,
        ownedNodeCount: actual.ownedNodeCount,
        ...measured,
      })
    }
    results.push({
      sampleRate: rate,
      cabinetFrames: kernel.length,
      cabinetSeconds: kernel.duration,
      endpoints,
      interior,
      scaling,
      lead: await verifyStudioLead(rate, kernel),
    })
  }
  return results
}

export async function verifyLiveTransitions(scenario = 'rapid') {
  assert(
    ['steady', 'single', 'rapid'].includes(scenario),
    'Unknown live transition scenario',
  )
  const { createGuitarAmpStage } =
    await import('/src/lib/guitar/guitar-amp-stage.ts')
  const ctx = new AudioContext({ sampleRate: 48000 })
  const timers = []
  let stage
  let capture
  let oscillator
  let inputGain
  let mute
  let moduleUrl
  try {
    const kernel = await cabinet(ctx)
    await ctx.resume()
    moduleUrl = URL.createObjectURL(
      new Blob(
        [
          `
      class Capture extends AudioWorkletProcessor {
        constructor(options) {
          super(); this.start = options.processorOptions.start;
          this.data = new Float32Array(options.processorOptions.frames);
          this.reference = new Float32Array(options.processorOptions.frames);
          this.gaps = []; this.last = undefined; this.cursor = undefined;
        }
        process(inputs, outputs) {
          const channel = inputs[0]?.[0];
          const reference = inputs[1]?.[0];
          if (this.last !== undefined && currentFrame !== this.last + 128)
            this.gaps.push({ previous: this.last, current: currentFrame, deliveredFrames: this.cursor });
          this.last = currentFrame;
          // Hardware output remains zero even if the downstream mute changes.
          for (const output of outputs) for (const samples of output) samples.fill(0);
          let offset = 0;
          if (this.cursor === undefined && currentFrame + 128 > this.start) {
            offset = Math.max(0, this.start - currentFrame); this.cursor = 0;
          }
          // Append delivered samples: currentFrame can repeat around Chromium graph edits.
          // Indexing by that clock would overwrite real samples and manufacture gaps.
          if (this.cursor !== undefined) for (let i = offset; i < 128 && this.cursor < this.data.length; i++) {
            this.data[this.cursor] = channel?.[i] ?? 0;
            this.reference[this.cursor] = reference?.[i] ?? 0;
            this.cursor++;
          }
          if (this.cursor >= this.data.length) {
            this.port.postMessage({ pcm: this.data, reference: this.reference, gaps: this.gaps },
              [this.data.buffer, this.reference.buffer]); return false;
          }
          return true;
        }
      }
      registerProcessor('guitar-integration-capture', Capture);
    `,
        ],
        { type: 'application/javascript' },
      ),
    )
    await ctx.audioWorklet.addModule(moduleUrl)
    const captureAt = Math.ceil((ctx.currentTime + 0.1) * ctx.sampleRate)
    const startAt = captureAt / ctx.sampleRate + 0.1
    capture = new AudioWorkletNode(ctx, 'guitar-integration-capture', {
      numberOfInputs: 2,
      processorOptions: { start: captureAt, frames: ctx.sampleRate * 5 },
    })
    const captured = new Promise((resolve, reject) => {
      capture.port.onmessage = (event) => resolve(event.data)
      timers.push(
        globalThis.setTimeout(
          () =>
            reject(new Error('Live capture exceeded eight-second deadline')),
          8000,
        ),
      )
    })
    mute = ctx.createGain()
    mute.gain.value = 0
    capture.connect(mute)
    mute.connect(ctx.destination)
    stage = createGuitarAmpStage(ctx, PARAMETERS, { cabinetBuffer: kernel })
    stage.output.connect(capture)
    oscillator = ctx.createOscillator()
    oscillator.frequency.value = 220
    inputGain = ctx.createGain()
    inputGain.gain.setValueAtTime(0.0001, startAt)
    inputGain.gain.exponentialRampToValueAtTime(0.035, startAt + 0.09)
    inputGain.gain.setValueAtTime(0.035, startAt + 3.5)
    inputGain.gain.setTargetAtTime(0, startAt + 3.5, 0.036)
    oscillator.connect(inputGain)
    inputGain.connect(stage.input)
    inputGain.connect(capture, 0, 1)
    oscillator.start(startAt)
    oscillator.stop(startAt + 3.74)
    const events = []
    const snapshots = []
    let maximumOwnedNodes = stage.nodes.length
    const rapidChanges = [
      [0.35, { character: 0 }],
      [0.38, { character: 0.5 }],
      [0.41, { enabled: false }],
      [0.44, { character: 0.9 }],
      [0.47, { enabled: true }],
      [0.8, { head: 'heavy' }],
      [0.84, { head: 'definition', character: 0.25 }],
      [1.2, { enabled: false }],
      [1.6, { enabled: true }],
      [2, { character: 0.1 }],
      [2.03, { character: 0.3 }],
      [2.06, { character: 0.6 }],
      [2.09, { character: 1 }],
    ]
    const changes =
      scenario === 'steady'
        ? []
        : scenario === 'single'
          ? [[2, { character: 0 }]]
          : rapidChanges
    const snapshot = () => {
      const time = ctx.currentTime - startAt
      if (time > 3.5) return
      snapshots.push({
        audioTime: time,
        gains: stage.nodes
          .filter((node) => node instanceof GainNode)
          .map((node) => node.gain.value),
      })
      timers.push(globalThis.setTimeout(snapshot, 10))
    }
    snapshot()
    for (const [after, next] of changes)
      timers.push(
        globalThis.setTimeout(
          () => {
            stage.setParameters(next)
            maximumOwnedNodes = Math.max(maximumOwnedNodes, stage.nodes.length)
            events.push({
              requestedSeconds: after,
              audioTime: ctx.currentTime - startAt,
              parameters: next,
              ownedNodes: stage.nodes.length,
            })
          },
          Math.max(0, (startAt + after - ctx.currentTime) * 1000),
        ),
      )
    const { pcm, reference, gaps } = await captured
    const measured = stats(pcm, ctx.sampleRate)
    const referenceMeasured = stats(reference, ctx.sampleRate)
    const maxStepFrame = Math.round(measured.maxStepSeconds * ctx.sampleRate)
    const first = Math.ceil(
      (startAt - captureAt / ctx.sampleRate + 0.2) * ctx.sampleRate,
    )
    const last = Math.floor(
      (startAt - captureAt / ctx.sampleRate + 3.4) * ctx.sampleRate,
    )
    const windowFrames = Math.round(ctx.sampleRate * 0.02)
    let minimumWindowRms = Infinity
    for (let from = first; from + windowFrames <= last; from += windowFrames) {
      let energy = 0
      for (let index = from; index < from + windowFrames; index++)
        energy += pcm[index] * pcm[index]
      minimumWindowRms = Math.min(
        minimumWindowRms,
        Math.sqrt(energy / windowFrames),
      )
    }
    assert(events.length === changes.length, 'Not every transition command ran')
    assert(
      minimumWindowRms > 1e-5,
      'Live transitions dropped all audible paths',
    )
    assert(
      maximumOwnedNodes <= 70,
      'More than two processors remained allocated',
    )
    return {
      scenario,
      sampleRate: ctx.sampleRate,
      captureClockAnomalies: gaps,
      rawReference: referenceMeasured,
      referenceContinuous:
        referenceMeasured.rms > 0.005 &&
        referenceMeasured.peak < 0.04 &&
        referenceMeasured.maxStep < 0.005,
      rawReferenceNearAmpStep: Array.from(
        reference.subarray(Math.max(0, maxStepFrame - 8), maxStepFrame + 8),
      ),
      events,
      transientWithinBound: measured.peak < 1 && measured.maxStep < 0.15,
      approximateSourceSecondsAtMaxStep:
        measured.maxStepSeconds - (startAt - captureAt / ctx.sampleRate),
      nearbyGainSnapshots: snapshots.filter(
        (entry) =>
          Math.abs(entry.audioTime - (measured.maxStepSeconds - 0.1)) < 0.1,
      ),
      maximumOwnedNodes,
      minimum20msWindowRms: minimumWindowRms,
      ...measured,
      hardwareOutput:
        'Capture worklet writes only zeros; a second gain is fixed at zero before destination.',
      timeCoordinates:
        'PCM times count delivered samples; command and gain-snapshot times use the context clock. Their alignment is approximate when the clock repeats or skips.',
      limitations:
        'Synthetic steady tone and timed rapid changes; no input hardware, full-song musical quality or hardware latency benchmark. Captures delivered sample blocks sequentially, with independent raw-source continuity and currentFrame anomaly diagnostics. Sample-step ceiling is a regression bound, not proof of inaudibility or device scheduling.',
    }
  } finally {
    for (const timer of timers) globalThis.clearTimeout(timer)
    stage?.dispose()
    oscillator?.disconnect()
    inputGain?.disconnect()
    capture?.disconnect()
    mute?.disconnect()
    if (moduleUrl !== undefined) URL.revokeObjectURL(moduleUrl)
    await ctx.close()
  }
}

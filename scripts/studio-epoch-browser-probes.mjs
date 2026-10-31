// Studio epoch browser probes: Plays from silence on OfflineAudioContext, through the real run and graph code, compared sample by sample.
// Imported by scripts/check-studio-epoch-browser.mjs inside a page served by the Vite dev server.
//
// A Play takes its place on the clock from the device's callback length
// (seekEarliest in run.ts), which the browser reports and may change while
// the context runs. Each probe presses Play twice, a render quantum apart,
// with device callbacks that end a fraction of a frame apart, and checks the
// two renders are the same audio a whole number of frames apart: no source
// interpolated between frames. A whole-frame Play lands exactly a quantum
// later, so every effect sees the same samples on the same quanta.
import { EMPTY_CHAIN } from '/src/lib/studio-fx/chain-spec.ts'
import { measureTrackLatencies } from '/src/lib/studio-fx/mixdown.ts'
import { resolveStudioSoundGraph } from '/src/lib/studio/export/sound-graph.ts'
import { createStudioLaneMeter } from '/src/lib/studio/metering/live-meter.ts'
import { compileStudioArrangement } from '/src/lib/studio/model/arrangement-plan.ts'
import { createStudioProject, createStudioTrack, } from '/src/lib/studio/model/defaults.ts'
import { buildStudioGraph } from '/src/lib/studio/playback/graph.ts'
import { StudioFrozenBuffers } from '/src/lib/studio/playback/lane-freeze.ts'
import { renderLaneFreeze } from '/src/lib/studio/playback/lane-freeze-render.ts'
import { setPlaybackChoice } from '/src/lib/studio/playback/playback-quality.ts'
import { planLatencySeconds, prepareStudioPlan, } from '/src/lib/studio/playback/prepare-plan.ts'
import { buildStudioRun, openRunEnvelope, } from '/src/lib/studio/playback/run.ts'

const SR = 48000
const BANDS = [1000, 5000, 10000, 15000]
const NOW = '2026-10-31T12:00:00.000Z'

export const db = (gain) => 20 * Math.log10(Math.max(1e-15, gain))
const round = (value, digits = 2) => Number(value.toFixed(digits))

/** Seeded white noise. */
function noise(frames, peak, seed) {
  let state = seed >>> 0
  return Float32Array.from({ length: frames }, () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return (state / 2 ** 32 - 0.5) * 2 * peak
  })
}

/** Four tones, at the bands the probes read. */
function tones(frames, peak) {
  return Float32Array.from({ length: frames }, (_, n) =>
    BANDS.reduce(
      (sum, hz) => sum + peak * Math.sin((2 * Math.PI * hz * n) / SR),
      0,
    ),
  )
}

function asset(id, frames) {
  return {
    id,
    projectId: 'epoch-probe',
    sha256: 'a'.repeat(64),
    mimeType: 'audio/wav',
    byteLength: 44 + frames * 2,
    channels: 1,
    normalizedSampleRate: SR,
    normalizedFrameCount: frames,
    importVersion: 1,
    canonicalPcmId: `pcm-${id}`,
    canonicalPcmSha256: 'b'.repeat(64),
    canonicalPcmByteLength: 32 + frames * 4,
    preparation: { algorithmVersion: 'bs1770-48k-v1', gainDb: 0 },
    provenance: {
      kind: 'guitar-night',
      sourceId: `guitar-take:${id}`,
      importedAt: NOW,
    },
  }
}

function clip(id, trackId, assetId, startFrame, frames) {
  return {
    id,
    trackId,
    assetId,
    startFrame,
    sourceInFrame: 0,
    sourceOutFrame: frames,
    gainDb: 0,
    fades: { curve: 'linear-amplitude' },
  }
}

/**
 * A song: lanes of the given roles, each playing a clip of tones from 0.1 s
 * for 1.5 s, then a clip of its own noise from 1.7 s for 1.5 s. A dry lane
 * has no effects at all.
 */
function song(roles, dry) {
  const frames = 1.5 * SR
  const sources = new Map()
  const assets = []
  const clips = []
  const tracks = roles.map((role, index) => {
    const id = `track-${index + 1}`
    const made = createStudioTrack({ id, name: role, order: index, role })
    for (const [kind, data, at] of [
      ['tones', tones(frames, 0.2 / roles.length), 0.1 * SR],
      ['noise', noise(frames, 0.5 / roles.length, 7 + index), 1.7 * SR],
    ]) {
      const assetId = `${kind}-${index + 1}`
      assets.push(asset(assetId, frames))
      sources.set(assetId, data)
      clips.push(clip(`${assetId}-clip`, id, assetId, at, frames))
    }
    return dry
      ? { ...made, balanceGainDb: 0, fx: { ...made.fx, baseSpec: EMPTY_CHAIN } }
      : made
  })
  const project = {
    ...createStudioProject({
      id: 'epoch-probe',
      title: 'Epoch probe',
      now: NOW,
    }),
    tracks,
    clips,
  }
  return { project, assets, sources }
}

function buffersOn(ctx, sources) {
  return new Map(
    [...sources].map(([id, data]) => {
      const buffer = ctx.createBuffer(1, data.length, SR)
      buffer.copyToChannel(data, 0)
      return [id, buffer]
    }),
  )
}

/** The offline context as the run sees it: the device callback it reports is `baseLatency`. */
function clockOf(ctx, baseLatency) {
  return new Proxy(ctx, {
    get(target, property) {
      if (property === 'baseLatency') return baseLatency
      const value = Reflect.get(target, property, target)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
}

/** The plan and master a song plays with, latencies measured at 48 kHz as playback measures them. */
async function prepare(made, dry, frozen) {
  const signal = new AbortController().signal
  if (dry) {
    const framesByTrack = Object.fromEntries(
      made.project.tracks.map((track) => [track.id, 0]),
    )
    return {
      plan: compileStudioArrangement(made.project, made.assets, {
        latencies: { sampleRate: SR, framesByTrack },
      }),
      master: EMPTY_CHAIN,
      latency: 0,
    }
  }
  const plan = await prepareStudioPlan(
    made.project,
    made.assets,
    SR,
    0,
    signal,
    measureTrackLatencies,
    false,
    frozen,
  )
  const master = resolveStudioSoundGraph(made.project).full
  const [masterFrames] = await measureTrackLatencies([master], SR)
  return {
    plan,
    master,
    latency: planLatencySeconds(plan) + masterFrames / SR,
  }
}

/**
 * Render a Play from silence of `made` pressed at render quantum `quantum`
 * of a fresh offline context whose device callback is `callbackFrames` of
 * its frames. Returns the output and the output frame where the song's
 * frame 0 is heard.
 */
async function renderPlay(made, prepared, quantum, callbackFrames, frozen) {
  const length = Math.round(8 * SR)
  const offline = new OfflineAudioContext(2, length, SR)
  const ctx = clockOf(offline, callbackFrames / SR)
  const base = buffersOn(offline, made.sources)
  const buffers = frozen
    ? new StudioFrozenBuffers(offline, base, frozen.values())
    : base
  let run
  // The press: the run is built on the clock as it stands then.
  offline.suspend((quantum * 128) / SR).then(() => {
    run = buildStudioRun({
      ctx,
      project: made.project,
      plan: prepared.plan,
      buffers: { buffers, release: () => {} },
      releaseMemory: () => {},
      frozen,
      silentLanes: false,
      master: prepared.master,
      measured: { gainDb: 0, safetyGainDb: 0 },
      repeat: false,
      timing: { fromFrame: 0, audibleEpoch: 0 },
      latency: prepared.latency,
      buildGraph: buildStudioGraph,
      createLaneMeter: createStudioLaneMeter,
      fromSilence: true,
      open: openRunEnvelope,
    })
    // No transport ticks offline: schedule the whole song now.
    run.graph.scheduleUntil(Infinity)
    return offline.resume()
  })
  const rendered = await offline.startRendering()
  run.graph.dispose()
  return {
    left: rendered.getChannelData(0),
    right: rendered.getChannelData(1),
    heardFrame: run.audibleEpoch * SR,
  }
}

/** A tone's amplitude in `data` from `from` for `frames` frames (one DFT bin). */
function amplitude(data, hz, from, frames) {
  let re = 0
  let im = 0
  for (let n = 0; n < frames; n++) {
    const w = (2 * Math.PI * hz * n) / SR
    re += data[from + n] * Math.cos(w)
    im -= data[from + n] * Math.sin(w)
  }
  return (2 * Math.hypot(re, im)) / frames
}

/**
 * Two renders of the same song compared on the song's frames: each heard
 * from its own whole frame (rounded when it is not whole).
 */
function compare(a, b, songFrames) {
  const offA = Math.round(a.heardFrame)
  const offB = Math.round(b.heardFrame)
  let worst = 0
  let peak = 0
  for (const channel of ['left', 'right'])
    for (let f = 0; f < songFrames; f++) {
      const x = a[channel][offA + f]
      worst = Math.max(worst, Math.abs(x - b[channel][offB + f]))
      peak = Math.max(peak, Math.abs(x))
    }
  // Tones steady from 0.2 s into the song for one second: whole cycles of each.
  const bands = Object.fromEntries(
    BANDS.map((hz) => [
      `${hz / 1000} kHz`,
      round(
        db(
          amplitude(b.left, hz, offB + 0.2 * SR, SR) /
            amplitude(a.left, hz, offA + 0.2 * SR, SR),
        ),
        3,
      ),
    ]),
  )
  return {
    heardFrames: [a.heardFrame, b.heardFrame].map((f) => round(f, 4)),
    worstDbfs: round(db(worst), 1),
    peakDbfs: round(db(peak), 1),
    bandsDb: bands,
  }
}

/** The lag, within ±8 frames, at which `b` best matches `a`, and what is left there. */
function alignment(a, b, songFrames) {
  const offA = Math.round(a.heardFrame)
  const offB = Math.round(b.heardFrame)
  let best = { lag: 0, residual: Infinity }
  for (let lag = -8; lag <= 8; lag++) {
    let residual = 0
    for (let f = 0; f < songFrames; f++)
      residual = Math.max(
        residual,
        Math.abs(a.left[offA + f] - b.left[offB + f + lag]),
      )
    if (residual < best.residual) best = { lag, residual }
  }
  return { lag: best.lag, worstDbfs: round(db(best.residual), 1) }
}

/** A device callback of 100 ms, in frames of the 48 kHz clock. */
const CALLBACK = 4800

const SONG_FRAMES = Math.round(3.4 * SR)

/** Every band read within a hundredth of a decibel of the first render's. */
const bandsHeld = (result) =>
  Object.values(result.bandsDb).every((change) => Math.abs(change) < 0.01)

/**
 * Two Plays a quantum apart, the second with a callback half a frame
 * shorter: asked for a quantum less half a frame later.
 */
async function halfFrameApart(made, prepared) {
  const a = await renderPlay(made, prepared, 1, CALLBACK)
  const b = await renderPlay(made, prepared, 2, CALLBACK - 0.5)
  return compare(a, b, SONG_FRAMES)
}

/** One dry lane: the two renders are the same audio, sample for sample. */
async function dryLane() {
  const made = song(['other'], true)
  const result = await halfFrameApart(made, await prepare(made, true))
  return { ...result, pass: result.worstDbfs < -90 && bandsHeld(result) }
}

/** One dry lane, Played through a 48 kHz device's 4,096-frame callbacks, then a 44.1 kHz device's. */
async function dryLaneDevices() {
  const made = song(['other'], true)
  const prepared = await prepare(made, true)
  const a = await renderPlay(made, prepared, 1, 4096)
  const b = await renderPlay(made, prepared, 1, (4096 / 44100) * SR)
  const result = compare(a, b, SONG_FRAMES)
  return { ...result, pass: result.worstDbfs < -90 && bandsHeld(result) }
}

/**
 * Four lanes through their role chains at Best and the master. A lane with
 * a reverb does not render the same twice in Chromium, so the floor is the
 * same Play rendered twice, and the half-frame pair must sit at it.
 */
async function fourLaneMix() {
  setPlaybackChoice('best')
  const made = song(['voice', 'acoustic-guitar', 'bass', 'drums'], false)
  const prepared = await prepare(made, false)
  const a = await renderPlay(made, prepared, 1, CALLBACK)
  const again = await renderPlay(made, prepared, 1, CALLBACK)
  const floor = compare(a, again, SONG_FRAMES)
  const result = await halfFrameApart(made, prepared)
  return {
    ...result,
    floorDbfs: floor.worstDbfs,
    pass: result.worstDbfs <= floor.worstDbfs + 6 && bandsHeld(result),
  }
}

/**
 * A lane played from its render against the same lane live, Played on a
 * whole frame and asked for half a frame off one: they line up at lag 0 and
 * keep the same treble both times.
 */
async function frozenAgainstLive() {
  setPlaybackChoice('best')
  const made = song(['acoustic-guitar'], false)
  const live = await prepare(made, false)
  const lane = live.plan.lanes[0]
  const [latencyFrames] = await measureTrackLatencies([lane.spec], SR)
  const render = await renderLaneFreeze(
    lane,
    buffersOn(new OfflineAudioContext(1, 1, SR), made.sources),
    { latencyFrames, key: 'epoch-probe', signal: new AbortController().signal },
  )
  const frozen = new Map([[lane.track.id, render]])
  const played = await prepare(made, false, frozen)
  const results = {}
  for (const [name, callback] of [
    ['whole', CALLBACK],
    ['half', CALLBACK - 0.5],
  ]) {
    const a = await renderPlay(made, live, 1, callback)
    const b = await renderPlay(made, played, 1, callback, frozen)
    results[name] = {
      heardFrames: [a.heardFrame, b.heardFrame].map((f) => round(f, 4)),
      ...alignment(a, b, SONG_FRAMES),
      bandsDb: compare(a, b, SONG_FRAMES).bandsDb,
    }
  }
  return {
    ...results,
    pass: Object.values(results).every(
      (result) => result.lag === 0 && bandsHeld(result),
    ),
  }
}

export async function runStudioEpochProbes() {
  return {
    dryLane: await dryLane(),
    dryLaneDevices: await dryLaneDevices(),
    fourLaneMix: await fourLaneMix(),
    frozenAgainstLive: await frozenAgainstLive(),
  }
}

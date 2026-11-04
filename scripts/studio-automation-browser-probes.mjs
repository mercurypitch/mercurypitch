// Studio lane line browser probes: volume and pan lines Played and exported through the real run and graph code, in real Chromium.
// Imported by scripts/check-studio-epoch-browser.mjs --suite automation inside a page served by the Vite dev server.
//
// A lane's lines play on a stage of gains after its faders (graph-automation.ts),
// written from the anchor every lane shares, live and in a render alike. These
// probes check, on OfflineAudioContext with Chromium's own AudioParam timelines:
// - an export is the Play it stands for, sample for sample, with lines on;
// - a lane played from its render follows the same lines as the lane live;
// - a line lands on the song's frames: a 40 dB drop over 10 ms reads where
//   the song says, to a few hundredths of a decibel;
// - a seek and a loop point cross a line without a step, and a line's level
//   is heard where it is drawn, with Repeat over the song or over a range;
// - what lines cost an export, per lane.
// The song helpers mirror scripts/studio-epoch-browser-probes.mjs.
import { EMPTY_CHAIN } from '/src/lib/studio-fx/chain-spec.ts'
import { measureTrackLatencies } from '/src/lib/studio-fx/mixdown.ts'
import { encodeCanonicalPcm, sha256Bytes, } from '/src/lib/studio/audio/canonical-pcm.ts'
import { resolveStudioSoundGraph } from '/src/lib/studio/export/sound-graph.ts'
import { createStudioLaneMeter } from '/src/lib/studio/metering/live-meter.ts'
import { compileStudioArrangement } from '/src/lib/studio/model/arrangement-plan.ts'
import { studioAutomationValueAt, withStudioAutomation, } from '/src/lib/studio/model/automation.ts'
import { createStudioProject, createStudioTrack, } from '/src/lib/studio/model/defaults.ts'
import { buildStudioGraph } from '/src/lib/studio/playback/graph.ts'
import { StudioFrozenBuffers } from '/src/lib/studio/playback/lane-freeze.ts'
import { renderLaneFreeze } from '/src/lib/studio/playback/lane-freeze-render.ts'
import { renderStudioArrangement } from '/src/lib/studio/playback/offline-render.ts'
import { setPlaybackChoice } from '/src/lib/studio/playback/playback-quality.ts'
import { planLatencySeconds, prepareStudioPlan, } from '/src/lib/studio/playback/prepare-plan.ts'
import { buildStudioRun, openRunEnvelope, } from '/src/lib/studio/playback/run.ts'

const SR = 48000
const NOW = '2026-11-03T12:00:00.000Z'
const s = (seconds) => Math.round(seconds * SR)

const db = (gain) => 20 * Math.log10(Math.max(1e-15, gain))
const round = (value, digits = 2) => Number(value.toFixed(digits))

/** A device callback of 100 ms, in frames of the 48 kHz clock. */
const CALLBACK = 4800
const SONG_FRAMES = s(3.4)

function noise(frames, peak, seed) {
  let state = seed >>> 0
  return Float32Array.from({ length: frames }, () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return (state / 2 ** 32 - 0.5) * 2 * peak
  })
}

function tones(frames, peak) {
  return Float32Array.from({ length: frames }, (_, n) =>
    [1000, 5000].reduce(
      (sum, hz) => sum + peak * Math.sin((2 * Math.PI * hz * n) / SR),
      0,
    ),
  )
}

function asset(id, frames) {
  return {
    id,
    projectId: 'line-probe',
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

/** Points in seconds as a line's points in frames. */
const line = (points) =>
  points.map(([seconds, value]) => ({ frame: s(seconds), value }))

/** A volume line that dips a tone window 12 dB, and a pan line across the noise. */
const LINES = {
  volume: line([
    [0.1, 0],
    [0.5, 0],
    [0.6, -12],
    [1.7, -12],
    [2.4, 0],
    [3.0, -20],
  ]),
  pan: line([
    [1.7, -1],
    [3.2, 1],
  ]),
}

/**
 * A song: lanes of the given roles, each playing a clip of tones from 0.1 s
 * for 1.5 s, then a clip of its own noise from 1.7 s for 1.5 s, with the
 * lines `lines(index)` gives each lane. A dry lane has no effects at all.
 */
function song(roles, dry, lines = () => ({})) {
  const frames = s(1.5)
  const sources = new Map()
  const assets = []
  const clips = []
  const tracks = roles.map((role, index) => {
    const id = `track-${index + 1}`
    let made = createStudioTrack({ id, name: role, order: index, role })
    for (const [kind, data, at] of [
      ['tones', tones(frames, 0.2 / roles.length), s(0.1)],
      ['noise', noise(frames, 0.5 / roles.length, 7 + index), s(1.7)],
    ]) {
      const assetId = `${kind}-${index + 1}`
      assets.push(asset(assetId, frames))
      sources.set(assetId, data)
      clips.push(clip(`${assetId}-clip`, id, assetId, at, frames))
    }
    for (const [param, points] of Object.entries(lines(index)))
      made = withStudioAutomation(made, param, points)
    return dry
      ? { ...made, balanceGainDb: 0, fx: { ...made.fx, baseSpec: EMPTY_CHAIN } }
      : made
  })
  return {
    project: {
      ...createStudioProject({
        id: 'line-probe',
        title: 'Line probe',
        now: NOW,
      }),
      tracks,
      clips,
    },
    assets,
    sources,
  }
}

/** One dry lane holding a quarter of full scale from the song's start to 3.4 s: what it plays is its gain. */
function steady(lines = {}) {
  let track = {
    ...createStudioTrack({ id: 'track-1', name: 'Steady', order: 0 }),
    balanceGainDb: 0,
  }
  track = { ...track, fx: { ...track.fx, baseSpec: EMPTY_CHAIN } }
  for (const [param, points] of Object.entries(lines))
    track = withStudioAutomation(track, param, points)
  const data = new Float32Array(SONG_FRAMES).fill(0.25)
  return {
    project: {
      ...createStudioProject({
        id: 'line-probe',
        title: 'Line probe',
        now: NOW,
      }),
      tracks: [track],
      clips: [clip('steady-clip', 'track-1', 'steady', 0, SONG_FRAMES)],
    },
    assets: [asset('steady', SONG_FRAMES)],
    sources: new Map([['steady', data]]),
  }
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

async function prepare(made, dry, frozen, range) {
  if (dry) {
    const framesByTrack = Object.fromEntries(
      made.project.tracks.map((track) => [track.id, 0]),
    )
    return {
      // A range Repeat plays is a plan from its start to its end (prepare-plan.ts).
      plan: compileStudioArrangement(made.project, made.assets, {
        latencies: { sampleRate: SR, framesByTrack },
        ...(range && {
          startFrame: range.startFrame,
          endFrame: range.endFrame,
        }),
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
    new AbortController().signal,
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
 * Render a Play from silence pressed at render quantum `quantum` of a fresh
 * offline context whose device callback is `callbackFrames` of its frames.
 * `during` runs at the given output times on the run, as a hand would: a
 * seek. A repeating Play is scheduled to the render's end. Returns the
 * output and the output frame where the song's frame 0 is heard.
 */
async function renderPlay(
  made,
  prepared,
  quantum,
  callbackFrames,
  options = {},
) {
  const seconds = options.seconds ?? 8
  const offline = new OfflineAudioContext(2, s(seconds), SR)
  const ctx = clockOf(offline, callbackFrames / SR)
  const base = buffersOn(offline, made.sources)
  const buffers = options.frozen
    ? new StudioFrozenBuffers(offline, base, options.frozen.values())
    : base
  let run
  offline.suspend((quantum * 128) / SR).then(() => {
    run = buildStudioRun({
      ctx,
      project: made.project,
      plan: prepared.plan,
      buffers: { buffers, release: () => {} },
      releaseMemory: () => {},
      frozen: options.frozen,
      silentLanes: false,
      master: prepared.master,
      measured: { gainDb: 0, safetyGainDb: 0 },
      repeat: options.repeat === true,
      timing: { fromFrame: options.range?.startFrame ?? 0, audibleEpoch: 0 },
      fixedEnd: options.range?.endFrame ?? null,
      latency: prepared.latency,
      buildGraph: buildStudioGraph,
      createLaneMeter: createStudioLaneMeter,
      fromSilence: true,
      open: openRunEnvelope,
    })
    // No transport ticks offline: schedule the whole render now.
    run.graph.scheduleUntil(options.repeat === true ? seconds : Infinity)
    return offline.resume()
  })
  for (const [at, act] of options.during ?? [])
    offline.suspend(at).then(() => {
      act(run.graph, offline)
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

/** The largest difference between two renders over the song's first `frames` frames, in dBFS. */
function worstDbfs(a, b, frames, lag = 0) {
  const offA = Math.round(a.heardFrame)
  const offB = Math.round(b.heardFrame) + lag
  let worst = 0
  for (const channel of ['left', 'right'])
    for (let f = 0; f < frames; f++)
      worst = Math.max(
        worst,
        Math.abs(a[channel][offA + f] - b[channel][offB + f]),
      )
  return round(db(worst), 1)
}

/** The lag, within ±8 frames, at which `b` best matches `a`, and what is left there. */
function alignment(a, b, frames) {
  let best = { lag: 0, worstDbfs: Infinity }
  for (let lag = -8; lag <= 8; lag++) {
    const worst = worstDbfs(a, b, frames, lag)
    if (worst < best.worstDbfs) best = { lag, worstDbfs: worst }
  }
  return best
}

/** The song's assets as an export reads them: canonical PCM under its own digest. */
async function exportable(made) {
  const blobs = new Map()
  const assets = []
  for (const item of made.assets) {
    const data = made.sources.get(item.id)
    const blob = await encodeCanonicalPcm({
      sampleRate: SR,
      numberOfChannels: 1,
      length: data.length,
      getChannelData: () => data,
    })
    blobs.set(item.id, blob)
    const digest = await sha256Bytes(await blob.arrayBuffer())
    assets.push({ ...item, canonicalPcmSha256: digest })
  }
  return { assets, read: async (id) => blobs.get(id) }
}

/** The arrangement an export renders, before the master: its first frame is the song's frame 0. */
async function renderExport(made) {
  const { assets, read } = await exportable(made)
  const rendered = await renderStudioArrangement(made.project, assets, read)
  const out = {
    left: rendered.buffer.getChannelData(0),
    right: rendered.buffer.getChannelData(1),
    heardFrame: 0,
    frames: rendered.buffer.length,
  }
  rendered.release()
  return out
}

/** A 1 kHz tone's level in a render over the song's seconds `from` to `to`, in dB. */
function toneDb(render, from, to) {
  return db(
    amplitude(
      render.left,
      1000,
      Math.round(render.heardFrame) + s(from),
      s(to - from),
    ),
  )
}

/**
 * One dry lane with a volume line and a pan line, exported against the same
 * lane Played from a press asked for half a frame off a frame: the same
 * audio to the last bits of a float, as without lines (exportDryLane), and
 * the 1 kHz tone 12 dB down where the line holds it there, in both.
 */
async function exportLines() {
  const made = song(['other'], true, () => LINES)
  const play = await renderPlay(
    made,
    await prepare(made, true),
    2,
    CALLBACK - 0.5,
  )
  const exported = await renderExport(made)
  const frames = Math.min(SONG_FRAMES, exported.frames)
  const dip = [play, exported].map((render) =>
    round(toneDb(render, 0.7, 1.5) - toneDb(render, 0.2, 0.45), 3),
  )
  const result = { worstDbfs: worstDbfs(play, exported, frames), dipDb: dip }
  return {
    ...result,
    pass:
      result.worstDbfs < -120 &&
      dip.every((change) => Math.abs(change + 12) < 0.05),
  }
}

/**
 * Four lanes through their role chains at Best, lines on two of them,
 * exported against a Play with no master: they line up at lag 0, within
 * 6 dB of the floor of the same Play against one whose song lands 148
 * quanta later after its build, as an export's does (exportFourLanes).
 */
async function exportFourLanesLines() {
  setPlaybackChoice('best')
  const made = song(
    ['voice', 'acoustic-guitar', 'bass', 'drums'],
    false,
    (index) =>
      index === 0
        ? { volume: LINES.volume }
        : index === 1
          ? { pan: LINES.pan }
          : {},
  )
  const { plan } = await prepare(made, false)
  const bus = { plan, master: EMPTY_CHAIN, latency: planLatencySeconds(plan) }
  const playAt = async (later) => {
    const first = await renderPlay(made, bus, 2, CALLBACK - 0.5)
    const epoch = Math.round(first.heardFrame - bus.latency * SR)
    const shift = (((24000 - epoch) % 128) + 128) % 128
    if (shift === 0 && later === 0) return first
    return renderPlay(made, bus, 2, CALLBACK - 0.5 + shift + later)
  }
  const play = await playAt(0)
  const floorDbfs = worstDbfs(play, await playAt(148 * 128), SONG_FRAMES)
  const exported = await renderExport(made)
  const { lag, worstDbfs: worst } = alignment(play, exported, SONG_FRAMES)
  return {
    lag,
    worstDbfs: worst,
    floorDbfs,
    pass: lag === 0 && worst <= floorDbfs + 6,
  }
}

/**
 * An acoustic guitar lane with both lines, played from its render against
 * the same lane live: renders are taken before the faders, so the lines
 * ride on both alike, at lag 0 and within -40 dBFS (frozenAgainstLive).
 */
async function frozenLinesAgainstLive() {
  setPlaybackChoice('best')
  const made = song(['acoustic-guitar'], false, () => LINES)
  const live = await prepare(made, false)
  const lane = live.plan.lanes[0]
  const [latencyFrames] = await measureTrackLatencies([lane.spec], SR)
  const render = await renderLaneFreeze(
    lane,
    buffersOn(new OfflineAudioContext(1, 1, SR), made.sources),
    { latencyFrames, key: 'line-probe', signal: new AbortController().signal },
  )
  const frozen = new Map([[lane.track.id, render]])
  const played = await prepare(made, false, frozen)
  const a = await renderPlay(made, live, 1, CALLBACK - 0.5)
  const b = await renderPlay(made, played, 1, CALLBACK - 0.5, { frozen })
  const result = alignment(a, b, SONG_FRAMES)
  return { ...result, pass: result.lag === 0 && result.worstDbfs <= -40 }
}

/** Per output frame, a lined render over the same render without lines: the stage's gain as heard. */
function stageGain(lined, plain, from, to) {
  const offL = Math.round(lined.heardFrame)
  const offP = Math.round(plain.heardFrame)
  return Float64Array.from({ length: to - from }, (_, n) => {
    const under = plain.left[offP + from + n]
    return Math.abs(under) > 1e-4 ? lined.left[offL + from + n] / under : NaN
  })
}

/** A drop of 40 dB over 10 ms at 1 s, flat after, then a climb. */
const STEEP = line([
  [0, 0],
  [1.0, 0],
  [1.01, -40],
  [2.0, -40],
  [2.5, -6],
])

/**
 * The steep line on the steady lane: the gain heard on every seventh frame
 * from 0.9 s to 2.6 s of the song is the line's value at that frame, in a
 * Play and in an export, to within 0.05 dB: 40 dB in 10 ms is 0.08 dB a
 * frame, so a line a frame off would miss.
 */
async function lineOnTime() {
  const lined = steady({ volume: STEEP })
  const plain = steady()
  const misses = {}
  const plays = [
    [
      'play',
      async (made) =>
        renderPlay(made, await prepare(made, true), 2, CALLBACK - 0.5),
    ],
    ['export', (made) => renderExport(made)],
  ]
  for (const [name, render] of plays) {
    const a = await render(lined)
    const b = await render(plain)
    const gains = stageGain(a, b, s(0.9), s(2.6))
    let worst = 0
    for (let n = 0; n < gains.length; n += 7) {
      if (Number.isNaN(gains[n])) continue
      const expected = studioAutomationValueAt(STEEP, s(0.9) + n)
      worst = Math.max(worst, Math.abs(db(gains[n]) - expected))
    }
    misses[name] = round(worst, 4)
  }
  return {
    worstMissDb: misses,
    pass: Object.values(misses).every((miss) => miss <= 0.05),
  }
}

/**
 * The largest change of the stage's heard gain from one frame to the next,
 * over the song's frames `from` to `to` of a lined Play against the same
 * Play without lines, and the largest a 10 ms glide may take there.
 */
function largestStep(lined, plain, from, to) {
  const gains = stageGain(lined, plain, from, to)
  let step = 0
  for (let n = 1; n < gains.length; n++)
    if (!Number.isNaN(gains[n]) && !Number.isNaN(gains[n - 1]))
      step = Math.max(step, Math.abs(gains[n] - gains[n - 1]))
  return step
}

/** The steady lane rising from -20 dB to 0 dB over its 3.4 s. */
const RISE = line([
  [0, -20],
  [3.4, 0],
])

/** The worst a heard gain misses its line by, in dB, on every seventh frame from `from` to `to` that `songFrame` places. */
function worstMiss(gains, points, from, to, songFrame) {
  let worst = 0
  for (let n = from; n < to; n += 7) {
    const frame = songFrame(n)
    if (frame === null || Number.isNaN(gains[n])) continue
    worst = Math.max(
      worst,
      Math.abs(db(gains[n]) - studioAutomationValueAt(points, frame)),
    )
  }
  return round(worst, 4)
}

/**
 * A Play of the rising lane seeks from about 1.6 s back to 0.4 s. Its gain
 * follows the line up to the seek, crosses to the line's value at the new
 * place over 10 ms, no frame moving it more than that glide does, and
 * follows the line from there, all to within 0.05 dB. Cut without a glide,
 * the line would ramp from the old value to the next point instead, a
 * decibel or more off for up to a sixth of a second.
 */
async function seekGlides() {
  const to = s(0.4)
  let landed = null
  const during = [
    [
      1.7,
      (graph, offline) => {
        landed = graph.seek(to, graph.seekTime(offline.currentTime + 0.05))
        graph.scheduleUntil(Infinity)
      },
    ],
  ]
  const lined = steady({ volume: RISE })
  const plain = steady()
  const options = { during, seconds: 6 }
  const a = await renderPlay(
    lined,
    await prepare(lined, true),
    2,
    CALLBACK,
    options,
  )
  // A dry lane hears the seek's frame when it lands: frames of the Play since its song's frame 0.
  const at = Math.round(landed * SR - a.heardFrame)
  const b = await renderPlay(
    plain,
    await prepare(plain, true),
    2,
    CALLBACK,
    options,
  )
  const end = s(4.5)
  const gains = stageGain(a, b, 0, end)
  const step = largestStep(a, b, s(0.1), end)
  const glideFrames = 0.01 * SR
  const glide =
    Math.abs(
      10 ** (studioAutomationValueAt(RISE, at) / 20) -
        10 ** (studioAutomationValueAt(RISE, to + glideFrames) / 20),
    ) / glideFrames
  const missDb = worstMiss(gains, RISE, s(0.1), end, (n) =>
    n < at ? n : n > at + glideFrames ? to + (n - at) : null,
  )
  return {
    seekAtSongFrame: at,
    largestStep: round(step, 6),
    glideStep: round(glide, 6),
    missDb,
    pass: step <= 3 * glide && missDb <= 0.05,
  }
}

/**
 * A repeating Play of the rising lane: each loop point takes the gain from
 * 0 dB back to -20 dB over 10 ms, no frame moving it more than that glide
 * does, where a cut would move it 0.9 at once; around the loop points the
 * gain follows the line, pass after pass, to within 0.05 dB.
 */
async function loopGlides() {
  const lined = steady({ volume: RISE })
  const plain = steady()
  const options = { repeat: true, seconds: 8 }
  const a = await renderPlay(
    lined,
    await prepare(lined, true),
    2,
    CALLBACK,
    options,
  )
  const b = await renderPlay(
    plain,
    await prepare(plain, true),
    2,
    CALLBACK,
    options,
  )
  // Two loop points, 3.4 s and 6.8 s into the song's run.
  const end = s(7.5)
  const gains = stageGain(a, b, 0, end)
  const step = largestStep(a, b, s(0.1), end)
  const glideFrames = 0.01 * SR
  const glide = (1 - 0.1) / glideFrames
  const missDb = worstMiss(gains, RISE, s(0.1), end, (n) => {
    const frame = n % SONG_FRAMES
    return n >= SONG_FRAMES && frame <= glideFrames ? null : frame
  })
  return {
    largestStep: round(step, 6),
    glideStep: round(glide, 6),
    missDb,
    pass: step <= 3 * glide && missDb <= 0.05,
  }
}

/**
 * Repeat over a range of the rising lane, 0.9 s to 2.5 s, as the ruler's
 * range sets it (loop-range.ts): each loop point takes the gain from the
 * line's value at the range's end back to its value at the range's start
 * over 10 ms, no frame moving it more than that glide does, and between
 * loop points the gain follows the line, pass after pass, to within
 * 0.05 dB. A line read from the song's start at each loop point would
 * miss by 5.4 dB.
 */
async function rangeLoopGlides() {
  const range = { startFrame: s(0.9), endFrame: s(2.5) }
  const lined = steady({ volume: RISE })
  const plain = steady()
  const options = { repeat: true, seconds: 6, range }
  const a = await renderPlay(
    lined,
    await prepare(lined, true, undefined, range),
    2,
    CALLBACK,
    options,
  )
  const b = await renderPlay(
    plain,
    await prepare(plain, true, undefined, range),
    2,
    CALLBACK,
    options,
  )
  const length = range.endFrame - range.startFrame
  // Three loop points, 1.6 s, 3.2 s and 4.8 s into the run.
  const end = s(5.5)
  const gains = stageGain(a, b, 0, end)
  const step = largestStep(a, b, s(0.1), end)
  const glideFrames = 0.01 * SR
  const heard = (seconds) => 10 ** ((-20 + (20 * seconds) / 3.4) / 20)
  const glide = (heard(2.5) - heard(0.9)) / glideFrames
  const missDb = worstMiss(gains, RISE, s(0.1), end, (n) => {
    const into = n % length
    return n >= length && into <= glideFrames ? null : range.startFrame + into
  })
  return {
    largestStep: round(step, 6),
    glideStep: round(glide, 6),
    missDb,
    pass: step <= 3 * glide && missDb <= 0.05,
  }
}

/**
 * What lines cost an export: eight dry lanes over a 20 s song, each with a
 * volume line of 40 points and a pan line of 20, against the same lanes
 * without lines; the median of three renders of each.
 */
async function exportCost() {
  const lanes = 8
  const seconds = 20
  const frames = s(seconds)
  const build = (lined) => {
    const sources = new Map()
    const assets = []
    const clips = []
    const tracks = Array.from({ length: lanes }, (_, index) => {
      const id = `track-${index + 1}`
      let made = {
        ...createStudioTrack({ id, name: `Lane ${index + 1}`, order: index }),
        balanceGainDb: 0,
      }
      made = { ...made, fx: { ...made.fx, baseSpec: EMPTY_CHAIN } }
      if (lined) {
        made = withStudioAutomation(
          made,
          'volume',
          Array.from({ length: 40 }, (_, at) => ({
            frame: Math.round((at * frames) / 40),
            value: at % 2 === 0 ? -3 : -18,
          })),
        )
        made = withStudioAutomation(
          made,
          'pan',
          Array.from({ length: 20 }, (_, at) => ({
            frame: Math.round((at * frames) / 20),
            value: at % 2 === 0 ? -0.8 : 0.8,
          })),
        )
      }
      const assetId = `noise-${index + 1}`
      assets.push(asset(assetId, frames))
      sources.set(assetId, noise(frames, 0.1, 11 + index))
      clips.push(clip(`${assetId}-clip`, id, assetId, 0, frames))
      return made
    })
    return {
      project: {
        ...createStudioProject({
          id: 'line-probe',
          title: 'Line cost',
          now: NOW,
        }),
        tracks,
        clips,
      },
      assets,
      sources,
    }
  }
  const time = async (made) => {
    const runs = []
    for (let run = 0; run < 3; run++) {
      const started = performance.now()
      await renderExport(made)
      runs.push(performance.now() - started)
    }
    return runs.sort((x, y) => x - y)[1]
  }
  const plainMs = await time(build(false))
  const linedMs = await time(build(true))
  return {
    plainMs: round(plainMs, 1),
    linedMs: round(linedMs, 1),
    perLaneMinuteMs: round(((linedMs - plainMs) / lanes) * (60 / seconds), 1),
    pass: true,
  }
}

export async function runStudioAutomationProbes() {
  return {
    exportLines: await exportLines(),
    exportFourLanesLines: await exportFourLanesLines(),
    frozenLinesAgainstLive: await frozenLinesAgainstLive(),
    lineOnTime: await lineOnTime(),
    seekGlides: await seekGlides(),
    loopGlides: await loopGlides(),
    rangeLoopGlides: await rangeLoopGlides(),
    exportCost: await exportCost(),
  }
}

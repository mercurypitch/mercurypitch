// Studio comp browser probes: a comped loop take Played against its export, what its joins do to the sound, and songs with no comp hashed so a later build can be checked bit for bit.
// Imported by scripts/check-studio-comp-browser.mjs inside a page served by the Vite dev server.
//
// A comp plays stretches of one take's passes, each pass a window of the
// same audio, with an equal-power crossfade at each join (comp-plan.ts).
// Play and Export build the same plan through the same graph code, so a
// comped clip exports as it plays: on a dry lane to the last bit of a
// float, through a chain within the floor two Plays of the same song set.
// The passes here are sines of different pitch and phase, whose own steps
// from sample to sample are small: a join butted edge to edge would step
// as far as the two sides lie apart. Across a crossfade the export steps
// no further than the planned envelope allows: each side's own step at its
// gain, plus its level times how far its gain moves in one frame.
// A lane's volume and pan lines play on a stage after its faders
// (graph-automation.ts), so they ride over a comp as over any clip: a comp
// under lines exports as it plays, and the lines are heard on it. A comp
// split at a join, and split halves of the take on two passes, cross where
// they meet as a comp's stretches do, so each plays as the comp of the
// same passes does.
import { EMPTY_CHAIN } from '/src/lib/studio-fx/chain-spec.ts'
import { measureTrackLatencies } from '/src/lib/studio-fx/mixdown.ts'
import { encodeCanonicalPcm, sha256Bytes, } from '/src/lib/studio/audio/canonical-pcm.ts'
import { createStudioLaneMeter } from '/src/lib/studio/metering/live-meter.ts'
import { compileStudioArrangement } from '/src/lib/studio/model/arrangement-plan.ts'
import { applyStudioCommand } from '/src/lib/studio/model/commands.ts'
import { createStudioProject, createStudioTrack, } from '/src/lib/studio/model/defaults.ts'
import { studioSegmentGain } from '/src/lib/studio/playback/edge-envelope.ts'
import { buildStudioGraph } from '/src/lib/studio/playback/graph.ts'
import { renderStudioArrangement } from '/src/lib/studio/playback/offline-render.ts'
import { setPlaybackChoice } from '/src/lib/studio/playback/playback-quality.ts'
import { planLatencySeconds, prepareStudioPlan, } from '/src/lib/studio/playback/prepare-plan.ts'
import { buildStudioRun, openRunEnvelope, } from '/src/lib/studio/playback/run.ts'

const SR = 48000
const NOW = '2026-11-04T12:00:00.000Z'
/** Each pass of the loop take: 1.5 s, as a range of three beats at 120 bpm. */
const PASS = 1.5 * SR
/** Before the first pass: a count-in's worth of capture the clip never plays. */
const LEAD = 0.25 * SR
const PASSES = 3
/** Where the clip starts on the song's timeline. */
const AT = 0.2 * SR
/** The comp's joins, in frames into the clip: off any quantum or whole millisecond. */
const JOINS = [27_311, 51_029]
/** The crossfade half-length a join gets from these neighbours: 5 ms (comp-plan.ts). */
const HALF = 240

export const db = (gain) => 20 * Math.log10(Math.max(1e-15, gain))
const round = (value, digits = 2) => Number(value.toFixed(digits))

/** Pass `index` of the take: a sine of its own pitch and phase. */
const PASS_TONES = [
  { hz: 220, phase: 0.3 },
  { hz: 331, phase: 2.1 },
  { hz: 497, phase: 4.4 },
]

/** The loop take's audio: the lead, then each pass's sine, at 0.4 peak. */
function takeAudio() {
  const frames = LEAD + PASSES * PASS
  return Float32Array.from({ length: frames }, (_, n) => {
    const pass = Math.min(PASSES - 1, Math.floor(Math.max(0, n - LEAD) / PASS))
    const { hz, phase } = PASS_TONES[pass]
    return 0.4 * Math.sin((2 * Math.PI * hz * n) / SR + phase)
  })
}

/** Seeded white noise. */
function noise(frames, peak, seed) {
  let state = seed >>> 0
  return Float32Array.from({ length: frames }, () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return (state / 2 ** 32 - 0.5) * 2 * peak
  })
}

function asset(id, frames) {
  return {
    id,
    projectId: 'comp-probe',
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
    provenance: { kind: 'recording', importedAt: NOW },
  }
}

const NO_FADES = { curve: 'linear-amplitude' }

/** The loop take's clip on pass `heard`, the whole pass long, its passes kept. */
function takeClip(id, trackId, heard) {
  const first = LEAD + heard * PASS
  return {
    id,
    trackId,
    assetId: 'take',
    startFrame: AT,
    sourceInFrame: first,
    sourceOutFrame: first + PASS,
    gainDb: 0,
    fades: NO_FADES,
    passes: { firstFrame: LEAD, frames: PASS, count: PASSES },
  }
}

/** The comp the probes play: pass 0, then pass 2, then pass 1, on the clip heard on pass 1. */
function compOf(clip) {
  const [a, b] = JOINS.map((join) => clip.sourceInFrame + join)
  return [
    { fromSourceFrame: clip.sourceInFrame, toSourceFrame: a, pass: 0 },
    { fromSourceFrame: a, toSourceFrame: b, pass: 2 },
    { fromSourceFrame: b, toSourceFrame: clip.sourceOutFrame, pass: 1 },
  ]
}

/** A one-lane song of `role` (a dry lane has no effects) holding `clips`, under volume and pan `lines` if given. */
function song(role, dry, clips, sources, lines) {
  const made = createStudioTrack({ id: 'lane', name: role, order: 0, role })
  const plain = dry
    ? { ...made, balanceGainDb: 0, fx: { ...made.fx, baseSpec: EMPTY_CHAIN } }
    : made
  const track = lines === undefined ? plain : { ...plain, automation: lines }
  const project = {
    ...createStudioProject({ id: 'comp-probe', title: 'Comp probe', now: NOW }),
    tracks: [track],
    clips,
  }
  const assets = sources.map(([id, data]) => asset(id, data.length))
  return { project, assets, sources: new Map(sources) }
}

/** A comped loop take, alone on a lane, under `lines` if given. */
function compedSong(role, dry, lines) {
  const clip = takeClip('take-clip', 'lane', 1)
  return song(
    role,
    dry,
    [{ ...clip, comp: compOf(clip) }],
    [['take', takeAudio()]],
    lines,
  )
}

/** A frame of the song, `seconds` in. */
const frameAt = (seconds) => Math.round(seconds * SR)

/** A lane line through `[seconds, value]` points. */
const line = (points) =>
  points.map(([seconds, value]) => ({ frame: frameAt(seconds), value }))

/**
 * Lines over the comped clip (0.2 s to 1.7 s, joins at 0.769 s and
 * 1.263 s): the pan swings across the first join, and the volume holds
 * 12 dB down across the second.
 */
const COMP_LINES = {
  volume: line([
    [0.1, 0],
    [0.9, 0],
    [1, -12],
    [1.6, -12],
  ]),
  pan: line([
    [0.1, 0],
    [0.6, -0.5],
    [0.9, 0.5],
    [1, 0],
  ]),
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

/** The plan a song plays with, latencies measured at 48 kHz as playback measures them. */
async function prepare(made, dry) {
  if (dry) {
    const framesByTrack = Object.fromEntries(
      made.project.tracks.map((track) => [track.id, 0]),
    )
    const plan = compileStudioArrangement(made.project, made.assets, {
      latencies: { sampleRate: SR, framesByTrack },
    })
    return { plan, latency: 0 }
  }
  const plan = await prepareStudioPlan(
    made.project,
    made.assets,
    SR,
    0,
    new AbortController().signal,
    measureTrackLatencies,
  )
  return { plan, latency: planLatencySeconds(plan) }
}

/**
 * A Play from silence of `made`, pressed at render quantum `quantum` of a
 * fresh offline context whose device callback is `callbackFrames` of its
 * frames, with no master: the run and graph code a Play runs.
 */
async function renderPlay(
  made,
  prepared,
  quantum,
  callbackFrames,
  seconds = 4,
) {
  const offline = new OfflineAudioContext(2, Math.round(seconds * SR), SR)
  const ctx = clockOf(offline, callbackFrames / SR)
  const buffers = buffersOn(offline, made.sources)
  let run
  offline.suspend((quantum * 128) / SR).then(() => {
    run = buildStudioRun({
      ctx,
      project: made.project,
      plan: prepared.plan,
      buffers: { buffers, release: () => {} },
      releaseMemory: () => {},
      frozen: undefined,
      silentLanes: false,
      master: EMPTY_CHAIN,
      measured: { gainDb: 0, safetyGainDb: 0 },
      repeat: false,
      timing: { fromFrame: 0, audibleEpoch: 0 },
      latency: prepared.latency,
      buildGraph: buildStudioGraph,
      createLaneMeter: createStudioLaneMeter,
      fromSilence: true,
      open: openRunEnvelope,
    })
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
    left: rendered.buffer.getChannelData(0).slice(),
    right: rendered.buffer.getChannelData(1).slice(),
    heardFrame: 0,
    frames: rendered.buffer.length,
  }
  rendered.release()
  return out
}

/** How many of the song's frames up to `to` both renders hold. */
function sharedFrames(a, b, to) {
  return Math.min(
    to,
    a.left.length - Math.round(a.heardFrame),
    b.left.length - Math.round(b.heardFrame),
  )
}

/** The largest difference between two renders on the song's frames `[from, to)` both hold, in dBFS. */
function worstBetween(a, b, from, to) {
  const offA = Math.round(a.heardFrame)
  const offB = Math.round(b.heardFrame)
  const last = sharedFrames(a, b, to)
  let worst = 0
  for (const channel of ['left', 'right'])
    for (let f = from; f < last; f++)
      worst = Math.max(
        worst,
        Math.abs(a[channel][offA + f] - b[channel][offB + f]),
      )
  return round(db(worst), 1)
}

/** The lag, within ±8 frames, at which `b` best matches `a`. */
function lagBetween(a, b, from, to) {
  const offA = Math.round(a.heardFrame)
  const offB = Math.round(b.heardFrame)
  let best = { lag: 0, residual: Infinity }
  for (let lag = -8; lag <= 8; lag++) {
    let residual = 0
    for (let f = from; f < to; f++)
      residual = Math.max(
        residual,
        Math.abs(a.left[offA + f] - b.left[offB + f + lag]),
      )
    if (residual < best.residual) best = { lag, residual }
  }
  return best.lag
}

/** A device callback of 100 ms, in frames of the 48 kHz clock. */
const CALLBACK = 4800
/** The clip and a quarter second after it. */
const SONG_FRAMES = AT + PASS + 0.25 * SR

/**
 * A comped clip on a dry lane, Played from a press half a frame off a frame
 * and exported: the same audio to the last bit of a float, over every
 * frame of the clip (a dry export ends with its last clip).
 */
async function exportCompedDryLane() {
  const made = compedSong('other', true)
  const play = await renderPlay(
    made,
    await prepare(made, true),
    2,
    CALLBACK - 0.5,
  )
  const exported = await renderExport(made)
  const comparedFrames = sharedFrames(play, exported, SONG_FRAMES)
  const worstDbfs = worstBetween(play, exported, 0, SONG_FRAMES)
  return {
    worstDbfs,
    comparedFrames,
    pass: comparedFrames >= AT + PASS && worstDbfs < -140,
  }
}

/** The level of `[from, to)` of the song in a render, both sides, in dBFS. */
function rmsDb(render, from, to) {
  const off = Math.round(render.heardFrame)
  let sum = 0
  for (const channel of ['left', 'right'])
    for (let f = from; f < to; f++) sum += render[channel][off + f] ** 2
  return db(Math.sqrt(sum / (2 * (to - from))))
}

/**
 * The comped dry lane under a volume and a pan line, exported against its
 * Play: the comp's joins and the lane's lines play together, an export the
 * Play it stands for to the -120 dBFS a lane with lines alone is held to
 * (exportLines in studio-automation-browser-probes.mjs). And the volume
 * line is heard on the comp: 12 dB down over its low stretch, a join and
 * all, against the same comp with no lines.
 */
async function exportCompedLinedLane() {
  const made = compedSong('other', true, COMP_LINES)
  const play = await renderPlay(
    made,
    await prepare(made, true),
    2,
    CALLBACK - 0.5,
  )
  const exported = await renderExport(made)
  const comparedFrames = sharedFrames(play, exported, SONG_FRAMES)
  const worstDbfs = worstBetween(play, exported, 0, SONG_FRAMES)
  const low = [frameAt(1.05), frameAt(1.55)]
  const plain = await renderExport(compedSong('other', true))
  const lowered = await renderExport(
    compedSong('other', true, { volume: COMP_LINES.volume }),
  )
  const dipDb = round(rmsDb(lowered, ...low) - rmsDb(plain, ...low), 3)
  return {
    worstDbfs,
    comparedFrames,
    dipDb,
    pass:
      comparedFrames >= AT + PASS &&
      worstDbfs < -120 &&
      Math.abs(dipDb + 12) < 0.05,
  }
}

/**
 * The comped clip through the voice chain at Best: Play and export line up
 * at lag 0 and differ no more than two Plays of the same song do, one
 * pressed a whole number of quanta after the other (exportFourLanes in
 * studio-epoch-browser-probes.mjs: a compressor works in 32-frame steps of
 * each quantum, so placing the song elsewhere in one moves it a little).
 */
async function exportCompedVoice() {
  setPlaybackChoice('best')
  const made = compedSong('voice', false)
  const prepared = await prepare(made, false)
  const first = await renderPlay(made, prepared, 2, CALLBACK - 0.5)
  const epoch = Math.round(first.heardFrame - prepared.latency * SR)
  const shift = (((24000 - epoch) % 128) + 128) % 128
  const play =
    shift === 0
      ? first
      : await renderPlay(made, prepared, 2, CALLBACK - 0.5 + shift)
  const later = await renderPlay(
    made,
    prepared,
    2,
    CALLBACK - 0.5 + shift + 148 * 128,
  )
  const floorDbfs = worstBetween(play, later, 0, SONG_FRAMES)
  const exported = await renderExport(made)
  const worstDbfs = worstBetween(play, exported, 0, SONG_FRAMES)
  const lag = lagBetween(play, exported, 0, SONG_FRAMES)
  return {
    worstDbfs,
    floorDbfs,
    lag,
    pass: lag === 0 && worstDbfs <= floorDbfs + 6,
  }
}

/** The largest step from one sample to the next in `data` over `[from, to)`. */
function peakStep(data, from, to) {
  let peak = 0
  for (let n = Math.max(1, from); n < to; n++)
    peak = Math.max(peak, Math.abs(data[n] - data[n - 1]))
  return peak
}

/** The largest level in `data` over `[from, to)`. */
function peakLevel(data, from, to) {
  let peak = 0
  for (let n = Math.max(0, from); n < to; n++)
    peak = Math.max(peak, Math.abs(data[n]))
  return peak
}

/** A segment's last frame on the song's timeline, exclusive. */
const segmentEnd = (segment) =>
  segment.startFrame + segment.sourceOutFrame - segment.sourceInFrame

/**
 * The largest step of `render` across the crossing at song frame `cut`,
 * against the most the planned `segments` allow there (see joinSteps):
 * each segment sounding there, its own step at its gain, plus its level
 * times how far its gain moves in one frame. `lane` is the lane's gain
 * from a source sample to the render.
 */
function stepAcross(render, segments, audio, cut, lane) {
  const off = Math.round(render.heardFrame)
  const from = cut - HALF - 2
  const to = cut + HALF + 2
  const sides = segments
    .filter((segment) => segment.startFrame < to && segmentEnd(segment) > from)
    .map((segment) => {
      const centre = segment.sourceInFrame + cut - segment.startFrame
      return {
        gain: (n) =>
          n >= segment.startFrame && n < segmentEnd(segment)
            ? studioSegmentGain(segment, n)
            : 0,
        step: peakStep(audio, centre - HALF - 2, centre + HALF + 2),
        level: peakLevel(audio, centre - HALF - 2, centre + HALF + 2),
      }
    })
  let allowed = 0
  for (let n = from + 1; n < to; n++)
    allowed = Math.max(
      allowed,
      sides.reduce(
        (sum, side) =>
          sum +
          side.gain(n) * side.step +
          side.level * Math.abs(side.gain(n) - side.gain(n - 1)),
        0,
      ),
    )
  const step = peakStep(render.left, off + from, off + to)
  return {
    stepDbfs: round(db(step), 2),
    allowedDbfs: round(db(lane * allowed), 2),
    pass: step <= lane * allowed * 1.01 + 1e-6,
  }
}

/** The lane's gain from a source sample to `render`, read 10000 frames into a clip on pass `pass` at AT. */
function laneGain(render, audio, pass) {
  const off = Math.round(render.heardFrame)
  const middle = AT + 10_000
  return (
    peakLevel(render.left, off + middle, off + middle + SR / 10) /
    peakLevel(
      audio,
      LEAD + pass * PASS + 10_000,
      LEAD + pass * PASS + 10_000 + SR / 10,
    )
  )
}

/** `made` with `commands` applied, as a person's edits would leave it. */
function edited(made, commands) {
  const project = commands.reduce(
    (song, command) =>
      applyStudioCommand(song, command, { assets: made.assets, now: NOW }),
    made.project,
  )
  return { ...made, project }
}

/**
 * Two ways a loop take splits where two passes meet, each against the comp
 * that plays the same passes unsplit: the probes' comp split at its first
 * join, which leaves its left half pass 0 played whole; and the take on
 * pass 1, uncomped, split at the same frame, its right half moved to pass
 * 2 (against the comp of pass 1, then pass 2). The halves cross where they
 * meet as the comp's stretches do (comp-plan.ts), so each Plays and
 * exports as its comp does; at the cut the step stays within what the
 * planned envelope allows, live and in the export; and the level over the
 * 5 ms around the cut is the comp's, where a ramp to silence at either
 * edge would dip it.
 */
async function splitJoins() {
  const cut = AT + JOINS[0]
  const split = { type: 'split-clip', clipId: 'take-clip', atFrame: cut }
  const comped = compedSong('other', true)
  const clip = takeClip('take-clip', 'lane', 1)
  const at = clip.sourceInFrame + JOINS[0]
  const cases = {
    compSplit: {
      split: edited(comped, [{ ...split, newClipId: 'take-clip-b' }]),
      comp: comped,
      pass: 0,
    },
    halvesOnTwoPasses: {
      split: edited(song('other', true, [clip], [['take', takeAudio()]]), [
        { ...split, newClipId: 'take-clip-b' },
        { type: 'choose-pass', clipId: 'take-clip-b', pass: 2 },
      ]),
      comp: song(
        'other',
        true,
        [
          {
            ...clip,
            comp: [
              {
                fromSourceFrame: clip.sourceInFrame,
                toSourceFrame: at,
                pass: 1,
              },
              {
                fromSourceFrame: at,
                toSourceFrame: clip.sourceOutFrame,
                pass: 2,
              },
            ],
          },
        ],
        [['take', takeAudio()]],
      ),
      pass: 1,
    },
  }
  const audio = takeAudio()
  const results = {}
  for (const [name, { split: made, comp, pass }] of Object.entries(cases)) {
    const segments = compileStudioArrangement(made.project, made.assets)
      .lanes[0].segments
    const renders = {
      play: await renderPlay(
        made,
        await prepare(made, true),
        2,
        CALLBACK - 0.5,
      ),
      export: await renderExport(made),
    }
    const against = {
      play: await renderPlay(
        comp,
        await prepare(comp, true),
        2,
        CALLBACK - 0.5,
      ),
      export: await renderExport(comp),
    }
    const result = { clips: made.project.clips.length }
    for (const kind of ['play', 'export']) {
      const render = renders[kind]
      const near = [cut - HALF / 2, cut + HALF / 2]
      result[kind] = {
        ...stepAcross(
          render,
          segments,
          audio,
          cut,
          laneGain(render, audio, pass),
        ),
        againstCompDbfs: worstBetween(render, against[kind], 0, SONG_FRAMES),
        dipDb: round(rmsDb(render, ...near) - rmsDb(against[kind], ...near), 3),
      }
    }
    result.pass =
      result.clips === 2 &&
      ['play', 'export'].every(
        (kind) =>
          result[kind].pass &&
          result[kind].againstCompDbfs < -140 &&
          Math.abs(result[kind].dipDb) < 0.01,
      )
    results[name] = result
  }
  return {
    ...results,
    pass: Object.values(results).every((result) => result.pass),
  }
}

/**
 * At each join, the export's largest step across the crossfade, against
 * the most the planned envelope allows there and the step a join butted
 * edge to edge would take. With side i at gain g_i on a frame, its own
 * step s_i and its level a_i, one frame's step is at most
 * sum of g_i * s_i + a_i * |g_i - g_i before|, and a 10 ms crossfade
 * moves a gain by 1/306 a frame at most. Equal power lets
 * two passes of different pitch step a little further than either alone
 * (sqrt(s_1^2 + s_2^2) at most), which is a mix, not a click. A frame
 * dropped or doubled, or a gain that jumps, steps far beyond it.
 */
async function joinSteps() {
  const made = compedSong('other', true)
  const exported = await renderExport(made)
  const audio = takeAudio()
  const clip = made.project.clips[0]
  const order = clip.comp.map((part) => part.pass)
  const segments = compileStudioArrangement(made.project, made.assets).lanes[0]
    .segments
  const ends = (segment) =>
    segment.startFrame + segment.sourceOutFrame - segment.sourceInFrame
  // The lane's gain from a source sample to the export: 1 on a dry lane at its centre.
  const middle = AT + 10_000
  const lane =
    peakLevel(exported.left, middle, middle + SR / 10) /
    peakLevel(audio, LEAD + 0 * PASS + 10_000, LEAD + 10_000 + SR / 10)
  const joins = JOINS.map((join, index) => {
    const at = AT + join
    const from = at - HALF - 2
    const to = at + HALF + 2
    // The two sides' source frames at the join: the clip's own, moved by whole passes.
    const source = (pass) => clip.sourceInFrame + join + (pass - 1) * PASS
    const before = source(order[index])
    const after = source(order[index + 1])
    const sides = [segments[index], segments[index + 1]].map(
      (segment, side) => {
        const centre = side === 0 ? before : after
        const gain = (n) =>
          n >= segment.startFrame && n < ends(segment)
            ? studioSegmentGain(segment, n)
            : 0
        return {
          gain,
          step: peakStep(audio, centre - HALF - 2, centre + HALF + 2),
          level: peakLevel(audio, centre - HALF - 2, centre + HALF + 2),
        }
      },
    )
    let allowed = 0
    for (let n = from + 1; n < to; n++)
      allowed = Math.max(
        allowed,
        sides.reduce(
          (sum, side) =>
            sum +
            side.gain(n) * side.step +
            side.level * Math.abs(side.gain(n) - side.gain(n - 1)),
          0,
        ),
      )
    const step = peakStep(exported.left, from, to)
    const butted = Math.abs(audio[after] - audio[before - 1])
    return {
      frame: at,
      stepDbfs: round(db(step), 2),
      allowedDbfs: round(db(lane * allowed), 2),
      ownStepDbfs: round(db(Math.max(...sides.map((side) => side.step))), 2),
      buttedStepDbfs: round(db(butted), 2),
      // Float32 gains and curves interpolated between 65 points: a hair of slack.
      pass: step <= lane * allowed * 1.01 + 1e-6,
    }
  })
  return {
    laneGain: round(lane, 4),
    joins,
    pass: joins.every((join) => join.pass),
  }
}

/** SHA-256 of a render's two channels, as hex. */
async function hashOf(render) {
  const left = new Float32Array(render.left)
  const right = new Float32Array(render.right)
  const bytes = new Uint8Array(left.byteLength + right.byteLength)
  bytes.set(new Uint8Array(left.buffer, left.byteOffset, left.byteLength), 0)
  bytes.set(
    new Uint8Array(right.buffer, right.byteOffset, right.byteLength),
    left.byteLength,
  )
  return sha256Bytes(bytes.buffer)
}

/**
 * Songs with no comp, Played and exported, hashed: a plain clip with fades
 * and gain, a split that coalesces and the loop take on its middle pass
 * with fades, on a dry lane, on a dry lane under volume and pan lines, and
 * through the bass chain (which renders the same every time). Split halves
 * of the take on two passes left these songs when they began to cross
 * where they meet: splitJoins holds them to the comp of the same passes.
 */
function uncompedSongs() {
  const plain = noise(1.2 * SR, 0.3, 11)
  const fades = {
    curve: 'linear-amplitude',
    in: { fromSourceFrame: 0, toSourceFrame: 2400 },
    out: { fromSourceFrame: 50_000, toSourceFrame: 57_600 },
  }
  const clips = (trackId) => {
    const take = takeClip('take-clip', trackId, 1)
    const takeFades = {
      curve: 'linear-amplitude',
      in: {
        fromSourceFrame: take.sourceInFrame,
        toSourceFrame: take.sourceInFrame + 960,
      },
      out: {
        fromSourceFrame: take.sourceOutFrame - 4800,
        toSourceFrame: take.sourceOutFrame,
      },
    }
    return [
      {
        id: 'plain-a',
        trackId,
        assetId: 'plain',
        startFrame: 2 * SR,
        sourceInFrame: 0,
        sourceOutFrame: 20_000,
        gainDb: -3,
        fades,
      },
      {
        id: 'plain-b',
        trackId,
        assetId: 'plain',
        startFrame: 2 * SR + 20_000,
        sourceInFrame: 20_000,
        sourceOutFrame: 57_600,
        gainDb: -3,
        fades,
      },
      { ...take, gainDb: 1.5, fades: takeFades },
    ]
  }
  const sources = [
    ['take', takeAudio()],
    ['plain', plain],
  ]
  const lines = {
    volume: line([
      [0.1, 0],
      [1, -6],
      [2.5, -6],
      [3, 0],
      [4.2, -12],
      [5, 0],
    ]),
    pan: line([
      [0.1, 0],
      [1, -0.7],
      [2, 0.7],
      [4.5, 0],
    ]),
  }
  return [
    ['dry', song('other', true, clips('lane'), sources), true],
    ['lined', song('other', true, clips('lane'), sources, lines), true],
    ['bass', song('bass', false, clips('lane'), sources), false],
  ]
}

async function uncompedHashes() {
  setPlaybackChoice('best')
  const hashes = {}
  for (const [name, made, dry] of uncompedSongs()) {
    const prepared = await prepare(made, dry)
    const play = await renderPlay(made, prepared, 2, CALLBACK - 0.5, 7)
    hashes[`${name}Play`] = await hashOf(play)
    hashes[`${name}Export`] = await hashOf(await renderExport(made))
  }
  return { hashes, pass: true }
}

/** The probes; `comp: false` runs only what a build without comping can. */
export async function runStudioCompProbes({ comp = true } = {}) {
  const results = { uncompedHashes: await uncompedHashes() }
  if (!comp) return results
  results.exportCompedDryLane = await exportCompedDryLane()
  results.exportCompedLinedLane = await exportCompedLinedLane()
  results.exportCompedVoice = await exportCompedVoice()
  results.joinSteps = await joinSteps()
  results.splitJoins = await splitJoins()
  return results
}

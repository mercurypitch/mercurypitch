// Studio monitor browser probes: an armed input heard through its lane, offline and live, in real Chromium.
// Imported by scripts/check-studio-epoch-browser.mjs --suite monitor inside a page served by the Vite dev server.
//
// The input monitor (input-monitor.ts) plays the armed input through its
// lane's chain at the monitor profile (fx-profile.ts MONITOR_FX_PROFILE),
// in which no effect delays the signal, then through the master every
// monitored lane shares (monitor-master.ts). These probes measure, at
// 48 kHz:
// - latency: the frames each effect, and each role's new lane, adds before
//   anything is heard, monitored and at full quality;
// - plumbing: the monitor rendered offline against the lane's path built as
//   playback builds one (graph-lanes.ts), at the monitor profile;
// - live: the monitor on a running AudioContext against that render, and
//   the lag that lines them up best;
// - lanes: lanes armed on one input through the recorder's own split and
//   a monitor each (armed-input.ts), against each lane's path built by
//   hand on the channel or pair it picks, summed: two lanes on two sides,
//   two on one side, one on the pair, and one on an input the browser
//   gives no count for, where an input heard twice, or a lane hearing
//   another's side, would show. Each lane plays its whole chain, its echo
//   included: no node of an echo adds more than two signals
//   (effects/delay.ts), so two builds of one lane play it to the bit;
// - sound: each role's new lane monitored, against the same lane at full
//   quality, as a take on it plays back;
// - master: the song's master after the lane at a measured gain of 0, +6
//   and -4 dB, and as on each side of Compare, against the lane alone: the
//   level it plays a tone at, the frames it adds, the steepest step while a
//   tone heard live meets a gain change and a switch to each side of
//   Compare, and its ceiling with +8 dB on a tone peaking at -3 dBFS. On
//   Before the lane plays with every effect off, as Before plays the song:
//   that lane against its faders alone, and the steepest step while a voice
//   lane heard live switches between the sides and back to playback;
// - cost: render time per 128-frame quantum, dry and through lanes, through
//   the song's master and through none, and the main thread's time to
//   build a lane's path and to follow a change.
// Each monitor here hears its input from the first sample (`settled`), as
// it does an instrument: how a microphone's monitor rises on the arm is
// measured by studio-record-monitor-disarm.spec.ts. Each plays through a
// master with no effects, so that only its lane is measured, except where
// a probe names the song's master.
// Latency, plumbing, live and lanes pass on the bar the lane line probes
// hold an export to: -120 dBFS. The master passes when a tone's level moves
// by the gain within 0.1 dB, it adds no frame, no step at a change is
// steeper than 1.1 times the tone's own (while a step with no glide, there
// for scale, is), and its ceiling holds, passing a tone 3 dB or more under
// it within 0.1 dB. Sound and cost are reports:
// sound passes when every lane renders, cost while a monitored lane takes
// under a tenth of a quantum's time.
import { createStudioFxChain } from '/src/lib/studio-fx/chain.ts'
import { normalizeChainSpec } from '/src/lib/studio-fx/chain-spec.ts'
import { measureCompressorLatency } from '/src/lib/studio-fx/compressor-twin.ts'
import { EFFECT_KINDS } from '/src/lib/studio-fx/effect-definitions.ts'
import { FULL_FX_PROFILE, MONITOR_FX_PROFILE, } from '/src/lib/studio-fx/fx-profile.ts'
import { measureChainLatencyFrames } from '/src/lib/studio-fx/render.ts'
import { TRACK_ROLES } from '/src/lib/studio-fx/role-chains.ts'
import { measureShaperDelays } from '/src/lib/studio-fx/shaper-delay.ts'
import { prepareZeroLatencyCompressor } from '/src/lib/studio-fx/zero-latency-compressor.ts'
import { createStudioProject, createStudioTrack, } from '/src/lib/studio/model/defaults.ts'
import { frameTime } from '/src/lib/studio/playback/whole-frame.ts'
import { createStudioArmedInputs } from '/src/lib/studio/record/armed-input.ts'
import { createStudioInputMonitor } from '/src/lib/studio/record/input-monitor.ts'
import { createStudioMonitorMaster } from '/src/lib/studio/record/monitor-master.ts'
import { studioMonitorMasterGain, studioMonitorMasterSpec, studioMonitorSound, } from '/src/lib/studio/record/monitor-sound.ts'
import { scaleTo, syntheticVoice } from '/scripts/studio-fx-browser-probes.mjs'

export const SR = 48000
const NOW = '2026-11-05T12:00:00.000Z'
export const s = (seconds) => Math.round(seconds * SR)
export const round = (value, digits = 2) => Number(value.toFixed(digits))
/** A level in dBFS, or 'exact' for a difference of nothing at all. */
export const dbfs = (value) =>
  value === 0 ? 'exact' : round(20 * Math.log10(value), 1)
export const ms = (frames) => round((frames / SR) * 1000, 2)
/** The bar a render is held to against what it stands for (studio-automation-browser-probes.mjs). */
export const BAR_DBFS = -120
export const withinBar = (level) => level === 'exact' || level <= BAR_DBFS

/** Where an input starts: past the monitor's rise from silence. */
export const START = s(0.75)
/** Compared from this far into the input, past its first syllable. */
export const SKIP = s(0.5)
export const EMPTY_SPEC = normalizeChainSpec({ effects: [] })

export function laneProject(role, over = {}) {
  const project = createStudioProject({ id: 'monitor-probe', now: NOW })
  const lane = {
    ...createStudioTrack({ id: 'lane', name: 'Lane', order: 0, role }),
    ...over,
  }
  return { ...project, tracks: [lane] }
}

/** A new lane of `role` as the monitor hears it; `dry` as on Compare's Before side, every effect off. */
export function laneSound(role, over, dry = false) {
  return studioMonitorSound(laneProject(role, over), 'lane', { on: true, dry })
}

/** A new song's master as the monitor plays it, at a measured `gainDb`; `bypassed` as on Compare's Before side. */
export function songMaster(gainDb, bypassed = false) {
  return studioMonitorMasterSpec(
    laneProject('voice'),
    { gainDb, safetyGainDb: 0 },
    { bypassed },
  )
}

/**
 * Compare's gains for a song the master lifts +6 dB, matched on a side
 * turned down: Before by 5 dB, After by 3 dB, so both sides move.
 */
const COMPARED = {
  beforeEncodingGainDb: 0,
  beforeGainDb: -5,
  afterGainDb: -3,
  gainDb: 6,
  safetyGainDb: 0,
}

/** The master the monitor plays while Compare plays `side` (monitor-sound.ts): the side's gain, and no master on Before. */
function comparedMaster(side) {
  const gain = studioMonitorMasterGain(
    { gainDb: 0, safetyGainDb: 0 },
    { side, gains: COMPARED },
  )
  return {
    gainDb: gain.gainDb,
    spec: studioMonitorMasterSpec(laneProject('voice'), gain, {
      bypassed: side === 'before',
    }),
  }
}

/** A lane with no effects at unity: what reaches the master is the input. */
export const PLAIN_LANE = { on: true, spec: EMPTY_SPEC, gains: [1, 1] }

function withoutKinds(sound, kinds) {
  const spec = normalizeChainSpec({
    ...sound.spec,
    effects: sound.spec.effects.filter(
      (effect) => !kinds.includes(effect.kind),
    ),
  })
  return { ...sound, spec }
}

/** Every effect, each at its defaults: the heaviest chain a lane can carry. */
const EVERY_EFFECT = normalizeChainSpec({
  effects: EFFECT_KINDS.map((kind) => ({ kind, params: {}, enabled: true })),
})

/** A sung vowel at the loudness playback prepares a take to (preparation-gain.ts). */
export const voiceInput = (seconds) => scaleTo(syntheticVoice(seconds), -18)

function spreadGain(ctx) {
  const gain = ctx.createGain()
  gain.channelCount = 2
  gain.channelCountMode = 'explicit'
  gain.channelInterpretation = 'speakers'
  return gain
}

export function sourceOf(ctx, buffer, frame) {
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.start(frameTime(frame, SR))
  return source
}

/** The lane's path as playback builds one (graph-lanes.ts): spread as a clip is, the chain, then a gain per side. */
export function buildLanePath(ctx, source, sound, profile) {
  const chain = createStudioFxChain(ctx, sound.spec, {
    profile,
    stereoHold: true,
  })
  const split = ctx.createChannelSplitter(2)
  const merge = ctx.createChannelMerger(2)
  sound.gains.forEach((value, side) => {
    const gain = ctx.createGain()
    gain.gain.value = value
    split.connect(gain, side)
    gain.connect(merge, 0, side)
  })
  source.connect(spreadGain(ctx)).connect(chain.input)
  chain.output.connect(split)
  merge.connect(ctx.destination)
  return () => chain.dispose()
}

export async function renderOffline(length, build) {
  const ctx = new OfflineAudioContext({
    numberOfChannels: 2,
    length,
    sampleRate: SR,
  })
  // A monitored compressor runs on a worklet, loaded on each context before
  // a chain is built, as the recorder loads it (zero-latency-compressor.ts).
  await prepareZeroLatencyCompressor(ctx)
  const cleanup = build(ctx)
  const rendered = await ctx.startRendering()
  cleanup?.()
  return [rendered.getChannelData(0), rendered.getChannelData(1)]
}

/** A timer on the render's own clock, for a monitor released mid-render. */
export function renderClock(ctx) {
  return (callback, delayMs) => {
    const at = Math.ceil(((ctx.currentTime + delayMs / 1000) * SR) / 128) * 128
    void ctx.suspend(at / SR).then(() => {
      callback()
      void ctx.resume()
    })
    return () => {}
  }
}

/** The monitor itself, rendered offline: `sound` set at 0, the input from START, through `masterSpec`. */
export function monitorRender(
  input,
  sound,
  length = START + input.length,
  masterSpec = EMPTY_SPEC,
) {
  return renderOffline(length, (ctx) => {
    const monitor = createStudioInputMonitor(ctx, sourceOf(ctx, input, START), {
      master: createStudioMonitorMaster(masterSpec),
      schedule: renderClock(ctx),
      settled: true,
    })
    monitor.set(sound)
  })
}

export function lanePathRender(
  input,
  sound,
  profile,
  length = START + input.length,
) {
  return renderOffline(length, (ctx) =>
    buildLanePath(ctx, sourceOf(ctx, input, START), sound, profile),
  )
}

/** `a` from `fromA` against `b` from `fromB`, over `count` frames of both sides. */
export function compare(a, b, fromA, fromB, count) {
  let peak = 0
  let differences = 0
  let signal = 0
  for (let side = 0; side < 2; side++)
    for (let i = 0; i < count; i++) {
      const x = a[side][fromA + i]
      const difference = x - b[side][fromB + i]
      peak = Math.max(peak, Math.abs(difference))
      differences += difference * difference
      signal += x * x
    }
  const n = 2 * count
  return {
    peakDifferenceDbfs: dbfs(peak),
    rmsDifferenceDbfs: dbfs(Math.sqrt(differences / n)),
    signalRmsDbfs: dbfs(Math.sqrt(signal / n)),
  }
}

export function rmsOf(data, from, count) {
  let sum = 0
  for (const side of data)
    for (let i = from; i < from + count; i++) sum += side[i] * side[i]
  return Math.sqrt(sum / (2 * count))
}

export function peakOf(data, from, count) {
  let peak = 0
  for (const side of data)
    for (let i = from; i < from + count; i++)
      peak = Math.max(peak, Math.abs(side[i]))
  return peak
}

/** Frames from an impulse to the first thing heard, above -60 dBFS. */
export async function firstHeard(spec, profile) {
  const at = s(0.6)
  const impulse = new AudioBuffer({ length: 1, sampleRate: SR })
  impulse.getChannelData(0)[0] = 1
  const out = await renderOffline(s(1), (ctx) =>
    buildLanePath(
      ctx,
      sourceOf(ctx, impulse, at),
      { spec, gains: [1, 1] },
      profile,
    ),
  )
  for (let i = at; i < out[0].length; i++)
    if (Math.abs(out[0][i]) > 1e-3 || Math.abs(out[1][i]) > 1e-3) return i - at
  return null
}

async function latencyProbe() {
  await Promise.all([measureCompressorLatency(SR), measureShaperDelays(SR)])
  const effects = {}
  for (const kind of EFFECT_KINDS) {
    const spec = normalizeChainSpec({
      effects: [{ kind, params: {}, enabled: true }],
    })
    effects[kind] = {
      monitoredMs: ms(await firstHeard(spec, MONITOR_FX_PROFILE)),
      fullMs: ms(await firstHeard(spec, FULL_FX_PROFILE)),
    }
  }
  const lanes = {}
  for (const role of TRACK_ROLES) {
    const { spec } = laneSound(role)
    lanes[role] = {
      monitoredMs: ms(await firstHeard(spec, MONITOR_FX_PROFILE)),
      fullMs: ms(await firstHeard(spec, FULL_FX_PROFILE)),
      compensatedMs: ms(await measureChainLatencyFrames(spec, SR)),
    }
  }
  const monitored = [...Object.values(effects), ...Object.values(lanes)].map(
    (entry) => entry.monitoredMs,
  )
  return { pass: monitored.every((value) => value === 0), effects, lanes }
}

async function plumbingProbe() {
  const input = voiceInput(4)
  const voice = laneSound('voice', { gainDb: -3, pan: -0.3 })
  const cases = {
    'voice lane, -3 dB, pan -0.3': voice,
    'voice lane without its reverb': withoutKinds(voice, ['reverb']),
    'no effects': { ...voice, spec: EMPTY_SPEC },
  }
  const out = {}
  for (const [name, sound] of Object.entries(cases)) {
    const monitored = await monitorRender(input, sound)
    const lane = await lanePathRender(input, sound, MONITOR_FX_PROFILE)
    const again = await lanePathRender(input, sound, MONITOR_FX_PROFILE)
    const from = START + SKIP
    const count = input.length - SKIP
    out[name] = {
      monitorAgainstLane: compare(monitored, lane, from, from, count),
      laneAgainstItself: compare(lane, again, from, from, count),
    }
  }
  const pass = Object.values(out).every(({ monitorAgainstLane }) =>
    withinBar(monitorAgainstLane.peakDifferenceDbfs),
  )
  return { pass, ...out }
}

const RECORDER = `
class MonitorProbeRecorder extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0]
    if (input.length > 0)
      this.port.postMessage({
        frame: currentFrame,
        left: input[0].slice(),
        right: (input[1] ?? input[0]).slice(),
      })
    return true
  }
}
registerProcessor('monitor-probe-recorder', MonitorProbeRecorder)
`

/** The context behind each live view: `new AudioWorkletNode(view, ...)` makes its node there. */
const viewed = new WeakMap()
const NativeWorkletNode = globalThis.AudioWorkletNode
globalThis.AudioWorkletNode = new Proxy(NativeWorkletNode, {
  construct: (target, [context, ...rest]) =>
    new target(viewed.get(context) ?? context, ...rest),
})

/** A running context whose destination is a recorder: what the monitor sends to the speakers, frame by frame. */
export async function liveContext() {
  const ctx = new AudioContext({ sampleRate: SR, latencyHint: 'interactive' })
  await ctx.resume()
  const url = URL.createObjectURL(
    new Blob([RECORDER], { type: 'application/javascript' }),
  )
  await ctx.audioWorklet.addModule(url)
  const recorder = new AudioWorkletNode(ctx, 'monitor-probe-recorder', {
    channelCount: 2,
    channelCountMode: 'explicit',
    outputChannelCount: [2],
  })
  const tap = ctx.createGain()
  tap.connect(recorder).connect(ctx.destination)
  const chunks = []
  recorder.port.onmessage = (event) => chunks.push(event.data)
  const view = new Proxy(ctx, {
    get(target, key) {
      if (key === 'destination') return tap
      const value = target[key]
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
  viewed.set(view, ctx)
  await prepareZeroLatencyCompressor(view)
  return { ctx, view, chunks }
}

/** The recorded frames from `first`, `length` of them, laid out as an offline render. */
export function laidOut(chunks, first, length) {
  const out = [new Float32Array(length), new Float32Array(length)]
  for (const { frame, left, right } of chunks) {
    for (let i = 0; i < left.length; i++) {
      const at = frame + i - first
      if (at < 0 || at >= length) continue
      out[0][at] = left[i]
      out[1][at] = right[i]
    }
  }
  return out
}

export const median = (values) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]

export async function untilClock(ctx, time) {
  while (ctx.currentTime < time)
    await new Promise((resolve) => setTimeout(resolve, 50))
}

/** The monitor on a running context against its offline render; also what building and following a lane cost the main thread. */
async function liveRun(input, sound, masterSpec = EMPTY_SPEC) {
  const { ctx, view, chunks } = await liveContext()
  const source = ctx.createBufferSource()
  source.buffer = input
  const monitor = createStudioInputMonitor(view, source, {
    master: createStudioMonitorMaster(masterSpec),
    settled: true,
  })
  let started = performance.now()
  monitor.set(sound)
  const buildMs = performance.now() - started
  // The page's clock is coarse: time 200 calls at once.
  started = performance.now()
  for (let i = 0; i < 200; i++) monitor.set(sound)
  const sameMs = (performance.now() - started) / 200
  started = performance.now()
  for (let i = 0; i < 200; i++) {
    const gain = i % 2 === 0 ? 0.9 : 1
    monitor.set({
      ...sound,
      gains: [sound.gains[0] * gain, sound.gains[1] * gain],
    })
  }
  const movedMs = (performance.now() - started) / 200
  monitor.set(sound)
  const startFrame = Math.ceil((ctx.currentTime + 0.75) * SR)
  source.start(frameTime(startFrame, SR))
  await untilClock(ctx, (startFrame + input.length) / SR + 0.2)
  // The recorder's last quanta are still on their way to this thread.
  await new Promise((resolve) => setTimeout(resolve, 200))
  monitor.dispose()
  await ctx.close()
  const length = START + input.length
  const live = laidOut(chunks, startFrame - START, length)
  const offline = await monitorRender(input, sound, length, masterSpec)
  const from = START + SKIP
  const count = input.length - SKIP - s(0.1)
  // The lag that lines the live output up best with the render, within 10 ms each way.
  let best = { lag: 0, energy: Infinity }
  for (let lag = -480; lag <= 480; lag++) {
    let energy = 0
    for (let i = from; i < from + SR; i += 4) {
      const difference = live[0][i] - offline[0][i + lag]
      energy += difference * difference
    }
    if (energy < best.energy) best = { lag, energy }
  }
  return {
    againstRender: compare(live, offline, from, from, count),
    bestLagFrames: best.lag,
    baseLatencyMs: round(ctx.baseLatency * 1000, 2),
    outputLatencyMs: round(ctx.outputLatency * 1000, 2),
    mainThread: {
      buildMs: round(buildMs, 2),
      sameSoundMicros: round(sameMs * 1000, 1),
      faderMoveMicros: round(movedMs * 1000, 1),
    },
  }
}

async function liveProbe() {
  const input = voiceInput(4)
  const voice = laneSound('voice')
  const out = {
    'voice lane': await liveRun(input, voice),
    'voice lane without its reverb': await liveRun(
      input,
      withoutKinds(voice, ['reverb']),
    ),
    'no effects': await liveRun(input, { ...voice, spec: EMPTY_SPEC }),
    // A lane with effects is left out: the master's EQ turns a difference
    // near -140 dBFS at its input (a reverb's threads) into one near -90,
    // its own rounding. The lanes above show their own.
    "no effects, through the song's master": await liveRun(
      input,
      { ...voice, spec: EMPTY_SPEC },
      songMaster(0),
    ),
  }
  const pass = Object.values(out).every(
    (run) =>
      run.bestLagFrames === 0 &&
      withinBar(run.againstRender.peakDifferenceDbfs),
  )
  return { pass, ...out }
}

/** A stream as an arm opens it: only its track's channel count is read (lane-channel.ts `reportedChannels`). */
function streamOf(channelCount) {
  const track = {
    readyState: 'live',
    getSettings: () => (channelCount === null ? {} : { channelCount }),
  }
  return { getAudioTracks: () => [track] }
}

/** A voice on input 1 and the same voice 0.3 s on, at another level, on input 2: each side tells itself apart. */
function twoSides(seconds) {
  const voice = voiceInput(seconds).getChannelData(0)
  const shift = s(0.3)
  const both = new AudioBuffer({
    numberOfChannels: 2,
    length: voice.length,
    sampleRate: SR,
  })
  both.getChannelData(0).set(voice)
  const right = both.getChannelData(1)
  for (let i = 0; i < voice.length; i++)
    right[i] = 0.5 * voice[(i + shift) % voice.length]
  return both
}

/** One side of `input`, or both summed and halved as the split mixes a pair (input-channels.ts), as a mono buffer. */
function monoOf(input, pick) {
  const out = new AudioBuffer({
    numberOfChannels: 1,
    length: input.length,
    sampleRate: SR,
  })
  const [left, right] = [input.getChannelData(0), input.getChannelData(1)]
  const to = out.getChannelData(0)
  for (let i = 0; i < input.length; i++)
    to[i] =
      pick === 'pair' ? (left[i] + right[i]) * 0.5 : [left, right][pick][i]
  return out
}

/** Every lane armed on `input` through the recorder's split and a monitor of its own, as an arm opens them. */
function armedLanesRender(input, channels, lanes) {
  return renderOffline(START + input.length, (ctx) => {
    const inputs = createStudioArmedInputs(() => sourceOf(ctx, input, START))
    const stream = streamOf(channels)
    const master = createStudioMonitorMaster(EMPTY_SPEC)
    for (const { pick, sound } of lanes) {
      const armed = inputs.open(ctx, { stream, pick, release: () => {} })
      const monitor = createStudioInputMonitor(ctx, armed.node, {
        master,
        schedule: renderClock(ctx),
        settled: true,
      })
      monitor.set(sound)
    }
  })
}

/** Each lane's path built by hand on the mono signal its pick takes, summed. */
function handBuiltLanesRender(input, lanes) {
  return renderOffline(START + input.length, (ctx) => {
    const cleanups = lanes.map(({ heard, sound }) =>
      buildLanePath(
        ctx,
        sourceOf(ctx, monoOf(input, heard), START),
        sound,
        MONITOR_FX_PROFILE,
      ),
    )
    return () => cleanups.forEach((cleanup) => cleanup())
  })
}

/** Lanes armed on one input, against their paths built by hand: whole lanes, echo and all. */
async function lanesProbe() {
  const input = twoSides(4)
  const voice = laneSound('voice')
  const guitar = laneSound('acoustic-guitar')
  const quieter = laneSound('voice', { gainDb: -6, pan: 0.4 })
  const one = (channel) => ({ channel, pair: false })
  const cases = {
    'two lanes on inputs 1 and 2, each through its own chain': {
      channels: 2,
      lanes: [
        { pick: one(0), heard: 0, sound: voice },
        { pick: one(1), heard: 1, sound: guitar },
      ],
    },
    'two lanes on input 2': {
      channels: 2,
      lanes: [
        { pick: one(1), heard: 1, sound: voice },
        { pick: one(1), heard: 1, sound: quieter },
      ],
    },
    'a lane on inputs 1 + 2': {
      channels: 2,
      lanes: [
        { pick: { channel: 0, pair: true }, heard: 'pair', sound: voice },
      ],
    },
    'a lane on an input the browser gives no count for, folded as its take': {
      channels: null,
      lanes: [{ pick: null, heard: 'pair', sound: voice }],
    },
  }
  const out = {}
  for (const [name, { channels, lanes }] of Object.entries(cases)) {
    const armed = await armedLanesRender(input, channels, lanes)
    const built = await handBuiltLanesRender(input, lanes)
    const from = START + SKIP
    out[name] = compare(armed, built, from, from, input.length - SKIP)
  }
  const pass = Object.values(out).every((result) =>
    withinBar(result.peakDifferenceDbfs),
  )
  return { pass, ...out }
}

async function soundProbe() {
  await Promise.all([measureCompressorLatency(SR), measureShaperDelays(SR)])
  const input = voiceInput(4)
  const out = {}
  for (const role of TRACK_ROLES) {
    const sound = laneSound(role)
    const latency = await measureChainLatencyFrames(sound.spec, SR)
    const length = START + input.length
    const full = await lanePathRender(
      input,
      sound,
      FULL_FX_PROFILE,
      length + latency,
    )
    const monitored = await monitorRender(input, sound, length)
    const from = START + SKIP
    const count = input.length - SKIP
    const playedRms = rmsOf(full, from + latency, count)
    const shifted = full.map((side) => side.subarray(latency))
    const { rmsDifferenceDbfs } = compare(monitored, shifted, from, from, count)
    out[role] = {
      levelDb: round(
        20 * Math.log10(rmsOf(monitored, from, count) / playedRms),
        2,
      ),
      peakDb: round(
        20 *
          Math.log10(
            peakOf(monitored, from, count) /
              peakOf(full, from + latency, count),
          ),
        2,
      ),
      differenceDb: round(rmsDifferenceDbfs - 20 * Math.log10(playedRms), 1),
    }
  }
  const pass = Object.values(out).every((lane) =>
    Object.values(lane).every(Number.isFinite),
  )
  return { pass, ...out }
}

/** A steady sine of `seconds` peaking at `peakDbfs`, faded in and out over 10 ms. */
export function tone(seconds, peakDbfs, hz = 440) {
  const length = s(seconds)
  const buffer = new AudioBuffer({ length, sampleRate: SR })
  const data = buffer.getChannelData(0)
  const peak = 10 ** (peakDbfs / 20)
  const fade = s(0.01)
  for (let i = 0; i < length; i++) {
    const edge = Math.min(1, i / fade, (length - 1 - i) / fade)
    const ramp = 0.5 - 0.5 * Math.cos(Math.PI * edge)
    data[i] = peak * ramp * Math.sin((2 * Math.PI * hz * i) / SR)
  }
  return buffer
}

export const levelDbOf = (data, from, count) =>
  20 * Math.log10(rmsOf(data, from, count))

/** The steepest step from one sample to the next on either side, over `count` frames from `from`. */
export function steepestStep(data, from, count) {
  let steepest = 0
  for (const side of data)
    for (let i = Math.max(1, from); i < from + count; i++)
      steepest = Math.max(steepest, Math.abs(side[i] - side[i - 1]))
  return steepest
}

/** The lag, within 10 ms each way, at which `b` lines up best with `a`: the largest correlation. */
export function bestLag(a, b, from, count) {
  let best = { lag: 0, score: -Infinity }
  for (let lag = -480; lag <= 480; lag++) {
    let score = 0
    for (let i = from; i < from + count; i += 2)
      score += a[0][i] * b[0][i + lag] + a[1][i] * b[1][i + lag]
    if (score > best.score) best = { lag, score }
  }
  return best.lag
}

/** Frames from an impulse at the monitor's input to the first thing heard, above -60 dBFS, through `masterSpec`. */
export async function monitorFirstHeard(sound, masterSpec) {
  const impulse = new AudioBuffer({ length: 1, sampleRate: SR })
  impulse.getChannelData(0)[0] = 0.5
  const out = await monitorRender(impulse, sound, START + s(0.25), masterSpec)
  for (let i = START; i < out[0].length; i++)
    if (Math.abs(out[0][i]) > 1e-3 || Math.abs(out[1][i]) > 1e-3)
      return i - START
  return null
}

/** A tone through the voice lane at each measured gain, and on each of Compare's sides: its level against the lane alone. */
async function masterLevels() {
  const input = tone(2, -20)
  const voice = laneSound('voice')
  const from = START + SKIP
  const count = input.length - SKIP - s(0.1)
  const alone = levelDbOf(await monitorRender(input, voice), from, count)
  const out = { laneAloneDbfs: round(alone, 2) }
  for (const gainDb of [0, 6, -4]) {
    const heard = levelDbOf(
      await monitorRender(input, voice, undefined, songMaster(gainDb)),
      from,
      count,
    )
    out[`${gainDb > 0 ? '+' : ''}${gainDb} dB`] = {
      levelDbfs: round(heard, 2),
      againstLaneDb: round(heard - alone, 3),
      offByDb: round(heard - alone - gainDb, 3),
    }
  }
  // Compare's sides move the song by their gains; the voice moves with it,
  // on Before through its lane with every effect off, as Before plays the
  // song, so against that lane alone.
  const dry = laneSound('voice', undefined, true)
  const dryAlone = levelDbOf(await monitorRender(input, dry), from, count)
  out.dryLaneAloneDbfs = round(dryAlone, 2)
  for (const side of ['before', 'after']) {
    const { gainDb, spec } = comparedMaster(side)
    const lane = side === 'before' ? dry : voice
    const reference = side === 'before' ? dryAlone : alone
    const heard = levelDbOf(
      await monitorRender(input, lane, undefined, spec),
      from,
      count,
    )
    out[`Compare ${side}, ${gainDb > 0 ? '+' : ''}${gainDb} dB`] = {
      levelDbfs: round(heard, 2),
      againstLaneDb: round(heard - reference, 3),
      offByDb: round(heard - reference - gainDb, 3),
    }
  }
  return out
}

/** The voice lane with every effect off, as on Before, against the same lane's faders with no chain at all: the input at the faders, nothing else. */
async function dryLaneAgainstFaders() {
  const input = voiceInput(2)
  const dry = laneSound('voice', { gainDb: -3, pan: -0.3 }, true)
  const from = START + SKIP
  return compare(
    await monitorRender(input, dry),
    await monitorRender(input, { ...dry, spec: EMPTY_SPEC }),
    from,
    from,
    input.length - SKIP,
  )
}

/** The frames the master adds: an impulse's first sound, and the lag that lines a voice up best, against the lane alone. */
async function masterLatency() {
  await Promise.all([measureCompressorLatency(SR), measureShaperDelays(SR)])
  const voice = laneSound('voice')
  // What the same master would add at full quality, its lookahead and oversampling in.
  const out = {
    atFullQualityMs: ms(await firstHeard(songMaster(0), FULL_FX_PROFILE)),
  }
  for (const [name, sound] of Object.entries({
    'voice lane': voice,
    'no effects': PLAIN_LANE,
  })) {
    const alone = await monitorFirstHeard(sound, EMPTY_SPEC)
    const through = await monitorFirstHeard(sound, songMaster(0))
    out[name] = {
      laneAloneFrames: alone,
      throughMasterFrames: through,
      addedFrames: through - alone,
    }
  }
  const input = voiceInput(3)
  const alone = await monitorRender(input, voice)
  const through = await monitorRender(input, voice, undefined, songMaster(0))
  out.voiceBestLagFrames = bestLag(alone, through, START + SKIP, SR)
  return out
}

/** A tone heard live while the master's gain moves and Compare takes the master out and back: at each change, the steepest step against the tone's own on either side of it. Last, for scale, a +6 dB step with no glide, ahead of the monitor. */
async function masterChangesLive() {
  const { ctx, view, chunks } = await liveContext()
  const input = tone(6.5, -20)
  const source = ctx.createBufferSource()
  source.buffer = input
  const step = ctx.createGain()
  source.connect(step)
  const master = createStudioMonitorMaster(songMaster(0))
  const monitor = createStudioInputMonitor(view, step, {
    master,
    settled: true,
  })
  monitor.set(PLAIN_LANE)
  const startFrame = Math.ceil((ctx.currentTime + 0.75) * SR)
  source.start(frameTime(startFrame, SR))
  const changes = [
    { name: '0 to +6 dB', make: () => master.follow(songMaster(6)) },
    { name: '+6 to -4 dB', make: () => master.follow(songMaster(-4)) },
    {
      name: "Compare's Before side",
      make: () => master.follow(comparedMaster('before').spec),
    },
    {
      name: "Compare's After side",
      make: () => master.follow(comparedMaster('after').spec),
    },
    {
      name: 'a +6 dB step with no glide, for scale',
      make: () => step.gain.setValueAtTime(2, ctx.currentTime),
    },
  ]
  const changedAt = []
  for (const [index, change] of changes.entries()) {
    await untilClock(ctx, startFrame / SR + index + 1)
    changedAt.push(Math.round(ctx.currentTime * SR) - startFrame)
    change.make()
  }
  await untilClock(ctx, (startFrame + input.length) / SR + 0.2)
  // The recorder's last quanta are still on their way to this thread.
  await new Promise((resolve) => setTimeout(resolve, 200))
  monitor.dispose()
  await ctx.close()
  const live = laidOut(chunks, startFrame, input.length)
  const out = {}
  changes.forEach(({ name }, index) => {
    const at = changedAt[index]
    const before = { from: at - s(0.45), count: s(0.4) }
    const after = { from: at + s(0.3), count: s(0.4) }
    const own = Math.max(
      steepestStep(live, before.from, before.count),
      steepestStep(live, after.from, after.count),
    )
    const during = steepestStep(live, at - s(0.05), s(0.35))
    out[name] = {
      levelStepDb: round(
        levelDbOf(live, after.from, after.count) -
          levelDbOf(live, before.from, before.count),
        2,
      ),
      steepestAgainstToneOwn: round(during / own, 3),
    }
  })
  return out
}

/** The ceiling with +8 dB: a tone driven past it, and tones 3 dB and more under it against the same master with its limiter out. */
async function masterCeiling() {
  const spec = songMaster(8)
  const ceilingDb = spec.effects.find((effect) => effect.kind === 'limiter')
    .params.ceilingDb
  const unlimited = {
    ...spec,
    effects: spec.effects.map((effect) =>
      effect.kind === 'limiter' ? { ...effect, enabled: false } : effect,
    ),
  }
  const out = { ceilingDbfs: ceilingDb }
  for (const peakDbfs of [-3, -12.5, -16, -22]) {
    const input = tone(1.5, peakDbfs)
    const from = START + SKIP
    const count = input.length - SKIP - s(0.1)
    const limited = await monitorRender(input, PLAIN_LANE, undefined, spec)
    const plain = await monitorRender(input, PLAIN_LANE, undefined, unlimited)
    const intoDbfs = 20 * Math.log10(peakOf(plain, START, input.length))
    out[`tone at ${peakDbfs} dBFS`] = {
      intoCeilingDbfs: round(intoDbfs, 2),
      outPeakDbfs: round(
        20 * Math.log10(peakOf(limited, START, input.length)),
        3,
      ),
      overCeilingDb: round(
        20 * Math.log10(peakOf(limited, START, input.length)) - ceilingDb,
        4,
      ),
      levelAgainstUnlimitedDb: round(
        levelDbOf(limited, from, count) - levelDbOf(plain, from, count),
        4,
      ),
    }
  }
  return out
}

/**
 * A voice lane heard live as Compare switches sides and stops: on Before the
 * lane's effects and the master's go out and the gain goes to Before's, on
 * After they come back at After's gain, and once Compare stops the master
 * takes the measured gain alone. The steepest step at each switch, against
 * the tone's own around it.
 */
async function compareSidesLive() {
  const { ctx, view, chunks } = await liveContext()
  const input = tone(5.5, -20)
  const source = ctx.createBufferSource()
  source.buffer = input
  const step = ctx.createGain()
  source.connect(step)
  const voice = laneSound('voice')
  const dry = laneSound('voice', undefined, true)
  const before = comparedMaster('before').spec
  const after = comparedMaster('after').spec
  const master = createStudioMonitorMaster(after)
  const monitor = createStudioInputMonitor(view, step, {
    master,
    settled: true,
  })
  monitor.set(voice)
  const startFrame = Math.ceil((ctx.currentTime + 0.75) * SR)
  source.start(frameTime(startFrame, SR))
  const changes = [
    {
      name: 'After to Before',
      make: () => {
        monitor.set(dry)
        master.follow(before)
      },
    },
    {
      name: 'Before to After',
      make: () => {
        monitor.set(voice)
        master.follow(after)
      },
    },
    {
      name: 'After to playback, Compare stopped',
      make: () => master.follow(songMaster(COMPARED.gainDb)),
    },
    {
      name: 'a +6 dB step with no glide, for scale',
      make: () => step.gain.setValueAtTime(2, ctx.currentTime),
    },
  ]
  const changedAt = []
  for (const [index, change] of changes.entries()) {
    await untilClock(ctx, startFrame / SR + index + 1)
    changedAt.push(Math.round(ctx.currentTime * SR) - startFrame)
    change.make()
  }
  await untilClock(ctx, (startFrame + input.length) / SR + 0.2)
  // The recorder's last quanta are still on their way to this thread.
  await new Promise((resolve) => setTimeout(resolve, 200))
  monitor.dispose()
  await ctx.close()
  const live = laidOut(chunks, startFrame, input.length)
  const out = {}
  changes.forEach(({ name }, index) => {
    const at = changedAt[index]
    const before = { from: at - s(0.45), count: s(0.4) }
    const after = { from: at + s(0.3), count: s(0.4) }
    const own = Math.max(
      steepestStep(live, before.from, before.count),
      steepestStep(live, after.from, after.count),
    )
    const during = steepestStep(live, at - s(0.05), s(0.35))
    out[name] = {
      levelStepDb: round(
        levelDbOf(live, after.from, after.count) -
          levelDbOf(live, before.from, before.count),
        2,
      ),
      steepestAgainstToneOwn: round(during / own, 3),
    }
  })
  return out
}

async function masterProbe() {
  const levels = await masterLevels()
  const dryLane = await dryLaneAgainstFaders()
  const latency = await masterLatency()
  const live = await masterChangesLive()
  const sides = await compareSidesLive()
  const ceiling = await masterCeiling()
  const { ceilingDbfs, ...tones } = ceiling
  const pass =
    Object.values(levels).every(
      (entry) => typeof entry === 'number' || Math.abs(entry.offByDb) <= 0.1,
    ) &&
    latency.voiceBestLagFrames === 0 &&
    ['voice lane', 'no effects'].every(
      (name) => latency[name].addedFrames === 0,
    ) &&
    withinBar(dryLane.peakDifferenceDbfs) &&
    [live, sides].every((changes) =>
      Object.entries(changes).every(([name, change]) =>
        name.endsWith('for scale')
          ? change.steepestAgainstToneOwn > 1.1
          : change.steepestAgainstToneOwn <= 1.1,
      ),
    ) &&
    Object.values(tones).every(
      (entry) =>
        entry.overCeilingDb <= 0.0001 &&
        (ceilingDbfs - entry.intoCeilingDbfs < 3 ||
          Math.abs(entry.levelAgainstUnlimitedDb) <= 0.1),
    )
  return { pass, levels, dryLane, latency, live, sides, ceiling }
}

export async function timed(render) {
  const times = []
  for (let run = 0; run < 3; run++) {
    const started = performance.now()
    await render()
    times.push(performance.now() - started)
  }
  return median(times)
}

async function costProbe() {
  await Promise.all([measureCompressorLatency(SR), measureShaperDelays(SR)])
  const input = voiceInput(20)
  const quanta = (START + input.length) / 128
  const perQuantum = (renderMs) => round((renderMs * 1000) / quanta, 2)
  const voice = laneSound('voice')
  const cases = {
    'no effects': { ...voice, spec: EMPTY_SPEC },
    'voice lane': voice,
    'drums lane': laneSound('drums'),
    'every effect': { ...voice, spec: EVERY_EFFECT },
  }
  const out = {}
  const master = songMaster(0)
  for (const [name, sound] of Object.entries(cases))
    out[name] = {
      monitoredMicrosPerQuantum: perQuantum(
        await timed(() => monitorRender(input, sound, undefined, master)),
      ),
      laneAloneMicrosPerQuantum: perQuantum(
        await timed(() => monitorRender(input, sound)),
      ),
      fullMicrosPerQuantum: perQuantum(
        await timed(() => lanePathRender(input, sound, FULL_FX_PROFILE)),
      ),
    }
  const quantumMicros = (128 / SR) * 1e6
  const pass = Object.values(out).every(
    (entry) => entry.monitoredMicrosPerQuantum < quantumMicros / 10,
  )
  return { pass, quantumMicros: round(quantumMicros, 1), ...out }
}

export async function runStudioMonitorProbes() {
  return {
    latency: await latencyProbe(),
    plumbing: await plumbingProbe(),
    live: await liveProbe(),
    lanes: await lanesProbe(),
    sound: await soundProbe(),
    master: await masterProbe(),
    cost: await costProbe(),
  }
}

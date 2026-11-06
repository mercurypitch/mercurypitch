// Studio monitor browser probes: an armed input heard through its lane, offline and live, in real Chromium.
// Imported by scripts/check-studio-epoch-browser.mjs --suite monitor inside a page served by the Vite dev server.
//
// The input monitor (input-monitor.ts) plays the armed input through its
// lane's chain at the monitor profile (fx-profile.ts MONITOR_FX_PROFILE),
// in which no effect delays the signal. These probes measure, at 48 kHz:
// - latency: the frames each effect, and each role's new lane, adds before
//   anything is heard, monitored and at full quality;
// - plumbing: the monitor rendered offline against the lane's path built as
//   playback builds one (graph-lanes.ts), at the monitor profile;
// - live: the monitor on a running AudioContext against that render, and
//   the lag that lines them up best;
// - crossing: the arm moved between two lanes that sound alike, against
//   staying on one, where an input heard twice would show;
// - sound: each role's new lane monitored, against the same lane at full
//   quality, as a take on it plays back;
// - cost: render time per 128-frame quantum, dry and through lanes, and the
//   main thread's time to build a lane's path and to follow a change.
// Latency, plumbing, live and crossing pass on the bar the lane line probes
// hold an export to: -120 dBFS. Sound and cost are reports: sound passes
// when every lane renders, cost while a monitored lane takes under a tenth
// of a quantum's time.
import { createStudioFxChain } from '/src/lib/studio-fx/chain.ts'
import { normalizeChainSpec } from '/src/lib/studio-fx/chain-spec.ts'
import { measureCompressorLatency } from '/src/lib/studio-fx/compressor-twin.ts'
import { EFFECT_KINDS } from '/src/lib/studio-fx/effect-definitions.ts'
import { FULL_FX_PROFILE, MONITOR_FX_PROFILE, } from '/src/lib/studio-fx/fx-profile.ts'
import { measureChainLatencyFrames } from '/src/lib/studio-fx/render.ts'
import { TRACK_ROLES } from '/src/lib/studio-fx/role-chains.ts'
import { measureShaperDelays } from '/src/lib/studio-fx/shaper-delay.ts'
import { createStudioProject, createStudioTrack, } from '/src/lib/studio/model/defaults.ts'
import { frameTime } from '/src/lib/studio/playback/whole-frame.ts'
import { createStudioInputMonitor } from '/src/lib/studio/record/input-monitor.ts'
import { studioMonitorSound } from '/src/lib/studio/record/monitor-sound.ts'
import { scaleTo, syntheticVoice } from '/scripts/studio-fx-browser-probes.mjs'

const SR = 48000
const NOW = '2026-11-05T12:00:00.000Z'
const s = (seconds) => Math.round(seconds * SR)
const round = (value, digits = 2) => Number(value.toFixed(digits))
/** A level in dBFS, or 'exact' for a difference of nothing at all. */
const dbfs = (value) =>
  value === 0 ? 'exact' : round(20 * Math.log10(value), 1)
const ms = (frames) => round((frames / SR) * 1000, 2)
/** The bar a render is held to against what it stands for (studio-automation-browser-probes.mjs). */
const BAR_DBFS = -120
const withinBar = (level) => level === 'exact' || level <= BAR_DBFS

/** Where an input starts: past the monitor's rise from silence. */
const START = s(0.75)
/** Compared from this far into the input, past its first syllable. */
const SKIP = s(0.5)
const EMPTY_SPEC = normalizeChainSpec({ effects: [] })

function laneProject(role, over = {}) {
  const project = createStudioProject({ id: 'monitor-probe', now: NOW })
  const lane = {
    ...createStudioTrack({ id: 'lane', name: 'Lane', order: 0, role }),
    ...over,
  }
  return { ...project, tracks: [lane] }
}

/** A new lane of `role` as the monitor hears it. */
function laneSound(role, over) {
  return studioMonitorSound(laneProject(role, over), 'lane', { on: true })
}

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
const voiceInput = (seconds) => scaleTo(syntheticVoice(seconds), -18)

function spreadGain(ctx) {
  const gain = ctx.createGain()
  gain.channelCount = 2
  gain.channelCountMode = 'explicit'
  gain.channelInterpretation = 'speakers'
  return gain
}

function sourceOf(ctx, buffer, frame) {
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.start(frameTime(frame, SR))
  return source
}

/** The lane's path as playback builds one (graph-lanes.ts): spread as a clip is, the chain, then a gain per side. */
function buildLanePath(ctx, source, sound, profile) {
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

async function renderOffline(length, build) {
  const ctx = new OfflineAudioContext({
    numberOfChannels: 2,
    length,
    sampleRate: SR,
  })
  const cleanup = build(ctx)
  const rendered = await ctx.startRendering()
  cleanup?.()
  return [rendered.getChannelData(0), rendered.getChannelData(1)]
}

/** A timer on the render's own clock, for a monitor released mid-render. */
function renderClock(ctx) {
  return (callback, delayMs) => {
    const at = Math.ceil(((ctx.currentTime + delayMs / 1000) * SR) / 128) * 128
    void ctx.suspend(at / SR).then(() => {
      callback()
      void ctx.resume()
    })
    return () => {}
  }
}

/** The monitor itself, rendered offline: `sound` set at 0, the input from START. */
function monitorRender(input, sound, length = START + input.length) {
  return renderOffline(length, (ctx) => {
    const monitor = createStudioInputMonitor(ctx, sourceOf(ctx, input, START), {
      schedule: renderClock(ctx),
    })
    monitor.set(sound)
  })
}

function lanePathRender(input, sound, profile, length = START + input.length) {
  return renderOffline(length, (ctx) =>
    buildLanePath(ctx, sourceOf(ctx, input, START), sound, profile),
  )
}

/** `a` from `fromA` against `b` from `fromB`, over `count` frames of both sides. */
function compare(a, b, fromA, fromB, count) {
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

function rmsOf(data, from, count) {
  let sum = 0
  for (const side of data)
    for (let i = from; i < from + count; i++) sum += side[i] * side[i]
  return Math.sqrt(sum / (2 * count))
}

function peakOf(data, from, count) {
  let peak = 0
  for (const side of data)
    for (let i = from; i < from + count; i++)
      peak = Math.max(peak, Math.abs(side[i]))
  return peak
}

/** Frames from an impulse to the first thing heard, above -60 dBFS. */
async function firstHeard(spec, profile) {
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

/** A running context whose destination is a recorder: what the monitor sends to the speakers, frame by frame. */
async function liveContext() {
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
  return { ctx, view, chunks }
}

/** The recorded frames from `first`, `length` of them, laid out as an offline render. */
function laidOut(chunks, first, length) {
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

const median = (values) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]

async function untilClock(ctx, time) {
  while (ctx.currentTime < time)
    await new Promise((resolve) => setTimeout(resolve, 50))
}

/** The monitor on a running context against its offline render; also what building and following a lane cost the main thread. */
async function liveRun(input, sound) {
  const { ctx, view, chunks } = await liveContext()
  const source = ctx.createBufferSource()
  source.buffer = input
  const monitor = createStudioInputMonitor(view, source)
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
  const offline = await monitorRender(input, sound, length)
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
  }
  const pass = Object.values(out).every(
    (run) =>
      run.bestLagFrames === 0 &&
      withinBar(run.againstRender.peakDifferenceDbfs),
  )
  return { pass, ...out }
}

/** The arm moved from one voice lane to another at 1.5 s, against staying on the first. */
async function crossingProbe() {
  const input = voiceInput(4)
  const first = laneSound('voice')
  const second = { ...first, laneId: 'second-lane' }
  const crossAt = Math.round((START + s(1.5)) / 128) * 128
  const crossed = await renderOffline(START + input.length, (ctx) => {
    const monitor = createStudioInputMonitor(ctx, sourceOf(ctx, input, START), {
      schedule: renderClock(ctx),
    })
    monitor.set(first)
    void ctx.suspend(crossAt / SR).then(() => {
      monitor.set(second)
      void ctx.resume()
    })
  })
  const stayed = await monitorRender(input, first)
  // Level in 10 ms windows across the crossing: how far above staying put it rises.
  const window = s(0.01)
  let rise = -Infinity
  for (let at = crossAt - s(0.05); at < crossAt + s(0.5); at += window) {
    const there = rmsOf(stayed, at, window)
    if (there < 1e-4) continue
    rise = Math.max(rise, 20 * Math.log10(rmsOf(crossed, at, window) / there))
  }
  return {
    // An input heard twice over rises 6 dB.
    pass: rise < 1,
    crossingRiseDb: round(rise, 2),
    acrossCrossing: compare(crossed, stayed, crossAt, crossAt, s(0.5)),
    afterCrossing: compare(
      crossed,
      stayed,
      crossAt + s(1),
      crossAt + s(1),
      s(1),
    ),
  }
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

async function timed(render) {
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
  for (const [name, sound] of Object.entries(cases))
    out[name] = {
      monitoredMicrosPerQuantum: perQuantum(
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
    crossing: await crossingProbe(),
    sound: await soundProbe(),
    cost: await costProbe(),
  }
}

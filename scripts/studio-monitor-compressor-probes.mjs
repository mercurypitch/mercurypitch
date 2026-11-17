// Studio monitor compressor probes: a monitored lane's compressor, with no lookahead, against playback's, in real Chromium.
// Imported by scripts/check-studio-epoch-browser.mjs --suite monitor-compressor inside a page served by the Vite dev server.
//
// At the monitor's profile (fx-profile.ts MONITOR_FX_PROFILE) a compressor
// runs the browser's own processing with its lookahead taken out, on a
// worklet (zero-latency-compressor.ts). These probes hold it, at 48 kHz, to
// what playback's DynamicsCompressorNode does with the same settings, for
// every compressor the role chains (role-chains.ts) and the presets
// (presets.ts) carry, each alone on a lane:
// - latency: the frames a lane's compressor adds before an impulse is heard,
//   monitored (bar: none) and in playback (its lookahead, for scale), and
//   the lag that lines a sung vowel through the voice's compressor up best
//   with the same vowel through a lane with no effects (bar: 0);
// - levels: a steady 440 Hz tone peaking at -40, -20 and -10 dBFS,
//   monitored, against an offline render of playback's lane (bar: 0.5 dB),
//   and a sung vowel the same way (a report);
// - steps: a 480 Hz tone stepping between -30 and -6 dBFS every 0.4 s, each
//   step starting on a zero crossing: after each step's attack, its level
//   over the step against playback's (bar: 1 dB); and the largest step from
//   one frame to the next, from a cycle after each edge to a cycle before
//   the next, attack included, against the steepest step the tone makes at
//   the level it has there (bar: 1.1, as the master probes hold a gain
//   change). Playback's, and the monitor's with its gain cut 1 dB and 6 dB
//   at once on a crest, are there for scale;
// - gain: the gain the worklet gives each frame against the gain the
//   browser's node gives the same frame (its output 288 frames on, its
//   automatic makeup divided out), on the stepping tone and on a sung
//   vowel: the largest difference over frames above -40 dBFS, a report.
// What a monitored lane costs is the monitor suite's `cost` probe
// (studio-monitor-browser-probes.mjs).
import { normalizeChainSpec } from '/src/lib/studio-fx/chain-spec.ts'
import { compressorAutoMakeupGain } from '/src/lib/studio-fx/compressor-curve.ts'
import { measureCompressorLatency } from '/src/lib/studio-fx/compressor-twin.ts'
import { FULL_FX_PROFILE } from '/src/lib/studio-fx/fx-profile.ts'
import { MASTER_CHAIN_PRESET, STUDIO_FX_PRESETS, } from '/src/lib/studio-fx/presets.ts'
import { measureChainLatencyFrames } from '/src/lib/studio-fx/render.ts'
import { TRACK_ROLES } from '/src/lib/studio-fx/role-chains.ts'
import { measureShaperDelays } from '/src/lib/studio-fx/shaper-delay.ts'
import { createZeroLatencyCompressor } from '/src/lib/studio-fx/zero-latency-compressor.ts'
import { bestLag, EMPTY_SPEC, firstHeard, lanePathRender, laneSound, levelDbOf, monitorFirstHeard, monitorRender, PLAIN_LANE, renderOffline, round, s, SKIP, sourceOf, SR, START, tone, voiceInput, } from '/scripts/studio-monitor-browser-probes.mjs'

export const STEP_SECONDS = 0.4
export const STEP_LEVELS_DBFS = [-30, -6, -30, -6, -30]
/** 100 frames a cycle at 48 kHz: every step starts on a zero crossing. */
const STEP_HZ = 480

/** Every compressor a role's new lane or a preset carries, by where it comes from. */
function presetCompressors() {
  const found = []
  for (const role of TRACK_ROLES)
    for (const effect of laneSound(role).spec.effects)
      if (effect.kind === 'compressor')
        found.push({ name: `${role} ${effect.id}`, effect })
  for (const preset of [...STUDIO_FX_PRESETS, MASTER_CHAIN_PRESET])
    for (const effect of preset.spec.effects)
      if (effect.kind === 'compressor')
        found.push({ name: `${preset.id} ${effect.id}`, effect })
  return found
}

/** A lane with `effect` alone on it, at unity. */
export function laneOf(effect) {
  return {
    on: true,
    spec: normalizeChainSpec({ effects: [{ ...effect, enabled: true }] }),
    gains: [1, 1],
  }
}

/** The frames from a step's edge to the end of the compressor's attack: its attack time, and the division it starts on. */
function attackFrames(effect) {
  return Math.round((effect.params.attackMs / 1000) * SR) + 32
}

/** A tone of `hz` at the step levels, 0.4 s each: every step starts on a zero crossing where 0.4 s holds whole cycles of it. */
export function steppingTone(hz = STEP_HZ) {
  const step = s(STEP_SECONDS)
  const length = step * STEP_LEVELS_DBFS.length
  const buffer = new AudioBuffer({ length, sampleRate: SR })
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++)
    data[i] =
      10 ** (STEP_LEVELS_DBFS[Math.floor(i / step)] / 20) *
      Math.sin((2 * Math.PI * hz * i) / SR)
  return buffer
}

/** `input` monitored through `sound`, and played through it, the playback render moved back by its latency. */
export async function monitoredAndPlayed(input, sound) {
  const latency = await measureChainLatencyFrames(sound.spec, SR)
  const length = START + input.length
  const monitored = await monitorRender(input, sound, length)
  const played = await lanePathRender(
    input,
    sound,
    FULL_FX_PROFILE,
    length + latency,
  )
  return { monitored, played: played.map((side) => side.subarray(latency)) }
}

async function latencyProbe(compressors) {
  const plain = await monitorFirstHeard(PLAIN_LANE, EMPTY_SPEC)
  const out = {}
  for (const { name, effect } of compressors) {
    const sound = laneOf(effect)
    out[name] = {
      monitoredAddedFrames:
        (await monitorFirstHeard(sound, EMPTY_SPEC)) - plain,
      playbackFrames: await firstHeard(sound.spec, FULL_FX_PROFILE),
    }
  }
  const voice = compressors.find(({ name }) => name === 'voice character')
  const vowel = voiceInput(3)
  const through = await monitorRender(vowel, laneOf(voice.effect))
  const without = await monitorRender(vowel, PLAIN_LANE)
  const voiceBestLagFrames = bestLag(without, through, START + SKIP, SR)
  const pass =
    voiceBestLagFrames === 0 &&
    Object.values(out).every((entry) => entry.monitoredAddedFrames === 0)
  return { pass, voiceBestLagFrames, ...out }
}

async function levelsProbe(compressors) {
  const out = {}
  const vowel = voiceInput(4)
  for (const { name, effect } of compressors) {
    const sound = laneOf(effect)
    const row = {}
    for (const peakDbfs of [-40, -20, -10]) {
      const input = tone(2, peakDbfs)
      const { monitored, played } = await monitoredAndPlayed(input, sound)
      const from = START + SKIP
      const count = input.length - SKIP - s(0.1)
      const playedDb = levelDbOf(played, from, count)
      row[`${peakDbfs} dBFS`] = {
        playedDbfs: round(playedDb, 2),
        offByDb: round(levelDbOf(monitored, from, count) - playedDb, 3),
      }
    }
    const sung = await monitoredAndPlayed(vowel, sound)
    const from = START + SKIP
    const count = vowel.length - SKIP
    row['sung vowel, a report'] = {
      offByDb: round(
        levelDbOf(sung.monitored, from, count) -
          levelDbOf(sung.played, from, count),
        3,
      ),
    }
    out[name] = row
  }
  const pass = Object.values(out).every((row) =>
    Object.entries(row).every(
      ([level, entry]) =>
        level.endsWith('a report') || Math.abs(entry.offByDb) <= 0.5,
    ),
  )
  return { pass, ...out }
}

/** Each step's edge after the first, in render frames. */
export function stepEdges() {
  const step = s(STEP_SECONDS)
  return STEP_LEVELS_DBFS.slice(1).map((_, index) => START + (index + 1) * step)
}

/** The largest magnitude within `radius` whole frames of each frame of `side`. */
export function peaksAround(side, radius) {
  const peaks = new Float32Array(side.length)
  // The frames that can still be a peak, loudest first.
  const queue = []
  let head = 0
  const magnitude = (i) => Math.abs(side[i])
  for (let i = 0; i < side.length + radius; i++) {
    if (i < side.length) {
      while (queue.length > head && magnitude(queue.at(-1)) <= magnitude(i))
        queue.pop()
      queue.push(i)
    }
    const centre = i - radius
    if (centre < 0) continue
    while (queue[head] < centre - radius) head++
    peaks[centre] = magnitude(queue[head])
  }
  return peaks
}

/**
 * The largest step from one frame to the next over `count` frames from
 * `from`, against the steepest step a tone of `hz` makes at the level it has
 * there: its peak within a cycle either side. A gain that glides keeps this
 * at 1 or under, however fast; one that jumps does not.
 */
export function steepestAgainstToneOwn(data, from, count, hz = STEP_HZ) {
  const cycle = SR / hz
  const toneSlope = 2 * Math.sin((Math.PI * hz) / SR)
  let worst = 0
  for (const side of data) {
    const peaks = peaksAround(side, Math.ceil(cycle))
    for (let i = from; i < from + count; i++)
      worst = Math.max(
        worst,
        Math.abs(side[i] - side[i - 1]) / (peaks[i] * toneSlope),
      )
  }
  return worst
}

/** `data` with its gain cut by `db` from a crest of a tone of `hz` `at` frames on: a gain that jumps, for scale. */
export function withGainJump(data, at, db, hz = STEP_HZ) {
  // A crest: a quarter cycle past a whole cycle, the tone at its peak.
  const cycle = SR / hz
  const crest = Math.ceil(at / cycle) * cycle + cycle / 4
  const cut = 10 ** (-db / 20)
  return data.map((side) =>
    side.map((value, i) => (i >= crest ? value * cut : value)),
  )
}

async function stepsProbe(compressors) {
  const input = steppingTone()
  const step = s(STEP_SECONDS)
  const cycle = SR / STEP_HZ
  const out = {}
  for (const { name, effect } of compressors) {
    const { monitored, played } = await monitoredAndPlayed(
      input,
      laneOf(effect),
    )
    const attack = attackFrames(effect)
    const steps = stepEdges().map((edge, index) => {
      // The tone changes level at its edge: a cycle either side is the
      // edge itself, and the rest of the step, attack and all, is measured.
      const from = edge + cycle
      const count = step - 2 * cycle
      return {
        step: `${STEP_LEVELS_DBFS[index]} to ${STEP_LEVELS_DBFS[index + 1]} dBFS`,
        levelOffByDb: round(
          levelDbOf(monitored, edge + attack, step - attack) -
            levelDbOf(played, edge + attack, step - attack),
          3,
        ),
        steepestAgainstToneOwn: round(
          steepestAgainstToneOwn(monitored, from, count),
          3,
        ),
        playbackSteepestAgainstToneOwn: round(
          steepestAgainstToneOwn(played, from, count),
          3,
        ),
      }
    })
    const [firstUp] = stepEdges()
    const jumpAt = firstUp + attack + s(0.05)
    const jumped = (db) =>
      round(
        steepestAgainstToneOwn(
          withGainJump(monitored, jumpAt, db),
          firstUp + cycle,
          step - 2 * cycle,
        ),
        3,
      )
    out[name] = {
      steps,
      oneDbJumpForScale: jumped(1),
      sixDbJumpForScale: jumped(6),
    }
  }
  const pass = Object.values(out).every(
    (entry) =>
      entry.oneDbJumpForScale > 1.1 &&
      entry.sixDbJumpForScale > 1.1 &&
      entry.steps.every(
        (one) =>
          Math.abs(one.levelOffByDb) <= 1 && one.steepestAgainstToneOwn <= 1.1,
      ),
  )
  return { pass, ...out }
}

/** `input` through the browser's own compressor at `effect`'s settings, from START, settled first by the silence before it. */
function nativeRender(input, effect, extra) {
  return renderOffline(START + input.length + extra, (ctx) => {
    const node = ctx.createDynamicsCompressor()
    setCompressor(node, effect)
    sourceOf(ctx, input, START).connect(node).connect(ctx.destination)
  })
}

/** `input` through the monitor's worklet at `effect`'s settings, from START. */
function workletRender(input, effect) {
  return renderOffline(START + input.length, (ctx) => {
    const compressor = createZeroLatencyCompressor(ctx)
    if (compressor === null) throw new Error('No compressor worklet')
    setCompressor(compressor, effect)
    sourceOf(ctx, input, START)
      .connect(compressor.node)
      .connect(ctx.destination)
    return () => compressor.dispose()
  })
}

function setCompressor(compressor, effect) {
  const p = effect.params
  compressor.threshold.value = p.thresholdDb
  compressor.knee.value = p.kneeDb
  compressor.ratio.value = p.ratio
  compressor.attack.value = p.attackMs / 1000
  compressor.release.value = p.releaseMs / 1000
}

async function gainProbe(compressors) {
  const lookahead = await measureCompressorLatency(SR)
  const inputs = {
    'stepping tone': steppingTone(),
    'sung vowel': voiceInput(3),
  }
  const out = {}
  for (const { name, effect } of compressors) {
    const makeup = compressorAutoMakeupGain(
      effect.params.thresholdDb,
      effect.params.kneeDb,
      effect.params.ratio,
    )
    const row = {}
    for (const [inputName, input] of Object.entries(inputs)) {
      const native = await nativeRender(input, effect, lookahead)
      const worklet = await workletRender(input, effect)
      const x = (frame) => input.getChannelData(0)[frame - START] ?? 0
      let largest = 0
      for (let frame = START; frame < START + input.length; frame++) {
        const now = x(frame)
        const then = x(frame - lookahead)
        if (Math.abs(now) < 0.01 || Math.abs(then) < 0.01) continue
        const nativeGain = native[0][frame] / then / makeup
        const workletGain = worklet[0][frame] / now
        largest = Math.max(
          largest,
          Math.abs(20 * Math.log10(workletGain / nativeGain)),
        )
      }
      row[inputName] = { largestGainDifferenceDb: round(largest, 5) }
    }
    out[name] = row
  }
  return { pass: true, lookaheadFrames: lookahead, ...out }
}

export async function runStudioMonitorCompressorProbes() {
  await Promise.all([measureCompressorLatency(SR), measureShaperDelays(SR)])
  const compressors = presetCompressors()
  return {
    latency: await latencyProbe(compressors),
    levels: await levelsProbe(compressors),
    steps: await stepsProbe(compressors),
    gain: await gainProbe(compressors),
  }
}

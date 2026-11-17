// Studio monitor dynamics probes: a monitored lane's de-esser and dynamic EQ bands, with no lookahead, against playback's, in real Chromium.
// Imported by scripts/check-studio-epoch-browser.mjs --suite monitor-dynamics inside a page served by the Vite dev server.
//
// At the monitor's profile (fx-profile.ts MONITOR_FX_PROFILE) the
// de-esser's sibilant band and a dynamic EQ's band compress on the
// compressor worklet, the browser's own processing with no lookahead
// (zero-latency-compressor.ts). These probes hold them, at 48 kHz, to what
// playback's lane does with the same settings, for every de-esser and
// dynamic EQ band the role chains (role-chains.ts) and the presets
// (presets.ts) carry, each alone on a lane:
// - latency: the frames each adds before an impulse is heard, monitored
//   (bar: none) and in playback (its lookahead, for scale), and the lag that
//   lines a sung vowel through the voice's lane, and through the Clean vocal
//   preset, up best with the same vowel through the same lane without its
//   de-esser and dynamic EQ (bar: 0);
// - levels: steady tones at a band's lower edge, centre and upper edge (a
//   de-esser's at its crossover, half an octave and an octave above it),
//   peaking at -40, -20 and -10 dBFS, monitored, against an offline render
//   of playback's lane (bar: 0.5 dB);
// - voice: each role's new lane that carries a de-esser or a dynamic EQ,
//   and the Clean vocal preset, on the sung vowel the monitor suite's
//   `sound` probe plays, against playback's lane: the voice lane's level
//   within 0.25 dB (1.23 dB while these sat out of the monitor), the rest a
//   report, and each with its de-esser and dynamic EQ out of both, for
//   scale;
// - steps: a tone at each band's centre (the de-esser's at 8 kHz, in its
//   sibilant band) stepping between -30 and -6 dBFS every 0.4 s, each step
//   starting on a zero crossing: after each step's attack, its level over
//   the step against playback's (bar: 1 dB); the largest step from one
//   frame to the next, from a cycle after each edge to a cycle before the
//   next, attack included, against the steepest step the tone makes at the
//   level it has there (bar: 1.1), playback's for scale; and, since that
//   step sees a 1 dB jump only on a tone under about 750 Hz, the largest
//   part of a step the tone's own motion does not explain, after the attack
//   (bar: 0.02; a 1 dB jump leaves 0.11 at any frequency). The monitor's
//   output with its gain cut 1 dB and 6 dB at once on a crest is there for
//   scale. For the de-esser, sibilance too: noise above 5 kHz stepping
//   between -40 and -16 dBFS RMS, its level over each step after the attack
//   against playback's (bar: 1 dB);
// - light: on the Light tier, whose playback leaves the de-esser and the
//   dynamic EQ uncut (playback-quality.ts TIER_PROFILES), each lane the
//   voice probe plays, on the sung vowel, monitored at Light's lite list
//   against the same lane with its de-esser and dynamic EQ taken out: bit
//   for bit with the echo out of both (bar: exact), and with it in, within
//   the -120 dBFS bar. An echo sums three signals at each line's delay (its
//   input, its own feedback and the other line's), and the order a node
//   adds its inputs in can differ between two builds, so two builds of one
//   lane with an echo can differ: in Chromium 148 the voice lane at
//   Balanced or Light, or its echo alone, by -141 to -146.6 dBFS at the
//   peak, six builds each. And the lane at Balanced against Light, for
//   scale;
// - follow: a lane with a dynamic EQ band on a steady 480 Hz tone at -20
//   dBFS and a de-esser, monitored live on a running context while its tier
//   goes to Light and back to Balanced (input-monitor.ts, chain.ts
//   `setLite`): around each change, the largest step from one frame to the
//   next against the steepest step the tone makes at the louder of its
//   levels either side (bar: 1.1; a 1 dB jump on a crest for scale), how far
//   the lane dips while the two change places, and its level after: at Light
//   against an offline render of the lane without them, back at Balanced
//   against its level before the first change (bar: 0.01 dB each).
// What a monitored lane costs is the monitor suite's `cost` probe
// (studio-monitor-browser-probes.mjs).
import { normalizeChainSpec } from '/src/lib/studio-fx/chain-spec.ts'
import { measureCompressorLatency } from '/src/lib/studio-fx/compressor-twin.ts'
import { FULL_FX_PROFILE } from '/src/lib/studio-fx/fx-profile.ts'
import { MASTER_CHAIN_PRESET, STUDIO_FX_PRESETS, } from '/src/lib/studio-fx/presets.ts'
import { measureChainLatencyFrames } from '/src/lib/studio-fx/render.ts'
import { TRACK_ROLES } from '/src/lib/studio-fx/role-chains.ts'
import { measureShaperDelays } from '/src/lib/studio-fx/shaper-delay.ts'
import { TIER_PROFILES } from '/src/lib/studio/playback/playback-quality.ts'
import { frameTime } from '/src/lib/studio/playback/whole-frame.ts'
import { createStudioInputMonitor } from '/src/lib/studio/record/input-monitor.ts'
import { createStudioMonitorMaster } from '/src/lib/studio/record/monitor-master.ts'
import { bestLag, compare, EMPTY_SPEC, firstHeard, laidOut, lanePathRender, laneSound, levelDbOf, liveContext, monitorFirstHeard, monitorRender, PLAIN_LANE, rmsOf, round, s, SKIP, SR, START, tone, untilClock, voiceInput, withinBar, } from '/scripts/studio-monitor-browser-probes.mjs'
import { laneOf, monitoredAndPlayed, peaksAround, STEP_LEVELS_DBFS, STEP_SECONDS, steepestAgainstToneOwn, stepEdges, steppingTone, withGainJump, } from '/scripts/studio-monitor-compressor-probes.mjs'

const DYNAMICS = ['deesser', 'dyneq']
/** The de-esser's step tone: in its sibilant band, 3200 whole cycles a step. */
const DEESSER_STEP_HZ = 8000
/** Sibilance: noise above this, the band an "s" sits in. */
const SIBILANCE_FROM_HZ = 5000
/** The sibilance's level over each step, RMS. */
const SIBILANCE_LEVELS_DBFS = [-40, -16, -40, -16, -40]
/** A de-esser attacks in 1 ms (effects/deesser.ts). */
const DEESSER_ATTACK_MS = 1

const isDynamics = (effect) => DYNAMICS.includes(effect.kind)

/** Every de-esser and dynamic EQ band a role's new lane or a preset carries, by where it comes from. */
function presetDynamics() {
  const found = []
  for (const role of TRACK_ROLES)
    for (const effect of laneSound(role).spec.effects)
      if (isDynamics(effect))
        found.push({ name: `${role} ${effect.id}`, effect })
  for (const preset of [...STUDIO_FX_PRESETS, MASTER_CHAIN_PRESET])
    for (const effect of preset.spec.effects)
      if (isDynamics(effect))
        found.push({ name: `${preset.id} ${effect.id}`, effect })
  return found
}

/** `sound` without its de-esser and dynamic EQ. */
function withoutDynamics(sound) {
  return {
    ...sound,
    spec: normalizeChainSpec({
      ...sound.spec,
      effects: sound.spec.effects.filter((effect) => !isDynamics(effect)),
    }),
  }
}

/** A preset's chain on a lane at unity. */
function presetLane(id) {
  const preset = STUDIO_FX_PRESETS.find((item) => item.id === id)
  return { on: true, spec: preset.spec, gains: [1, 1] }
}

/** The frames from a step's edge to the end of the band's attack: its attack time, and the division it starts on. */
function attackFrames(effect) {
  const attackMs =
    effect.kind === 'deesser' ? DEESSER_ATTACK_MS : effect.params.attackMs
  return Math.round((attackMs / 1000) * SR) + 32
}

/**
 * The tones a band is heard at: a dynamic EQ's lower edge, centre and
 * upper edge (its bandpass 3 dB down at the edges), a de-esser's
 * crossover, and half an octave and an octave into its sibilant band.
 */
function bandTones(effect) {
  const f = effect.params.frequencyHz
  if (effect.kind === 'deesser') return [f, f * Math.SQRT2, 2 * f]
  const half = 1 / (2 * effect.params.q)
  const root = Math.sqrt(1 + half * half)
  return [f * (root - half), f, f * (root + half)]
}

/** A band's step tone: its centre to the nearest 2.5 Hz, so that 0.4 s holds whole cycles and each step starts on a zero crossing. */
function stepHz(effect) {
  if (effect.kind === 'deesser') return DEESSER_STEP_HZ
  return Math.round(effect.params.frequencyHz / 2.5) * 2.5
}

/** Deterministic white noise in [-1, 1) (mulberry32). */
function noise(length, seed) {
  const out = new Float32Array(length)
  let state = seed >>> 0
  for (let i = 0; i < length; i++) {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    out[i] = ((t ^ (t >>> 14)) >>> 0) / 2 ** 31 - 1
  }
  return out
}

/** `data` through a 12 dB/octave Butterworth highpass at `hz` (the cookbook's), in place. */
function highpass(data, hz) {
  const w = (2 * Math.PI * hz) / SR
  const alpha = Math.sin(w) / (2 * Math.SQRT1_2)
  const cos = Math.cos(w)
  const a0 = 1 + alpha
  const b0 = (1 + cos) / 2 / a0
  const b1 = -(1 + cos) / a0
  const a1 = (-2 * cos) / a0
  const a2 = (1 - alpha) / a0
  let x1 = 0
  let x2 = 0
  let y1 = 0
  let y2 = 0
  for (let i = 0; i < data.length; i++) {
    const x = data[i]
    const y = b0 * x + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2
    x2 = x1
    x1 = x
    y2 = y1
    y1 = y
    data[i] = y
  }
  return data
}

/** Sibilance: noise above 5 kHz, its RMS at each step's level, 0.4 s each. */
function steppingSibilance() {
  const step = s(STEP_SECONDS)
  const length = step * SIBILANCE_LEVELS_DBFS.length
  const hiss = highpass(
    highpass(noise(length, 20261117), SIBILANCE_FROM_HZ),
    SIBILANCE_FROM_HZ,
  )
  let sum = 0
  for (const value of hiss) sum += value * value
  const rms = Math.sqrt(sum / length)
  const buffer = new AudioBuffer({ length, sampleRate: SR })
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++)
    data[i] =
      (hiss[i] / rms) * 10 ** (SIBILANCE_LEVELS_DBFS[Math.floor(i / step)] / 20)
  return buffer
}

async function latencyProbe(dynamics) {
  const plain = await monitorFirstHeard(PLAIN_LANE, EMPTY_SPEC)
  const out = {}
  for (const { name, effect } of dynamics) {
    const sound = laneOf(effect)
    out[name] = {
      monitoredAddedFrames:
        (await monitorFirstHeard(sound, EMPTY_SPEC)) - plain,
      playbackFrames: await firstHeard(sound.spec, FULL_FX_PROFILE),
    }
  }
  const vowel = voiceInput(3)
  const lanes = {}
  for (const [name, sound] of Object.entries({
    'voice lane': laneSound('voice'),
    'Clean vocal preset': presetLane('clean-vocal'),
  })) {
    const lag = (a, b) => bestLag(a, b, START + SKIP, SR)
    const through = await monitoredAndPlayed(vowel, sound)
    const without = await monitoredAndPlayed(vowel, withoutDynamics(sound))
    lanes[name] = {
      againstPlaybackFrames: lag(through.played, through.monitored),
      againstWithoutThemFrames: lag(without.monitored, through.monitored),
      playbackAgainstWithoutThemFrames: lag(without.played, through.played),
    }
  }
  // A crossover's phase moves where a sound lines up best without making
  // it late: the same in playback, latency and all compensated.
  const pass =
    Object.values(lanes).every(
      (lane) =>
        lane.againstPlaybackFrames === 0 &&
        lane.againstWithoutThemFrames === lane.playbackAgainstWithoutThemFrames,
    ) && Object.values(out).every((entry) => entry.monitoredAddedFrames === 0)
  return { pass, lanes, ...out }
}

async function levelsProbe(dynamics) {
  const out = {}
  for (const { name, effect } of dynamics) {
    const sound = laneOf(effect)
    const row = {}
    for (const hz of bandTones(effect))
      for (const peakDbfs of [-40, -20, -10]) {
        const input = tone(2, peakDbfs, hz)
        const { monitored, played } = await monitoredAndPlayed(input, sound)
        const from = START + SKIP
        const count = input.length - SKIP - s(0.1)
        const playedDb = levelDbOf(played, from, count)
        row[`${round(hz, 1)} Hz at ${peakDbfs} dBFS`] = {
          playedDbfs: round(playedDb, 2),
          offByDb: round(levelDbOf(monitored, from, count) - playedDb, 3),
        }
      }
    out[name] = row
  }
  const pass = Object.values(out).every((row) =>
    Object.values(row).every((entry) => Math.abs(entry.offByDb) <= 0.5),
  )
  return { pass, ...out }
}

/** The lane's level monitored against playback's, on `input`, in dB, as the monitor suite's `sound` probe reads it. */
async function levelAgainstPlayback(input, sound) {
  const latency = await measureChainLatencyFrames(sound.spec, SR)
  const length = START + input.length
  const played = await lanePathRender(
    input,
    sound,
    FULL_FX_PROFILE,
    length + latency,
  )
  const monitored = await monitorRender(input, sound, length)
  const from = START + SKIP
  const count = input.length - SKIP
  return round(
    20 *
      Math.log10(
        rmsOf(monitored, from, count) / rmsOf(played, from + latency, count),
      ),
    3,
  )
}

/** Each role's new lane that carries a de-esser or a dynamic EQ, and the Clean vocal preset's. */
function dynamicsLanes() {
  const lanes = {}
  for (const role of TRACK_ROLES) {
    const sound = laneSound(role)
    if (sound.spec.effects.some(isDynamics)) lanes[`${role} lane`] = sound
  }
  lanes['Clean vocal preset'] = presetLane('clean-vocal')
  return lanes
}

async function voiceProbe() {
  const input = voiceInput(4)
  const out = {}
  for (const [name, sound] of Object.entries(dynamicsLanes()))
    out[name] = {
      levelDb: await levelAgainstPlayback(input, sound),
      withoutDynamicsForScaleDb: await levelAgainstPlayback(
        input,
        withoutDynamics(sound),
      ),
    }
  return { pass: Math.abs(out['voice lane'].levelDb) <= 0.25, ...out }
}

/**
 * The largest part of a step the tone's own motion does not explain,
 * against the level the tone has there: |y[i+1] - 2 cos(w) y[i] + y[i-1]|,
 * which is nothing for a tone of `hz` at any steady level and phase, over
 * its peak within a cycle either side. A gain that glides leaves little of
 * it; one that jumps by g leaves about |1 - g| of the peak (0.11 for 1 dB)
 * at any frequency, where the steepest step sees a jump on a low tone only.
 * A fast attack leaves some too: the de-esser's, 24 dB in about 1 ms.
 */
function departureFromTone(data, from, count, hz) {
  const twoCos = 2 * Math.cos((2 * Math.PI * hz) / SR)
  let worst = 0
  for (const side of data) {
    const peaks = peaksAround(side, Math.ceil(SR / hz))
    for (let i = from; i < from + count; i++)
      worst = Math.max(
        worst,
        Math.abs(side[i + 1] - twoCos * side[i] + side[i - 1]) / peaks[i],
      )
  }
  return worst
}

/** Past this a step's departure after its attack reads as a click: a gain jump of about 0.17 dB, a sixth of what 1 dB leaves. */
const DEPARTURE_BAR = 0.02

/** Each step's level monitored against playback's, after the band's attack. */
function stepLevels(monitored, played, attack) {
  const step = s(STEP_SECONDS)
  return stepEdges().map((edge) =>
    round(
      levelDbOf(monitored, edge + attack, step - attack) -
        levelDbOf(played, edge + attack, step - attack),
      3,
    ),
  )
}

/**
 * Where a step is read for a click, in frames, `edge` being where the tone
 * changes level: a cycle either side is the edge itself. `whole` runs from
 * there, attack and all, `settled` from the end of the attack.
 */
function stepWindows(edge, hz, attack) {
  const cycle = SR / hz
  const end = edge + s(STEP_SECONDS) - cycle
  const window = (from) => ({
    from: Math.ceil(from),
    count: Math.floor(end - Math.ceil(from)),
  })
  return {
    whole: window(edge + cycle),
    settled: window(edge + attack + cycle),
  }
}

async function stepsProbe(dynamics) {
  const out = {}
  for (const { name, effect } of dynamics) {
    const hz = stepHz(effect)
    const attack = attackFrames(effect)
    const { monitored, played } = await monitoredAndPlayed(
      steppingTone(hz),
      laneOf(effect),
    )
    const offBy = stepLevels(monitored, played, attack)
    const read = (measure, data, { from, count }, digits) =>
      round(measure(data, from, count, hz), digits)
    const steps = stepEdges().map((edge, index) => {
      const { whole, settled } = stepWindows(edge, hz, attack)
      return {
        step: `${STEP_LEVELS_DBFS[index]} to ${STEP_LEVELS_DBFS[index + 1]} dBFS`,
        levelOffByDb: offBy[index],
        steepestAgainstToneOwn: read(
          steepestAgainstToneOwn,
          monitored,
          whole,
          3,
        ),
        playbackSteepestAgainstToneOwn: read(
          steepestAgainstToneOwn,
          played,
          whole,
          3,
        ),
        departureAfterAttack: read(departureFromTone, monitored, settled, 4),
        departureWithAttack: read(departureFromTone, monitored, whole, 4),
        playbackDepartureWithAttack: read(departureFromTone, played, whole, 4),
      }
    })
    // A jump on a crest of the first loud step, past its attack.
    const [firstUp] = stepEdges()
    const { whole, settled } = stepWindows(firstUp, hz, attack)
    const jumped = (db) =>
      withGainJump(monitored, firstUp + attack + s(0.05), db, hz)
    const entry = {
      toneHz: hz,
      steps,
      forScale: {
        oneDbJumpSteepest: read(steepestAgainstToneOwn, jumped(1), whole, 3),
        sixDbJumpSteepest: read(steepestAgainstToneOwn, jumped(6), whole, 3),
        oneDbJumpDeparture: read(departureFromTone, jumped(1), settled, 4),
        sixDbJumpDeparture: read(departureFromTone, jumped(6), settled, 4),
      },
    }
    if (effect.kind === 'deesser') {
      const sibilance = await monitoredAndPlayed(
        steppingSibilance(),
        laneOf(effect),
      )
      entry.sibilance = stepLevels(
        sibilance.monitored,
        sibilance.played,
        attack,
      ).map((levelOffByDb, index) => ({
        step: `${SIBILANCE_LEVELS_DBFS[index]} to ${SIBILANCE_LEVELS_DBFS[index + 1]} dBFS RMS`,
        levelOffByDb,
      }))
    }
    out[name] = entry
  }
  const pass = Object.values(out).every(
    (entry) =>
      entry.forScale.oneDbJumpDeparture > DEPARTURE_BAR &&
      entry.forScale.sixDbJumpDeparture > DEPARTURE_BAR &&
      entry.steps.every(
        (one) =>
          Math.abs(one.levelOffByDb) <= 1 &&
          one.steepestAgainstToneOwn <= 1.1 &&
          one.departureAfterAttack <= DEPARTURE_BAR,
      ) &&
      (entry.sibilance ?? []).every((one) => Math.abs(one.levelOffByDb) <= 1),
  )
  return { pass, departureBar: DEPARTURE_BAR, ...out }
}

/** What Light playback keeps only the lookahead of: a monitored lane passes them uncut. */
const LIGHT_LITE = TIER_PROFILES.light.lite

/** `sound` without its echo, which differs from one build to the next (see the header). */
function withoutEcho(sound) {
  return {
    ...sound,
    spec: normalizeChainSpec({
      ...sound.spec,
      effects: sound.spec.effects.filter((effect) => effect.kind !== 'delay'),
    }),
  }
}

async function lightProbe() {
  const input = voiceInput(4)
  const read = (a, b) => compare(a, b, START, START, input.length)
  const out = {}
  for (const [name, sound] of Object.entries(dynamicsLanes())) {
    const light = { ...sound, lite: LIGHT_LITE }
    const without = withoutDynamics(sound)
    out[name] = {
      againstLaneWithoutThem: read(
        await monitorRender(input, withoutEcho(light)),
        await monitorRender(input, withoutEcho(without)),
      ).peakDifferenceDbfs,
      withEchoAgainstLaneWithoutThem: read(
        await monitorRender(input, light),
        await monitorRender(input, without),
      ).peakDifferenceDbfs,
      balancedAgainstLightForScale: read(
        await monitorRender(input, sound),
        await monitorRender(input, light),
      ).rmsDifferenceDbfs,
    }
  }
  const pass = Object.values(out).every(
    (lane) =>
      lane.againstLaneWithoutThem === 'exact' &&
      withinBar(lane.withEchoAgainstLaneWithoutThem),
  )
  return { pass, lite: LIGHT_LITE, ...out }
}

/** The follow probe's tone: low enough for the step measure, in its dynamic EQ's band. */
const FOLLOW_HZ = 480
/** A dynamic EQ band that cuts the tone and the voice's de-esser: what Light takes out. */
const FOLLOW_LANE = {
  on: true,
  spec: normalizeChainSpec({
    effects: [
      {
        kind: 'dyneq',
        enabled: true,
        params: {
          frequencyHz: FOLLOW_HZ,
          q: 1,
          thresholdDb: -40,
          ratio: 4,
          rangeDb: 6,
          attackMs: 8,
          releaseMs: 90,
        },
      },
      {
        kind: 'deesser',
        enabled: true,
        params: { frequencyHz: 6500, thresholdDb: -30, ratio: 5 },
      },
    ],
  }),
  gains: [1, 1],
}
/** When the tier changes, seconds into the tone, and the lite list it changes to. */
const FOLLOW_CHANGES = [
  { at: 1.5, lite: LIGHT_LITE },
  { at: 2.75, lite: [] },
]
/** Whole cycles of the tone, the frames a level is read over. */
const wholeCycles = (frames) =>
  Math.floor(frames / (SR / FOLLOW_HZ)) * (SR / FOLLOW_HZ)

async function followProbe() {
  const input = tone(4, -20, FOLLOW_HZ)
  const { ctx, view, chunks } = await liveContext()
  const source = ctx.createBufferSource()
  source.buffer = input
  const monitor = createStudioInputMonitor(view, source, {
    master: createStudioMonitorMaster(EMPTY_SPEC),
    settled: true,
  })
  monitor.set(FOLLOW_LANE)
  const startFrame = Math.ceil((ctx.currentTime + 0.75) * SR)
  source.start(frameTime(startFrame, SR))
  const changes = []
  for (const { at, lite } of FOLLOW_CHANGES) {
    await untilClock(ctx, startFrame / SR + at)
    changes.push(Math.round(ctx.currentTime * SR) - startFrame)
    monitor.set({ ...FOLLOW_LANE, lite })
  }
  await untilClock(ctx, (startFrame + input.length) / SR + 0.2)
  // The recorder's last quanta are still on their way to this thread.
  await new Promise((resolve) => setTimeout(resolve, 200))
  monitor.dispose()
  await ctx.close()
  const out = laidOut(chunks, startFrame, input.length)
  const without = await monitorRender(input, withoutDynamics(FOLLOW_LANE))
  const toneSlope = 2 * Math.sin((Math.PI * FOLLOW_HZ) / SR)
  const peakOf = (from, count) => {
    let peak = 0
    for (const side of out)
      for (let i = from; i < from + count; i++)
        peak = Math.max(peak, Math.abs(side[i]))
    return peak
  }
  const levelOf = (data, from, to) =>
    levelDbOf(data, from, wholeCycles(to - from))
  const around = changes.map((frame) => {
    const from = frame - s(0.05)
    const count = s(0.45)
    const level = Math.max(
      peakOf(frame - s(0.25), s(0.2)),
      peakOf(frame + s(0.25), s(0.2)),
    )
    let steepest = 0
    for (const side of out)
      for (let i = from; i < from + count; i++)
        steepest = Math.max(steepest, Math.abs(side[i] - side[i - 1]))
    const peaks = peaksAround(out[0], Math.ceil(SR / FOLLOW_HZ))
    let lowest = Infinity
    for (let i = frame; i < frame + s(0.2); i++)
      lowest = Math.min(lowest, peaks[i])
    return {
      frame,
      steepestAgainstToneOwn: round(steepest / (level * toneSlope), 3),
      dipsToDb: round(
        20 * Math.log10(lowest / peakOf(frame - s(0.25), s(0.2))),
        1,
      ),
    }
  })
  const [toLight, backToBalanced] = changes
  const balancedDb = levelOf(out, s(0.6), toLight - s(0.1))
  const lightDb = levelOf(out, toLight + s(0.4), backToBalanced - s(0.1))
  const lightWithoutDb = levelOf(
    without.map((side) => side.subarray(START)),
    toLight + s(0.4),
    backToBalanced - s(0.1),
  )
  const againDb = levelOf(out, backToBalanced + s(0.4), input.length - s(0.1))
  // A 1 dB jump on a crest of the steady Balanced tone, for scale.
  const crest =
    Math.ceil(s(1) / (SR / FOLLOW_HZ)) * (SR / FOLLOW_HZ) + SR / FOLLOW_HZ / 4
  const jumped = out.map((side) =>
    side.map((value, i) => (i >= crest ? value * 10 ** (-1 / 20) : value)),
  )
  let jumpStep = 0
  for (const side of jumped)
    for (let i = crest - 50; i < crest + 50; i++)
      jumpStep = Math.max(jumpStep, Math.abs(side[i] - side[i - 1]))
  const result = {
    toLight: {
      ...around[0],
      bandsTakenOutDb: round(lightDb - balancedDb, 3),
      levelAgainstLaneWithoutThemDb: round(lightDb - lightWithoutDb, 4),
    },
    backToBalanced: {
      ...around[1],
      levelAgainstBeforeDb: round(againDb - balancedDb, 4),
    },
    forScale: {
      oneDbJumpSteepest: round(
        jumpStep / (peakOf(s(0.6), s(0.3)) * toneSlope),
        3,
      ),
    },
  }
  const pass =
    around.every((change) => change.steepestAgainstToneOwn <= 1.1) &&
    Math.abs(result.toLight.levelAgainstLaneWithoutThemDb) <= 0.01 &&
    Math.abs(result.backToBalanced.levelAgainstBeforeDb) <= 0.01
  return { pass, toneHz: FOLLOW_HZ, ...result }
}

export async function runStudioMonitorDynamicsProbes() {
  await Promise.all([measureCompressorLatency(SR), measureShaperDelays(SR)])
  const dynamics = presetDynamics()
  return {
    latency: await latencyProbe(dynamics),
    levels: await levelsProbe(dynamics),
    voice: await voiceProbe(),
    steps: await stepsProbe(dynamics),
    light: await lightProbe(),
    follow: await followProbe(),
  }
}

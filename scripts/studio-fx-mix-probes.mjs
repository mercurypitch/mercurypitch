// Studio FX mix probes: the transient shaper, the stereo stage, the ducked echo, every role
// chain, the mix macros and a full mastered mix, rendered in real Chromium.
// Imported by scripts/check-studio-fx-browser.mjs inside a page served by the Vite dev server.
import { applyMixMacros, autoMixTrack, findFlavour, normalizeChainSpec, renderMixdown, LOUDNESS_PRESETS, measureChainLatencyFrames, measureLoudness, MIX_FLAVOURS, NEUTRAL_MACROS, REFERENCE_LUFS, renderMasteredMix, renderThroughChain, ROLE_BALANCE_DB, roleChain, TRACK_ROLES, } from '/src/lib/studio-fx/index.ts'
import { db, magnitude, rms, round, scaleTo, SR, syntheticVoice, } from '/scripts/studio-fx-browser-probes.mjs'

function seeded(seed) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return (state / 4294967296) * 2 - 1
  }
}

function makeBuffer(channels, seconds, fill) {
  const length = Math.round(seconds * SR)
  const buffer = new AudioBuffer({
    numberOfChannels: channels,
    length,
    sampleRate: SR,
  })
  for (let c = 0; c < channels; c++) {
    const data = buffer.getChannelData(c)
    for (let i = 0; i < length; i++) data[i] = fill(c, i)
  }
  return buffer
}

/** Kick on the beat, snare on the off-beat, at 120 BPM. */
function drumLoop(seconds) {
  const noise = seeded(7)
  const beat = 0.5
  const onsets = []
  for (let at = 0; at < seconds - 0.4; at += beat)
    onsets.push(Math.round(at * SR))
  const buffer = makeBuffer(1, seconds, () => 0)
  const out = buffer.getChannelData(0)
  onsets.forEach((start, n) => {
    let phase = 0
    let previous = 0
    for (let i = 0; i < 0.35 * SR && start + i < out.length; i++) {
      const t = i / SR
      if (n % 2 === 0) {
        phase += (2 * Math.PI * (55 + 90 * Math.exp(-t / 0.02))) / SR
        out[start + i] +=
          0.8 *
          (Math.sin(phase) * Math.exp(-t / 0.12) +
            0.3 * noise() * Math.exp(-t / 0.002))
      } else {
        const white = noise()
        const bright = white - previous
        previous = white
        out[start + i] +=
          0.6 *
          (0.6 * Math.sin(2 * Math.PI * 190 * t) * Math.exp(-t / 0.05) +
            0.35 * bright * Math.exp(-t / 0.08))
      }
    }
  })
  return { buffer, onsets }
}

/** Plucked notes: a bass line, or chords for the harmonic instruments. */
function plucks(seconds, notes, { brightness = 8, decay = 0.6, every = 0.5 }) {
  return makeBuffer(1, seconds, (_, i) => {
    const t = i / SR
    const local = t % every
    const step = Math.floor(t / every)
    const chord = notes[step % notes.length]
    let value = 0
    for (const f0 of chord) {
      for (let k = 1; k <= brightness && k * f0 < 12000; k++) {
        value +=
          (Math.sin(2 * Math.PI * k * f0 * local) / k) *
          Math.exp((-local * k) / decay)
      }
    }
    return (0.2 * value) / chord.length
  })
}

const BASS_LINE = [[55], [55], [73.4], [82.4]]
const CHORDS = [
  [220, 261.6, 329.6],
  [174.6, 220, 261.6],
  [196, 246.9, 293.7],
  [164.8, 196, 246.9],
]

function clipFor(role, seconds) {
  if (role === 'voice' || role === 'backing-vocals')
    return syntheticVoice(seconds)
  if (role === 'drums') return drumLoop(seconds).buffer
  if (role === 'bass')
    return plucks(seconds, BASS_LINE, { brightness: 12, decay: 0.8 })
  return plucks(seconds, CHORDS, { brightness: 10, decay: 0.5 })
}

function stats(buffer) {
  let peak = 0
  let finite = true
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    for (const v of buffer.getChannelData(c)) {
      if (!Number.isFinite(v)) finite = false
      peak = Math.max(peak, Math.abs(v))
    }
  }
  return { finite, peakDb: db(peak) }
}

const only = (kind, params) => ({ effects: [{ kind, params }] })

async function transientProbe() {
  const { buffer, onsets } = drumLoop(2.2)
  const x = buffer.getChannelData(0)
  const through = async (params, source = buffer) =>
    (
      await renderThroughChain(source, only('transient', params), {
        tailSeconds: 0,
      })
    ).getChannelData(0)
  const region = (y, fromMs, toMs) =>
    db(
      Math.sqrt(
        onsets.reduce(
          (sum, onset) =>
            sum +
            rms(
              y,
              onset + Math.round((fromMs * SR) / 1000),
              onset + Math.round((toMs * SR) / 1000),
            ) **
              2,
          0,
        ),
      ),
    )
  const change = (y, fromMs, toMs) =>
    region(y, fromMs, toMs) - region(x, fromMs, toMs)
  const plain = await through({ attack: 0, sustain: 0 })
  const punchy = await through({ attack: 100, sustain: 0 })
  const tight = await through({ attack: 0, sustain: -100 })
  let identity = 0
  for (let i = 0; i < x.length; i++)
    identity = Math.max(identity, Math.abs(plain[i] - x[i]))
  // A held 41 Hz note must not wobble the gain: the key is high-passed.
  const low = makeBuffer(
    1,
    2,
    (_, i) => 0.5 * Math.sin((2 * Math.PI * 41.2 * i) / SR),
  )
  const lowOut = await through({ attack: 100, sustain: -100 }, low)
  const lowIn = low.getChannelData(0)
  const windows = []
  for (let from = SR; from + 2400 <= 1.9 * SR; from += 2400)
    windows.push(
      db(rms(lowOut, from, from + 2400) / rms(lowIn, from, from + 2400)),
    )
  const ripple = Math.max(...windows) - Math.min(...windows)
  const result = {
    identityError: identity,
    attackLiftDb: round(change(punchy, 0, 12), 2),
    tailWithAttackDb: round(change(punchy, 80, 200), 2),
    tailCutDb: round(change(tight, 80, 200), 2),
    attackWithSustainCutDb: round(change(tight, 0, 12), 2),
    lowNoteRippleDb: round(ripple, 3),
  }
  return {
    pass:
      identity < 1e-6 &&
      result.attackLiftDb > 2 &&
      Math.abs(result.tailWithAttackDb) < 1 &&
      result.tailCutDb < -1 &&
      Math.abs(result.attackWithSustainCutDb) < 1.5 &&
      ripple < 0.1,
    ...result,
  }
}

async function stereoProbe() {
  const voice = syntheticVoice(1.5)
  const x = voice.getChannelData(0)
  const haas = await renderThroughChain(
    voice,
    only('stereo', { haasMs: 14, haasAmount: 100 }),
    { tailSeconds: 0 },
  )
  const [hl, hr] = [haas.getChannelData(0), haas.getChannelData(1)]
  let foldError = 0
  let side = 0
  for (let i = 0; i < x.length; i++) {
    foldError = Math.max(foldError, Math.abs((hl[i] + hr[i]) / 2 - x[i]))
    side += ((hl[i] - hr[i]) / 2) ** 2
  }
  const sideDb = db(Math.sqrt(side / x.length)) - db(rms(x, 0, x.length))

  const a = seeded(11)
  const b = seeded(23)
  const pair = makeBuffer(2, 1, (c) => 0.2 * (c === 0 ? a() : b()))
  const narrow = await renderThroughChain(
    pair,
    only('stereo', { widthPct: 0 }),
    {
      tailSeconds: 0,
    },
  )
  const wire = await renderThroughChain(pair, only('stereo', {}), {
    tailSeconds: 0,
  })
  let monoError = 0
  let wireError = 0
  for (let i = 0; i < pair.length; i++) {
    monoError = Math.max(
      monoError,
      Math.abs(narrow.getChannelData(0)[i] - narrow.getChannelData(1)[i]),
    )
    for (let c = 0; c < 2; c++)
      wireError = Math.max(
        wireError,
        Math.abs(wire.getChannelData(c)[i] - pair.getChannelData(c)[i]),
      )
  }

  // Pure side content at 50 Hz and 1 kHz: the mono-below stage takes only the 50 Hz.
  const antiphase = makeBuffer(2, 1, (c, i) => {
    const v =
      0.2 * Math.sin((2 * Math.PI * 50 * i) / SR) +
      0.2 * Math.sin((2 * Math.PI * 1000 * i) / SR)
    return c === 0 ? v : -v
  })
  const mono = await renderThroughChain(
    antiphase,
    only('stereo', { monoBelowHz: 120 }),
    { tailSeconds: 0 },
  )
  const sideOf = (buffer) => {
    const l = buffer.getChannelData(0)
    const r = buffer.getChannelData(1)
    return l.map((v, i) => (v - r[i]) / 2)
  }
  const [sIn, sOut] = [sideOf(antiphase), sideOf(mono)]
  const keep = (f) =>
    db(magnitude(sOut, f, SR / 2, SR) / magnitude(sIn, f, SR / 2, SR))
  const result = {
    haasMonoFoldError: foldError,
    haasSideDb: round(sideDb, 1),
    widthZeroLeftRightError: monoError,
    defaultsWireError: wireError,
    sideKept50HzDb: round(keep(50), 1),
    sideKept1kHzDb: round(keep(1000), 2),
  }
  return {
    pass:
      foldError < 1e-5 &&
      sideDb > -14 &&
      monoError < 1e-6 &&
      wireError < 1e-5 &&
      result.sideKept50HzDb < -20 &&
      Math.abs(result.sideKept1kHzDb) < 0.5,
    ...result,
  }
}

async function echoDuckProbe() {
  const voice = scaleTo(syntheticVoice(1.65), -18)
  const padded = makeBuffer(1, 3.5, (_, i) =>
    i < voice.length ? voice.getChannelData(0)[i] : 0,
  )
  const wet = async (duck) =>
    (
      await renderThroughChain(
        padded,
        only('delay', { timeMs: 300, feedback: 40, mix: 100, duck }),
        { tailSeconds: 0 },
      )
    ).getChannelData(0)
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

async function roleChainsProbe() {
  const rows = []
  for (const role of TRACK_ROLES) {
    const clip = scaleTo(clipFor(role, 3), -26)
    const track = await autoMixTrack(role, clip, { bpm: 120 })
    const out = await renderThroughChain(clip, track.spec)
    const { finite, peakDb } = stats(out)
    rows.push({
      role,
      finite,
      latencyFrames: await measureChainLatencyFrames(track.spec, SR),
      chainLoudnessChangeDb: round(-track.trimDb, 1),
      outLufs: round(measureLoudness(out).integratedLufs, 2),
      expectedLufs: REFERENCE_LUFS + ROLE_BALANCE_DB[role],
      peakDb: round(peakDb, 1),
    })
  }
  return {
    pass: rows.every(
      (row) =>
        row.finite &&
        Math.abs(row.chainLoudnessChangeDb) < 8 &&
        Math.abs(row.outLufs - row.expectedLufs) < 0.5 &&
        row.peakDb < 1,
    ),
    rows,
  }
}

async function macrosProbe() {
  const voice = scaleTo(syntheticVoice(2), -18)
  const tailOf = async (space) => {
    const spec = roleChain('voice', {
      measuredLufs: -18,
      bpm: 120,
      macros: { ...NEUTRAL_MACROS, space },
    })
    const y = (await renderThroughChain(voice, spec)).getChannelData(0)
    return db(rms(y, voice.length + 0.1 * SR, voice.length + 1.1 * SR))
  }
  const spaceRangeDb = (await tailOf(100)) - (await tailOf(-60))
  const flavours = []
  for (const flavour of MIX_FLAVOURS) {
    for (const role of ['voice', 'drums', 'keys']) {
      const clip = clipFor(role, 1.5)
      const spec = applyMixMacros(
        roleChain(role, {
          measuredLufs: measureLoudness(clip).integratedLufs,
          bpm: 120,
        }),
        flavour.macros,
      )
      const { finite, peakDb } = stats(await renderThroughChain(clip, spec))
      flavours.push({
        flavour: flavour.id,
        role,
        finite,
        peakDb: round(peakDb, 1),
      })
    }
  }
  return {
    pass:
      spaceRangeDb > 10 &&
      flavours.every((row) => row.finite && row.peakDb < 3),
    spaceTailRangeDb: round(spaceRangeDb, 1),
    flavours,
  }
}

async function fullMixProbe() {
  const seconds = 4
  const roles = ['voice', 'drums', 'bass', 'acoustic-guitar', 'keys']
  const mix = makeBuffer(2, seconds + 3, () => 0)
  for (const role of roles) {
    const clip = scaleTo(clipFor(role, seconds), -24)
    const { spec } = await autoMixTrack(role, clip, { bpm: 120 })
    const out = await renderThroughChain(clip, spec)
    for (let c = 0; c < 2; c++) {
      const into = mix.getChannelData(c)
      const from = out.getChannelData(c)
      for (let i = 0; i < Math.min(into.length, from.length); i++)
        into[i] += from[i]
    }
  }
  const rows = []
  for (const preset of LOUDNESS_PRESETS) {
    for (const flavourId of ['natural', 'lofi']) {
      const flavour = findFlavour(flavourId)
      const master = await renderMasteredMix(mix, {
        targetLufs: preset.targetLufs,
        maxLimitingDb: preset.maxLimitingDb,
        macros: flavour.macros,
        masterEq: flavour.masterEq,
      })
      rows.push({
        loudness: preset.id,
        flavour: flavourId,
        gainDb: round(master.gainDb, 2),
        limitingDb: round(master.before.truePeakDb + master.gainDb + 1.5, 2),
        deliveredLufs: round(master.after.integratedLufs, 2),
        targetLufs: preset.targetLufs,
        peakDb: round(master.after.samplePeakDb, 2),
        maxLimitingDb: preset.maxLimitingDb,
      })
    }
  }
  return {
    pass: rows.every(
      (row) =>
        row.peakDb <= -1.49 &&
        row.limitingDb <= row.maxLimitingDb + 0.01 &&
        row.deliveredLufs < row.targetLufs + 0.7 &&
        (row.limitingDb < row.maxLimitingDb - 0.01
          ? Math.abs(row.deliveredLufs - row.targetLufs) < 0.7
          : true),
    ),
    rows,
  }
}

async function mixdownProbe() {
  const click = () =>
    makeBuffer(1, 1, (_, i) => (i === Math.round(0.25 * SR) ? 0.5 : 0))
  const slow = roleChain('voice', { measuredLufs: -18 })
  const fast = normalizeChainSpec({ effects: [{ kind: 'eq' }] })
  const solo = async (spec) =>
    renderMixdown([{ buffer: click(), spec }], { tailSeconds: 0.2 })
  const peakAt = (buffer) => {
    const y = buffer.getChannelData(0)
    let best = 0
    for (let i = 1; i < y.length; i++)
      if (Math.abs(y[i]) > Math.abs(y[best])) best = i
    return best
  }
  const [slowAt, fastAt] = [peakAt(await solo(slow)), peakAt(await solo(fast))]
  const both = await renderMixdown(
    [
      { buffer: click(), spec: slow },
      { buffer: click(), spec: fast, startSeconds: 0.5 },
    ],
    { tailSeconds: 0.2 },
  )
  const y = both.getChannelData(0)
  const second = peakAt(
    makeBuffer(1, y.length / SR, (_, i) => (i > 0.6 * SR ? y[i] : 0)),
  )
  const expected = Math.round(0.25 * SR)
  return {
    pass:
      slowAt === expected &&
      fastAt === expected &&
      second === expected + Math.round(0.5 * SR),
    slowChainClickAt: slowAt,
    fastChainClickAt: fastAt,
    offsetTrackClickAt: second,
    expected,
  }
}

export async function runStudioFxMixProbes() {
  return {
    transientShapesHitsNotLowNotes: await transientProbe(),
    stereoWidensMonoSafely: await stereoProbe(),
    echoStepsBackWhileSinging: await echoDuckProbe(),
    everyRoleChainRendersClean: await roleChainsProbe(),
    macrosAndFlavoursRenderClean: await macrosProbe(),
    fullMixMastersToEveryTarget: await fullMixProbe(),
    mixdownAlignsChainsAndOffsets: await mixdownProbe(),
  }
}

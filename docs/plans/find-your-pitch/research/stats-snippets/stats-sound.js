/* ==========================================================================================
   STATS-KIT SOUND, copied verbatim from https://dev.stats.maff.app/kit/app.ffcf540f.js
   (kit/template/sound-map.js lines 10-36 and 177-179; kit/template/sound.js lines 319-386 and
   571-661 of the joined bundle), wrapped as one ES module, plus renderToWav() for video soundtracks.
   Thirteen synthesized voices (no samples, nothing to license), one bus: compressor -> limiter ->
   master -3 dB -> tanh soft clip at -2 dBFS, with a 22% send into a seeded synthetic room.
   Everything is deterministic (seeded noise), so OfflineAudioContext renders the same WAV twice.
   ========================================================================================== */

/* ---------------------------------------------------------------- keys and scales (sound-map.js) */

/* ---------------------------------------------------------------- keys and scales */
export const PITCH_CLASS = {
  C: 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  F: 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
}
export const MODES = {
  ionian: [0, 2, 4, 5, 7, 9, 11],
  major: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  minor: [0, 2, 3, 5, 7, 8, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
}
// Reads keys the way the picker does (parseKey in src/picker/chladni.ts): 'E minor', 'Bb major', 'B♭ major',
// 'B-flat minor', 'F sharp minor', 'd dorian', 'Eb'. The tonic sits in the octave from C3 (MIDI 48), where the
// picker roots its chords. Text that is not a key plays in C major; a quality this table does not name plays
// as natural minor, since the picker hears it as minor too.
export function scaleFor(key) {
  const m =
    /^\s*([A-Ga-g])\s*(#|♯|b|♭|-?\s*sharp|-?\s*flat)?(?:\s+|-|$)(.*)$/i.exec(
      key == null ? '' : String(key),
    )
  if (!m) return { tonic: 48, intervals: MODES.major.slice() }
  const letter = m[1].toUpperCase(),
    raw = (m[2] || '').replace(/[-\s]/g, '').toLowerCase()
  const acc =
    raw === '#' || raw === '♯' || raw === 'sharp'
      ? '#'
      : raw === 'b' || raw === '♭' || raw === 'flat'
        ? 'b'
        : ''
  const quality = m[3].trim().toLowerCase() || 'major'
  const pc =
    letter + acc in PITCH_CLASS
      ? PITCH_CLASS[letter + acc]
      : PITCH_CLASS[letter]
  const mode =
    Object.keys(MODES).find((q) => new RegExp(`^${q}\\b`).test(quality)) ||
    'minor'
  return { tonic: 48 + pc, intervals: MODES[mode].slice() }
}
// a diatonic degree (0 is the tonic) as a MIDI note, with the tonic in scientific octave `octave` (C4 = 60)
export function degreeToMidi(scale, degree, octave) {
  const n = scale.intervals.length,
    d = Math.round(degree),
    wrap = Math.floor(d / n)
  return (
    12 * (octave + 1) +
    (scale.tonic % 12) +
    12 * wrap +
    scale.intervals[d - wrap * n]
  )
}
// the key's chord strummed upward on the harp: what the sound switch answers with when it turns on
export const chordEvents = (scale) =>
  [0, 2, 4, 7].map((d, i) => ({
    t: i * 0.045,
    instrument: 'harp',
    midi: degreeToMidi(scale, d, 3),
    velocity: 72,
    dur: 1.4,
  }))

/* ---------------------------------------------------------------- the bus (sound.js) */
const FADE = 0.3 // seconds a stopped phrase takes to fade out
const LOOKAHEAD = 0.12 // seconds of notes scheduled ahead of the clock
const TICK_MS = 25 // how often the scheduler looks ahead
const PACK_WAIT_MS = 2500 // how long the first phrase waits for the pack before it plays synthesized voices
const RESUME_WAIT_MS = 300 // how long ensure() waits for a held context to resume
const TAIL_MS = 4000 // how long a phrase may ring after it ends: the longest decaying sample (2.5 s), pitched down
const CEILING_DB = -2 // the soft clip's ceiling: under -1 dBTP, with room for the peaks between samples
const MASTER_DB = -3 // the bus level into the soft clip (calibrated in Task 15)
const SYNTH_DB = 0 // synthesized voices against the samples (calibrated in Task 15)
const dbToGain = (db) => Math.pow(10, db / 20)
// a seeded random source (mulberry32), so the room and the noise are the same on every visit
function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), a | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
// The soft clip curve: linear up to three quarters of the ceiling, then a tanh knee that never reaches it.
// Everything leaves through it, so a dense strum cannot clip whatever the compressor misses.
function softClip(ceilingDb = CEILING_DB, n = 2049) {
  const c = dbToGain(ceilingDb),
    k = 0.75 * c,
    curve = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1,
      a = Math.abs(x)
    curve[i] =
      Math.sign(x) * (a <= k ? a : k + (c - k) * Math.tanh((a - k) / (c - k)))
  }
  return curve
}
// A synthetic stereo room: 18 ms of pre-delay, then noise that decays to -60 dB over `seconds` and darkens as it
// goes. Seeded, so every visit hears the same room; there is no file to download and nothing to license.
function roomIR(c, seconds = 1.6, seed = 7) {
  const rate = c.sampleRate,
    pre = Math.round(0.018 * rate),
    len = pre + Math.round(seconds * rate)
  const ir = c.createBuffer(2, len, rate)
  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch),
      rand = rng(seed + ch * 101)
    let low = 0
    for (let i = pre; i < len; i++) {
      const u = (i - pre) / (len - pre)
      low += (0.55 - 0.45 * u) * (rand() * 2 - 1 - low) // a one-pole low-pass that closes as the tail decays
      data[i] = low * Math.pow(10, -3 * u)
    }
  }
  return ir
}
// input -> compressor -> limiter -> master -> soft clip -> speakers, with a reverb send from the input
export function buildBus(c) {
  const input = c.createGain()
  const comp = c.createDynamicsCompressor()
  comp.threshold.value = -20
  comp.knee.value = 12
  comp.ratio.value = 3
  comp.attack.value = 0.01
  comp.release.value = 0.25
  const limit = c.createDynamicsCompressor()
  limit.threshold.value = -6
  limit.knee.value = 0
  limit.ratio.value = 20
  limit.attack.value = 0.001
  limit.release.value = 0.1
  const master = c.createGain()
  master.gain.value = dbToGain(MASTER_DB)
  const clip = c.createWaveShaper()
  clip.curve = softClip(CEILING_DB)
  clip.oversample = '4x'
  const send = c.createGain()
  send.gain.value = 0.22
  const room = c.createConvolver()
  room.buffer = roomIR(c)
  input.connect(comp)
  input.connect(send)
  send.connect(room)
  room.connect(comp)
  comp.connect(limit)
  limit.connect(master)
  master.connect(clip)
  clip.connect(c.destination)
  return { input, master }
}

/* ---------------------------------------------------------------- synthesized voices (sound.js) */
/* ---------------------------------------------------------------- synthesized voices */
// The offline report's only voices, and the stand-in for any voice whose samples did not load. Each is
// (c, out, t, midi, velocity, dur): one note at time t into node out.
export const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12)
const level = (velocity) =>
  Math.pow(Math.max(1, Math.min(127, velocity)) / 127, 2)
const noises = new WeakMap(),
  jitter = rng(5)
function noise(c) {
  if (!noises.has(c)) {
    const b = c.createBuffer(1, c.sampleRate, c.sampleRate),
      d = b.getChannelData(0),
      r = rng(11)
    for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1
    noises.set(c, b)
  }
  return noises.get(c)
}
// a gain that rises to `peak` over `attack`, holds, then falls to e^-4 of it over `decay` seconds
function env(c, out, t, peak, attack, hold, decay) {
  const g = c.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(peak, t + attack)
  g.gain.setTargetAtTime(0, t + attack + hold, decay / 4)
  g.connect(out)
  return g
}
function osc(c, type, f, t, end, out) {
  const o = c.createOscillator()
  o.type = type
  o.frequency.value = f
  o.connect(out)
  o.start(t)
  o.stop(end)
}
function filter(c, type, f, q, out) {
  const b = c.createBiquadFilter()
  b.type = type
  b.frequency.value = f
  b.Q.value = q
  b.connect(out)
  return b
}
// filtered noise: brushes, the crowd, the needle, the crackle
function hiss(
  c,
  out,
  t,
  velocity,
  {
    hold = 0,
    decay = 0.2,
    type = 'bandpass',
    f = 2000,
    q = 0.7,
    attack = 0.003,
    peak = 0.5,
  } = {},
) {
  const g = env(
    c,
    filter(c, type, f, q, out),
    t,
    peak * level(velocity),
    attack,
    hold,
    decay,
  )
  const s = c.createBufferSource()
  s.buffer = noise(c)
  s.loop = true
  s.connect(g)
  s.start(t, jitter() * 0.5)
  s.stop(t + attack + hold + decay + 0.05)
}
// a plucked string: a triangle with a quiet octave shimmer, darker when played softly
function pluck(c, out, t, midi, velocity, ring, bright) {
  const f = hz(midi),
    lp = filter(
      c,
      'lowpass',
      Math.min(12000, f * (2 + (6 * bright * velocity) / 127)),
      0.7,
      out,
    )
  const g = env(c, lp, t, 0.45 * level(velocity), 0.005, 0, ring),
    end = t + ring + 0.05
  osc(c, 'triangle', f, t, end, g)
  const s = c.createGain()
  s.gain.value = 0.18
  s.connect(g)
  osc(c, 'sine', f * 2.001, t, end, s)
}
// a celesta: a sine and its fourth partial, the partial dying first
function bell(c, out, t, midi, velocity) {
  const f = hz(midi),
    a = level(velocity)
  osc(c, 'sine', f, t, t + 2, env(c, out, t, 0.4 * a, 0.003, 0, 1.8))
  osc(c, 'sine', f * 4, t, t + 0.6, env(c, out, t, 0.12 * a, 0.002, 0, 0.5))
}
// a bowed note: two detuned saws through a low-pass, swelling in and held for its length
function bow(c, out, t, midi, velocity, dur) {
  const f = hz(midi),
    lp = filter(c, 'lowpass', f * 3, 0.5, out),
    end = t + dur + 0.8
  const g = env(
    c,
    lp,
    t,
    0.22 * level(velocity),
    0.25,
    Math.max(0, dur - 0.25),
    0.6,
  )
  osc(c, 'sawtooth', f * 0.998, t, end, g)
  osc(c, 'sawtooth', f * 1.002, t, end, g)
}
function kick(c, out, t, midi, velocity) {
  const o = c.createOscillator(),
    g = env(c, out, t, 0.9 * level(velocity), 0.002, 0, 0.35)
  o.frequency.setValueAtTime(120, t)
  o.frequency.exponentialRampToValueAtTime(45, t + 0.12)
  o.connect(g)
  o.start(t)
  o.stop(t + 0.45)
}
function stick(c, out, t, midi, velocity) {
  hiss(c, out, t, velocity, { decay: 0.08, type: 'highpass', f: 1800 })
  osc(
    c,
    'triangle',
    190,
    t,
    t + 0.15,
    env(c, out, t, 0.3 * level(velocity), 0.001, 0, 0.12),
  )
}
function clap(c, out, t, midi, velocity) {
  ;[0, 0.011, 0.023].forEach((d) =>
    hiss(c, out, t + d, velocity, {
      decay: 0.03,
      f: 1200,
      q: 1.2,
      attack: 0.001,
    }),
  )
  hiss(c, out, t + 0.03, velocity, { decay: 0.15, f: 1200, q: 1.2, peak: 0.3 })
}
function needle(c, out, t, midi, velocity) {
  osc(
    c,
    'sine',
    60,
    t,
    t + 0.2,
    env(c, out, t, 0.5 * level(velocity), 0.002, 0, 0.15),
  )
  hiss(c, out, t, velocity, {
    decay: 0.04,
    type: 'lowpass',
    f: 800,
    attack: 0.001,
  })
}
// sparse clicks through a high-pass, for dur seconds
function crackle(c, out, t, midi, velocity, dur) {
  const r = rng(Math.round(t * 1000) + 3)
  for (let x = t; x < t + dur; x += 0.02 + r() * 0.18)
    hiss(c, out, x, velocity * (0.3 + 0.7 * r()), {
      decay: 0.003,
      type: 'highpass',
      f: 2500,
      attack: 0.0005,
    })
}
function click(c, out, t, midi, velocity) {
  osc(
    c,
    'sine',
    hz(midi),
    t,
    t + 0.08,
    env(c, out, t, 0.5 * level(velocity), 0.001, 0, 0.05),
  )
}
// the thirteen voices, in the spec's order
export const SYNTH = {
  harp: (c, o, t, m, v) => pluck(c, o, t, m, v, 2.4, 1),
  guitar: (c, o, t, m, v) => pluck(c, o, t, m, v, 1.6, 0.7),
  guitarMute: (c, o, t, m, v) => pluck(c, o, t, m, v, 0.12, 0.3),
  celesta: bell,
  bowed: bow,
  brush: (c, o, t, m, v) => hiss(c, o, t, v, { decay: 0.25, f: 3500 }),
  stick,
  kick,
  clap,
  crowd: (c, o, t, m, v, d) =>
    hiss(c, o, t, v, {
      attack: 0.3,
      hold: Math.max(0.2, d - 0.3),
      decay: 0.6,
      f: 1800,
      q: 0.5,
    }),
  needle,
  crackle,
  click,
}
const VOICES = Object.keys(SYNTH)

/* ---------------------------------------------------------------- added: render a phrase to WAV */
// events: [{ t, instrument, midi, velocity, dur }] (t in seconds). Same routing as Sound.render()
// in the kit: every note goes straight into the bus input (the live player adds a per-phrase fader).
// Use it to bake a lesson's sound effects (a strum when a chord lands, harp notes as notes jump) into
// a WAV that the HyperFrames composition plays as an <audio> track, frame-accurately.
export async function renderToWav(
  events,
  { seconds, sampleRate = 48000 } = {},
) {
  const span =
    seconds || events.reduce((m, e) => Math.max(m, e.t + e.dur), 0) + 2.5
  const c = new OfflineAudioContext(
      2,
      Math.ceil(span * sampleRate),
      sampleRate,
    ),
    bus = buildBus(c)
  events.forEach((e) =>
    (SYNTH[e.instrument] || SYNTH.harp)(
      c,
      bus.input,
      e.t,
      e.midi,
      e.velocity,
      e.dur,
    ),
  )
  const buf = await c.startRendering()
  return new Blob([wavBytes(buf)], { type: 'audio/wav' })
}
export function wavBytes(buf) {
  const ch = buf.numberOfChannels,
    n = buf.length,
    rate = buf.sampleRate,
    out = new DataView(new ArrayBuffer(44 + n * ch * 2))
  const str = (o, s) => {
    for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i))
  }
  str(0, 'RIFF')
  out.setUint32(4, 36 + n * ch * 2, true)
  str(8, 'WAVEfmt ')
  out.setUint32(16, 16, true)
  out.setUint16(20, 1, true)
  out.setUint16(22, ch, true)
  out.setUint32(24, rate, true)
  out.setUint32(28, rate * ch * 2, true)
  out.setUint16(32, ch * 2, true)
  out.setUint16(34, 16, true)
  str(36, 'data')
  out.setUint32(40, n * ch * 2, true)
  const data = Array.from({ length: ch }, (_, k) => buf.getChannelData(k))
  for (let i = 0, o = 44; i < n; i++)
    for (let k = 0; k < ch; k++, o += 2) {
      const v = Math.max(-1, Math.min(1, data[k][i]))
      out.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true)
    }
  return out.buffer
}

/* ---------------------------------------------------------------- the picker's simpler voice */
// From the picker bundle (Ct / It): a triangle plus a sine an octave up (x2.001, gain .18), 12 ms
// attack to `peak`, exponential decay over 2.2 s, through a 2.6 kHz low-pass and a 0.29 s feedback
// delay (feedback .28, wet .22). strum(): root, third, fifth, octave of the key from C3, 45 ms apart.
// rise(): the same chord, then an octave higher, then the root two octaves up, 38 ms apart.
export function pickerVoice(c, out, f, t, peak = 0.16) {
  const a = c.createOscillator()
  a.type = 'triangle'
  a.frequency.value = f
  const b = c.createOscillator()
  b.type = 'sine'
  b.frequency.value = f * 2.001
  const bg = c.createGain()
  bg.gain.value = 0.18
  const g = c.createGain()
  g.gain.setValueAtTime(1e-4, t)
  g.gain.exponentialRampToValueAtTime(peak, t + 0.012)
  g.gain.exponentialRampToValueAtTime(1e-4, t + 2.2)
  a.connect(g)
  b.connect(bg)
  bg.connect(g)
  g.connect(out)
  a.start(t)
  b.start(t)
  a.stop(t + 2.3)
  b.stop(t + 2.3)
}
export function pickerBus(c) {
  const input = c.createGain()
  input.gain.value = 0.55
  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 2600
  const d = c.createDelay(1)
  d.delayTime.value = 0.29
  const fb = c.createGain()
  fb.gain.value = 0.28
  const wet = c.createGain()
  wet.gain.value = 0.22
  input.connect(lp)
  lp.connect(c.destination)
  lp.connect(d)
  d.connect(fb)
  fb.connect(d)
  d.connect(wet)
  wet.connect(c.destination)
  return input
}
export const strumMidi = (tonicMidi, minor) => [
  tonicMidi,
  tonicMidi + (minor ? 3 : 4),
  tonicMidi + 7,
  tonicMidi + 12,
]

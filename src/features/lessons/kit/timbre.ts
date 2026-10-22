// ============================================================
// Timbres — Merc's "ooh" as an "ng" and as a lip trill
// ============================================================
//
// Lesson 7 plays one siren in three sounds on one path (its FACTS 82): "oo",
// Merc's "ooh" unchanged; "ng", the same voice through a lowpass at 900 Hz,
// the sound leaving through the nose with the mouth closed; and a lip trill,
// its level wobbling 22 times a second at a depth of 70 % over a soft band
// of breath noise. Both are synthesised illustrations: the buzz rate and the
// filter are the page's choices, not measurements of lips or noses. Each is
// a `Timbre` for kit/sound.ts, which builds a voice exactly as before
// without one, and lives in its own module, so no page that never sings
// them carries them in its first paint.

import { mulberry32 } from './dom'
import type { Timbre } from './sound'

/** The "ng" lowpass, Hz. */
export const NG_LOWPASS_HZ = 900
/** The lip trill's buzz, times a second, and how deep it pulls the level (0 to 1). */
export const TRILL_HZ = 22
export const TRILL_DEPTH = 0.7
/** The breath under the trill: its band and its level against the tone. */
const AIR_HZ = 1800
const AIR_Q = 0.7
const AIR_LEVEL = 0.12

/** "Ng": the tone through a lowpass at 900 Hz, and nothing more. */
export const NG: Timbre = (filter, envelope) => {
  filter.frequency.value = NG_LOWPASS_HZ
  filter.connect(envelope)
}

// One second of white noise per context, from a fixed seed, looped under a trill.
let air: AudioBuffer | null = null

function airBuffer(context: BaseAudioContext): AudioBuffer {
  if (air !== null && air.sampleRate === context.sampleRate) return air
  const length = Math.round(context.sampleRate)
  const buf = context.createBuffer(1, length, context.sampleRate)
  const data = buf.getChannelData(0)
  const random = mulberry32(0x7a11)
  for (let i = 0; i < length; i++) data[i] = random() * 2 - 1
  air = buf
  return buf
}

/**
 * A lip trill: the tone's level wobbles from 100 % down to 30 % and back,
 * 22 times a second, with a soft band of breath noise under it that the
 * same wobble carries.
 */
export const LIP_TRILL: Timbre = (filter, envelope, at, parts) => {
  const context = filter.context
  const wobble = context.createGain()
  // swings 0.65 ± 0.35: from 1 down to 0.3, a depth of 70 %
  wobble.gain.value = 1 - TRILL_DEPTH / 2
  const lfo = context.createOscillator()
  lfo.frequency.value = TRILL_HZ
  const depth = context.createGain()
  depth.gain.value = TRILL_DEPTH / 2
  lfo.connect(depth)
  depth.connect(wobble.gain)
  filter.connect(wobble)
  const breath = context.createBufferSource()
  breath.buffer = airBuffer(context)
  breath.loop = true
  const band = context.createBiquadFilter()
  band.type = 'bandpass'
  band.frequency.value = AIR_HZ
  band.Q.value = AIR_Q
  const level = context.createGain()
  level.gain.value = AIR_LEVEL
  breath.connect(band)
  band.connect(level)
  level.connect(wobble)
  wobble.connect(envelope)
  lfo.start(at)
  breath.start(at)
  parts.push(lfo, breath)
}

/** The siren's three sounds, by the page's names for them. */
export type SirenSound = 'ng' | 'trill' | 'oo'

/** The timbre each sound plays in; "oo" is Merc's "ooh" unchanged. */
export const TIMBRES: Readonly<Record<SirenSound, Timbre | undefined>> = {
  ng: NG,
  trill: LIP_TRILL,
  oo: undefined,
}

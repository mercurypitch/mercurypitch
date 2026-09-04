// Every tunable, described well enough to drag.
// ============================================================
//
// `world3d-config.ts` says it out loud: "The debug panel binds directly
// to this object and dumps it back as JSON, so the shape has to stay
// plain data." This is the other half of that sentence -- the list of
// what may be dragged, how far, and what it does.
//
// THREE DECISIONS, and the reasons matter more than the list.
//
// IT MUTATES THE LIVE CONFIG OBJECT. Every stage holds `const cfg =
// CHAMBER_CONFIG` and reads `cfg.ring`, `cfg.loop`, `cfg.locomotion`
// fresh on the frame that needs them, so writing into that object is
// seen on the next frame with no plumbing, no signal, and no remount.
// A panel that rebuilt the config would have to tear down the stage to
// apply it, which is the opposite of what a dial is for -- you drag a
// dial to feel the difference, and you cannot feel a difference across
// a reload.
//
// IT IS NOT THE HOME OF ANY NUMBER. Same discipline as the 2D game's
// `journey-config`: the panel edits values whose permanent home is the
// config module, and `asOverride` below is how a session's dragging
// comes back as something to paste there. A panel that became the home
// would put the game's feel in a browser's local storage.
//
// EVERY DIAL CARRIES ITS OWN SENTENCE. A slider labelled `holdCap` is
// useless on a phone at the moment you are trying to work out why the
// glass will not break. The `does` line is what makes the panel usable
// by someone who did not write the simulation this morning -- which,
// three weeks from now, includes whoever did.

import type { World3DConfig, World3DConfigOverride } from '../world3d-config'

/** Which branch of the config a dial belongs to. */
export type DialGroup = keyof World3DConfig

export interface Dial {
  group: DialGroup
  /** The key inside that branch. */
  key: string
  /** What it is called on screen. Short: it shares a row with a value. */
  label: string
  /** One sentence, in the player's terms rather than the code's. */
  does: string
  min: number
  max: number
  step: number
  /** Appended to the value, e.g. 's' or 'Hz'. Empty for a bare number. */
  unit: string
}

/**
 * The dials, in the order they are worth reaching for.
 *
 * Ranges are not the whole legal domain of each number -- they are the
 * range within which the game is still a game. `riseSeconds` accepts 40
 * and the slider stops at 4, because a slider that spends nine tenths of
 * its travel in unusable territory is a slider you cannot tune with.
 */
export const DIALS: readonly Dial[] = [
  // ---- the resonance verb ------------------------------------------
  {
    group: 'ring',
    key: 'tolSemis',
    label: 'Pitch band',
    does: 'How far off the note you may be and still charge the glass.',
    min: 0.2,
    max: 3,
    step: 0.05,
    unit: ' st',
  },
  {
    group: 'ring',
    key: 'riseSeconds',
    label: 'Hold to cap',
    does: 'Seconds of holding the note to reach what a steady hold can reach.',
    min: 0.3,
    max: 4,
    step: 0.05,
    unit: 's',
  },
  {
    group: 'ring',
    key: 'holdCap',
    label: 'Hold ceiling',
    does: 'How far a steady note gets on its own. The rest is the waver.',
    min: 0.1,
    max: 1,
    step: 0.05,
    unit: '',
  },
  {
    group: 'ring',
    key: 'pumpSeconds',
    label: 'Waver to break',
    does: 'Seconds of full-strength waver from the ceiling to the break.',
    min: 0.2,
    max: 4,
    step: 0.05,
    unit: 's',
  },
  {
    group: 'ring',
    key: 'pumpTolBonus',
    label: 'Band while ringing',
    does: 'Extra pitch band once it is ringing, so the waver does not fall out of tune.',
    min: 0,
    max: 2,
    step: 0.05,
    unit: ' st',
  },
  {
    group: 'ring',
    key: 'fallSeconds',
    label: 'Breath cost',
    does: 'Seconds to decay from full to nothing when you stop. Long is forgiving.',
    min: 0.5,
    max: 10,
    step: 0.1,
    unit: 's',
  },

  // ---- the ear that hears the waver --------------------------------
  {
    group: 'vibrato',
    key: 'minHz',
    label: 'Slowest waver',
    does: 'Below this rate the wobble is not counted at all.',
    min: 1,
    max: 6,
    step: 0.1,
    unit: ' Hz',
  },
  {
    group: 'vibrato',
    key: 'maxHz',
    label: 'Fastest waver',
    does: 'Above this rate it stops counting -- a tremble is not a waver.',
    min: 4,
    max: 14,
    step: 0.1,
    unit: ' Hz',
  },
  {
    group: 'vibrato',
    key: 'minDepthCents',
    label: 'Smallest swing',
    does: 'How wide the wobble has to be before it registers.',
    min: 2,
    max: 60,
    step: 1,
    unit: '¢',
  },
  {
    group: 'vibrato',
    key: 'maxDepthCents',
    label: 'Widest swing',
    does: 'Past this it stops counting. Keep it at (band + ringing band) x 100 or the sim refuses a pump the ear promised.',
    min: 60,
    max: 500,
    step: 5,
    unit: '¢',
  },
  {
    group: 'vibrato',
    key: 'windowSec',
    label: 'Listening window',
    does: 'How much recent singing the waver is measured over.',
    min: 0.3,
    max: 2.5,
    step: 0.05,
    unit: 's',
  },

  // ---- the break ---------------------------------------------------
  {
    group: 'shatter',
    key: 'launchSpeed',
    label: 'Shard speed',
    does: 'How hard the glass is thrown at a perfect break.',
    min: 0.3,
    max: 5,
    step: 0.05,
    unit: ' m/s',
  },
  {
    group: 'shatter',
    key: 'launchLift',
    label: 'Shard lift',
    does: 'Upward push, so shards arc rather than slide.',
    min: 0,
    max: 3,
    step: 0.05,
    unit: ' m/s',
  },
  {
    group: 'shatter',
    key: 'spreadRadians',
    label: 'Spread',
    does: 'Random scatter on each shard. Zero is a neat starburst.',
    min: 0,
    max: 1.5,
    step: 0.05,
    unit: ' rad',
  },
  {
    group: 'shatter',
    key: 'towardViewer',
    label: 'Toward camera',
    does: 'Lean added before each shard is aimed. Zero throws half of it away through Merc.',
    min: 0,
    max: 1.5,
    step: 0.05,
    unit: '',
  },
  {
    group: 'shatter',
    key: 'spinTurnsPerSecond',
    label: 'Spin',
    does: 'Turns a second. Fast enough and a shard reads as a blur, not a shape.',
    min: 0,
    max: 4,
    step: 0.05,
    unit: '/s',
  },
  {
    group: 'shatter',
    key: 'releaseWindowSeconds',
    label: 'Release window',
    does: 'How long the pane takes to come apart. Short is a bang, long is a cascade.',
    min: 0.02,
    max: 1.5,
    step: 0.01,
    unit: 's',
  },
  {
    group: 'shatter',
    key: 'gravity',
    label: 'Shard gravity',
    does: 'Below Earth on purpose -- it is what makes slow glass look like glass.',
    min: 0.5,
    max: 12,
    step: 0.1,
    unit: ' m/s²',
  },
  {
    group: 'shatter',
    key: 'restitution',
    label: 'Bounce',
    does: 'Speed kept after hitting the floor.',
    min: 0,
    max: 0.9,
    step: 0.05,
    unit: '',
  },
  {
    group: 'shatter',
    key: 'settleSeconds',
    label: 'Settle',
    does: 'How long the debris takes to stop moving.',
    min: 0.5,
    max: 10,
    step: 0.1,
    unit: 's',
  },

  // ---- how Merc moves ----------------------------------------------
  {
    group: 'locomotion',
    key: 'walkSpeed',
    label: 'Walk speed',
    does: 'Top speed at a full push on the pad.',
    min: 0.2,
    max: 4,
    step: 0.05,
    unit: ' m/s',
  },
  {
    group: 'locomotion',
    key: 'accelSeconds',
    label: 'Get going',
    does: 'Seconds from a standstill to top speed. Zero reads as sliding, not walking.',
    min: 0.01,
    max: 0.8,
    step: 0.01,
    unit: 's',
  },
  {
    group: 'locomotion',
    key: 'jumpHeight',
    label: 'Jump height',
    does: 'How high the apex reaches. Every ledge is built under this number.',
    min: 0.15,
    max: 1.5,
    step: 0.01,
    unit: ' m',
  },
  {
    group: 'locomotion',
    key: 'gravity',
    label: 'Merc gravity',
    does: 'How heavily he falls. High makes a droplet read as a brick.',
    min: 1,
    max: 20,
    step: 0.1,
    unit: ' m/s²',
  },
  {
    group: 'locomotion',
    key: 'coyoteSeconds',
    label: 'Coyote time',
    does: 'Grace after walking off an edge in which a jump still jumps.',
    min: 0,
    max: 0.4,
    step: 0.01,
    unit: 's',
  },
  {
    group: 'locomotion',
    key: 'bufferSeconds',
    label: 'Jump buffer',
    does: 'How early a jump may be pressed before landing and still fire.',
    min: 0,
    max: 0.4,
    step: 0.01,
    unit: 's',
  },
  {
    group: 'locomotion',
    key: 'maxFallSpeed',
    label: 'Terminal speed',
    does: 'Caps how fast a long fall reads.',
    min: 1,
    max: 20,
    step: 0.5,
    unit: ' m/s',
  },

  // ---- the clock ---------------------------------------------------
  {
    group: 'loop',
    key: 'stepSeconds',
    label: 'Step size',
    does: 'Seconds per simulation step. Smaller is steadier and costs more.',
    min: 1 / 240,
    max: 1 / 30,
    step: 1 / 960,
    unit: 's',
  },
  {
    group: 'loop',
    key: 'maxStepsPerFrame',
    label: 'Catch-up cap',
    does: 'Most steps one frame may run before time is dropped, so a stall cannot spiral.',
    min: 1,
    max: 12,
    step: 1,
    unit: '',
  },
]

/** Human names for the groups, in the order the panel shows them. */
export const GROUP_LABELS: Readonly<Record<DialGroup, string>> = {
  ring: 'The glass answering',
  vibrato: 'Hearing the waver',
  shatter: 'The break',
  locomotion: 'How Merc moves',
  loop: 'The clock',
}

export const GROUP_ORDER: readonly DialGroup[] = [
  'ring',
  'vibrato',
  'shatter',
  'locomotion',
  'loop',
]

/** Read a dial's current value out of a config object. */
export const readDial = (config: World3DConfig, dial: Dial): number => {
  const branch = config[dial.group] as unknown as Record<string, number>
  return branch[dial.key] ?? 0
}

/**
 * Write a dial's value into the live config object.
 *
 * In place, deliberately -- see the header. Clamped to the dial's own
 * range so a number typed into a range input by a keyboard cannot put
 * the simulation somewhere the slider could not reach.
 */
export const writeDial = (
  config: World3DConfig,
  dial: Dial,
  value: number,
): number => {
  const clamped = Math.min(dial.max, Math.max(dial.min, value))
  const branch = config[dial.group] as unknown as Record<string, number>
  branch[dial.key] = clamped
  return clamped
}

/** A deep-enough copy to restore from. The config is two levels of plain
 * data and nothing else, which is the property the panel relies on. */
export const snapshot = (config: World3DConfig): World3DConfig =>
  JSON.parse(JSON.stringify(config)) as World3DConfig

/** Put a snapshot back, in place, so live readers see it. */
export const restore = (config: World3DConfig, from: World3DConfig): void => {
  for (const group of GROUP_ORDER) {
    const target = config[group] as unknown as Record<string, number>
    const source = from[group] as unknown as Record<string, number>
    for (const key of Object.keys(source)) target[key] = source[key]!
  }
}

/**
 * What has actually been changed, as something to paste into the config
 * module.
 *
 * Only the dials that differ from the baseline, because a dump of every
 * number is a dump nobody can read a decision out of. Compared with a
 * tolerance rather than by equality: a range input hands back the string
 * "0.7000000000000001" often enough to matter.
 */
export const asOverride = (
  config: World3DConfig,
  baseline: World3DConfig,
): World3DConfigOverride => {
  const out: Record<string, Record<string, number>> = {}
  for (const dial of DIALS) {
    const now = readDial(config, dial)
    const was = readDial(baseline, dial)
    if (Math.abs(now - was) < 1e-9) continue
    out[dial.group] ??= {}
    out[dial.group]![dial.key] = now
  }
  return out as World3DConfigOverride
}

const KEY = 'beside-cue:games:dev-dials'

/**
 * Remember the dragging across a reload.
 *
 * Worth doing and worth being nervous about, which is why `load` only
 * ever writes through `writeDial`: a stored value for a dial that has
 * since changed its range, or been removed, cannot put the game
 * somewhere the panel could not have.
 */
export const save = (override: World3DConfigOverride): void => {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(override))
  } catch {
    // A private window still tunes; it just forgets.
  }
}

export const load = (config: World3DConfig): void => {
  let raw: string | null
  try {
    raw = window.localStorage.getItem(KEY)
  } catch {
    return
  }
  if (raw === null) return
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return
  }
  if (typeof parsed !== 'object' || parsed === null) return
  const stored = parsed as Record<string, Record<string, unknown>>
  for (const dial of DIALS) {
    const value = stored[dial.group]?.[dial.key]
    if (typeof value !== 'number' || !Number.isFinite(value)) continue
    writeDial(config, dial, value)
  }
}

export const forget = (): void => {
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    // Nothing was stored to begin with.
  }
}

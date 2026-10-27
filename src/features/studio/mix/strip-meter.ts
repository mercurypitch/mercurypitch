// Studio strip meter readings — a lane's level on the master meter's -60 to 0 dBFS travel, its peak hold, and its title.

/** The rail's floor, as on the master meter. */
export const STRIP_FLOOR_DB = -60
/** Gain reduction reaches the bottom of its rail at this many dB. */
export const STRIP_REDUCTION_RANGE_DB = 24
/** A new high stays put this long before it falls. */
export const STRIP_HOLD_MS = 1500
export const STRIP_FALL_DB_PER_SECOND = 20

export const amplitudeDb = (amplitude: number) =>
  amplitude > 0 ? 20 * Math.log10(amplitude) : -Infinity

/** Where a level sits on its rail: 0 at the floor, 100 at 0 dBFS. */
export function stripTravel(db: number): number {
  return Math.max(
    0,
    Math.min(100, ((db - STRIP_FLOOR_DB) / -STRIP_FLOOR_DB) * 100),
  )
}

/** How far down from the top the gain reduction reaches, 0 to 100. */
export function reductionTravel(db: number): number {
  return Math.max(0, Math.min(100, (-db / STRIP_REDUCTION_RANGE_DB) * 100))
}

/** The peak hold: the highest level and when it was reached, in milliseconds. */
export interface StripHold {
  readonly db: number
  readonly since: number
}

/**
 * Where the hold marker sits at `now`: at the high for 1.5 s, then falling
 * 20 dB a second until it drops off the rail at the floor. With reduced
 * motion it does not fall: once the hold is over, the next reading moves it
 * in one step.
 */
export function stripHoldDb(
  hold: StripHold,
  now: number,
  reducedMotion: boolean,
): number {
  const falling = now - hold.since - STRIP_HOLD_MS
  if (falling <= 0) return hold.db
  const db = hold.db - (falling / 1000) * STRIP_FALL_DB_PER_SECOND
  return reducedMotion || db < STRIP_FLOOR_DB ? -Infinity : db
}

/** The hold after a reading of `db` at `now`: a level at or above the marker becomes the new high. */
export function stepStripHold(
  hold: StripHold | null,
  db: number,
  now: number,
  reducedMotion: boolean,
): StripHold {
  if (hold && db < stripHoldDb(hold, now, reducedMotion)) return hold
  return { db, since: now }
}

/** The meter's title: the held peak, and the gain reduction of a lane that compresses. */
export function stripMeterTitle(
  name: string,
  reading: { holdDb: number; reductionDb: number | null } | null,
): string {
  if (!reading) return `${name}: press Play to see its level`
  const { holdDb } = reading
  if (!Number.isFinite(holdDb)) return `${name}: silent`
  // A mute fades by halves for a second: its last traces read as the floor.
  const level =
    holdDb < STRIP_FLOOR_DB ? `under ${STRIP_FLOOR_DB}` : holdDb.toFixed(1)
  const peak = `${name}: peak ${level} dB after the fader`
  return reading.reductionDb === null
    ? peak
    : `${peak}, ${(-reading.reductionDb).toFixed(1)} dB of gain reduction`
}

// ============================================================
// beat — the arithmetic behind Beat Hunt and Drift.
//
// Beat Hunt detunes one tone of a unison pair by the staircase's
// level in cents; what the ear hunts is the beating, whose rate is
// the difference of the two frequencies. Drift keeps a click train
// steady for a few clicks and then lets its tempo gain or lose the
// level in percent — or hold — and asks which.
//
// Pure. Nothing here plays a sound.
// ============================================================

/** The partner of `freq` detuned by `cents`. */
export function detuneHz(freq: number, cents: number): number {
  return freq * 2 ** (cents / 1200)
}

/** Beats per second between a tone and its detuned partner. */
export function beatRateHz(freq: number, cents: number): number {
  return Math.abs(detuneHz(freq, cents) - freq)
}

/** The beat rate said aloud: "5 beats a second", "a beat every 4 s". */
export function beatWord(rateHz: number): string {
  if (rateHz >= 0.95) {
    const rounded =
      rateHz >= 10 ? Math.round(rateHz) : Math.round(rateHz * 10) / 10
    return `${rounded} beat${rounded === 1 ? '' : 's'} a second`
  }
  if (rateHz <= 0) return 'no beating'
  const every = Math.round((1 / rateHz) * 10) / 10
  return `a beat every ${every} s`
}

export type DriftWay = 'steady' | 'faster' | 'slower'

export const DRIFT_WAYS: readonly DriftWay[] = ['steady', 'faster', 'slower']

/** A third each; the steady third is the catch trial. */
export function pickDriftWay(random: () => number = Math.random): DriftWay {
  return DRIFT_WAYS[Math.min(2, Math.floor(random() * 3))]
}

/** Click onsets in ms: `steadyClicks` on the period, then `driftClicks`
 *  on the period the new tempo gives — tempo × (1 ± percent/100). */
export function driftOnsetsMs(
  periodMs: number,
  percent: number,
  way: DriftWay,
  steadyClicks: number,
  driftClicks: number,
): number[] {
  const factor =
    way === 'faster'
      ? 1 + percent / 100
      : way === 'slower'
        ? 1 - percent / 100
        : 1
  const driftPeriod = periodMs / Math.max(0.05, factor)
  const onsets: number[] = []
  for (let k = 0; k < steadyClicks; k++) onsets.push(k * periodMs)
  let t = (steadyClicks - 1) * periodMs
  for (let k = 0; k < driftClicks; k++) {
    t += driftPeriod
    onsets.push(t)
  }
  return onsets
}

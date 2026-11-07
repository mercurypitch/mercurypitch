// ============================================================
// AirPlay readout: where the app takes the sound to go, for a tester
// ============================================================
//
// Three rows above the AirPlay sound check's buttons, read off the phone in
// Test 13 (docs/plans/tv-device-tests.md): the guess as it stands now
// (airplay-suspicion.ts), the last output check with its rate, when it ran,
// why and whether inside a gesture (output-check.ts), and what may play
// beside the room's sound. The route's kind, never a port's name: a tester
// copies these rows off the phone. Pure, so the words are tested without
// a phone; AirPlayCheckPanel.tsx reads the stores and draws them.

import type { AirPlayFacts } from '@/stores/airplay-suspicion'
import { suspectsAirPlay } from '@/stores/airplay-suspicion'
import type { OutputCheck } from '@/stores/output-check'
import { OUTPUT_CHECK_MOMENTS } from '@/stores/output-check'

export interface AirPlayReadoutRow {
  readonly label: string
  readonly value: string
}

const hz = (rate: number | null): string =>
  rate === null ? 'an unknown rate' : `${String(Math.round(rate))} Hz`

const two = (n: number): string => String(n).padStart(2, '0')

/** The phone's own clock at `at`: 21:31:05. */
function clockAt(at: number): string {
  const date = new Date(at)
  return `${two(date.getHours())}:${two(date.getMinutes())}:${two(date.getSeconds())}`
}

/** The guess now: AirPlay alone or not, and what says so. */
export function guessWords(facts: AirPlayFacts): string {
  if (facts.screen) return 'Not AirPlay alone: a screen is connected'
  if (facts.route === 'airplay') return 'AirPlay alone: the route says airplay'
  const session =
    facts.route === null
      ? "the phone's session not read"
      : `the phone's session at ${hz(facts.sessionRate)} on ${facts.route}`
  const rates = `the page at ${hz(facts.pageRate)}, ${session}`
  return suspectsAirPlay(facts)
    ? `AirPlay alone, likely: ${rates}`
    : `Not AirPlay alone: ${rates}`
}

const VERDICTS: Readonly<Record<OutputCheck['verdict'], string>> = {
  airplay: 'AirPlay alone',
  local: 'local',
  unknown: 'unknown',
}

/** The last check: its rate, when, why, whether in a gesture, and its word. */
export function lastCheckWords(check: OutputCheck | null): string {
  if (check === null) return 'None yet'
  const what =
    check.rate === null
      ? `No fresh context (${check.failure ?? 'none made'})`
      : hz(check.rate)
  const gesture = check.gesture ? 'in a gesture' : 'outside a gesture'
  return `${what} at ${clockAt(check.at)}, on ${OUTPUT_CHECK_MOMENTS[check.why]}, ${gesture}: ${VERDICTS[check.verdict]}`
}

/** What may play beside the room's Web Audio (output-check.ts, webAudioAlone). */
export function besideWords(webAudioAlone: boolean): string {
  return webAudioAlone
    ? "Nothing: the lock screen's carrier and the unlock clip stand aside"
    : "The lock screen's carrier and the unlock clip, where a start's check says the sound stays here"
}

/** The three rows, in order. */
export function airPlayReadout(now: {
  readonly facts: AirPlayFacts
  readonly check: OutputCheck | null
  readonly alone: boolean
}): readonly AirPlayReadoutRow[] {
  return [
    { label: 'The guess', value: guessWords(now.facts) },
    { label: 'Last check', value: lastCheckWords(now.check) },
    { label: 'Beside the sound', value: besideWords(now.alone) },
  ]
}

// ============================================================
// The dev fixtures' stop of the Warm-up
// ============================================================
//
// A room's dev fixture (`?lipFixture=intro` and the others) draws the room
// in warm-up mode when the page also says `&warmUp=<n>`: the room as stop n
// of four (routine-stop.ts). Nothing listens to the stop: what the room
// hands it goes nowhere, and the fixture keeps its pinned frame.
//
// Dev server only: only the fixtures import it, and the native entry
// imports them behind `import.meta.env.DEV`.

import type { RoutineStop } from './routine-stop'

/** The fixtures' Warm-up: four stops, as the owner's routine has. */
export const FIXTURE_STOPS = 4

/**
 * The stop `?warmUp=<n>` names (from 1); undefined without the parameter.
 * A number outside the routine is its first stop.
 */
export function fixtureStop(
  search: string = window.location.search,
): RoutineStop | undefined {
  const value = new URLSearchParams(search).get('warmUp')
  if (value === null) return undefined
  const n = Number.parseInt(value, 10)
  const inRange = Number.isInteger(n) && n >= 1 && n <= FIXTURE_STOPS
  return {
    index: inRange ? n - 1 : 0,
    count: FIXTURE_STOPS,
    settledNote: null,
    finish: () => undefined,
    skip: () => undefined,
  }
}

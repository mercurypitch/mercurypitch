// ============================================================
// Where a progress surface gets its runs
// ============================================================
//
// Two stores hold the same idea and disagree about everything else.
//
//   - `sessionResults` is device-local, capped at 50, written only by
//     `endPracticeSession`, and therefore only ever holds practice runs.
//   - `sessionRecords` is the account's, in the cloud, and holds all four
//     kinds — including the exercises and challenges that make up most of
//     what people actually do.
//
// Every progress surface used to read the first one, which is how somebody
// with forty recorded runs was shown "0 sessions": their work was in the
// store nothing looked at, on a domain whose localStorage they had never
// practised on.
//
// So: the account's history when there is an account, the device's when
// there is not. Signed out is not a degraded case — it is somebody who has
// no cloud history to read, and their local runs are the true answer.

import { hasValidToken } from '@/db/services/auth-service'
import { loadSessionRecords } from '@/db/services/session-service'
import type { ProgressRun } from './run-kinds'
import { isProgressRun, runFromLocalResult, runFromRecord } from './run-kinds'

/**
 * How far back a progress surface looks.
 *
 * The local store caps itself at 50; the cloud does not, so this is the cap
 * for both. Large enough that a regular singer's card stops moving only
 * after months, small enough that the read stays one small response.
 */
export const PROGRESS_RUN_LIMIT = 200

export interface ProgressRunSource {
  runs: readonly ProgressRun[]
  /**
   * Which store answered.
   *
   * Surfaces say so out loud — "on this device" is a materially different
   * claim from "on your account", and showing a number without saying which
   * one it is was the whole problem.
   */
  scope: 'account' | 'device'
}

const EMPTY: ProgressRunSource = { runs: [], scope: 'device' }

/**
 * Load runs for whoever is here now.
 *
 * Takes its two dependencies as parameters so the decision can be tested
 * without a database or a token: the wiring is the part that was wrong, and
 * untestable wiring is how it stayed wrong.
 */
export async function loadProgressRuns(
  deps: {
    signedIn?: () => boolean
    loadRecords?: typeof loadSessionRecords
    localHistory?: () => readonly unknown[]
  } = {},
): Promise<ProgressRunSource> {
  const signedIn = deps.signedIn ?? hasValidToken
  if (signedIn()) {
    const loadRecords = deps.loadRecords ?? loadSessionRecords
    const records = await loadRecords(PROGRESS_RUN_LIMIT)
    // An account with no rows yet still answers "account": the number is a
    // true zero rather than a store that was not consulted.
    return {
      runs: records.map(runFromRecord).filter(isProgressRun),
      scope: 'account',
    }
  }

  const local = deps.localHistory?.() ?? []
  return {
    runs: local
      .map((entry) => runFromLocalResult(entry as never))
      .filter(isProgressRun),
    scope: 'device',
  }
}

export { EMPTY as NO_PROGRESS_RUNS }

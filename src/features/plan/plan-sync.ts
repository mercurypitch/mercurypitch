// ============================================================
// Plan sync — the plan's answers reach the account once there is one
// ============================================================
//
// What a person answered stays on the device until they hold a real account:
// a password, Google or Apple account, which `hasUpgradedAccount()` tells from
// the anonymous identity that a first write mints and that holds a valid token
// too. Then the answers and the two lines they typed go to the account as one
// row of `userSurveyResponses`, and the record is marked as sent. The record
// syncs with the settings, so the mark travels with it: a second device that
// has pulled it sees the mark and sends nothing, which is "once per person,
// not once per device".
//
// Seven things are easy to break:
//
// - Nothing leaves without a real account. The typed lines are free text, and
//   the rule is that they reach the server only for someone who holds one, and
//   never reach the funnel or GA4. The check comes first, before the record
//   or the lines are read (and submitPlanResponse asks again at the write).
// - Only an answered plan is sent. A plan turned down with Not now is never
//   marked as sent (markPlanSynced leaves it alone), so sending it would
//   repeat at every sign-in and every load.
// - The mark belongs to the plan that was sent. It is written through
//   markPlanSynced with the date that plan carried, so a plan answered again
//   while the first was on its way is not marked as sent, and is sent next.
// - A send already on its way is joined, not repeated. A sign-in changes the
//   auth token more than once, and each change asks for a sync.
// - The record is read after the settings pull, not before it. A second
//   device holds its own copy, unmarked, until the pull applies the account's
//   marked one, and a sync that read first would send the plan again. The wait
//   is bounded (settings-pull-wait.ts, the same one the takeover makes), and
//   past the cap, or for a pull that ended without the account's settings, the
//   record is read as it stands.
// - A line goes only while the plan's own picks keep its option. The record
//   syncs and the lines do not, so a record pulled from another device can
//   pick differently from the lines this one holds; pickedLines is the one
//   rule, applied here as the store applies it when it saves.
// - It never throws and never rejects. The plan's screens and App's effect
//   call it and look at nothing it returns, so whatever goes wrong (a check
//   that throws, a writer that throws or rejects, a mark that cannot be
//   written) is a 'failed' that says so on the console, with nothing marked.
//
// A failed send changes nothing: no mark, and the lines stay on the device.
// The next sign-in, load or finished plan tries again.
//
// A send is at least once, not exactly once: a reply lost after the row landed,
// or two devices that both send before either mark has synced, leave a second
// row for the same plan. submitPlanResponse says how a reader counts them.

import { hasUpgradedAccount } from '@/db/services/auth-service'
import { settingsPulled } from '@/db/services/settings-service'
import type { PlanResponseV1 } from '@/db/services/survey-service'
import { submitPlanResponse } from '@/db/services/survey-service'
import type { PlanRecordV1 } from './plan-record'
import { pickedLines, readPlanTexts } from './plan-record'
import { markPlanSynced, planRecord } from './plan-store'
import { awaitSettingsPull } from './settings-pull-wait'

/**
 * What a sync did: sent the plan, had nothing to send or no one to send it
 * for, or went wrong and marked nothing.
 */
export type PlanSyncResult = 'synced' | 'skipped' | 'failed'

export interface PlanSyncDeps {
  /** Does this browser hold a real account? hasUpgradedAccount when not given. */
  upgraded?: () => boolean
  /** Writes the response to the account, rejecting when it cannot. submitPlanResponse when not given. */
  submit?: (response: PlanResponseV1) => Promise<void>
  /** Resolves when the settings pull has landed, rejecting when it ended without the account's settings. settingsPulled when not given. */
  settingsPulled?: () => Promise<void>
}

/** An answered plan, which is the only kind that is sent. */
type AnsweredPlan = PlanRecordV1 & { status: 'answered' }

/** Is this an answered plan the account has not been given? */
function isUnsent(record: PlanRecordV1 | null): record is AnsweredPlan {
  return (
    record !== null &&
    record.status === 'answered' &&
    record.syncedAt === undefined
  )
}

/**
 * The response for a plan: its ids, the two lines its picks keep and the date
 * it was written, and nothing else the record holds (not how it was first
 * shown, not what the voiceprint found, not the synced date). Each field is
 * named here, so one added to the record is not sent until someone chooses it.
 * The declared return type holds the names to the service's own description
 * against a field removed or retyped; a field added to the plan's choices or
 * texts compiles and is not sent, so plan-sync.test.ts compares their keys
 * and fails until someone decides. The arrays are copied: the writer reads the
 * response after an await, and it must not change under it.
 */
function responseFor(plan: AnsweredPlan): PlanResponseV1 {
  const { choices } = plan
  const { q3other, q4app } = pickedLines(choices, readPlanTexts())
  return {
    kind: 'plan',
    v: 1,
    status: plan.status,
    choices: {
      q1: choices.q1,
      q2: choices.q2,
      q3: [...choices.q3],
      q4: [...choices.q4],
    },
    texts: { q3other, q4app },
    at: plan.at,
  }
}

/** The sends on their way, by the date of the plan each carries. */
const sending = new Map<string, Promise<PlanSyncResult>>()

/**
 * Writes the plan's response and, once it has arrived, marks that plan as
 * sent. Anything that goes wrong marks nothing, and the plan goes again (a
 * mark that cannot be written lands in the same catch as a refused write).
 */
async function send(
  plan: AnsweredPlan,
  submit: (response: PlanResponseV1) => Promise<void>,
): Promise<PlanSyncResult> {
  try {
    await submit(responseFor(plan))
    markPlanSynced(plan.at)
  } catch (err) {
    console.warn('[plan-sync] Could not send the plan:', err)
    return 'failed'
  }
  return 'synced'
}

/**
 * Sends the plan to the account when there is a real one and the plan is
 * answered and not yet sent, and marks it as sent when it arrives. 'skipped'
 * says there was nothing to send, or no one to send it for; 'failed' says
 * something went wrong, with nothing marked. It never rejects.
 */
export async function syncPlanToAccount(
  deps: PlanSyncDeps = {},
): Promise<PlanSyncResult> {
  try {
    const upgraded = deps.upgraded ?? hasUpgradedAccount
    if (!upgraded()) return 'skipped'
    // The account may hold this plan already, marked as sent, and only the
    // pull brings that mark to this device: read the record after it.
    await awaitSettingsPull(deps.settingsPulled ?? settingsPulled)
    // Read after the await, so no effect that asked for a sync can track it.
    const plan = planRecord()
    if (!isUnsent(plan)) return 'skipped'
    const underway = sending.get(plan.at)
    if (underway !== undefined) return await underway
    const attempt = send(plan, deps.submit ?? submitPlanResponse).finally(
      () => {
        sending.delete(plan.at)
      },
    )
    sending.set(plan.at, attempt)
    return await attempt
  } catch (err) {
    console.warn('[plan-sync] Could not check the account or the plan:', err)
    return 'failed'
  }
}

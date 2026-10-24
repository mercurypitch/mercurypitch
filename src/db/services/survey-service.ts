// ============================================================
// Survey Service — Onboarding survey storage
// ============================================================
//
// One table, `userSurveyResponses`, holds two kinds of row: the feedback
// survey's answers (`{ kind: 'gh97-v2', gotInTheWay }` today, and
// `{ background, usage, featureRequest }` on the rows of the older survey)
// and, once there is a real account, the plan's (`kind: 'plan'`, see
// PlanResponseV1).
//
// Four things are easy to break:
//
// - hasSubmittedSurvey counts the survey and not the plan. A plan row that
//   counted would answer "yes" for a singer who never saw the survey and
//   silence it for good, and it reads every row, not the first, because a
//   plan row can sit in front of the survey. The survey's own row carries a
//   `kind` now, so the plan's is told by `kind === 'plan'` and not by having
//   one: a reader keyed on "has a kind" would stop counting the survey's row
//   and ask a singer who has answered it again.
// - A row's answers come back as an object from the account, because the
//   worker parses the JSON columns it knows (fromSql in
//   workers/db-worker/src/tables.ts), and as the text it was given from the
//   local store. The entity's type says text. Both are read, and the account's
//   is the one that matters: a reader of text alone passes against the local
//   store and counts every plan row as the survey for a real singer.
// - A write that fails has to be heard. The survey modal keeps itself open on
//   a null, and the plan's sync would otherwise mark a plan sent that never
//   arrived. A repository promise that is returned without being awaited
//   escapes the try around it, so submitSurvey awaits the write inside it.
// - The plan's row is written only for a real account. The typed lines are
//   free text, and a write signed out would mint an anonymous identity to put
//   them under (the hybrid adapter provisions one on a first write), so the
//   service asks for itself and does not rely on its caller having asked.

import { getDb } from '@/db'
import type { UserSurveyResponse } from '@/db/entities'
import { getUserId } from '@/db/seed'
import { hasUpgradedAccount } from '@/db/services/auth-service'

/**
 * What the survey saves. The modal sends `kind: 'gh97-v2'` and `gotInTheWay`,
 * the one question it asks now. The three fields of the older survey stay, so
 * the rows it wrote still read.
 */
export interface SurveyAnswers {
  kind?: 'gh97-v2'
  /** What the singer was trying to do the last time the app got in their way. */
  gotInTheWay?: string
  background?: string[]
  usage?: string[]
  featureRequest?: string
}

/**
 * What the plan sends to the account: the four answers as ids, the two lines
 * the person typed and the date the plan was written. The fields are written
 * out here, in the plan's own names, and not imported, because src/db imports
 * nothing from src/features. plan-sync.ts builds this from the plan's record:
 * its return type holds the two descriptions together against a field removed
 * or retyped on either side, and a test in plan-sync.test.ts fails when the
 * plan gains a field that this lacks, so that someone decides whether it goes
 * up.
 */
export interface PlanResponseV1 {
  kind: 'plan'
  v: 1
  /** Only 'answered' is written today: a plan turned down is not sent, so the table holds no decline rows. */
  status: 'answered' | 'declined'
  choices: {
    q1: string | null
    q2: string | null
    q3: string[]
    q4: string[]
  }
  texts: { q3other: string; q4app: string }
  at: string
}

/**
 * What a row's answers say: the object the account hands back, or the parsed
 * text the local store hands back. Text that is not JSON has no answers.
 */
function answersOf(row: UserSurveyResponse): unknown {
  const stored: unknown = row.answersJson
  if (typeof stored !== 'string') return stored
  try {
    return JSON.parse(stored)
  } catch {
    return null
  }
}

/** Is this row the plan's, and not the survey's? */
function isPlanRow(row: UserSurveyResponse): boolean {
  const answers = answersOf(row)
  return (
    typeof answers === 'object' &&
    answers !== null &&
    'kind' in answers &&
    answers.kind === 'plan'
  )
}

/** Writes one row of the current user's. Rejects when the write fails. */
async function createRow(answers: object): Promise<UserSurveyResponse> {
  const db = await getDb()
  const repo = db.getRepository<UserSurveyResponse>('userSurveyResponses')
  return repo.create({
    userId: getUserId(),
    answersJson: JSON.stringify(answers),
    submittedAt: new Date().toISOString(),
  })
}

/** Check if the current user has already submitted the survey. The plan's rows do not count. */
export async function hasSubmittedSurvey(): Promise<boolean> {
  try {
    const db = await getDb()
    const repo = db.getRepository<UserSurveyResponse>('userSurveyResponses')
    const rows = await repo.findAll({ where: { userId: getUserId() } })
    return rows.some((row) => !isPlanRow(row))
  } catch {
    return false
  }
}

/** Save survey answers for the current user. Null when the write fails. */
export async function submitSurvey(
  answers: SurveyAnswers,
): Promise<UserSurveyResponse | null> {
  try {
    return await createRow(answers)
  } catch {
    return null
  }
}

/**
 * Save the plan's response for the current user, as one row. Rejects when
 * the write fails, so the caller knows to try again, and without a real
 * account, so that no caller can upload the typed lines under an identity a
 * write would mint.
 *
 * Delivery is at least once: a reply lost after the row landed, or a second
 * device that sends before the settings pull has applied the marked record,
 * leaves a second row for the same plan. A reader takes one row per singer
 * and `at`; on a tie, the row that carries typed lines. Every Done saves a
 * new `at`, so the latest `at` is the singer's current plan.
 */
export async function submitPlanResponse(r: PlanResponseV1): Promise<void> {
  if (!hasUpgradedAccount()) {
    throw new Error('The plan is sent only for a real account')
  }
  await createRow(r)
}

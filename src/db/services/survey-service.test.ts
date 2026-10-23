// ============================================================
// Survey service — one table, two kinds of row
// ============================================================
//
// `userSurveyResponses` holds the feedback survey's answers and, once there is
// a real account, the plan's (kind: 'plan'). hasSubmittedSurvey asks the
// table "has this singer filled in the survey?", and a plan row must not
// answer yes: the survey would be silenced for good by a row that is not it.
// Every row has to be read for that, because a plan row can sit in front of
// the survey. The same row reads back as the text it was given from the local
// store and as an object from the account (the worker parses the JSON columns
// it knows), and both have to be read.
//
// The plan's row is written only for a real account: the typed lines are free
// text, and a write signed out would mint an anonymous identity to put them
// under. The check is the account check's own and is stubbed here.
//
// The store is the real one: a DexieAdapter over the test setup's in-memory
// IndexedDB, with only `getDb` pointed at it. Rows that the cases need in a
// given order are put with chosen ids, because the store lists a singer's rows
// by id.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DexieAdapter } from '@/db/adapters/dexie-adapter'
import type { UserSurveyResponse } from '@/db/entities'
import type { PlanResponseV1, SurveyAnswers, } from '@/db/services/survey-service'

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  currentUser: { id: 'singer-1' },
  upgraded: true,
}))

vi.mock('@/db', () => ({ getDb: mocks.getDb }))
vi.mock('@/db/seed', () => ({ getUserId: () => mocks.currentUser.id }))
vi.mock('@/db/services/auth-service', () => ({
  hasUpgradedAccount: () => mocks.upgraded,
}))

import { hasSubmittedSurvey, submitPlanResponse, submitSurvey, } from '@/db/services/survey-service'

const PLAN: PlanResponseV1 = {
  kind: 'plan',
  v: 1,
  status: 'answered',
  choices: {
    q1: 'singing',
    q2: 'audition',
    q3: ['progress', 'other'],
    q4: ['app'],
  },
  texts: {
    q3other: 'my neighbours can hear everything',
    q4app: 'Duolingo for guitar',
  },
  at: '2026-10-20T12:00:00.000Z',
}

const SURVEY = { background: ['singer'], usage: ['practice'] }

/** What the survey's modal saves today. */
const ONE_QUESTION: SurveyAnswers = {
  kind: 'gh97-v2',
  gotInTheWay: 'load my own song',
}

let db: DexieAdapter

function rows() {
  return db.getRepository<UserSurveyResponse>('userSurveyResponses')
}

/**
 * Puts a row as the store would hold it, under an id that fixes where it
 * lists. `answers` is stored as given: text from this device, or an object, as
 * the account hands a JSON column back.
 */
async function put(
  id: string,
  answers: unknown,
  userId = mocks.currentUser.id,
): Promise<void> {
  const now = '2026-10-20T12:00:00.000Z'
  await db.putStrict<UserSurveyResponse>('userSurveyResponses', {
    id,
    userId,
    answersJson: answers as string,
    submittedAt: now,
    createdAt: now,
    updatedAt: now,
  })
}

beforeEach(() => {
  db = new DexieAdapter()
  mocks.getDb.mockResolvedValue(db)
  mocks.currentUser.id = 'singer-1'
  mocks.upgraded = true
})

afterEach(async () => {
  vi.restoreAllMocks()
  await db.destroy()
})

describe('has this singer filled in the survey', () => {
  it('is no when they have no rows', async () => {
    expect(await hasSubmittedSurvey()).toBe(false)
  })

  it.each([
    ['text', JSON.stringify(SURVEY)],
    ['an object', SURVEY],
  ])('counts a survey row, read as %s', async (_, survey) => {
    await put('a', survey)

    expect(await hasSubmittedSurvey()).toBe(true)
  })

  // The one-question survey's row carries a `kind` too. A reader that told the
  // plan's row by "has a kind" would stop counting this one and ask a singer
  // who has answered again, so this pins that only `kind: 'plan'` is the plan's.
  it.each([
    ['text', JSON.stringify(ONE_QUESTION)],
    ['an object', ONE_QUESTION],
  ])('counts the one-question survey row, read as %s', async (_, survey) => {
    await put('a', survey)

    expect(await hasSubmittedSurvey()).toBe(true)
  })

  it('does not count a plan row as the survey', async () => {
    await put('a', JSON.stringify(PLAN))

    expect(await hasSubmittedSurvey()).toBe(false)
  })

  it('does not count a plan row that comes back as an object either', async () => {
    await put('a', PLAN)

    expect(await hasSubmittedSurvey()).toBe(false)
  })

  it('finds the survey behind a plan row', async () => {
    // The store lists by id: the plan row comes first. A read of one row
    // would stop at it and call the survey unanswered.
    await put('a-plan', JSON.stringify(PLAN))
    await put('b-survey', JSON.stringify(SURVEY))

    expect(await hasSubmittedSurvey()).toBe(true)
  })

  it('finds the survey in front of a plan row', async () => {
    await put('a-survey', JSON.stringify(SURVEY))
    await put('b-plan', JSON.stringify(PLAN))

    expect(await hasSubmittedSurvey()).toBe(true)
  })

  it('counts only this singer rows', async () => {
    await put('a', JSON.stringify(SURVEY), 'singer-2')
    await put('b', JSON.stringify(PLAN))

    expect(await hasSubmittedSurvey()).toBe(false)
  })

  it('counts a row whose answers cannot be read, as it did before plan rows', async () => {
    await put('a', 'not json')

    expect(await hasSubmittedSurvey()).toBe(true)
  })

  it('is no when the rows cannot be read', async () => {
    vi.spyOn(rows(), 'findAll').mockRejectedValue(new Error('storage closed'))

    expect(await hasSubmittedSurvey()).toBe(false)
  })
})

describe('saving the survey', () => {
  it('saves the answers as one row of this singer and returns it', async () => {
    const saved = await submitSurvey(SURVEY)

    expect(saved).toMatchObject({
      userId: 'singer-1',
      answersJson: JSON.stringify(SURVEY),
    })
    expect(await rows().findAll()).toHaveLength(1)
  })

  it('returns null when the survey write fails', async () => {
    vi.spyOn(rows(), 'create').mockRejectedValue(new Error('disk full'))

    expect(await submitSurvey(SURVEY)).toBeNull()
    expect(await rows().findAll()).toEqual([])
  })
})

describe('saving the plan', () => {
  it('writes the whole response as one row of this singer', async () => {
    await submitPlanResponse(PLAN)

    const [row, ...others] = await rows().findAll()
    expect(others).toEqual([])
    expect(row.userId).toBe('singer-1')
    expect(row.answersJson).toBe(JSON.stringify(PLAN))
    expect(Number.isNaN(Date.parse(row.submittedAt))).toBe(false)
  })

  it('rejects when the write fails, so the caller can try again', async () => {
    vi.spyOn(rows(), 'create').mockRejectedValue(new Error('disk full'))

    await expect(submitPlanResponse(PLAN)).rejects.toThrow('disk full')
  })

  it('leaves the survey unanswered', async () => {
    await submitPlanResponse(PLAN)

    expect(await hasSubmittedSurvey()).toBe(false)
  })

  it('rejects without a real account, and does not so much as try the write', async () => {
    mocks.upgraded = false
    const create = vi.spyOn(rows(), 'create')

    await expect(submitPlanResponse(PLAN)).rejects.toThrow('real account')

    expect(create).not.toHaveBeenCalled()
    expect(await rows().findAll()).toEqual([])
  })
})

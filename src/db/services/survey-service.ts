// ============================================================
// Survey Service — Onboarding survey storage
// ============================================================

import { getDb } from '@/db'
import type { UserSurveyResponse } from '@/db/entities'
import { getUserId } from '@/db/seed'

export interface SurveyAnswers {
  background?: string[]
  usage?: string[]
  featureRequest?: string
}

/** Check if the current user has already submitted the survey. */
export async function hasSubmittedSurvey(): Promise<boolean> {
  try {
    const db = await getDb()
    const repo = db.getRepository<UserSurveyResponse>('userSurveyResponses')
    const existing = await repo.findAll({
      where: { userId: getUserId() },
      limit: 1,
    })
    return existing.length > 0
  } catch {
    return false
  }
}

/** Save survey answers for the current user. */
export async function submitSurvey(
  answers: SurveyAnswers,
): Promise<UserSurveyResponse | null> {
  try {
    const db = await getDb()
    const repo = db.getRepository<UserSurveyResponse>('userSurveyResponses')
    return repo.create({
      userId: getUserId(),
      answersJson: JSON.stringify(answers),
      submittedAt: new Date().toISOString(),
    })
  } catch {
    return null
  }
}

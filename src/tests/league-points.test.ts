// ============================================================
// League points — pure-calculator tests
// ============================================================
// Imports the dependency-free worker module directly (no D1/auth), so the
// per-action scoring model is covered by the main suite.

import { describe, expect, it } from 'vitest'
import type { LeaguePointsConfig } from '../../workers/db-worker/src/league-points'
import { DEFAULT_LEAGUE_POINTS_CONFIG, goalMetBonus, pointsForAction, streakMilestoneBonus, } from '../../workers/db-worker/src/league-points'

describe('DEFAULT_LEAGUE_POINTS_CONFIG', () => {
  it('matches the leaguePointsConfig seed defaults', () => {
    expect(DEFAULT_LEAGUE_POINTS_CONFIG).toEqual({
      exerciseBase: 10,
      challengeBase: 15,
      weeklyBase: 20,
      scoreDivisor: 10,
      dailyVarietyBonus: 5,
      goalMetBonus: 25,
      streakMilestoneBonus: 50,
      milestoneEvery: 7,
      dailyScoredSessionCap: 30,
    })
  })
})

describe('pointsForAction — by source', () => {
  it('practice is never ranked (always 0, even with score / variety)', () => {
    expect(pointsForAction({ source: 'practice', score: 100 })).toBe(0)
    expect(
      pointsForAction({
        source: 'practice',
        score: 100,
        firstOfDayForExercise: true,
      }),
    ).toBe(0)
  })

  it('exercise = base(10) + score bonus', () => {
    expect(pointsForAction({ source: 'exercise', score: 0 })).toBe(10)
    expect(pointsForAction({ source: 'exercise', score: 100 })).toBe(20)
  })

  it('challenge = base(15) + score bonus', () => {
    expect(pointsForAction({ source: 'challenge', score: 0 })).toBe(15)
    expect(pointsForAction({ source: 'challenge', score: 100 })).toBe(25)
    expect(pointsForAction({ source: 'challenge', score: 50 })).toBe(20)
  })

  it('weekly = base(20) + score bonus', () => {
    expect(pointsForAction({ source: 'weekly', score: 0 })).toBe(20)
    expect(pointsForAction({ source: 'weekly', score: 100 })).toBe(30)
  })

  it('weights harder actions above easier ones at equal score', () => {
    const practice = pointsForAction({ source: 'practice', score: 100 })
    const exercise = pointsForAction({ source: 'exercise', score: 100 })
    const challenge = pointsForAction({ source: 'challenge', score: 100 })
    const weekly = pointsForAction({ source: 'weekly', score: 100 })
    expect(practice).toBeLessThan(exercise)
    expect(exercise).toBeLessThan(challenge)
    expect(challenge).toBeLessThan(weekly)
  })
})

describe('pointsForAction — score scaling and clamping', () => {
  it('adds round(score / 10) as the quality bonus (0..10)', () => {
    // exercise base is 10, so points - 10 is the isolated score bonus.
    expect(pointsForAction({ source: 'exercise', score: 40 }) - 10).toBe(4)
    expect(pointsForAction({ source: 'exercise', score: 44 }) - 10).toBe(4)
    // Math.round is half-up: 9.5 -> 10, 0.5 -> 1.
    expect(pointsForAction({ source: 'exercise', score: 95 }) - 10).toBe(10)
    expect(pointsForAction({ source: 'exercise', score: 94 }) - 10).toBe(9)
    expect(pointsForAction({ source: 'exercise', score: 5 }) - 10).toBe(1)
    expect(pointsForAction({ source: 'exercise', score: 4 }) - 10).toBe(0)
  })

  it('clamps score into 0..100 before scaling', () => {
    expect(pointsForAction({ source: 'exercise', score: 150 })).toBe(20) // clamp 100
    expect(pointsForAction({ source: 'exercise', score: -25 })).toBe(10) // clamp 0
  })

  it('treats a non-finite score as 0', () => {
    expect(pointsForAction({ source: 'exercise', score: Number.NaN })).toBe(10)
    expect(
      pointsForAction({ source: 'exercise', score: Number.POSITIVE_INFINITY }),
    ).toBe(10)
  })
})

describe('pointsForAction — daily variety bonus', () => {
  it('adds +5 on the first exercise completion of the day', () => {
    expect(
      pointsForAction({
        source: 'exercise',
        score: 0,
        firstOfDayForExercise: true,
      }),
    ).toBe(15)
    expect(
      pointsForAction({
        source: 'exercise',
        score: 100,
        firstOfDayForExercise: true,
      }),
    ).toBe(25)
  })

  it('does not add the variety bonus on later completions that day', () => {
    expect(
      pointsForAction({
        source: 'exercise',
        score: 0,
        firstOfDayForExercise: false,
      }),
    ).toBe(10)
  })

  it('ignores the variety flag for non-exercise sources', () => {
    expect(
      pointsForAction({
        source: 'challenge',
        score: 0,
        firstOfDayForExercise: true,
      }),
    ).toBe(15)
    expect(
      pointsForAction({
        source: 'weekly',
        score: 0,
        firstOfDayForExercise: true,
      }),
    ).toBe(20)
  })
})

describe('pointsForAction — custom config', () => {
  const cfg: LeaguePointsConfig = {
    ...DEFAULT_LEAGUE_POINTS_CONFIG,
    exerciseBase: 3,
    scoreDivisor: 20,
    dailyVarietyBonus: 1,
  }

  it('honours overridden weights and divisor', () => {
    // base 3 + round(100/20)=5 = 8
    expect(pointsForAction({ source: 'exercise', score: 100 }, cfg)).toBe(8)
    // + variety 1 = 9
    expect(
      pointsForAction(
        { source: 'exercise', score: 100, firstOfDayForExercise: true },
        cfg,
      ),
    ).toBe(9)
  })

  it('gives no score bonus when the divisor is non-positive', () => {
    const bad: LeaguePointsConfig = {
      ...DEFAULT_LEAGUE_POINTS_CONFIG,
      scoreDivisor: 0,
    }
    expect(pointsForAction({ source: 'exercise', score: 100 }, bad)).toBe(10)
  })
})

describe('goalMetBonus', () => {
  it('is the daily-goal weight (+25 by default)', () => {
    expect(goalMetBonus()).toBe(25)
  })

  it('honours a custom config', () => {
    expect(
      goalMetBonus({ ...DEFAULT_LEAGUE_POINTS_CONFIG, goalMetBonus: 40 }),
    ).toBe(40)
  })

  it('is the dominant consistency lever (out-earns a top single action)', () => {
    // One goal-met day beats one perfect weekly attempt — streaks drive the ladder.
    expect(goalMetBonus()).toBeGreaterThan(
      pointsForAction({ source: 'weekly', score: 100 }) -
        DEFAULT_LEAGUE_POINTS_CONFIG.weeklyBase,
    )
  })
})

describe('streakMilestoneBonus', () => {
  it('awards the bonus only every 7th streak day', () => {
    expect(streakMilestoneBonus(7)).toBe(50)
    expect(streakMilestoneBonus(14)).toBe(50)
    expect(streakMilestoneBonus(49)).toBe(50)
  })

  it('is 0 on non-milestone days', () => {
    expect(streakMilestoneBonus(1)).toBe(0)
    expect(streakMilestoneBonus(6)).toBe(0)
    expect(streakMilestoneBonus(8)).toBe(0)
    expect(streakMilestoneBonus(13)).toBe(0)
  })

  it('is 0 for a zero or negative streak', () => {
    expect(streakMilestoneBonus(0)).toBe(0)
    expect(streakMilestoneBonus(-7)).toBe(0)
  })

  it('floors a fractional streak before testing the milestone', () => {
    expect(streakMilestoneBonus(7.9)).toBe(50)
    expect(streakMilestoneBonus(13.9)).toBe(0)
  })

  it('honours a custom milestone period', () => {
    const cfg: LeaguePointsConfig = {
      ...DEFAULT_LEAGUE_POINTS_CONFIG,
      milestoneEvery: 5,
    }
    expect(streakMilestoneBonus(5, cfg)).toBe(50)
    expect(streakMilestoneBonus(10, cfg)).toBe(50)
    expect(streakMilestoneBonus(7, cfg)).toBe(0)
  })

  it('disables milestones when the period is non-positive', () => {
    const cfg: LeaguePointsConfig = {
      ...DEFAULT_LEAGUE_POINTS_CONFIG,
      milestoneEvery: 0,
    }
    expect(streakMilestoneBonus(7, cfg)).toBe(0)
  })
})

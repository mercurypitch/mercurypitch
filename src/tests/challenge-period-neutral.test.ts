// ============================================================
// The challenge does not tell you how long it is in its name
// ============================================================
//
// The decision: challenges move from a week to four weeks, and may later run
// fortnightly or for a single day. Nothing in the data model has to change
// for that — there is no "weekly" field anywhere, only `startsAt`/`endsAt` —
// so the only thing that would go stale is the copy.
//
// So the copy stops saying it. "Legend Attempt" everywhere a user can read,
// and the countdown already tells them how many days are left, which is the
// honest answer whatever the period is.
//
// Internal names stay: the file is still `WeeklyLegendHero.tsx`, the service
// `weekly-service.ts`, the attempt kinds `weekly_attempt` / `weekly_join`,
// the DB table unchanged. Renaming those is a wide rename with no user-facing
// gain and a migration at the end of it.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function repoFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

/** Quoted strings and JSX text — what a person can actually read. */
function userFacingText(source: string): string[] {
  const out: string[] = []
  // Quoted literals, minus the ones that are obviously module paths.
  for (const match of source.matchAll(/'([^'\n]{4,})'|"([^"\n]{4,})"/g)) {
    const value = match[1] ?? match[2] ?? ''
    if (value.startsWith('.') || value.startsWith('@/')) continue
    if (/^[a-z0-9-]+$/.test(value)) continue // ids, css classes, kinds
    out.push(value)
  }
  // Bare JSX text between tags.
  for (const match of source.matchAll(/>([^<>{}\n]{4,})</g)) {
    out.push(match[1])
  }
  return out
}

/** Strip line and block comments — a comment is not copy. */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

const SURFACES = [
  'src/features/challenges/WeeklyLegendHero.tsx',
  'src/features/challenges/ChallengeStage.tsx',
  'src/features/challenges/ChallengeResultCard.tsx',
  'src/features/challenges/PastWeeklyChallenges.tsx',
  'src/features/challenges/LegendsShowcase.tsx',
]

// "This week", "weekly", "monthly", "this month" — a period in the name.
const PERIOD_WORDS = /\b(weekly|monthly|fortnightly|this week|this month)\b/i

describe('what a user reads about a challenge', () => {
  it.each(SURFACES)('%s never names a period', (path) => {
    const offenders = userFacingText(withoutComments(repoFile(path))).filter(
      (text) => PERIOD_WORDS.test(text),
    )
    expect(offenders).toEqual([])
  })

  it('calls it a Legend Attempt on the home card', () => {
    const hero = repoFile('src/features/challenges/WeeklyLegendHero.tsx')
    expect(hero).toContain('<span class={styles.eyebrow}>Legend Attempt</span>')
  })

  it('calls it the same thing on the stage', () => {
    const stage = repoFile('src/features/challenges/ChallengeStage.tsx')
    expect(stage).toContain("'Legend Attempt'")
    expect(stage).toContain("'Legend Attempt performance stage'")
  })

  it('says the same in the guided tour', () => {
    // The tour is copy too, and it was promising "every week".
    const store = repoFile('src/stores/app-store.ts')
    const step = store.slice(
      store.indexOf("title: 'Legend Attempt'") - 40,
      store.indexOf("title: 'Legend Attempt'") + 400,
    )
    expect(step).toContain("targetSelector: '.home-legend-card'")
    expect(step).not.toMatch(/every week/i)
  })

  it('still tells you how long is left, which is the honest version', () => {
    // Dropping the period word only works because the countdown stays.
    const service = repoFile('src/features/challenges/weekly-service.ts')
    expect(service).toContain('export function hoursUntil(')
  })
})

describe('the internals are deliberately untouched', () => {
  it('keeps the storage names a rename would have to migrate', () => {
    const service = repoFile('src/features/challenges/weekly-service.ts')
    expect(service).toContain('startsAt')
    expect(service).toContain('endsAt')
    // No period field to change: this is why the switch needs no migration.
    expect(service).not.toMatch(/\bperiodKind\b|\bcadence\b|\bisWeekly\b/)
  })
})

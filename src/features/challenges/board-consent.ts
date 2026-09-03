// ============================================================
// Consent to be named on a Legend board
// ============================================================
//
// A ranked challenge attempt publishes a name beside a score, permanently —
// the podium of a closed challenge is a historical record, not a live view
// that scrolls away. So the consent has to be asked for before the attempt,
// not inferred from having taken one.
//
// It reuses `leaderboardOptIn` rather than adding a challenge-specific flag.
// One flag, one meaning — "show my name on public boards" — so a singer who
// turns it off in Settings disappears from the global leaderboard, from live
// challenge boards, and (via the archive's read-time redaction) from past
// podiums, all at once. Two flags would let those three disagree, and the
// disagreement would only ever be discovered by the person harmed by it.
//
// The Settings toggle is unchanged; this only adds a second, earlier place
// the same consent can be given.

import { getDb } from '@/db'
import type { UserProfile } from '@/db/entities'
import { getUserId } from '@/db/seed'

/**
 * Whether this singer has agreed to appear by name on public boards.
 *
 * Fails closed. A missing profile, a signed-out session or a transient
 * database error all read as "no consent", which costs a dialog the singer
 * can dismiss — the other direction costs a published name nobody agreed to.
 */
export async function hasBoardConsent(): Promise<boolean> {
  try {
    const db = await getDb()
    const profile = await db
      .getRepository<UserProfile>('userProfiles')
      .findById(getUserId())
    return profile?.leaderboardOptIn === true
  } catch {
    return false
  }
}

/**
 * Record the consent, creating the profile row if this is a singer's first
 * write. Returns false when it could not be stored — the caller must not
 * start a ranked attempt on a consent that was never saved.
 *
 * `leaderboardOptInAt` is written alongside because consent with no date is
 * not evidence of anything.
 */
export async function grantBoardConsent(): Promise<boolean> {
  try {
    const db = await getDb()
    const profiles = db.getRepository<UserProfile>('userProfiles')
    const userId = getUserId()
    const patch = {
      leaderboardOptIn: true,
      leaderboardOptInAt: new Date().toISOString(),
    }
    // Cloud row id == userId (the JWT identity). An anonymous singer has no
    // profile row until something writes one, and consent is often that
    // something — which is why the create branch carries the whole default
    // shape rather than just the two consent fields.
    //
    // The display name matters here more than it looks. A board falls back to
    // `Singer-<id>` only when the profile row is ABSENT — an empty stored name
    // is a name, and `COALESCE` does not catch it — so creating the row with
    // `displayName: ''` would put a blank entry on a public podium. The same
    // handle the fallback would have produced is written instead, matching
    // leaderboard-service so both paths mint the identical name.
    if ((await profiles.findById(userId)) != null) {
      await profiles.update(userId, patch)
    } else {
      await profiles.create({
        displayName: `Singer-${userId.slice(0, 6)}`,
        joinDate: new Date().toISOString(),
        lastPracticeDate: null,
        currentStreak: 0,
        ...patch,
      })
    }
    return true
  } catch {
    return false
  }
}

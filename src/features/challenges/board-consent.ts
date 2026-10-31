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
import { CloudRequestError } from '@/db/adapters/server-adapter'
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
    const userId = getUserId()
    const db = await getDb()
    const profile = await db
      .getRepository<UserProfile>('userProfiles')
      .findById(userId)
    return getUserId() === userId && profile?.leaderboardOptIn === true
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
    const userId = getUserId()
    const db = await getDb()
    const profiles = db.getRepository<UserProfile>('userProfiles')
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
    const profile = await profiles.findById(userId)
    if (getUserId() !== userId) return false
    // Given already: kept as it is, with the date it was given on. Asked
    // twice, a second write would have moved that date.
    if (profile?.leaderboardOptIn === true) return true
    if (profile != null) {
      await profiles.update(userId, patch)
    } else {
      try {
        await profiles.create({
          displayName: `Singer-${userId.slice(0, 6)}`,
          joinDate: new Date().toISOString(),
          lastPracticeDate: null,
          currentStreak: 0,
          ...patch,
        })
      } catch (err) {
        // create() provisions a first-time visitor's identity, and the server
        // creates the profile row while provisioning — so the POST finds it.
        if (!(err instanceof CloudRequestError && err.status === 409)) throw err
        if (getUserId() !== userId) return false
        await profiles.update(userId, patch)
      }
    }
    // A saved consent belongs to its initiator, not an account selected while
    // the write was pending. The caller must ask that account independently.
    return getUserId() === userId
  } catch {
    return false
  }
}

/**
 * Take the consent back: the singer's name leaves every public board at
 * once, live boards and past podiums alike (read-time redaction). A singer
 * with no profile row has never consented, so there is nothing to write.
 * Returns false when it could not be stored, as `grantBoardConsent` does;
 * the caller shows the switch as it was.
 *
 * The date goes with the flag: consent with no date is not evidence, and
 * a withdrawal leaves none behind.
 */
export async function revokeBoardConsent(): Promise<boolean> {
  try {
    const userId = getUserId()
    const db = await getDb()
    const profiles = db.getRepository<UserProfile>('userProfiles')
    const profile = await profiles.findById(userId)
    if (getUserId() !== userId) return false
    if (profile == null) return true
    await profiles.update(userId, {
      leaderboardOptIn: false,
      leaderboardOptInAt: null,
    })
    return getUserId() === userId
  } catch {
    return false
  }
}

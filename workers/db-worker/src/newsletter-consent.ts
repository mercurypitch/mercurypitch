// ── Who asked to hear from us ────────────────────────────────────────
//
// The stored answer and nothing else: no Env, no request, no routes. It sits
// on its own because both ends need it and they must not import each other —
// `auth.ts` records the answer given on the register form, and `newsletter.ts`
// records the answer given in Settings or through the link in an email, while
// importing `auth.ts` for the session and the rate limiter. A single module
// holding all three would close that loop.
//
// The list is this column. A mirror in a mailing provider would be a second
// source of truth for consent, and the two would drift the first time
// somebody unsubscribed from an email: Settings would go on saying they were
// subscribed until something reconciled them. Keeping it here also means
// account erasure already covers it, and that the switch still works on a day
// the mail provider does not.

/** The surface a consent change came from. Stored for the record. */
export type NewsletterSource = 'signup' | 'settings' | 'email'

export interface NewsletterConsent {
  optIn: boolean
  /** When they last said yes. NULL when they never have. */
  optInAt: string | null
}

/**
 * Record an answer.
 *
 * Both timestamps are kept: the record of consent is when it was given AND
 * when it was withdrawn, and overwriting one with the other would lose half
 * of it. `newsletterOptInAt` moving on every fresh yes is deliberate — see
 * `unsubscribeToken` in newsletter.ts.
 */
export async function setNewsletterConsent(
  db: D1Database,
  userId: string,
  optIn: boolean,
  source: NewsletterSource,
): Promise<void> {
  const now = new Date().toISOString()
  await db
    .prepare(
      optIn
        ? `UPDATE users
              SET newsletterOptIn = 1, newsletterOptInAt = ?,
                  newsletterSource = ?, updatedAt = ?
            WHERE id = ?`
        : `UPDATE users
              SET newsletterOptIn = 0, newsletterOptOutAt = ?,
                  newsletterSource = ?, updatedAt = ?
            WHERE id = ?`,
    )
    .bind(now, source, now, userId)
    .run()
}

export async function readNewsletterConsent(
  db: D1Database,
  userId: string,
): Promise<NewsletterConsent | null> {
  const row = await db
    .prepare(
      `SELECT newsletterOptIn, newsletterOptInAt FROM users WHERE id = ?`,
    )
    .bind(userId)
    .first<{ newsletterOptIn: number; newsletterOptInAt: string | null }>()
  if (!row) return null
  return { optIn: row.newsletterOptIn === 1, optInAt: row.newsletterOptInAt }
}

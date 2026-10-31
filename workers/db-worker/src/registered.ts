// ── Registered accounts ──────────────────────────────────────────────
// Friends, blocks and reports are for registered accounts only. An
// anonymous identity is a device id in one browser's storage: it cannot be
// signed back into, so it can neither answer a request nor keep a block, and
// it has no name on a board to protect (friends.ts says more).

import type { Env } from './auth'

/** True when this account is a real one, not a lazily provisioned device id. */
export async function isRegistered(userId: string, env: Env): Promise<boolean> {
  const row = await env.DB.prepare(
    'SELECT authProvider FROM users WHERE id = ?',
  )
    .bind(userId)
    .first<{ authProvider: string }>()
  return row != null && row.authProvider !== 'anonymous'
}

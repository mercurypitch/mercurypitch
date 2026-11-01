// ============================================================
// Public text refusal — a name or title the word filter turned down
// ============================================================
//
// The db-worker reads every name and title other singers see through its
// word filter and refuses one with 400 and `{"error": "<field> uses a word
// that is not allowed"}` (workers/db-worker/src/public-text.ts). That is
// the one write failure the singer can fix by typing something else, so
// screens tell it apart from the rest here, in one place, rather than
// showing ServerAdapter's transport message or "try again".

import { CloudRequestError } from '@/db/adapters/server-adapter'
import { WORD_NOT_ALLOWED } from '../../../workers/db-worker/src/public-text-wording'

const SUFFIX = ` ${WORD_NOT_ALLOWED}`

/**
 * The field the worker's word filter refused (`displayName`, `melodyName`,
 * `sessionName`, `itemsJson`, ...), or null for any other failure.
 */
export function refusedPublicTextField(err: unknown): string | null {
  if (!(err instanceof CloudRequestError) || err.status !== 400) return null
  let message: unknown
  try {
    message = (JSON.parse(err.body) as { error?: unknown } | null)?.error
  } catch {
    return null
  }
  if (typeof message !== 'string' || !message.endsWith(SUFFIX)) return null
  const field = message.slice(0, -SUFFIX.length)
  return field === '' ? null : field
}

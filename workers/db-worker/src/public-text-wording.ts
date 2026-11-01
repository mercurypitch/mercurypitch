// ============================================================
// public-text-wording — how the worker words a refused public text
// ============================================================
//
// validateWrite answers a refused name or title with 400 and
// `{"error": "<field> uses a word that is not allowed"}` (public-text.ts).
// The app reads that answer to tell the singer what to change instead of
// showing the transport error (src/db/services/public-text-refusal.ts), so
// both sides take the words from here.
//
// No imports, so the app's bundle can take it without the name filter's
// word list.

/** What follows the field name when the name filter refuses a word. */
export const WORD_NOT_ALLOWED = 'uses a word that is not allowed'

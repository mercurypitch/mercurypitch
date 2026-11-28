// ============================================================
// What a person reads when our servers did not answer
// ============================================================

import { describe, expect, it } from 'vitest'
import { ApiDeadlineError, ApiUnreachableError } from '@/db/api-fetch'
import { failureText, isNoAnswer, NO_ANSWER_TEXT } from './no-answer-copy'

const URL = 'https://api.test/api/weekly/active?code=123'

describe('a call to our servers that got no answer', () => {
  it('reads as plain copy, whichever of the two errors it ended with', () => {
    expect(failureText(new ApiDeadlineError(URL, 8000), 'Fallback.')).toBe(
      NO_ANSWER_TEXT,
    )
    expect(failureText(new ApiUnreachableError(URL), 'Fallback.')).toBe(
      NO_ANSWER_TEXT,
    )
  })

  it('names no address, no milliseconds and no error, and keeps the name whole', () => {
    expect(NO_ANSWER_TEXT).toBe(
      "Couldn't reach Mercury Pitch's servers. Check your connection and try again.",
    )
    expect(NO_ANSWER_TEXT).not.toMatch(/https?:|\/api\/|\d+ ?ms|—|Error/)
  })

  // A test that resets its modules, or a second bundle, makes its own copy of
  // the error classes, so they are known by name, as isNetworkError knows
  // them (src/lib/global-error-handler.ts).
  it('is known by name, not by which copy of the class made it', () => {
    const deadline = new Error('No answer from https://api.test within 8000 ms')
    deadline.name = 'ApiDeadlineError'
    const refused = new Error('Not sent to https://api.test')
    refused.name = 'ApiUnreachableError'

    expect(isNoAnswer(deadline)).toBe(true)
    expect(isNoAnswer(refused)).toBe(true)
  })
})

describe('any other failure', () => {
  it('keeps its own message, and an empty one gets the fallback', () => {
    expect(failureText(new Error('Card declined.'), 'Fallback.')).toBe(
      'Card declined.',
    )
    expect(failureText(new Error(''), 'Fallback.')).toBe('Fallback.')
    expect(failureText('not an error', 'Fallback.')).toBe('Fallback.')
    expect(isNoAnswer(new TypeError('Failed to fetch'))).toBe(false)
  })
})

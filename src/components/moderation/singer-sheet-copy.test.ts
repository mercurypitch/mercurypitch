import { describe, expect, it } from 'vitest'
import type { ModerationProblem } from '@/db/services/moderation-service'
import { REPORT_REASONS } from '@/db/services/moderation-service'
import { paneTitle, problemWords, REASON_WORDS, reportContactUrl, } from './singer-sheet-copy'

const PROBLEMS: ModerationProblem[] = [
  'account',
  'refused',
  'missing',
  'self',
  'invalid',
  'busy',
  'full',
  'unreachable',
]

describe('the singer sheet’s words', () => {
  it('words every reason the worker takes, and no other', () => {
    expect(Object.keys(REASON_WORDS)).toEqual([...REPORT_REASONS])
  })

  it('opens the contact form on its support topic, naming the report', () => {
    const url = new URL(reportContactUrl('Ada', 'user', 'ada-id'))

    expect(url.pathname).toBe('/contact/')
    expect(url.searchParams.get('topic')).toBe('support')
    expect(url.searchParams.get('message')).toBe(
      'About a report on Ada (user ada-id):\n\n',
    )
  })

  it('offers a second try only where it can help', () => {
    const again = PROBLEMS.filter(
      (problem) => problemWords('report', problem, 'Ada').retry !== null,
    )
    expect(again).toEqual(['invalid', 'unreachable'])
    expect(problemWords('report', 'invalid', 'Ada').retry).toBe('edit')
    expect(problemWords('block', 'unreachable', 'Ada').retry).toBe('again')
  })

  it('sends the singer to sign in where the account is the matter', () => {
    const signIn = PROBLEMS.filter(
      (problem) => problemWords('block', problem, 'Ada').signIn,
    )
    expect(signIn).toEqual(['account', 'refused'])
  })

  it('says which of the two failed, by name for a block', () => {
    expect(problemWords('report', 'busy', 'Ada').title).toBe(
      'Could not send the report',
    )
    expect(problemWords('block', 'busy', 'Ada').title).toBe(
      'Could not block Ada',
    )
    expect(
      paneTitle('problem', 'Ada', { action: 'block', problem: 'self' }),
    ).toBe('Could not block Ada')
    expect(problemWords('block', 'self', 'Ada').body).toBe(
      'You cannot block yourself.',
    )
  })
})

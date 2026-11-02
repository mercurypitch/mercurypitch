import { describe, expect, it } from 'vitest'
import type { ModerationProblem } from '@/db/services/moderation-service'
import { REPORT_REASONS } from '@/db/services/moderation-service'
import { paneTitle, problemWords, REASON_WORDS, reportContactUrl, suspendedContactUrl, } from './singer-sheet-copy'

const PROBLEMS: ModerationProblem[] = [
  'account',
  'refused',
  'suspended',
  'missing',
  'self',
  'invalid',
  'busy',
  'full',
  'unreachable',
  'server',
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
    expect(again).toEqual(['invalid', 'unreachable', 'server'])
    expect(problemWords('report', 'invalid', 'Ada').retry).toBe('edit')
    expect(problemWords('block', 'unreachable', 'Ada').retry).toBe('again')
    expect(problemWords('block', 'server', 'Ada').retry).toBe('again')
  })

  it('tells a server that failed apart from no connection', () => {
    expect(problemWords('report', 'server', 'Ada').body).toBe(
      'MercuryPitch could not answer just now. Try again in a moment.',
    )
    expect(problemWords('report', 'unreachable', 'Ada').body).toBe(
      'Could not reach MercuryPitch. Check the connection and try again.',
    )
  })

  it('tells a suspended account so, with the contact form and no sign-in', () => {
    const words = problemWords('block', 'suspended', 'Ada')

    expect(words).toEqual({
      title: 'This account is suspended',
      body: 'A suspended account cannot report or block. If you think this is a mistake, tell us through the contact form.',
      retry: null,
      signIn: false,
      contact: 'account',
    })
    const url = new URL(suspendedContactUrl())
    expect(url.searchParams.get('topic')).toBe('support')
    expect(url.searchParams.get('message')).toBe(
      'About my suspended account:\n\n',
    )
  })

  it('puts the report’s contact form under a report that failed', () => {
    const contact = PROBLEMS.map(
      (problem) => problemWords('report', problem, 'Ada').contact,
    )
    expect(contact).toEqual([
      'report',
      null,
      'account',
      'report',
      'report',
      'report',
      'report',
      'report',
      'report',
      'report',
    ])
    expect(problemWords('block', 'busy', 'Ada').contact).toBeNull()
  })

  it('titles a report already with us apart from one just sent', () => {
    expect(paneTitle('already', 'Ada', null)).toBe(
      'We have your report already',
    )
    expect(paneTitle('sent', 'Ada', null)).toBe('Report sent')
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

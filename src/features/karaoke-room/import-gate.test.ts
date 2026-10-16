// ============================================================
// The import gate: S7b §4.3, row by row
// ============================================================

import { describe, expect, it } from 'vitest'
import type { ImportState } from './import-gate'
import { importAction, importState } from './import-gate'
import type { KaraokeSongs } from './karaoke-songs'

const month = {
  renewsAt: '2026-11-01T09:00:00.000Z',
  perPeriod: 20,
}
const subscriber: KaraokeSongs = { ...month, left: 14, subscribed: true }
const signedIn = { token: true, account: true }
const anonymous = { token: true, account: false }
const nobody = { token: false, account: false }

describe('the import gate', () => {
  it('sends a subscriber with songs left straight to Files', () => {
    const state = importState(subscriber, signedIn)

    expect(state).toBe('songs-left')
    expect(importAction(state)).toBe('files')
  })

  it('gives a subscriber with none left the note, not the offer', () => {
    const state = importState({ ...subscriber, left: 0 }, signedIn)

    expect(state).toBe('none-left')
    expect(importAction(state)).toBe('note')
  })

  it('sends a signed-in singer with the free song unused to Files', () => {
    const state = importState(
      { ...month, subscribed: false, renewsAt: null, left: 1, free: 1 },
      signedIn,
    )

    expect(state).toBe('free-song')
    expect(importAction(state)).toBe('files')
  })

  it('offers Cloud to a signed-in singer whose free song is used', () => {
    const state = importState(
      { ...month, subscribed: false, renewsAt: null, left: 0, free: 0 },
      signedIn,
    )

    expect(state).toBe('free-used')
    expect(importAction(state)).toBe('offer')
  })

  it('offers Cloud to an anonymous singer the server says has none', () => {
    const state = importState(
      { ...month, subscribed: false, renewsAt: null, left: 0 },
      anonymous,
    )

    expect(state).toBe('no-account')
    expect(importAction(state)).toBe('offer')
  })

  it('offers Cloud on a fresh install before anything is known, never Files', () => {
    const state = importState(
      { ...month, subscribed: false, renewsAt: null, left: null },
      nobody,
    )

    expect(state).toBe('no-account')
    expect(importAction(state)).toBe('offer')
  })

  it('lets the pick decide while the server has not answered a phone with a token', () => {
    const unknown = { ...month, subscribed: false, renewsAt: null, left: null }

    expect(importState(unknown, anonymous)).toBe('unknown')
    expect(importState(unknown, signedIn)).toBe('unknown')
    expect(importAction('unknown')).toBe('files')
  })

  it('counts songs the server gives anyone else, such as review access, as songs left', () => {
    const state = importState(
      { ...month, subscribed: false, renewsAt: null, left: 3, free: 0 },
      anonymous,
    )

    expect(state).toBe('songs-left')
  })

  it('has an action for every state', () => {
    const states: ImportState[] = [
      'songs-left',
      'free-song',
      'none-left',
      'free-used',
      'no-account',
      'unknown',
    ]

    expect(states.map(importAction)).toEqual([
      'files',
      'files',
      'note',
      'offer',
      'offer',
      'files',
    ])
  })
})

// ============================================================
// Worker write validation — sessionRecords
//
// `source` decides leaderboard eligibility and league points, so the column
// must never hold values outside the known enum: an unknown string earns
// nothing today but would silently join every future eligibility query.
// ============================================================

import { describe, expect, it } from 'vitest'
import { validateWrite } from '../../workers/db-worker/src/validation'

describe('validateWrite for sessionRecords', () => {
  it('accepts every known source and an absent one', () => {
    for (const source of ['practice', 'challenge', 'weekly', 'exercise']) {
      expect(validateWrite('sessionRecords', { source })).toBeNull()
    }
    expect(validateWrite('sessionRecords', {})).toBeNull()
  })

  it('rejects unknown or non-string sources', () => {
    expect(validateWrite('sessionRecords', { source: 'admin' })).toMatch(
      /source/,
    )
    expect(validateWrite('sessionRecords', { source: 42 })).toMatch(/source/)
    expect(validateWrite('sessionRecords', { source: '' })).toMatch(/source/)
  })

  it('keeps the numeric range checks', () => {
    expect(validateWrite('sessionRecords', { score: 101 })).toMatch(/score/)
    expect(
      validateWrite('sessionRecords', { notesHit: 5, notesTotal: 3 }),
    ).toMatch(/notesHit/)
    expect(validateWrite('sessionRecords', { score: 88 })).toBeNull()
  })

  it('accepts valid Progress evidence fields', () => {
    expect(
      validateWrite('sessionRecords', {
        source: 'exercise',
        instrument: 'voice',
        durationMs: 12_500,
        sourceVersion: 2,
        sourceRef: 'long-note',
        comparabilityKey: 'voice:exercise:long-note:v2',
      }),
    ).toBeNull()
  })

  it('rejects invalid Progress evidence fields', () => {
    expect(validateWrite('sessionRecords', { instrument: 'drums' })).toMatch(
      /instrument/,
    )
    expect(validateWrite('sessionRecords', { durationMs: 0 })).toMatch(
      /durationMs/,
    )
    expect(validateWrite('sessionRecords', { durationMs: Infinity })).toMatch(
      /durationMs/,
    )
    expect(validateWrite('sessionRecords', { sourceVersion: 1.5 })).toMatch(
      /sourceVersion/,
    )
    expect(validateWrite('sessionRecords', { sourceRef: '' })).toMatch(
      /sourceRef/,
    )
    expect(
      validateWrite('sessionRecords', { comparabilityKey: { task: 'x' } }),
    ).toMatch(/comparabilityKey/)
    expect(
      validateWrite('sessionRecords', {
        comparabilityKey: 'voice:exercise:long-note:v1',
        sourceRef: 'long-note',
      }),
    ).toMatch(/sourceVersion/)
  })

  it('ignores other entities', () => {
    expect(validateWrite('userProfiles', { source: 'garbage' })).toBeNull()
  })
})

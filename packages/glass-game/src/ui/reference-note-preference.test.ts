// Reference tuning tests — finite bounds, persistence and production gating.
import { describe, expect, it, vi } from 'vitest'
import { parseReferenceNoteHold, REFERENCE_NOTE_HOLD_PREFERENCE, } from '../reference-note'
import { createReferenceNotePreference } from './reference-note-preference'

describe('reference note hold preference', () => {
  it.each([
    undefined,
    null,
    '',
    '  ',
    'oops',
    'Infinity',
    Infinity,
    NaN,
    false,
    {},
  ])('defaults unusable value %s to 1.25s', (value) => {
    expect(parseReferenceNoteHold(value)).toBe(1.25)
  })
  it.each([
    [0, 1],
    [20, 1.5],
    ['1.1', 1.1],
    [1.5, 1.5],
  ])('bounds %s to %s seconds', (value, expected) => {
    expect(parseReferenceNoteHold(value)).toBe(expected)
  })
  it('preserves a saved choice and persists normalized changes for a later visit', () => {
    const saved = new Map([[REFERENCE_NOTE_HOLD_PREFERENCE, '1.4']])
    const writePreference = vi.fn((key: string, value: string) => {
      saved.set(key, value)
    })
    const host = {
      developmentTuning: true,
      readPreference: (key: string) => saved.get(key) ?? null,
      writePreference,
    }
    const pref = createReferenceNotePreference(host)
    expect(pref.referenceNoteHoldSeconds()).toBe(1.4)
    expect(writePreference).not.toHaveBeenCalled()
    pref.changeReferenceNoteHold(99)
    expect(pref.referenceNoteHoldSeconds()).toBe(1.5)
    expect(writePreference).toHaveBeenLastCalledWith(
      REFERENCE_NOTE_HOLD_PREFERENCE,
      '1.5',
    )
    expect(createReferenceNotePreference(host).referenceNoteHoldSeconds()).toBe(
      1.5,
    )
  })
  it('ignores development overrides and changes in release hosts', () => {
    const readPreference = vi.fn(() => '1')
    const writePreference = vi.fn()
    const pref = createReferenceNotePreference({
      developmentTuning: false,
      readPreference,
      writePreference,
    })
    pref.changeReferenceNoteHold(1.5)
    expect(pref.referenceNoteHoldSeconds()).toBe(1.25)
    expect(readPreference).not.toHaveBeenCalled()
    expect(writePreference).not.toHaveBeenCalled()
  })
})

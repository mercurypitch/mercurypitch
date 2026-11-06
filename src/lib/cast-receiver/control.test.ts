// ============================================================
// Cast receiver control tests — what a sender may ask of the receiver
// ============================================================

import { describe, expect, it } from 'vitest'
import { readCastControl } from '@/lib/cast-receiver/control'

describe('reading a control message', () => {
  it.each([
    ['probe', { v: 1, kind: 'probe' }],
    ['demo', { v: 1, kind: 'demo' }],
    ['diagnostics on', { v: 1, kind: 'diagnostics', on: true }],
    ['diagnostics off', { v: 1, kind: 'diagnostics', on: false }],
  ])('takes %s', (_name, value) => {
    expect(readCastControl(value)).toEqual(value)
  })

  it('keeps nothing else a sender put in it', () => {
    expect(readCastControl({ v: 1, kind: 'probe', extra: 'x' })).toEqual({
      v: 1,
      kind: 'probe',
    })
  })

  it.each([
    ['nothing', null],
    ['a list', [{ v: 1, kind: 'probe' }]],
    ['no version', { kind: 'probe' }],
    ['another version', { v: 2, kind: 'probe' }],
    ['a stage message', { v: 1, kind: 'idle' }],
    ['diagnostics with no switch', { v: 1, kind: 'diagnostics' }],
    ['diagnostics with a word', { v: 1, kind: 'diagnostics', on: 'yes' }],
  ])('drops %s', (_name, value) => {
    expect(readCastControl(value)).toBeNull()
  })
})

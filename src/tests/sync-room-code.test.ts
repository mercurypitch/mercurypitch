// A room id is a case-sensitive Durable Object name, so a lowercase code
// does not fail -- it opens a DIFFERENT, empty room, and both devices sit
// waiting for each other in separate rooms. These pin the normalization
// that stops that, which is the difference between "the code did not
// work" and a transfer.

import { describe, expect, it } from 'vitest'
import { isCompleteRoomCode, normalizeRoomCode, parseSyncLinkHash, ROOM_CODE_LENGTH, } from '@/lib/room-code'

describe('sync room code', () => {
  it('uppercases what a phone keyboard typed', () => {
    expect(normalizeRoomCode('abcd2345')).toBe('ABCD2345')
    expect(normalizeRoomCode('AbCd2345')).toBe('ABCD2345')
  })

  it('drops what a copy or a helpful human added', () => {
    expect(normalizeRoomCode(' ABCD 2345 ')).toBe('ABCD2345')
    expect(normalizeRoomCode('ABCD-2345')).toBe('ABCD2345')
    expect(normalizeRoomCode('\tabcd2345\n')).toBe('ABCD2345')
  })

  it('refuses characters the generator never emits', () => {
    // The worker's alphabet has no 0, O, 1 or I, so any of them is a
    // typo -- and there is no unambiguous character to map them to.
    expect(normalizeRoomCode('OI01')).toBe('')
    expect(normalizeRoomCode('A0B1C')).toBe('ABC')
  })

  it('stops at the code length, however much was pasted', () => {
    expect(normalizeRoomCode('ABCD2345EXTRA')).toBe('ABCD2345')
    expect(normalizeRoomCode('ABCD2345EXTRA')).toHaveLength(ROOM_CODE_LENGTH)
  })

  it('knows when there is enough to try', () => {
    expect(isCompleteRoomCode('abcd234')).toBe(false)
    expect(isCompleteRoomCode('abcd2345')).toBe(true)
    expect(isCompleteRoomCode('')).toBe(false)
  })
})

describe('the scanned sync link', () => {
  // One format, two parsers — the app's hash router and the Karaoke
  // Night page, which has none. This helper is what keeps them agreeing.
  it('reads the code off the QR link, however cased', () => {
    expect(parseSyncLinkHash('#/sync:ABCD2345')).toBe('ABCD2345')
    expect(parseSyncLinkHash('#/sync:abcd2345')).toBe('ABCD2345')
    expect(parseSyncLinkHash('#sync:ABCD2345')).toBe('ABCD2345')
  })

  it('refuses anything that is not a complete code', () => {
    expect(parseSyncLinkHash('#/sync:ABC')).toBeNull()
    expect(parseSyncLinkHash('#/sync:')).toBeNull()
    expect(parseSyncLinkHash('#/link:ABCD2345')).toBeNull()
    expect(parseSyncLinkHash('#/karaoke')).toBeNull()
    expect(parseSyncLinkHash('')).toBeNull()
  })
})

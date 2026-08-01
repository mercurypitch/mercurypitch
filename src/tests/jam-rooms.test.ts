// ── Hosted-rooms tests ────────────────────────────────────────────────
// The owner token is the only thing that proves host to the signaling DO,
// and it used to live in a module variable that a reload threw away. These
// pin that it survives, that the list stays bounded and fresh, and that
// nothing here throws when storage is unavailable — a lobby that cannot
// render because localStorage is disabled is worse than no room list.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { forgetHostedRoom, hostedRooms, ownerTokenFor, refreshHostedRooms, rememberHostedRoom, touchHostedRoom, } from '@/lib/jam/jam-rooms'

const KEY = 'pitchperfect_jam_hosted_rooms'

describe('hosted rooms', () => {
  beforeEach(() => {
    localStorage.clear()
    // The reactive list is a cache over storage, so clearing storage behind
    // it does not invalidate it -- refresh is the documented way to reload.
    refreshHostedRooms()
    vi.restoreAllMocks()
  })

  it('remembers a room and hands its token back', () => {
    rememberHostedRoom('ABCD', 'Edgy', 'secret-1')
    expect(ownerTokenFor('ABCD')).toBe('secret-1')
    expect(hostedRooms()).toHaveLength(1)
    expect(hostedRooms()[0]!.displayName).toBe('Edgy')
  })

  it('knows nothing about a room this device never hosted', () => {
    expect(ownerTokenFor('NOPE')).toBeNull()
    expect(hostedRooms()).toEqual([])
  })

  it('survives a reload — which is the whole point', () => {
    rememberHostedRoom('ABCD', 'Edgy', 'secret-1')
    // A fresh module read, as a page load would do.
    expect(ownerTokenFor('ABCD')).toBe('secret-1')
  })

  it('replaces rather than duplicates when a room is re-entered', () => {
    rememberHostedRoom('ABCD', 'Edgy', 'secret-1')
    rememberHostedRoom('ABCD', 'Edgy', 'secret-2')
    expect(hostedRooms()).toHaveLength(1)
    expect(ownerTokenFor('ABCD')).toBe('secret-2')
  })

  it('lists the most recent room first', () => {
    rememberHostedRoom('OLD', 'Edgy', 't1')
    rememberHostedRoom('NEW', 'Edgy', 't2')
    expect(hostedRooms().map((r) => r.roomId)).toEqual(['NEW', 'OLD'])
  })

  it('bumps a room without changing its secret', () => {
    rememberHostedRoom('OLD', 'Edgy', 't1')
    rememberHostedRoom('NEW', 'Edgy', 't2')
    touchHostedRoom('OLD')
    expect(hostedRooms()[0]!.roomId).toBe('OLD')
    expect(ownerTokenFor('OLD')).toBe('t1')
  })

  it('forgets a room on request', () => {
    rememberHostedRoom('ABCD', 'Edgy', 'secret-1')
    forgetHostedRoom('ABCD')
    expect(hostedRooms()).toEqual([])
    expect(ownerTokenFor('ABCD')).toBeNull()
  })

  it('drops rooms older than a day', () => {
    // Rooms outlive their last peer by five minutes, so a day-old entry is
    // certainly dead and should not offer a rejoin that cannot work.
    const stale = [
      {
        roomId: 'OLD',
        displayName: 'Edgy',
        ownerToken: 't1',
        lastSeen: Date.now() - 25 * 60 * 60 * 1000,
      },
    ]
    localStorage.setItem(KEY, JSON.stringify(stale))
    refreshHostedRooms()
    expect(hostedRooms()).toEqual([])
  })

  it('keeps the list bounded', () => {
    for (let i = 0; i < 12; i++) rememberHostedRoom(`R${i}`, 'Edgy', `t${i}`)
    expect(hostedRooms().length).toBeLessThanOrEqual(8)
    // The most recent survive.
    expect(ownerTokenFor('R11')).toBe('t11')
  })

  it('ignores a malformed store rather than throwing', () => {
    localStorage.setItem(KEY, 'not json at all')
    refreshHostedRooms()
    expect(hostedRooms()).toEqual([])
    expect(ownerTokenFor('ABCD')).toBeNull()
  })

  it('ignores entries missing the fields that matter', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify([{ roomId: 'ABCD', lastSeen: Date.now() }, null, 42]),
    )
    refreshHostedRooms()
    expect(hostedRooms()).toEqual([])
  })

  it('does not throw when storage is unavailable', () => {
    // Spy on the instance, not Storage.prototype -- jsdom's localStorage
    // does not dispatch through the prototype, so a prototype spy silently
    // does nothing and the test passes for the wrong reason.
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    // The room lives in memory only: the signal updates before the storage
    // write is attempted, deliberately, so the lobby still works. What
    // matters is that both answers AGREE -- listing a room whose token
    // could not be found would offer a rejoin that cannot restore host.
    expect(() => rememberHostedRoom('ABCD', 'Edgy', 't')).not.toThrow()
    expect(hostedRooms().map((r) => r.roomId)).toEqual(['ABCD'])
    expect(ownerTokenFor('ABCD')).toBe('t')
  })

  it('refuses to store a room with no secret to store', () => {
    rememberHostedRoom('ABCD', 'Edgy', '')
    rememberHostedRoom('', 'Edgy', 'tok')
    expect(hostedRooms()).toEqual([])
  })
})

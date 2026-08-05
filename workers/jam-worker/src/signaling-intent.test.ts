// ============================================================
// Jam signaling connection intent — handshake boundary coverage
// ============================================================

import { describe, expect, it } from 'vitest'
import { connectionAllowsMessage, isJamRoomId, JAM_CONNECTION_INTENT_HEADER, JAM_ROOM_ID_HEADER, parseInitialConnectionIntent, withJamConnectionContext, } from './signaling-intent'

describe('Jam signaling connection intent', () => {
  it('allows exactly one route-appropriate handshake', () => {
    expect(connectionAllowsMessage('create', 'create-room')).toBe(true)
    expect(connectionAllowsMessage('create', 'join-room')).toBe(false)
    expect(connectionAllowsMessage('join', 'join-room')).toBe(true)
    expect(connectionAllowsMessage('join', 'create-room')).toBe(false)
    expect(connectionAllowsMessage('established', 'create-room')).toBe(false)
    expect(connectionAllowsMessage('established', 'join-room')).toBe(false)
    expect(connectionAllowsMessage('established', 'offer')).toBe(true)
    expect(connectionAllowsMessage('established', 'set-background')).toBe(true)
    expect(connectionAllowsMessage('join', 'set-background')).toBe(false)
    expect(connectionAllowsMessage('departed', 'offer')).toBe(false)
  })

  it('accepts only the two initial connection intents', () => {
    expect(parseInitialConnectionIntent('create')).toBe('create')
    expect(parseInitialConnectionIntent('join')).toBe('join')
    expect(parseInitialConnectionIntent('established')).toBeNull()
    expect(parseInitialConnectionIntent(null)).toBeNull()
  })

  it('accepts only unambiguous eight-character room ids', () => {
    expect(isJamRoomId('ABCDEFGH')).toBe(true)
    expect(isJamRoomId('ABCDEF0I')).toBe(false)
    expect(isJamRoomId('ABCDEFGHI')).toBe(false)
    expect(isJamRoomId('../ROOMS')).toBe(false)
  })

  it('overwrites spoofed client routing headers before DO dispatch', () => {
    const clientRequest = new Request(
      'https://jam.example/api/jam/rooms/ABCDEFGH/signal',
      {
        headers: {
          [JAM_CONNECTION_INTENT_HEADER]: 'create',
          [JAM_ROOM_ID_HEADER]: 'ATTACKER',
        },
      },
    )

    const forwarded = withJamConnectionContext(
      clientRequest,
      'ABCDEFGH',
      'join',
    )

    expect(forwarded.headers.get(JAM_CONNECTION_INTENT_HEADER)).toBe('join')
    expect(forwarded.headers.get(JAM_ROOM_ID_HEADER)).toBe('ABCDEFGH')
  })
})

// ============================================================
// Jam signaling connection intent — bind each WebSocket to one handshake
// ============================================================

export const JAM_ROOM_ID_HEADER = 'X-Jam-Room-Id'
export const JAM_CONNECTION_INTENT_HEADER = 'X-Jam-Connection-Intent'
const JAM_ROOM_ID_RE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/

export type JamConnectionIntent = 'create' | 'join' | 'established' | 'departed'

export interface JamSocketAttachment {
  connectionIntent: JamConnectionIntent
  displayName?: string
  /** Set by the Durable Object after owner-token verification. */
  isHost?: boolean
  peerId?: string
  roomId: string
}

export function isJamRoomId(value: string): boolean {
  return JAM_ROOM_ID_RE.test(value)
}

export function parseInitialConnectionIntent(
  value: string | null,
): 'create' | 'join' | null {
  return value === 'create' || value === 'join' ? value : null
}

/**
 * A socket routed through /rooms/new can only create, and a socket routed
 * through /rooms/:id/signal can only join. Once established, neither
 * handshake may be replayed to replace room ownership.
 */
export function connectionAllowsMessage(
  intent: JamConnectionIntent | null,
  messageType: string,
): boolean {
  if (intent === 'create') return messageType === 'create-room'
  if (intent === 'join') return messageType === 'join-room'
  if (intent === 'established') {
    return (
      messageType === 'offer' ||
      messageType === 'answer' ||
      messageType === 'ice-candidate' ||
      messageType === 'set-background' ||
      messageType === 'leave-room'
    )
  }
  return false
}

/** Override client-supplied routing headers before forwarding to the DO. */
export function withJamConnectionContext(
  request: Request,
  roomId: string,
  intent: 'create' | 'join',
): Request {
  const headers = new Headers(request.headers)
  headers.set(JAM_ROOM_ID_HEADER, roomId)
  headers.set(JAM_CONNECTION_INTENT_HEADER, intent)
  return new Request(request, { headers })
}

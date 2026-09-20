// ============================================================
// jam-room-link — the one address a room is invited by
// ============================================================
//
// `/jam#/jam:CODE`, not `/#/jam:CODE`. The hash is identical and the router
// reads it the same way, but the PATH is what a server sees -- and `/jam` is
// the one that serves jam.html, with the Jam card in its Open Graph tags. A
// link off `/` unfurls with the generic site image instead.
//
// One function because three places hand the link out (the room's code
// button, the sidebar's, the invite dialog and its QR code), and two of them
// had kept the old spelling: the same room was invited by two addresses, and
// only one of them showed the right card when pasted into a chat.

/** The link that opens this room, on whatever origin the app is served from. */
export function jamRoomLink(roomId: string, origin?: string): string {
  const base =
    origin ?? (typeof window === 'undefined' ? '' : window.location.origin)
  return `${base}/jam#/jam:${roomId}`
}

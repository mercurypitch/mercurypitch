// ── Jam peer colors ──────────────────────────────────────────────────
// Shared deterministic color palette for all jam participants.
// The same array is imported by canvases, camera widget, and peer list
// so every component shows consistent coloring.

export const JAM_PEER_COLORS = [
  '#58a6ff', // blue  — accent
  '#f0883e', // orange
  '#3fb950', // green
  '#d2a8ff', // purple
  '#f778ba', // pink
  '#ffa657', // amber
  '#7ee787', // lime
  '#a5d6ff', // sky
]

/** Returns a stable color for a given peer ID based on sorted insertion order. */
export function getPeerColor(peerId: string, allPeerIds: string[]): string {
  const sorted = [...allPeerIds].sort()
  const idx = sorted.indexOf(peerId)
  return JAM_PEER_COLORS[idx % JAM_PEER_COLORS.length] ?? JAM_PEER_COLORS[0]!
}

/** Build a peerId → color map from all known peer IDs. */
export function buildPeerColorMap(peerIds: string[]): Record<string, string> {
  const sorted = [...peerIds].sort()
  const map: Record<string, string> = {}
  sorted.forEach((id, i) => {
    map[id] = JAM_PEER_COLORS[i % JAM_PEER_COLORS.length]!
  })
  return map
}

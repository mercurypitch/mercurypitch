// ── QrCode ───────────────────────────────────────────────────────────
// A code somebody points a phone at, from across a room.
//
// Exists because the device that most needs to be paired is the one that
// cannot type: a TV remote makes entering eight characters a chore, and
// entering an account password a genuine ordeal. Scanning moves that work
// to the phone already in the person's hand.
//
// Rendered as one inline SVG path rather than a canvas or an image: it
// scales to whatever the layout gives it, costs no raster memory on a
// cheap TV, and prints crisply if somebody screenshots it. The modules
// are merged into a single `d` string because a QR is several hundred
// rects, and several hundred DOM nodes on a TV browser is a visible
// pause.
//
// Deliberately NOT theme-following. A QR is read by a camera, and the
// contrast the camera needs is fixed: dark modules on a light quiet zone.
// A "dark mode" QR is a QR that fails to scan in a dim living room, which
// is exactly where this one is used.

import type { Component } from 'solid-js'
import { createMemo } from 'solid-js'
import { encode } from 'uqr'

export interface QrCodeProps {
  /** The text to encode — a URL, for everything this is used for. */
  value: string
  /** Rendered size in CSS pixels. The SVG scales; this is the box. */
  size?: number
  /** Accessible description; the value itself is rarely meaningful aloud. */
  label?: string
}

/**
 * Quiet zone, in modules.
 *
 * The spec asks for four and it is not decoration: a scanner finds the
 * code by its border, and a QR flush against a dark panel is one many
 * phones simply will not see.
 */
const QUIET_ZONE = 4

export const QrCode: Component<QrCodeProps> = (props) => {
  const matrix = createMemo(() =>
    // Medium correction: the code still reads with a quarter of it
    // obscured, which on a TV covers a reflection, a smudge, or somebody's
    // hand -- and costs only a slightly denser grid at these lengths.
    encode(props.value, { ecc: 'M', border: QUIET_ZONE }),
  )

  const path = createMemo(() => {
    const qr = matrix()
    let d = ''
    for (let y = 0; y < qr.size; y += 1) {
      for (let x = 0; x < qr.size; x += 1) {
        // One subpath per dark module, all in one element.
        if (qr.data[y]?.[x] === true) d += `M${x} ${y}h1v1h-1z`
      }
    }
    return d
  })

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${matrix().size} ${matrix().size}`}
      width={props.size ?? 200}
      height={props.size ?? 200}
      role="img"
      aria-label={props.label ?? 'QR code'}
      // shape-rendering keeps module edges hard at any scale; without it
      // a browser antialiases the grid and a marginal camera loses it.
      shape-rendering="crispEdges"
      style={{ 'border-radius': '8px' }}
    >
      <rect width={matrix().size} height={matrix().size} fill="#ffffff" />
      <path d={path()} fill="#000000" />
    </svg>
  )
}

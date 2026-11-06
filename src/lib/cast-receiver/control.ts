// ============================================================
// Cast receiver control — what a sender can ask of the receiver itself
// ============================================================
//
// The stage's own messages (`song`, `frame`, `idle`, protocol.ts) draw the
// stage. These three ask the receiver something instead, for the spike on a
// real Cast device (P6, step 6.0) before any sender of ours exists: Google's
// Cast Command and Control tool can send them on the stage's namespace.
//
// - `probe`: the receiver answers with what the device can do
//   (capabilities.ts) and how its frames are going (frame-meter.ts).
// - `diagnostics`: draws, or stops drawing, the same over the stage.
// - `demo`: plays the stage's demo song, driven on the receiver itself, so
//   the stage can be measured on a device with nothing to send it songs.
//
// They carry the stage protocol's version, so a sender of either kind
// speaks one language. Anything else is dropped, as the stage drops it.
//
// Tests: src/lib/cast-receiver/control.test.ts.

import { TV_STAGE_PROTOCOL } from '@/lib/tv-stage/protocol'

export type CastControl =
  | { readonly v: typeof TV_STAGE_PROTOCOL; readonly kind: 'probe' }
  | {
      readonly v: typeof TV_STAGE_PROTOCOL
      readonly kind: 'diagnostics'
      readonly on: boolean
    }
  | { readonly v: typeof TV_STAGE_PROTOCOL; readonly kind: 'demo' }

/** A control message from a value already parsed, or null for anything else. */
export function readCastControl(value: unknown): CastControl | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return null
  const fields = value as Record<string, unknown>
  if (fields.v !== TV_STAGE_PROTOCOL) return null
  switch (fields.kind) {
    case 'probe':
    case 'demo':
      return { v: TV_STAGE_PROTOCOL, kind: fields.kind }
    case 'diagnostics':
      return typeof fields.on === 'boolean'
        ? { v: TV_STAGE_PROTOCOL, kind: 'diagnostics', on: fields.on }
        : null
    default:
      return null
  }
}

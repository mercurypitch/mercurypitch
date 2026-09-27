// ============================================================
// The studio around the Karaoke panel, in the native app
// ============================================================
//
// In the native app the Karaoke tab is the room, and UvrPanel is the studio
// a singer reaches from the room's Options, "Manage songs" (plan S8 §11,
// decision D8 A). The studio around it draws the one options button and the
// Group row the panel's own header and group tabs were (they scrolled
// sideways on a phone, audit K5), so the panel lends it the few controls
// those need. And the room hosts the one zen stage: a song chosen to sing
// here goes back to it rather than onto a second stage.
//
// Only types. The web never passes a studio, and every read of one in the
// panel sits behind IS_NATIVE_BUILD, so none of it reaches the web bundle.

import type { Accessor } from 'solid-js'
import type { UvrView } from './UvrPanel'

/** The views the studio's options offer: find a song by singing, or the songs. */
export type UvrStudioView = Extract<UvrView, 'shazam-listen' | 'upload'>

/** What the panel hands the studio once it is set up. */
export interface UvrStudioControls {
  readonly view: Accessor<UvrView>
  readonly showView: (view: UvrStudioView) => void
  readonly openGuide: () => void
}

export interface UvrStudioHosting {
  /** A song chosen to sing: the Karaoke room takes it. */
  readonly onSing: (sessionId: string) => void
  /** Receive the panel's controls, once, when it is set up. */
  readonly attach: (controls: UvrStudioControls) => void
}

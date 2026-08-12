// ── GuideVocalMic ─────────────────────────────────────────────────────
// The separated vocal stem's level-and-mute control, as a real microphone.
//
// This is not the singer's microphone. Nothing here captures anything: the
// control decides how loud the ORIGINAL singer is in the mix, and the two
// jobs deserve two different pictures. The line-art mic in `MicIcon` is the
// one every video call uses for "your input device", and it stays there —
// on the pitch coach, the mic monitor, the stem-mixer scoring toggle. A
// vocal stem is a recorded performance, so it gets the stage mic: bulbous
// grille, long tapering body, trailing cable, sparkles.
//
// Raster rather than SVG on purpose. The look wanted here is a lit,
// three-dimensional object with a specular highlight down the grille, which
// is a lot of gradient stops to hand-author and maintain in two colourways.
//
// Colour is the state, and its sense is the opposite of the input mic's:
//   violet  = unmuted, the guide vocal is audible
//   red     = muted
// No slash. On the input mic red means "live and capturing", so the two
// controls must not share a red; they never appear in the same row, and the
// mic body itself differs, which is what carries the distinction.
//
// Both files are 128px squares with the mic on the upper-left/lower-right
// diagonal and four sparkles in the two corners it leaves free, so the pair
// registers exactly — toggling swaps hue and nothing moves.

import type { Component } from 'solid-js'
import styles from './GuideVocalMic.module.css'

interface GuideVocalMicProps {
  /** Muted (or dragged to silence) — shows the red mic. */
  muted: boolean
  /** Rendered box in px. Larger than a line glyph needs: a lit 3D object
      stops reading below roughly 22px, where a two-stroke outline still
      does. */
  size?: number
}

export const GuideVocalMic: Component<GuideVocalMicProps> = (props) => (
  <img
    class={styles.mic}
    src={props.muted ? '/mic/guide-vocal-off.webp' : '/mic/guide-vocal-on.webp'}
    width={props.size ?? 30}
    height={props.size ?? 30}
    // The pill that hosts this already carries the full state in its
    // aria-label and aria-pressed; a second announcement here would just
    // read the state twice.
    alt=""
    aria-hidden="true"
    draggable={false}
  />
)

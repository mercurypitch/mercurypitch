// ============================================================
// MixingDesk — the desk's instrument: a row of channel strips.
//
// One strip per answer, every fader at the same height and every
// lamp dark until the reveal: a boosted band, a heavier render or a
// named fault must be heard, not read off the drawing. While a
// render plays the master lamp glows; when the drill compares two
// renders the strip being played wears a bracket, which says which
// is sounding and nothing about which is right.
// ============================================================

import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import styles from './EarInstruments.module.css'

interface MixingDeskProps {
  labels: readonly string[]
  /** A render is playing. */
  playing: boolean
  /** 1-based strip whose render is sounding, when the drill compares
   *  several; 0 for none. */
  highlight: number
  reveal: { index: number; name: string } | null
}

const LEFT = 96
const RIGHT = 424
const FADER_TOP = 76
const FADER_BOTTOM = 176
const CAP_Y = 118

export function MixingDesk(props: MixingDeskProps): JSX.Element {
  const step = () => (RIGHT - LEFT) / Math.max(1, props.labels.length)
  const x = (i: number) => LEFT + step() * (i + 0.5)
  return (
    <svg
      viewBox="0 0 520 240"
      role="img"
      aria-label="The mixing desk"
      data-instrument="desk"
      class={styles.instrument}
    >
      <rect
        x="70"
        y="24"
        width="380"
        height="196"
        rx="6"
        class={styles.frame}
      />
      <line x1="90" y1="52" x2="430" y2="52" class={styles.brassLine} />
      <text x="90" y="44" class={styles.captionBrass} data-part="title">
        THE DESK
      </text>
      <circle
        cx="424"
        cy="41"
        r="5"
        class={styles.lamp}
        classList={{ [styles.lampLit]: props.playing }}
        data-part="master-lamp"
        data-lit={props.playing ? 'true' : 'false'}
      />
      <For each={props.labels}>
        {(label, i) => (
          <g
            data-part="strip"
            data-lit={props.reveal?.index === i() ? 'true' : 'false'}
            data-sounding={props.highlight === i() + 1 ? 'true' : 'false'}
          >
            <circle
              cx={x(i())}
              cy={62}
              r="4"
              class={styles.lamp}
              classList={{ [styles.lampLit]: props.reveal?.index === i() }}
              data-part="lamp"
            />
            <line
              x1={x(i())}
              y1={FADER_TOP}
              x2={x(i())}
              y2={FADER_BOTTOM}
              class={styles.faintLine}
            />
            <rect
              x={x(i()) - 9}
              y={CAP_Y}
              width="18"
              height="12"
              rx="2"
              class={styles.brassLine}
              data-part="fader"
            />
            <Show when={props.highlight === i() + 1}>
              <line
                x1={x(i()) - step() / 2 + 8}
                y1={FADER_BOTTOM + 8}
                x2={x(i()) + step() / 2 - 8}
                y2={FADER_BOTTOM + 8}
                class={styles.brassLine}
                data-part="bracket"
              />
            </Show>
            <text
              x={x(i())}
              y={FADER_BOTTOM + 26}
              text-anchor="middle"
              class={styles.caption}
            >
              {label}
            </text>
          </g>
        )}
      </For>
      <Show when={props.reveal}>
        {(reveal) => (
          <text
            x="260"
            y="212"
            text-anchor="middle"
            class={styles.nameplate}
            data-part="nameplate"
          >
            {reveal().name}
          </text>
        )}
      </Show>
    </svg>
  )
}

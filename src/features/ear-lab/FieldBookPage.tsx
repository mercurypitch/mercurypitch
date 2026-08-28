// ============================================================
// FieldBookPage — the Field Book's instrument: an open page.
//
// The page shows what has been read of a song and nothing more: a
// rule per item kind with a tick per item, the key engraved once it
// is known, and a filling brass line while the reading runs. It
// never shows an answer — the drills have their own instruments.
// ============================================================

import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import styles from './EarInstruments.module.css'

interface FieldBookPageProps {
  /** 0..100 while reading; null once read or before. */
  pct: number | null
  keyName: string | null
  counts: { home: number; echo: number; bassline: number } | null
}

const ROWS: { key: 'home' | 'echo' | 'bassline'; label: string; y: number }[] =
  [
    { key: 'home', label: 'Landings', y: 96 },
    { key: 'echo', label: 'Phrases', y: 136 },
    { key: 'bassline', label: 'Root motions', y: 176 },
  ]

export function FieldBookPage(props: FieldBookPageProps): JSX.Element {
  const ticks = (count: number) => Math.min(24, count)
  return (
    <svg
      viewBox="0 0 520 240"
      role="img"
      aria-label="The Field Book page"
      data-instrument="field-book"
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
      <line x1="90" y1="56" x2="430" y2="56" class={styles.brassLine} />
      <text x="90" y="46" class={styles.captionBrass} data-part="title">
        FIELD BOOK
      </text>
      <Show when={props.keyName}>
        {(keyName) => (
          <text
            x="430"
            y="46"
            text-anchor="end"
            class={styles.nameplate}
            data-part="key"
          >
            {keyName()}
          </text>
        )}
      </Show>
      <For each={ROWS}>
        {(row) => (
          <g data-part="row" data-kind={row.key}>
            <text x="90" y={row.y - 10} class={styles.caption}>
              {row.label}
            </text>
            <line
              x1="90"
              y1={row.y}
              x2="430"
              y2={row.y}
              class={styles.faintLine}
            />
            <Show when={props.counts}>
              {(counts) => (
                <For each={Array.from({ length: ticks(counts()[row.key]) })}>
                  {(_, i) => (
                    <line
                      x1={96 + i() * 14}
                      y1={row.y - 6}
                      x2={96 + i() * 14}
                      y2={row.y}
                      class={styles.brassLine}
                      data-part="tick"
                    />
                  )}
                </For>
              )}
            </Show>
          </g>
        )}
      </For>
      <Show when={props.pct !== null}>
        <line
          x1="90"
          y1="206"
          x2={90 + (340 * (props.pct ?? 0)) / 100}
          y2="206"
          class={styles.brassLine}
          data-part="progress"
        />
      </Show>
    </svg>
  )
}

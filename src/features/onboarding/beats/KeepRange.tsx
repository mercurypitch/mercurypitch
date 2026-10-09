// ============================================================
// Keep — the voiceprint card
// ============================================================
//
// What the singer is being asked to keep, drawn as the thing itself: their
// voice type and range, lit on a keyboard. On a phone the keyboard becomes a
// bar, which still reads at that width where 28 keys would not.
//
// The words carry the facts; the keyboard and the bar are decoration and are
// hidden from assistive technology.

import type { Component } from 'solid-js'
import { createMemo, For, Show } from 'solid-js'
import type { RangeResult } from '@/lib/mirror/metrics'
import keep from '../keep.module.css'

/** White keys only: pitch classes C D E F G A B. */
const WHITE_PCS = [0, 2, 4, 5, 7, 9, 11]
/** Black keys, by the white key they sit after. */
const BLACK_AFTER: Record<number, number> = { 1: 0, 3: 2, 6: 5, 8: 7, 10: 9 }

const KEY_W = 20
const KEY_H = 56
const BLACK_W = 12
const BLACK_H = 32

/** The span the keyboard draws: C2 to B5, widened to whole octaves when a
 *  range reaches past either end. */
export function keyboardSpan(
  range: Pick<RangeResult, 'lowMidi' | 'highMidi'>,
): {
  first: number
  last: number
} {
  const first = Math.min(36, Math.floor(range.lowMidi / 12) * 12)
  const last = Math.max(83, Math.floor(range.highMidi / 12) * 12 + 11)
  return { first, last }
}

/** A white key's place from the left of the span, in keys. */
function whiteIndex(midi: number, first: number): number {
  const octave = Math.floor(midi / 12) - Math.floor(first / 12)
  return octave * 7 + WHITE_PCS.indexOf(((midi % 12) + 12) % 12)
}

/** Left and right edge of a key, in viewBox units. */
function keyEdges(midi: number, first: number): [number, number] {
  const pc = ((midi % 12) + 12) % 12
  const after = BLACK_AFTER[pc]
  if (after === undefined) {
    const x = whiteIndex(midi, first) * KEY_W
    return [x, x + KEY_W]
  }
  const x = (whiteIndex(midi - pc + after, first) + 1) * KEY_W - BLACK_W / 2
  return [x, x + BLACK_W]
}

function voiceType(range: RangeResult): string | null {
  const hint = range.voiceHint?.trim() ?? ''
  return hint === '' ? null : hint.charAt(0).toUpperCase() + hint.slice(1)
}

export const KeepRange: Component<{ range: RangeResult }> = (props) => {
  const span = createMemo(() => keyboardSpan(props.range))
  const keys = createMemo(() => {
    const { first, last } = span()
    const all: { midi: number; black: boolean }[] = []
    for (let midi = first; midi <= last; midi++) {
      all.push({ midi, black: BLACK_AFTER[midi % 12] !== undefined })
    }
    return all
  })
  const width = () => (whiteIndex(span().last, span().first) + 1) * KEY_W
  const lit = (midi: number): boolean =>
    midi >= props.range.lowMidi && midi <= props.range.highMidi
  const lowX = () => keyEdges(props.range.lowMidi, span().first)[0]
  const highX = () => keyEdges(props.range.highMidi, span().first)[1]
  /** The lit stretch as a share of the span, for the phone's bar. */
  const barStart = () => (lowX() / width()) * 100
  const barWidth = () => ((highX() - lowX()) / width()) * 100

  return (
    <div class={keep.rangeCard} data-testid="keep-range">
      <p class={keep.rangeHead}>
        <Show when={voiceType(props.range)}>
          {(type) => <strong class={keep.rangeType}>{type()}</strong>}
        </Show>
        <span class={keep.rangeNotes}>
          {props.range.lowNote} to {props.range.highNote}
        </span>
      </p>

      <svg
        class={keep.rangeKeys}
        viewBox={`0 0 ${width()} ${KEY_H}`}
        aria-hidden="true"
      >
        <defs>
          <linearGradient
            id="keep-range-lit"
            gradientUnits="userSpaceOnUse"
            x1={lowX()}
            x2={highX()}
            y1="0"
            y2="0"
          >
            <stop offset="0" stop-color="#0bd0bf" />
            <stop offset="0.35" stop-color="#14bfd8" />
            <stop offset="0.7" stop-color="#3c80fb" />
            <stop offset="1" stop-color="#8c50f9" />
          </linearGradient>
        </defs>
        <For each={keys().filter((key) => !key.black)}>
          {(key) => (
            <rect
              x={keyEdges(key.midi, span().first)[0]}
              y="0"
              width={KEY_W}
              height={KEY_H}
              class={lit(key.midi) ? keep.keyLit : keep.keyWhite}
            />
          )}
        </For>
        <For each={keys().filter((key) => key.black)}>
          {(key) => (
            <rect
              x={keyEdges(key.midi, span().first)[0]}
              y="0"
              width={BLACK_W}
              height={BLACK_H}
              rx="2"
              class={lit(key.midi) ? keep.keyBlackLit : keep.keyBlack}
            />
          )}
        </For>
        <line
          x1={lowX()}
          x2={lowX()}
          y1="0"
          y2={KEY_H}
          class={keep.rangeEndLow}
        />
        <line
          x1={highX()}
          x2={highX()}
          y1="0"
          y2={KEY_H}
          class={keep.rangeEndHigh}
        />
        <circle cx={lowX()} cy={KEY_H / 2} r="7" class={keep.rangeDotLow} />
        <circle cx={highX()} cy={KEY_H / 2} r="7" class={keep.rangeDotHigh} />
      </svg>

      <span class={keep.rangeBar} aria-hidden="true">
        <span
          class={keep.rangeBarLit}
          style={{ left: `${barStart()}%`, width: `${barWidth()}%` }}
        />
      </span>
    </div>
  )
}

export default KeepRange

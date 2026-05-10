// ============================================================
// NoteList — Displays melody notes with accuracy band colors
// ============================================================

import type { Component } from 'solid-js'
import { createMemo, For, Show } from 'solid-js'
import { centsToBand } from '@/lib/practice-engine'
import type { MelodyItem, NoteResult } from '@/types'

interface NoteListProps {
  melody: () => MelodyItem[]
  currentNoteIndex: () => number
  noteResults: () => NoteResult[]
  isPlaying: () => boolean
}

const BAND_CLASSES: Record<number | 'off', string> = {
  100: 'band-perfect',
  90: 'band-excellent',
  75: 'band-good',
  50: 'band-okay',
  0: 'band-off',
  off: 'band-off',
}

export const NoteList: Component<NoteListProps> = (props) => {
  // Map playable-note index → result band. Synthetic rest blocks are
  // present in the view melody for Spaced mode, but they do not produce
  // NoteResult entries, so we count only non-rest items.
  const bandMap = createMemo(() => {
    const map = new Map<number, { band: number | 'off'; pct: number }>()
    for (let i = 0; i < props.noteResults().length; i++) {
      const r = props.noteResults()[i]
      const band = centsToBand(r.avgCents)
      const pct = Math.round(Math.max(0, 100 - r.avgCents * 2))
      map.set(i, { band, pct })
    }
    return map
  })

  const playableIndexFor = (absoluteIndex: number): number =>
    props
      .melody()
      .slice(0, absoluteIndex + 1)
      .filter((item) => item.isRest !== true).length - 1

  return (
    <div id="note-list">
      <For each={props.melody()}>
        {(item, index) => {
          const absoluteIndex = () => index()
          const isRest = item.isRest === true
          const playableIndex = () =>
            isRest ? -1 : playableIndexFor(absoluteIndex())
          const midi = item.note.midi
          const isActive = () => {
            if (!props.isPlaying()) return false
            return absoluteIndex() === props.currentNoteIndex()
          }
          const bandEntry = () =>
            playableIndex() >= 0 ? bandMap().get(playableIndex()) : undefined
          const bandCls = () => {
            const e = bandEntry()
            return e !== undefined ? BAND_CLASSES[e.band] : ''
          }
          const pct = () => {
            const e = bandEntry()
            return e !== undefined ? e.pct : null
          }

          return (
            <div
              class={`note-item ${isRest ? 'rest-item' : ''} ${isActive() ? 'active' : ''} ${bandCls()}`}
              data-midi={midi}
            >
              <div class="note-dot" />
              <span class="note-name">
                {isRest ? 'Rest' : `${item.note.name}${item.note.octave}`}
              </span>
              <span class="note-freq">
                {isRest
                  ? `${item.duration} beat${item.duration === 1 ? '' : 's'}`
                  : `${item.note.freq.toFixed(0)}Hz`}
              </span>
              <Show when={pct() !== null}>
                <span class="note-accuracy-pct">{pct()}%</span>
              </Show>
            </div>
          )
        }}
      </For>
    </div>
  )
}

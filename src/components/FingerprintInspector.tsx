// ============================================================
// FingerprintInspector — Select and inspect any fingerprint
//
// Dropdown selector listing all library melodies and uploaded
// stem fingerprints. Selecting one shows its full signature:
// notes, intervals, chroma distribution, and metadata.
// ============================================================

import { createMemo, createSignal, For, Show } from 'solid-js'
import { SafeSelect } from '@/components/shared/SafeSelect'
import { midiToNote } from '@/lib/scale-data'
import { getFingerprintArray } from '@/lib/shazam/melody-fingerprints'
import type { MelodyFingerprint } from '@/lib/shazam/types'
import styles from './FingerprintInspector.module.css'

const CHROMA_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
]

export function FingerprintInspector() {
  const [selectedId, setSelectedId] = createSignal<string | null>(null)

  const fingerprints = createMemo(() => {
    const all = getFingerprintArray()
    return all.slice().sort((a, b) => {
      const aStem = a.melodyId.startsWith('stem:')
      const bStem = b.melodyId.startsWith('stem:')
      if (aStem !== bStem) return aStem ? -1 : 1
      return a.name.localeCompare(b.name)
    })
  })

  const selected = createMemo<MelodyFingerprint | null>(() => {
    const id = selectedId()
    if (id === null || id === '') return null
    return fingerprints().find((fp) => fp.melodyId === id) ?? null
  })

  const referenceNotes = createMemo(() => {
    const fp = selected()
    if (!fp) return []
    return fp.pitchSequence.map((m) => {
      if (m == null || Number.isNaN(m)) return { midi: 0, label: 'Rest' }
      const n = midiToNote(m)
      return { midi: m, label: `${n.name}${n.octave}` }
    })
  })

  const MAX_INTERVAL_DISPLAY = 30

  const intervalDisplay = createMemo(() => {
    const fp = selected()
    if (!fp) return ''
    const first = fp.intervalSequence.slice(0, MAX_INTERVAL_DISPLAY)
    let text = first.map((d) => (d >= 0 ? `+${d}` : `${d}`)).join(', ')
    if (fp.intervalSequence.length > MAX_INTERVAL_DISPLAY) {
      text += `, +${fp.intervalSequence.length - MAX_INTERVAL_DISPLAY} more`
    }
    return text
  })

  const chromaBars = createMemo(() => {
    const fp = selected()
    if (!fp) return new Array(12).fill(0)
    const counts = new Array(12).fill(0)
    for (const c of fp.chromaSequence) {
      if (c >= 0 && c < 12) counts[c]++
    }
    const max = Math.max(...counts, 1)
    return counts.map((n) => n / max)
  })

  function handleChange(e: Event & { currentTarget: HTMLSelectElement }) {
    setSelectedId(e.currentTarget.value || null)
  }

  return (
    <div class={styles.panel} data-testid="fingerprint-inspector">
      <h4 class={styles.heading}>Reference Fingerprint</h4>

      <SafeSelect
        class={styles.select}
        value={selectedId() ?? ''}
        onChange={handleChange}
        data-testid="fingerprint-select"
      >
        <option value="">-- Select a fingerprint --</option>
        <For each={fingerprints()}>
          {(fp) => (
            <option value={fp.melodyId}>
              {fp.melodyId.startsWith('stem:') ? '[Upload]' : '[Library]'}{' '}
              {fp.name}
            </option>
          )}
        </For>
      </SafeSelect>

      <Show
        when={selected()}
        fallback={
          <div class={styles.emptyState}>
            Select a melody or stem to inspect its fingerprint
          </div>
        }
      >
        <div class={styles.detailCard}>
          <div class={styles.detailHeader}>
            <span class={styles.detailName}>{selected()!.name}</span>
            <span
              class={`${styles.sourceBadge} ${selected()!.melodyId.startsWith('stem:') ? styles.sourceStem : styles.sourceLibrary}`}
            >
              {selected()!.melodyId.startsWith('stem:') ? 'Upload' : 'Library'}
            </span>
          </div>
          <div class={styles.melodyId}>{selected()!.melodyId}</div>

          <div class={styles.metaGrid}>
            <div class={styles.metaItem}>
              <span class={styles.metaLabel}>BPM</span>
              <span class={styles.metaValue}>{selected()!.bpm}</span>
            </div>
            <div class={styles.metaItem}>
              <span class={styles.metaLabel}>Key</span>
              <span class={styles.metaValue}>{selected()!.key}</span>
            </div>
            <div class={styles.metaItem}>
              <span class={styles.metaLabel}>Notes</span>
              <span class={styles.metaValue}>{selected()!.noteCount}</span>
            </div>
            <div class={styles.metaItem}>
              <span class={styles.metaLabel}>Duration</span>
              <span class={styles.metaValue}>
                {selected()!.durationSec.toFixed(1)}s
              </span>
            </div>
          </div>

          <div>
            <div class={styles.sectionLabel}>Note Sequence</div>
            <div class={styles.noteRow}>
              <For each={referenceNotes().slice(0, 50)}>
                {(note) => <span class={styles.notePill}>{note.label}</span>}
              </For>
              <Show when={referenceNotes().length > 50}>
                <span class={styles.noteMore}>
                  +{referenceNotes().length - 50} more
                </span>
              </Show>
            </div>
          </div>

          <div>
            <div class={styles.sectionLabel}>Intervals</div>
            <div class={styles.intervalText}>{intervalDisplay()}</div>
          </div>

          <div>
            <div class={styles.sectionLabel}>Chroma Distribution</div>
            <div class={styles.chromaGrid}>
              <For each={chromaBars()}>
                {(height, i) => (
                  <div
                    class={styles.chromaBar}
                    style={{ height: `${(height * 100).toFixed(0)}%` }}
                    title={`${CHROMA_NAMES[i()]}: ${(height * 100).toFixed(0)}%`}
                  />
                )}
              </For>
            </div>
          </div>
        </div>
      </Show>
    </div>
  )
}

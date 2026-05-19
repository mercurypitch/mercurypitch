// ============================================================
// ShazamDebugPanel — Diagnostics view for match internals
//
// Shows reference fingerprint vs user recording side-by-side:
// per-feature scores, note sequence comparison, and metadata.
// Only accessible when IS_DEV is true.
// ============================================================

import { For, Show } from 'solid-js'
import { midiToNote } from '@/lib/scale-data'
import type { LivePitchContour, MatchCandidate, MelodyFingerprint, } from '@/lib/shazam/types'
import styles from './ShazamDebugPanel.module.css'

interface ShazamDebugPanelProps {
  candidate: MatchCandidate
  referenceFingerprint: MelodyFingerprint | null
  liveContour: LivePitchContour | null
  hummingNormalized: boolean
}

export function ShazamDebugPanel(props: ShazamDebugPanelProps) {
  const breakdown = () => props.candidate.breakdown
  const ref = () => props.referenceFingerprint
  const user = () => props.liveContour

  const noteCountRatio = (): string => {
    const r = ref()
    const u = user()
    if (!r || !u || r.noteCount === 0) return '—'
    const ratio = u.noteSequence.length / r.noteCount
    return `${ratio.toFixed(2)} (user: ${u.noteSequence.length}, ref: ${r.noteCount})`
  }

  const durationRatio = (): string => {
    const r = ref()
    const u = user()
    if (!r || !u || r.durationSec === 0) return '—'
    const ratio = u.durationSec / r.durationSec
    return `${ratio.toFixed(2)} (user: ${u.durationSec.toFixed(1)}s, ref: ${r.durationSec.toFixed(1)}s)`
  }

  const referenceNotes = (): Array<{ midi: number; label: string }> => {
    const r = ref()
    if (!r) return []
    return r.pitchSequence.map((m) => {
      if (m == null || Number.isNaN(m)) return { midi: 0, label: 'Rest' }
      const n = midiToNote(m)
      return { midi: m, label: `${n.name}${n.octave}` }
    })
  }

  const userNotes = (): Array<{ midi: number; label: string }> => {
    const u = user()
    if (!u) return []
    return u.noteSequence.map((m) => {
      if (m == null || Number.isNaN(m)) return { midi: 0, label: 'Rest' }
      const n = midiToNote(m)
      return { midi: m, label: `${n.name}${n.octave}` }
    })
  }

  const scoreBar = (label: string, value: number, fillClass: string) => (
    <div class={styles.scoreRow}>
      <span class={styles.scoreLabel}>{label}</span>
      <div class={styles.scoreTrack}>
        <div
          class={`${styles.scoreFill} ${fillClass}`}
          style={{ width: `${(value * 100).toFixed(0)}%` }}
        />
      </div>
      <span class={styles.scoreValue}>{(value * 100).toFixed(0)}%</span>
    </div>
  )

  return (
    <div class={styles.panel} data-testid="shazam-debug-panel">
      <h4 class={styles.heading}>Debug — Match Diagnostics</h4>

      {/* Per-feature scores */}
      <div class={styles.scores}>
        {scoreBar('Pitch', breakdown().pitchScore, styles.scoreFillPitch)}
        {scoreBar(
          'Interval',
          breakdown().intervalScore,
          styles.scoreFillInterval,
        )}
        {scoreBar('Chroma', breakdown().chromaScore, styles.scoreFillChroma)}
        {scoreBar('Rhythm', breakdown().rhythmScore, styles.scoreFillRhythm)}
        {scoreBar('Length', breakdown().lengthBonus, styles.scoreFillLength)}
      </div>

      {/* Note sequence comparison */}
      <div class={styles.noteSection}>
        <div class={styles.noteSectionLabel}>
          Reference Notes ({ref()?.noteCount ?? 0})
        </div>
        <div class={styles.noteRow}>
          <For each={referenceNotes()}>
            {(note) => (
              <span class={`${styles.notePill} ${styles.notePillRef}`}>
                {note.label}
              </span>
            )}
          </For>
          <Show when={referenceNotes().length === 0}>
            <span class={styles.notePill} style={{ color: '#64748b' }}>
              No reference
            </span>
          </Show>
        </div>

        <div class={styles.noteSectionLabel}>
          Your Notes ({user()?.noteSequence.length ?? 0})
        </div>
        <div class={styles.noteRow}>
          <For each={userNotes()}>
            {(note) => (
              <span class={`${styles.notePill} ${styles.notePillUser}`}>
                {note.label}
              </span>
            )}
          </For>
          <Show when={userNotes().length === 0}>
            <span class={styles.notePill} style={{ color: '#64748b' }}>
              No recording
            </span>
          </Show>
        </div>
      </div>

      {/* Metadata */}
      <div class={styles.meta}>
        <div class={styles.metaItem}>
          <span class={styles.metaLabel}>Confidence</span>
          <span class={styles.metaValue}>{props.candidate.confidence}%</span>
        </div>
        <div class={styles.metaItem}>
          <span class={styles.metaLabel}>Source</span>
          <span class={styles.metaValue}>
            {props.candidate.source === 'stem' ? 'User Upload' : 'Library'}
          </span>
        </div>
        <div class={styles.metaItem}>
          <span class={styles.metaLabel}>Humming Norm</span>
          <span
            class={
              props.hummingNormalized
                ? styles.metaValueActive
                : styles.metaValueInactive
            }
          >
            {props.hummingNormalized ? 'Applied' : 'Not applied'}
          </span>
        </div>
        <div class={styles.metaItem}>
          <span class={styles.metaLabel}>Ref BPM</span>
          <span class={styles.metaValue}>{ref()?.bpm ?? '—'}</span>
        </div>
        <div class={styles.metaItem}>
          <span class={styles.metaLabel}>Note Count Ratio</span>
          <span class={styles.metaValue}>{noteCountRatio()}</span>
        </div>
        <div class={styles.metaItem}>
          <span class={styles.metaLabel}>Duration Ratio</span>
          <span class={styles.metaValue}>{durationRatio()}</span>
        </div>
      </div>
    </div>
  )
}

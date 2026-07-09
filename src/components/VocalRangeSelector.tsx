import type { Component } from 'solid-js'
import { createMemo, createSignal, Show } from 'solid-js'
import type { VocalRangeResult } from '@/lib/vocal-analyzer'
import { detectVocalRange } from '@/lib/vocal-analyzer'
import { getSessionHistory } from '@/stores/practice-session-store'
import { setVocalRangePreset, vocalRangePreset } from '@/stores/settings-store'
import styles from './TierSelector.module.css'

interface VocalRangeSelectorProps {
  class?: string
}

export const VocalRangeSelector: Component<VocalRangeSelectorProps> = (
  props,
) => {
  const [detectedRange, setDetectedRange] =
    createSignal<VocalRangeResult | null>(null)

  // Collect MIDI notes from session history for auto-detection
  const midiHistory = createMemo(() => {
    const history = getSessionHistory()
    const midis: number[] = []
    for (const session of history) {
      for (const pr of session.practiceItemResult) {
        for (const nr of pr.noteResult) {
          if (nr.item?.note?.midi !== undefined && nr.item.note.midi > 0) {
            midis.push(nr.item.note.midi)
          }
        }
      }
    }
    return midis
  })

  const handleAutoDetect = () => {
    const result = detectVocalRange(midiHistory())
    setDetectedRange(result)
    if (result.confident && result.voiceType !== 'unknown') {
      setVocalRangePreset(result.voiceType)
    }
  }

  return (
    <div class={`${styles.tierSelector} ${props.class ?? ''}`}>
      {/* Auto-detect button */}
      <Show when={midiHistory().length >= 10}>
        <button
          class={`${styles.tierBtn} ${styles.tierAuto}`}
          onClick={handleAutoDetect}
          title="Auto-detect from your singing history"
          style={{
            width: '100%',
            'margin-bottom': '0.5rem',
            'justify-content': 'center',
            gap: '8px',
          }}
        >
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <span class={styles.tierName}>
            {detectedRange()?.confident === true
              ? `Auto: ${detectedRange()!.voiceType} (${detectedRange()!.lowNote}–${detectedRange()!.highNote})`
              : detectedRange() !== null
                ? `Not enough data (${midiHistory().length} notes)`
                : `Auto-Detect (${midiHistory().length} notes)`}
          </span>
        </button>
      </Show>

      <div
        class={styles.tierButtons}
        style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; margin-top: 0.5rem;"
      >
        <button
          class={`${styles.tierBtn} ${styles.tierSoprano}${vocalRangePreset() === 'soprano' ? ` ${styles.tierActive}` : ''}`}
          onClick={() => setVocalRangePreset('soprano')}
          title="High Female Voice (C4-C6)"
        >
          <span class={styles.tierIconWrap}>
            <svg
              viewBox="0 0 24 24"
              width="22"
              height="22"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M12 4v16M8 8l4-4 4 4" />
              <path d="M4 12h16" />
            </svg>
          </span>
          <span class={styles.tierName}>Soprano</span>
        </button>

        <button
          class={`${styles.tierBtn} ${styles.tierMezzo}${vocalRangePreset() === 'mezzo-soprano' ? ` ${styles.tierActive}` : ''}`}
          onClick={() => setVocalRangePreset('mezzo-soprano')}
          title="Mid-High Female Voice (A3-A5)"
        >
          <span class={styles.tierIconWrap}>
            <svg
              viewBox="0 0 24 24"
              width="22"
              height="22"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M12 7v14M9 10l3-3 3 3" />
              <path d="M6 14h12" />
            </svg>
          </span>
          <span class={styles.tierName} style="font-size: 0.8rem">
            Mezzo
          </span>
        </button>

        <button
          class={`${styles.tierBtn} ${styles.tierAlto}${vocalRangePreset() === 'alto' ? ` ${styles.tierActive}` : ''}`}
          onClick={() => setVocalRangePreset('alto')}
          title="Low Female Voice (F3-F5)"
        >
          <span class={styles.tierIconWrap}>
            <svg
              viewBox="0 0 24 24"
              width="22"
              height="22"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M12 10v10M10 12l2-2 2 2" />
              <path d="M8 16h8" />
            </svg>
          </span>
          <span class={styles.tierName}>Alto</span>
        </button>

        <button
          class={`${styles.tierBtn} ${styles.tierTenor}${vocalRangePreset() === 'tenor' ? ` ${styles.tierActive}` : ''}`}
          onClick={() => setVocalRangePreset('tenor')}
          title="High Male Voice (C3-C5)"
        >
          <span class={styles.tierIconWrap}>
            <svg
              viewBox="0 0 24 24"
              width="22"
              height="22"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M12 14V4M10 12l2 2 2-2" />
              <path d="M8 8h8" />
            </svg>
          </span>
          <span class={styles.tierName}>Tenor</span>
        </button>

        <button
          class={`${styles.tierBtn} ${styles.tierBaritone}${vocalRangePreset() === 'baritone' ? ` ${styles.tierActive}` : ''}`}
          onClick={() => setVocalRangePreset('baritone')}
          title="Mid Male Voice (G2-G4)"
        >
          <span class={styles.tierIconWrap}>
            <svg
              viewBox="0 0 24 24"
              width="22"
              height="22"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M12 17V7M9 14l3 3 3-3" />
              <path d="M6 10h12" />
            </svg>
          </span>
          <span class={styles.tierName} style="font-size: 0.8rem">
            Baritone
          </span>
        </button>

        <button
          class={`${styles.tierBtn} ${styles.tierBass}${vocalRangePreset() === 'bass' ? ` ${styles.tierActive}` : ''}`}
          onClick={() => setVocalRangePreset('bass')}
          title="Low Male Voice (E2-E4)"
        >
          <span class={styles.tierIconWrap}>
            <svg
              viewBox="0 0 24 24"
              width="22"
              height="22"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M12 20V4M8 16l4 4 4-4" />
              <path d="M4 12h16" />
            </svg>
          </span>
          <span class={styles.tierName}>Bass</span>
        </button>
      </div>
    </div>
  )
}

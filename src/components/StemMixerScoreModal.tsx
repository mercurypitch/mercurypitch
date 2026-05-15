// ============================================================
// StemMixerScoreModal — scoring overlay shown after mic playback
// ============================================================

import type { Component } from 'solid-js'
import type { Accessor } from 'solid-js'
import { Show } from 'solid-js'

interface MicScore {
  totalNotes: number
  matchedNotes: number
  accuracyPct: number
  avgCentsOff: number
  grade: 'S' | 'A' | 'B' | 'C' | 'D'
}

interface StemMixerScoreModalProps {
  showScore: Accessor<boolean>
  score: Accessor<MicScore | null>
  onClose: () => void
}

export const StemMixerScoreModal: Component<StemMixerScoreModalProps> = (
  props,
) => {
  return (
    <Show when={props.showScore() && props.score()}>
      <div class="sm-mic-score-overlay" onClick={() => props.onClose()}>
        <div class="sm-mic-score-card" onClick={(e) => e.stopPropagation()}>
          <div class="sm-mic-score-card-inner">
            <button
              class="sm-mic-score-close"
              onClick={() => props.onClose()}
              aria-label="Close score"
            >
              <svg
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <div class="sm-mic-score-grade-row">
              <span
                class={`sm-mic-grade sm-mic-grade--${props.score()!.grade.toLowerCase()}`}
              >
                {props.score()!.grade}
              </span>
              <div class="sm-mic-score-stats">
                <span class="sm-mic-score-accuracy">
                  {props.score()!.accuracyPct}% accuracy
                </span>
                <span class="sm-mic-score-detail">
                  {props.score()!.matchedNotes}/{props.score()!.totalNotes}{' '}
                  notes in tolerance
                </span>
                <span class="sm-mic-score-detail">
                  ±{props.score()!.avgCentsOff}¢ avg deviation
                </span>
              </div>
            </div>
            <button class="sm-mic-score-ok-btn" onClick={() => props.onClose()}>
              OK
            </button>
          </div>
        </div>
      </div>
    </Show>
  )
}

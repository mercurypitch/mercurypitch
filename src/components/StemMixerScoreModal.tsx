// ============================================================
// StemMixerScoreModal — scoring overlay shown after mic playback
// ============================================================
//
// Visual language matches the karaoke playlist summary (gradient card,
// grade colors) and the Voice Mirror result cards (rounded stat pills).

import type { Component } from 'solid-js'
import type { Accessor } from 'solid-js'
import { Show } from 'solid-js'
import type { MicScore } from '@/lib/mic-scoring'

interface StemMixerScoreModalProps {
  showScore: Accessor<boolean>
  score: Accessor<MicScore | null>
  onClose: () => void
}

const GRADE_LABEL: Record<MicScore['grade'], string> = {
  S: 'Superb',
  A: 'Great take',
  B: 'Good take',
  C: 'Getting there',
  D: 'Keep practicing',
}

export const StemMixerScoreModal: Component<StemMixerScoreModalProps> = (
  props,
) => {
  return (
    <Show when={props.showScore() && props.score()}>
      <div class="sm-mic-score-overlay" onClick={() => props.onClose()}>
        <div class="sm-mic-score-card" onClick={(e) => e.stopPropagation()}>
          <button
            class="sm-mic-score-close"
            onClick={() => props.onClose()}
            aria-label="Close score"
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
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

          <div
            class={`sm-mic-grade sm-mic-grade--${props.score()!.grade.toLowerCase()}`}
          >
            {props.score()!.grade}
          </div>
          <div class="sm-mic-score-verdict">
            {GRADE_LABEL[props.score()!.grade]}
          </div>

          <div class="sm-mic-score-accuracy">
            {props.score()!.accuracyPct}
            <span class="sm-mic-score-accuracy-unit">%</span>
          </div>
          <div class="sm-mic-score-accuracy-label">pitch accuracy</div>

          <div class="sm-mic-score-pills">
            <Show when={(props.score()!.notesTotal ?? 0) > 0}>
              <span class="sm-mic-score-pill">
                <svg
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  fill="currentColor"
                  stroke="none"
                >
                  <ellipse cx="7" cy="19" rx="4" ry="3" />
                  <rect x="10" y="4" width="2.5" height="15" rx="1" />
                  <path d="M12.5 4 C14 4, 19 3, 20 8 C21 12, 17 11, 12.5 10 Z" />
                </svg>
                <strong>
                  {props.score()!.notesHit}/{props.score()!.notesTotal}
                </strong>
                notes hit
              </span>
            </Show>
            <span class="sm-mic-score-pill">
              <svg
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              >
                <path d="M2 14l4-5 4 4 4-8 4 6 4-3" />
              </svg>
              <strong>
                {props.score()!.matchedNotes}/{props.score()!.totalNotes}
              </strong>
              samples in tune
            </span>
            <span class="sm-mic-score-pill">
              <svg
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              >
                <path d="M12 3v18" />
                <path d="M7 8l5-5 5 5" />
                <path d="M7 16l5 5 5-5" />
              </svg>
              <strong>±{props.score()!.avgCentsOff}¢</strong>
              avg deviation
            </span>
          </div>

          <button class="sm-mic-score-ok-btn" onClick={() => props.onClose()}>
            OK
          </button>
        </div>
      </div>
    </Show>
  )
}

import type { Component } from 'solid-js'
import { setVocalRangePreset, vocalRangePreset } from '@/stores/settings-store'

interface VocalRangeSelectorProps {
  class?: string
}

export const VocalRangeSelector: Component<VocalRangeSelectorProps> = (props) => {
  return (
    <div class={`tier-selector ${props.class ?? ''}`}>
      <div class="welcome-tier-buttons" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; margin-top: 0.5rem;">
        <button
          class={`welcome-tier-btn welcome-tier-soprano${vocalRangePreset() === 'soprano' ? ' tier-active' : ''}`}
          onClick={() => setVocalRangePreset('soprano')}
          title="High Female Voice (C4-C6)"
        >
          <span class="tier-icon-wrap">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 4v16M8 8l4-4 4 4" />
              <path d="M4 12h16" />
            </svg>
          </span>
          <span class="tier-name">Soprano</span>
        </button>

        <button
          class={`welcome-tier-btn welcome-tier-mezzo${vocalRangePreset() === 'mezzo-soprano' ? ' tier-active' : ''}`}
          onClick={() => setVocalRangePreset('mezzo-soprano')}
          title="Mid-High Female Voice (A3-A5)"
        >
          <span class="tier-icon-wrap">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 7v14M9 10l3-3 3 3" />
              <path d="M6 14h12" />
            </svg>
          </span>
          <span class="tier-name" style="font-size: 0.8rem">Mezzo</span>
        </button>

        <button
          class={`welcome-tier-btn welcome-tier-alto${vocalRangePreset() === 'alto' ? ' tier-active' : ''}`}
          onClick={() => setVocalRangePreset('alto')}
          title="Low Female Voice (F3-F5)"
        >
          <span class="tier-icon-wrap">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 10v10M10 12l2-2 2 2" />
              <path d="M8 16h8" />
            </svg>
          </span>
          <span class="tier-name">Alto</span>
        </button>

        <button
          class={`welcome-tier-btn welcome-tier-tenor${vocalRangePreset() === 'tenor' ? ' tier-active' : ''}`}
          onClick={() => setVocalRangePreset('tenor')}
          title="High Male Voice (C3-C5)"
        >
          <span class="tier-icon-wrap">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 14V4M10 12l2 2 2-2" />
              <path d="M8 8h8" />
            </svg>
          </span>
          <span class="tier-name">Tenor</span>
        </button>

        <button
          class={`welcome-tier-btn welcome-tier-baritone${vocalRangePreset() === 'baritone' ? ' tier-active' : ''}`}
          onClick={() => setVocalRangePreset('baritone')}
          title="Mid Male Voice (G2-G4)"
        >
          <span class="tier-icon-wrap">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 17V7M9 14l3 3 3-3" />
              <path d="M6 10h12" />
            </svg>
          </span>
          <span class="tier-name" style="font-size: 0.8rem">Baritone</span>
        </button>

        <button
          class={`welcome-tier-btn welcome-tier-bass${vocalRangePreset() === 'bass' ? ' tier-active' : ''}`}
          onClick={() => setVocalRangePreset('bass')}
          title="Low Male Voice (E2-E4)"
        >
          <span class="tier-icon-wrap">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 20V4M8 16l4 4 4-4" />
              <path d="M4 12h16" />
            </svg>
          </span>
          <span class="tier-name">Bass</span>
        </button>
      </div>
    </div>
  )
}

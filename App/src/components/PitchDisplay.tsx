// ============================================================
// PitchDisplay — Shows detected pitch with accuracy feedback
// ============================================================

import { Component, createSignal, createMemo, Show } from 'solid-js';
import type { PitchResult, AccuracyRating } from '@/types';

interface PitchDisplayProps {
  pitch: () => PitchResult | null;
  targetNote: () => string;
  rating?: () => AccuracyRating;
}

const RATING_COLORS: Record<AccuracyRating, string> = {
  perfect: '#22c55e',
  excellent: '#4ade80',
  good: '#facc15',
  okay: '#fb923c',
  off: '#f87171',
};

const RATING_LABELS: Record<AccuracyRating, string> = {
  perfect: 'Perfect!',
  excellent: 'Excellent',
  good: 'Good',
  okay: 'Okay',
  off: 'Off pitch',
};

export const PitchDisplay: Component<PitchDisplayProps> = (props) => {
  const noteName = createMemo(() => {
    const p = props.pitch();
    if (!p || !p.noteName) return '--';
    return `${p.noteName}${p.octave}`;
  });

  const centsDisplay = createMemo(() => {
    const p = props.pitch();
    if (!p || !p.noteName) return '';
    const sign = p.cents >= 0 ? '+' : '';
    return `${sign}${p.cents}¢`;
  });

  const clarity = createMemo(() => {
    const p = props.pitch();
    if (!p) return 0;
    return Math.round(p.clarity * 100);
  });

  const barWidth = createMemo(() => {
    const p = props.pitch();
    if (!p || !p.noteName) return 50; // center
    // Map cents (-50 to +50) to percentage (0 to 100)
    const pct = Math.round(((p.cents + 50) / 100) * 100);
    return Math.max(0, Math.min(100, pct));
  });

  const ratingLabel = createMemo(() => {
    const r = props.rating?.();
    return r ? RATING_LABELS[r] : null;
  });

  const ratingColor = createMemo(() => {
    const r = props.rating?.();
    return r ? RATING_COLORS[r] : '#888';
  });

  return (
    <div class="pitch-display">
      <div class="pitch-note">
        <span class="pitch-note-name">{noteName()}</span>
        <Show when={centsDisplay()}>
          <span class="pitch-cents">{centsDisplay()}</span>
        </Show>
      </div>

      <div class="pitch-clarity-bar">
        <div class="pitch-clarity-track">
          <div class="pitch-center-mark" />
          <div
            class="pitch-clarity-fill"
            style={{ width: `${barWidth()}%`, 'background-color': ratingColor() }}
          />
        </div>
      </div>

      <Show when={ratingLabel()}>
        <div class="pitch-rating" style={{ color: ratingColor() }}>
          {ratingLabel()}
        </div>
      </Show>

      <div class="pitch-clarity-pct">{clarity()}% clarity</div>
    </div>
  );
};

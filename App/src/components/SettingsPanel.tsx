// ============================================================
// Settings Panel — Pitch detection and accuracy configuration
// ============================================================

import { Component, createMemo, For } from 'solid-js';
import { appStore } from '@/stores/app-store';

export const SettingsPanel: Component = () => {
  const s = () => appStore.settings();

  // Map bands array to display format (perfect=100, excellent=90, good=75, okay=50)
  const bandLabels = ['Perfect', 'Excellent', 'Good', 'Okay'];

  const bandValues = createMemo(() => {
    const bands = s().bands;
    return {
      perfect:    bands.find(b => b.band === 100)?.threshold ?? 0,
      excellent:  bands.find(b => b.band === 90)?.threshold ?? 10,
      good:       bands.find(b => b.band === 75)?.threshold ?? 25,
      okay:       bands.find(b => b.band === 50)?.threshold ?? 50,
    };
  });

  const handleBandChange = (band: 'perfect' | 'excellent' | 'good' | 'okay', value: string) => {
    const num = parseInt(value, 10) || 0;
    const idx = s().bands.findIndex(b => b.band === (band === 'perfect' ? 100 : band === 'excellent' ? 90 : band === 'good' ? 75 : 50));
    if (idx >= 0) {
      appStore.setBand(idx, num);
    }
  };

  return (
    <div class="settings-panel">
      <div class="settings-content">
        <h2 class="settings-title">Settings</h2>

        {/* Pitch Detection Section */}
        <div class="settings-section">
          <h3 class="settings-section-title">Pitch Detection</h3>

          <div class="settings-row">
            <label for="set-threshold">Detection Threshold</label>
            <input
              type="range"
              id="set-threshold"
              min="5"
              max="20"
              step="1"
              value={Math.round(s().detectionThreshold * 100)}
              onInput={(e) => appStore.setDetectionThreshold(parseInt(e.currentTarget.value) / 100)}
            />
            <span class="settings-val">{s().detectionThreshold.toFixed(2)}</span>
            <small>Lower = stricter pitch detection</small>
          </div>

          <div class="settings-row">
            <label for="set-sensitivity">Sensitivity</label>
            <input
              type="range"
              id="set-sensitivity"
              min="1"
              max="10"
              step="1"
              value={s().sensitivity}
              onInput={(e) => appStore.setSensitivity(parseInt(e.currentTarget.value))}
            />
            <span class="settings-val">{s().sensitivity}</span>
            <small>Higher = more responsive to quiet signals</small>
          </div>

          <div class="settings-row">
            <label for="set-min-confidence">Min Confidence</label>
            <input
              type="range"
              id="set-min-confidence"
              min="30"
              max="90"
              step="5"
              value={Math.round(s().minConfidence * 100)}
              onInput={(e) => appStore.setMinConfidence(parseInt(e.currentTarget.value) / 100)}
            />
            <span class="settings-val">{Math.round(s().minConfidence * 100)}%</span>
            <small>Minimum confidence to accept a pitch</small>
          </div>

          <div class="settings-row">
            <label for="set-amplitude">Min Amplitude</label>
            <input
              type="range"
              id="set-amplitude"
              min="1"
              max="10"
              step="1"
              value={s().minAmplitude}
              onInput={(e) => appStore.setMinAmplitude(parseInt(e.currentTarget.value))}
            />
            <span class="settings-val">{s().minAmplitude}</span>
            <small>Minimum signal loudness required</small>
          </div>
        </div>

        {/* Accuracy Bands Section */}
        <div class="settings-section">
          <h3 class="settings-section-title">Accuracy Bands</h3>
          <p class="settings-desc">Define how many cents off is "Perfect", "Good", etc.</p>

          <div class="settings-row">
            <label for="band-perfect">Perfect (&le; cents)</label>
            <input
              type="number"
              id="band-perfect"
              min="1"
              max="50"
              value={bandValues().perfect}
              onInput={(e) => handleBandChange('perfect', e.currentTarget.value)}
            />
          </div>

          <div class="settings-row">
            <label for="band-excellent">Excellent (&le; cents)</label>
            <input
              type="number"
              id="band-excellent"
              min="1"
              max="100"
              value={bandValues().excellent}
              onInput={(e) => handleBandChange('excellent', e.currentTarget.value)}
            />
          </div>

          <div class="settings-row">
            <label for="band-good">Good (&le; cents)</label>
            <input
              type="number"
              id="band-good"
              min="1"
              max="100"
              value={bandValues().good}
              onInput={(e) => handleBandChange('good', e.currentTarget.value)}
            />
          </div>

          <div class="settings-row">
            <label for="band-okay">Okay (&le; cents)</label>
            <input
              type="number"
              id="band-okay"
              min="1"
              max="200"
              value={bandValues().okay}
              onInput={(e) => handleBandChange('okay', e.currentTarget.value)}
            />
          </div>
        </div>

        {/* Current Values Section */}
        <div class="settings-section">
          <h3 class="settings-section-title">Current Values</h3>
          <div class="settings-info">
            <div>Threshold: <span>{s().detectionThreshold.toFixed(2)}</span></div>
            <div>Sensitivity: <span>{s().sensitivity}</span></div>
            <div>Min Confidence: <span>{Math.round(s().minConfidence * 100)}%</span></div>
            <div>Min Amplitude: <span>{s().minAmplitude}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
};

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

        {/* Practice Aids Section */}
        <div class="settings-section">
          <h3 class="settings-section-title">Practice Aids</h3>

          <div class="settings-row">
            <label for="set-tonic-anchor">Tonic Anchor Tone</label>
            <input
              type="checkbox"
              id="set-tonic-anchor"
              checked={s().tonicAnchor}
              onChange={(e) => appStore.setTonicAnchor(e.currentTarget.checked)}
            />
            <small>Play a reference tone at the start of each run to help lock in to the key</small>
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
     
        {/* ADSR Envelope Section */}
        <div class="settings-section">
          <h3 class="settings-section-title">Tone Envelope (ADSR)</h3>
          <p class="settings-desc">Adjust the Attack, Decay, Sustain, Release envelope for note playback.</p>

          <div class="settings-row">
            <label for="adsr-attack">Attack</label>
            <input
              type="range"
              id="adsr-attack"
              min="0"
              max="1000"
              step="10"
              value={appStore.adsr().attack}
              onInput={(e) => appStore.setAttack(parseInt(e.currentTarget.value))}
            />
            <span class="settings-val">{appStore.adsr().attack}ms</span>
            <small>Time to reach full volume</small>
          </div>

          <div class="settings-row">
            <label for="adsr-decay">Decay</label>
            <input
              type="range"
              id="adsr-decay"
              min="0"
              max="1000"
              step="10"
              value={appStore.adsr().decay}
              onInput={(e) => appStore.setDecay(parseInt(e.currentTarget.value))}
            />
            <span class="settings-val">{appStore.adsr().decay}ms</span>
            <small>Time to fall to sustain level</small>
          </div>

          <div class="settings-row">
            <label for="adsr-sustain">Sustain</label>
            <input
              type="range"
              id="adsr-sustain"
              min="0"
              max="100"
              step="5"
              value={appStore.adsr().sustain}
              onInput={(e) => appStore.setSustain(parseInt(e.currentTarget.value))}
            />
            <span class="settings-val">{appStore.adsr().sustain}%</span>
            <small>Volume during note held</small>
          </div>

          <div class="settings-row">
            <label for="adsr-release">Release</label>
            <input
              type="range"
              id="adsr-release"
              min="0"
              max="2000"
              step="50"
              value={appStore.adsr().release}
              onInput={(e) => appStore.setRelease(parseInt(e.currentTarget.value))}
            />
            <span class="settings-val">{appStore.adsr().release}ms</span>
            <small>Time to fade after note ends</small>
          </div>
        </div>
 </div>
    </div>
  );
};

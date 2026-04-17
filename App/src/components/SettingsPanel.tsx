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

        {/* Sensitivity Presets Section */}
        <div class="settings-section">
          <h3 class="settings-section-title">Sensitivity Presets</h3>
          <p class="settings-desc">Quick presets for different environments.</p>

          <div class="settings-row">
            <label for="preset-select">Environment</label>
            <select
              id="preset-select"
              value={appStore.sensitivityPreset()}
              onChange={(e) => appStore.applySensitivityPreset(e.currentTarget.value as 'quiet' | 'home' | 'noisy')}
            >
              <option value="quiet">Quiet Room (Studio)</option>
              <option value="home">Some Noise (At Home)</option>
              <option value="noisy">High Noise (Outside)</option>
            </select>
          </div>
        </div>

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

        {/* Visibility Toggles */}
        <div class="settings-section">
          <h3 class="settings-section-title">Visibility</h3>
          <p class="settings-desc">Show or hide interface elements.</p>

          <div class="settings-row">
            <label for="vis-gridlines">Grid Lines</label>
            <input
              type="checkbox"
              id="vis-gridlines"
              checked={appStore.gridLinesVisible()}
              onChange={(e) => appStore.setGridLines(e.currentTarget.checked)}
            />
            <small>Show horizontal and vertical grid lines</small>
          </div>

          <div class="settings-row">
            <label for="vis-theme">Theme</label>
            <select
              id="vis-theme"
              value={appStore.theme()}
              onChange={(e) => appStore.setTheme(e.currentTarget.value as 'dark' | 'light')}
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
            <small>Switch between dark and light mode</small>
          </div>
        </div>

        {/* Playback Speed Section */}
        <div class="settings-section">
          <h3 class="settings-section-title">Playback Speed</h3>
          <p class="settings-desc">Adjust the playback speed of the practice melody.</p>

          <div class="settings-row">
            <label for="playback-speed">Speed</label>
            <input
              type="range"
              id="playback-speed"
              min="25"
              max="200"
              step="25"
              value={Math.round(appStore.playbackSpeed() * 100)}
              onInput={(e) => appStore.setPlaybackSpeed(parseInt(e.currentTarget.value) / 100)}
            />
            <span class="settings-val">{appStore.playbackSpeed().toFixed(2)}x</span>
            <small>0.25x = slowest, 2.0x = fastest</small>
          </div>
        </div>

        {/* Reverb Section */}
        <div class="settings-section">
          <h3 class="settings-section-title">Reverb</h3>
          <p class="settings-desc">Add reverb (echo) to the practice playback for a richer sound.</p>

          <div class="settings-row">
            <label for="reverb-type">Type</label>
            <select
              id="reverb-type"
              value={appStore.reverb().type}
              onChange={(e) => appStore.setReverbType(e.currentTarget.value as 'off' | 'room' | 'hall' | 'cathedral')}
            >
              <option value="off">Off</option>
              <option value="room">Room</option>
              <option value="hall">Hall</option>
              <option value="cathedral">Cathedral</option>
            </select>
          </div>

          <div class="settings-row">
            <label for="reverb-wetness">Wet Mix</label>
            <input
              type="range"
              id="reverb-wetness"
              min="0"
              max="100"
              step="5"
              value={appStore.reverb().wetness}
              onInput={(e) => appStore.setReverbWetness(parseInt(e.currentTarget.value))}
            />
            <span class="settings-val">{appStore.reverb().wetness}%</span>
            <small>How much reverb vs dry signal</small>
          </div>
        </div>

        {/* About Section */}
        <div class="settings-section">
          <h3 class="settings-section-title">About PitchPerfect</h3>
          <div class="about-content">
            <div class="about-logo">
              <svg viewBox="0 0 48 48" width="40" height="40">
                <circle cx="24" cy="24" r="22" fill="none" stroke="currentColor" stroke-width="2"/>
                <path d="M24 8 L24 40 M12 16 Q18 10 24 16 Q30 22 36 16" fill="none" stroke="currentColor" stroke-width="2"/>
                <circle cx="24" cy="32" r="4" fill="currentColor"/>
              </svg>
            </div>
            <p class="about-name">PitchPerfect</p>
            <p class="about-version">Version 1.0.0</p>
            <p class="about-desc">
              A web-based vocal pitch practice tool. Sing into your microphone and see your accuracy
              on the pitch canvas. Use the piano roll editor to compose melodies, then practice
              singing them with real-time feedback.
            </p>
            <div class="about-features">
              <span>🎤 Real-time pitch detection</span>
              <span>🎹 Piano roll editor</span>
              <span>📊 Progress tracking</span>
              <span>🎵 MIDI import/export</span>
              <span>🔊 ADSR envelope</span>
              <span>🏛️ Reverb effects</span>
            </div>
            <p class="about-credits">
              Built with SolidJS + TypeScript. Audio powered by Web Audio API.
            </p>
            <div class="about-links">
              <a
                href="https://github.com/Komediruzecki/pitch-perfect"
                target="_blank"
                rel="noopener noreferrer"
                class="about-link"
              >
                <svg viewBox="0 0 24 24" width="16" height="16">
                  <path
                    fill="currentColor"
                    d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"
                  />
                </svg>
                View on GitHub
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

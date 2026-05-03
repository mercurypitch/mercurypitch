// ============================================================
// Settings Panel — Pitch detection and accuracy configuration
// ============================================================

import type { Component } from 'solid-js'
import { createMemo, createSignal, For, Show } from 'solid-js'
import { APP_VERSION, IS_DEV } from '@/lib/defaults'
import type { AccuracyTier } from '@/stores'
import { accuracyTier, applyAccuracyTier, appStore } from '@/stores'
import { adsr, playbackSpeed, setPlaybackSpeed, setSensitivity, settings, } from '@/stores'
import type { PitchAlgorithm } from '@/stores/settings-store'
import type { PitchBufferSize } from '@/stores/settings-store'
import { characterSounds, colorCodeNotes, flameMode, selectedCharacter, setCharacterSounds, setColorCodeNotes, setFlameMode, setShowAccuracyPercent, setShowPracticeResultPopup, setShowSidebarNoteList, showAccuracyPercent, showPracticeResultPopup, showSidebarNoteList, } from '@/stores/settings-store'
import { pitchAlgorithm, setPitchAlgorithm } from '@/stores/settings-store'
import { PITCH_BUFFER_DESCRIPTIONS, PITCH_BUFFER_LABELS, PITCH_BUFFER_SIZES, pitchBufferSize, setPitchBufferSize, } from '@/stores/settings-store'
import { TierSelector } from '@/components'

export const SettingsPanel: Component = () => {
  const s = () => settings()
  const [showResetConfirm, setShowResetConfirm] = createSignal(false)

  const bandValues = createMemo(() => {
    const bands = s().bands
    return {
      perfect: bands.find((b) => b.band === 100)?.threshold ?? 0,
      excellent: bands.find((b) => b.band === 90)?.threshold ?? 10,
      good: bands.find((b) => b.band === 75)?.threshold ?? 25,
      okay: bands.find((b) => b.band === 50)?.threshold ?? 50,
    }
  })

  const handleBandChange = (
    band: 'perfect' | 'excellent' | 'good' | 'okay',
    value: string,
  ) => {
    const num = parseInt(value, 10) || 0
    const idx = s().bands.findIndex(
      (b) =>
        b.band ===
        (band === 'perfect'
          ? 100
          : band === 'excellent'
            ? 90
            : band === 'good'
              ? 75
              : 50),
    )
    if (idx >= 0) {
      appStore.setBand(idx, num)
    }
  }

  const handleResetStorage = () => {
    // Clear all pitchperfect_ keys
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('pitchperfect_')) {
        localStorage.removeItem(key)
      }
    })
    // Reload the page to apply defaults
    window.location.reload()
  }

  const [testCrash, setTestCrash] = createSignal(false)

  return (
    <div class="settings-panel">
      <div class="settings-content">
        <h2 class="settings-title">Settings</h2>

        {/* Sensitivity Presets Section */}
        <div class="settings-section">
          <h3 class="settings-section-title">Sensitivity Presets</h3>
          <div class="settings-divider" />
          <p class="settings-desc">Quick presets for different environments.</p>

          <div class="settings-row">
            <label for="preset-select">Environment</label>
            <select
              id="preset-select"
              value={appStore.sensitivityPreset()}
              onChange={(e) => {
                appStore.applySensitivityPreset(
                  e.currentTarget.value as 'quiet' | 'home' | 'noisy',
                )
              }}
            >
              <option value="quiet">Quiet Room (Studio)</option>
              <option value="home">Some Noise (At Home)</option>
              <option value="noisy">High Noise (Outside)</option>
            </select>
          </div>
        </div>

        {/* Accuracy Tier Section */}
        <div class="settings-section">
          <h3 class="settings-section-title">Accuracy Tier</h3>
          <div class="settings-divider" />
          <p class="settings-desc">
            Choose your skill level. Perfect pitch means being within the
            specified number of cents of the target note.
          </p>

          <TierSelector class="settings-tier-selector" />
        </div>

        {/* Pitch Algorithm Section */}
        <div class="settings-section">
          <h3 class="settings-section-title">Pitch Algorithm</h3>
          <div class="settings-divider" />
          <p class="settings-desc">
            Select the pitch detection algorithm. YIN is the classic,
            well-tested default. MPM (McLeod) offers better harmonic handling
            and fewer octave errors on complex timbres.
          </p>

          <div class="settings-row">
            <label for="pitch-algorithm-select">Algorithm</label>
            <select
              id="pitch-algorithm-select"
              value={pitchAlgorithm()}
              onChange={(e) => {
                setPitchAlgorithm(e.currentTarget.value as PitchAlgorithm)
              }}
            >
              <option value="yin">YIN (Classic)</option>
              <option value="mpm">MPM (McLeod)</option>
            </select>
          </div>

          <Show when={pitchAlgorithm() === 'mpm'}>
            <div class="settings-row">
              <label>Buffer Size</label>
              <div class="pitch-buffer-pills">
                <For each={PITCH_BUFFER_SIZES}>
                  {(size) => (
                    <button
                      class={`pitch-buffer-pill${pitchBufferSize() === size ? ' pitch-buffer-pill-active' : ''}`}
                      onClick={() =>
                        setPitchBufferSize(size as PitchBufferSize)
                      }
                      title={PITCH_BUFFER_DESCRIPTIONS[size]}
                    >
                      {PITCH_BUFFER_LABELS[size]}
                    </button>
                  )}
                </For>
              </div>
            </div>
            <p
              class="settings-desc"
              style="margin-top: 4px; font-size: 0.7rem;"
            >
              {PITCH_BUFFER_DESCRIPTIONS[pitchBufferSize()]}
            </p>
          </Show>
        </div>

        {/* Pitch Detection Section */}
        <div class="settings-section">
          <h3 class="settings-section-title">Pitch Detection</h3>
          <div class="settings-divider" />

          <div class="settings-row">
            <label for="set-threshold">Detection Threshold</label>
            <input
              type="range"
              id="set-threshold"
              min="5"
              max="20"
              step="1"
              value={Math.round(s().detectionThreshold * 100)}
              onInput={(e) => {
                appStore.setDetectionThreshold(
                  parseInt(e.currentTarget.value) / 100,
                )
              }}
            />
            <span class="settings-val">
              {s().detectionThreshold.toFixed(2)}
            </span>
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
              onInput={(e) => {
                setSensitivity(parseInt(e.currentTarget.value))
              }}
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
              onInput={(e) => {
                appStore.setMinConfidence(parseInt(e.currentTarget.value) / 100)
              }}
            />
            <span class="settings-val">
              {Math.round(s().minConfidence * 100)}%
            </span>
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
              onInput={(e) => {
                appStore.setMinAmplitude(parseInt(e.currentTarget.value))
              }}
            />
            <span class="settings-val">{s().minAmplitude}</span>
            <small>Minimum signal loudness required</small>
          </div>
        </div>

        {/* Practice Aids Section */}
        <div class="settings-section">
          <h3 class="settings-section-title">Practice Aids</h3>
          <div class="settings-divider" />

          <div class="settings-row">
            <label for="set-tonic-anchor">Tonic Anchor Tone</label>
            <label class="settings-toggle">
              <input
                type="checkbox"
                id="set-tonic-anchor"
                checked={s().tonicAnchor}
                onChange={(e) => {
                  appStore.setTonicAnchor(e.currentTarget.checked)
                }}
              />
              <span class="settings-slider" />
            </label>
            <small>
              Play a reference tone at the start of each run to help lock in to
              the key
            </small>
          </div>
        </div>

        {/* Accuracy Bands Section */}
        <div class="settings-section">
          <h3 class="settings-section-title">Accuracy Bands</h3>
          <div class="settings-divider" />
          <p class="settings-desc">
            Define how many cents off is "Perfect", "Good", etc.
          </p>

          <div class="settings-row">
            <label for="band-perfect">Perfect (&le; cents)</label>
            <input
              class={'input-number-dark'}
              type="number"
              id="band-perfect"
              min="1"
              max="50"
              value={bandValues().perfect}
              onInput={(e) => {
                handleBandChange('perfect', e.currentTarget.value)
              }}
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
              onInput={(e) => {
                handleBandChange('excellent', e.currentTarget.value)
              }}
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
              onInput={(e) => {
                handleBandChange('good', e.currentTarget.value)
              }}
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
              onInput={(e) => {
                handleBandChange('okay', e.currentTarget.value)
              }}
            />
          </div>
        </div>

        {/* Current Values Section */}
        <div class="settings-section">
          <h3 class="settings-section-title">Current Values</h3>
          <div class="settings-divider" />
          <div class="settings-info">
            <div>
              Threshold: <span>{s().detectionThreshold.toFixed(2)}</span>
            </div>
            <div>
              Sensitivity: <span>{s().sensitivity}</span>
            </div>
            <div>
              Min Confidence:{' '}
              <span>{Math.round(s().minConfidence * 100)}%</span>
            </div>
            <div>
              Min Amplitude: <span>{s().minAmplitude}</span>
            </div>
          </div>
        </div>

        {/* ADSR Envelope Section */}
        <div class="settings-section">
          <h3 class="settings-section-title">Tone Envelope (ADSR)</h3>
          <div class="settings-divider" />
          <p class="settings-desc">
            Adjust the Attack, Decay, Sustain, Release envelope for note
            playback.
          </p>

          <div class="settings-row">
            <label for="adsr-attack">Attack</label>
            <input
              type="range"
              id="adsr-attack"
              min="0"
              max="1000"
              step="10"
              value={adsr().attack}
              onInput={(e) => {
                appStore.setAttack(parseInt(e.currentTarget.value))
              }}
            />
            <span class="settings-val">{adsr().attack}ms</span>
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
              value={adsr().decay}
              onInput={(e) => {
                appStore.setDecay(parseInt(e.currentTarget.value))
              }}
            />
            <span class="settings-val">{adsr().decay}ms</span>
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
              value={adsr().sustain}
              onInput={(e) => {
                appStore.setSustain(parseInt(e.currentTarget.value))
              }}
            />
            <span class="settings-val">{adsr().sustain}%</span>
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
              value={adsr().release}
              onInput={(e) => {
                appStore.setRelease(parseInt(e.currentTarget.value))
              }}
            />
            <span class="settings-val">{adsr().release}ms</span>
            <small>Time to fade after note ends</small>
          </div>
        </div>

        {/* Visibility Toggles */}
        <div class="settings-section">
          <h3 class="settings-section-title">Visibility</h3>
          <div class="settings-divider" />
          <p class="settings-desc">Show or hide interface elements.</p>

          <div class="settings-row">
            <label for="vis-gridlines">Grid Lines</label>
            <label class="settings-toggle">
              <input
                type="checkbox"
                id="vis-gridlines"
                checked={appStore.gridLinesVisible()}
                onChange={(e) => {
                  appStore.setGridLinesVisible(e.currentTarget.checked)
                }}
              />
              <span class="settings-slider" />
            </label>
            <small>Show horizontal and vertical grid lines</small>
          </div>

          <div class="settings-row">
            <label for="vis-sidebar-notes">Sidebar Note List</label>
            <label class="settings-toggle">
              <input
                type="checkbox"
                id="vis-sidebar-notes"
                checked={showSidebarNoteList()}
                onChange={(e) => {
                  setShowSidebarNoteList(e.currentTarget.checked)
                }}
              />
              <span class="settings-slider" />
            </label>
            <small>
              Show the detailed note list in the Practice sidebar. Hidden by
              default for a cleaner playback layout.
            </small>
          </div>

          <div class="settings-row">
            <label for="vis-playback-setup">Playback Setup</label>
            <label class="settings-toggle">
              <input
                type="checkbox"
                id="vis-playback-setup"
                checked={appStore.showPlaybackSetupInfo()}
                onChange={(e) => {
                  appStore.setShowPlaybackSetup(e.currentTarget.checked)
                }}
              />
              <span class="settings-slider" />
            </label>
            <small>Show Playback setup component in sidebar</small>
          </div>

          <div class="settings-row">
            <label for="vis-stats">Stats Panel</label>
            <label class="settings-toggle">
              <input
                type="checkbox"
                id="vis-stats"
                checked={appStore.showStats()}
                onChange={(e) => {
                  appStore.setShowStats(e.currentTarget.checked)
                }}
              />
              <span class="settings-slider" />
            </label>
            <small>Show accuracy stats (Practice tab)</small>
          </div>

          <div class="settings-row">
            <label for="vis-pitch-display">Pitch Display</label>
            <label class="settings-toggle">
              <input
                type="checkbox"
                id="vis-pitch-display"
                checked={appStore.showPitchDisplay()}
                onChange={(e) => {
                  appStore.setShowPitchDisplay(e.currentTarget.checked)
                }}
              />
              <span class="settings-slider" />
            </label>
            <small>Show live pitch tracker (Practice tab)</small>
          </div>

          <div class="settings-row">
            <label for="vis-practice-result-popup">Practice Result Popup</label>
            <label class="settings-toggle">
              <input
                type="checkbox"
                id="vis-practice-result-popup"
                checked={showPracticeResultPopup()}
                onChange={(e) => {
                  setShowPracticeResultPopup(e.currentTarget.checked)
                }}
              />
              <span class="settings-slider" />
            </label>
            <small>
              Show a score overlay after each practice run or session completes.
              When off, results are still recorded in history.
            </small>
          </div>

          <div class="settings-row">
            <label for="vis-theme">Theme</label>
            <label>
              <select
                id="vis-theme"
                value={appStore.theme()}
                onChange={(e) => {
                  appStore.setTheme(e.currentTarget.value as 'dark' | 'light')
                }}
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </label>
            <small>Switch between dark and light mode</small>
          </div>
        </div>

        {/* Visualization Section */}
        <div class="settings-section">
          <h3 class="settings-section-title">Visualization</h3>
          <div class="settings-divider" />
          <p class="settings-desc">
            Enhance the practice experience with visual feedback effects.
          </p>

          <div class="settings-row">
            <label for="vis-flame">Burning Notes</label>
            <label class="settings-toggle">
              <input
                type="checkbox"
                id="vis-flame"
                checked={flameMode()}
                onChange={(e) => {
                  setFlameMode(e.currentTarget.checked)
                }}
              />
              <span class="settings-slider" />
            </label>
            <small>
              Animate the currently-playing note with a burning fire effect
              synced to playback.
            </small>
          </div>

          <div class="settings-row">
            <label for="vis-color-code">Accuracy Color Coding</label>
            <label class="settings-toggle">
              <input
                type="checkbox"
                id="vis-color-code"
                checked={colorCodeNotes()}
                onChange={(e) => {
                  setColorCodeNotes(e.currentTarget.checked)
                }}
              />
              <span class="settings-slider" />
            </label>
            <small>
              Color-code played notes based on pitch accuracy (Green: Perfect,
              Teal: Excellent, etc).
            </small>
          </div>

          <div class="settings-row">
            <label for="vis-accuracy-pct">Show Accuracy Percentage</label>
            <label class="settings-toggle">
              <input
                type="checkbox"
                id="vis-accuracy-pct"
                checked={showAccuracyPercent()}
                onChange={(e) => {
                  setShowAccuracyPercent(e.currentTarget.checked)
                }}
              />
              <span class="settings-slider" />
            </label>
            <small>
              Display a numeric accuracy percentage on each played note.
            </small>
          </div>

          {/*
            Character Sounds — when on, the playback instrument follows
            the guide character picked in the sidebar so each persona
            sounds different. When off, the user's manual instrument
            choice (set elsewhere via appStoreCore.instrument) wins.
            See EngineContext for the mapping.
          */}
          <div class="settings-row">
            <label for="char-sounds">Character Sounds</label>
            <label class="settings-toggle">
              <input
                type="checkbox"
                id="char-sounds"
                checked={characterSounds()}
                onChange={(e) => {
                  setCharacterSounds(e.currentTarget.checked)
                }}
              />
              <span class="settings-slider" />
            </label>
            <small>
              Play a different timbre per guide character (currently:{' '}
              <strong>{selectedCharacter()}</strong>). Disable to use the
              instrument selected manually.
            </small>
          </div>
        </div>

        {/* Playback Speed Section */}
        <div class="settings-section">
          <h3 class="settings-section-title">Playback Speed</h3>
          <div class="settings-divider" />
          <p class="settings-desc">
            Adjust the playback speed of the practice melody.
          </p>

          <div class="settings-row">
            <label for="playback-speed">Speed</label>
            <input
              type="range"
              id="playback-speed"
              min="25"
              max="200"
              step="25"
              value={Math.round(playbackSpeed() * 100)}
              onInput={(e) => {
                setPlaybackSpeed(parseInt(e.currentTarget.value) / 100)
              }}
            />
            <span class="settings-val">{playbackSpeed().toFixed(2)}x</span>
            <small>0.25x = slowest, 2.0x = fastest</small>
          </div>
        </div>

        {/* Reverb Section */}
        <div class="settings-section">
          <h3 class="settings-section-title">Reverb</h3>
          <div class="settings-divider" />
          <p class="settings-desc">
            Add reverb (echo) to the practice playback for a richer sound.
          </p>

          <div class="settings-row">
            <label for="reverb-type">Type</label>
            <select
              id="reverb-type"
              value={appStore.reverb().type}
              onChange={(e) => {
                appStore.setReverbType(
                  e.currentTarget.value as
                    | 'off'
                    | 'room'
                    | 'hall'
                    | 'cathedral',
                )
              }}
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
              onInput={(e) => {
                appStore.setReverbWetness(parseInt(e.currentTarget.value))
              }}
            />
            <span class="settings-val">{appStore.reverb().wetness}%</span>
            <small>How much reverb vs dry signal</small>
          </div>
        </div>

        {/* Keyboard Shortcuts Section */}
        <div class="settings-section">
          <h3 class="settings-section-title">Keyboard Shortcuts</h3>
          <div class="settings-divider" />
          <p class="settings-desc">
            Global shortcuts active when not typing in a text field.
          </p>
          <div class="keymap-table">
            <div class="keymap-row keymap-header">
              <span>Key</span>
              <span>Action</span>
            </div>
            <div class="keymap-row">
              <kbd>Space</kbd>
              <span>Play / Pause / Resume (focus mode)</span>
            </div>
            <div class="keymap-row">
              <kbd>Esc</kbd>
              <span>Exit focus mode / Stop playback</span>
            </div>
            <div class="keymap-row">
              <kbd>Home</kbd>
              <span>Go to beginning</span>
            </div>
            <div class="keymap-row">
              <kbd>R</kbd>
              <span>Toggle Repeat mode</span>
            </div>
            <div class="keymap-row">
              <kbd>P</kbd>
              <span>Toggle Practice mode</span>
            </div>
            <div class="keymap-row">
              <kbd>O</kbd>
              <span>Toggle Once mode</span>
            </div>
            <div class="keymap-row">
              <kbd>↑</kbd>
              <span>Increase playback speed</span>
            </div>
            <div class="keymap-row">
              <kbd>↓</kbd>
              <span>Decrease playback speed</span>
            </div>
          </div>
        </div>

        {/* Danger Zone Section */}
        <div class="settings-section settings-danger-zone">
          <h3 class="settings-section-title">Danger Zone</h3>
          <div class="settings-divider danger-divider" />
          <p class="settings-desc">
            Irreversible actions that affect all your data.
          </p>

          <div class="settings-row danger-row">
            <div class="danger-content">
              <label class="danger-label">Reset to Factory Defaults</label>
              <small class="danger-desc">
                Clear all stored data and reload the app with initial defaults.
              </small>
            </div>
            <button
              class="danger-btn"
              onClick={() => setShowResetConfirm(true)}
            >
              Reset
            </button>
          </div>

          {/* Reset Confirmation Modal */}
          <Show when={showResetConfirm()}>
            <div class="danger-confirm-overlay">
              <div class="danger-confirm-box">
                <h4 class="danger-confirm-title">Confirm Reset</h4>
                <p class="danger-confirm-text">
                  Are you sure you want to reset all data? This will clear all
                  stored melodies, presets, sessions, and settings. This action
                  cannot be undone.
                </p>
                <div class="danger-confirm-actions">
                  <button
                    class="danger-btn-secondary"
                    onClick={() => setShowResetConfirm(false)}
                  >
                    Cancel
                  </button>
                  <button
                    class="danger-btn-primary"
                    onClick={handleResetStorage}
                  >
                    Reset All Data
                  </button>
                </div>
              </div>
            </div>
          </Show>
        </div>

        {/* Developer Tools Section */}
        <Show when={IS_DEV}>
          {testCrash() &&
            (() => {
              throw new Error('Dev mode injected render crash')
            })()}
          <div class="settings-section settings-danger-zone">
            <h3 class="settings-section-title" style="color: var(--yellow);">
              Developer Tools
            </h3>
            <div
              class="settings-divider"
              style="background: linear-gradient(90deg, var(--yellow), transparent);"
            />
            <p class="settings-desc">Development-only tools for debugging.</p>

            <div class="settings-row danger-row">
              <div class="danger-content">
                <label class="danger-label" style="color: var(--yellow);">
                  Test Crash Screen
                </label>
                <small class="danger-desc">
                  Inject a rendering error to test the global CrashModal
                  boundary.
                </small>
              </div>
              <button
                class="danger-btn"
                style="background: rgba(220, 160, 0, 0.1); color: var(--yellow); border-color: var(--yellow);"
                onClick={() => setTestCrash(true)}
              >
                Trigger Crash
              </button>
            </div>
          </div>
        </Show>

        {/* About Section */}
        <div class="settings-section">
          <h3 class="settings-section-title">About PitchPerfect</h3>
          <div class="settings-divider" />
          <div class="about-content">
            <div class="about-logo">
              <svg viewBox="0 0 48 48" width="40" height="40">
                <circle
                  cx="24"
                  cy="24"
                  r="22"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                />
                <path
                  d="M24 8 L24 40 M12 16 Q18 10 24 16 Q30 22 36 16"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                />
                <circle cx="24" cy="32" r="4" fill="currentColor" />
              </svg>
            </div>
            <p class="about-name">PitchPerfect</p>
            <p class="about-version">Version {APP_VERSION}</p>
            <p class="about-desc">
              A web-based vocal pitch practice tool. Sing into your microphone
              and see your accuracy on the pitch canvas. Use the piano roll
              editor to compose melodies, then practice singing them with
              real-time feedback.
            </p>
            <div class="about-features">
              <span class="feature-pill pill-detection">
                <svg viewBox="0 0 24 24" width="14" height="14">
                  <path
                    fill="currentColor"
                    d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zM17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"
                  />
                </svg>
                Real-time pitch detection
              </span>
              <span class="feature-pill pill-editor">
                <svg viewBox="0 0 24 24" width="14" height="14">
                  <path
                    fill="currentColor"
                    d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"
                  />
                </svg>
                Piano roll editor
              </span>
              <span class="feature-pill pill-progress">
                <svg viewBox="0 0 24 24" width="14" height="14">
                  <path
                    fill="currentColor"
                    d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"
                  />
                </svg>
                Progress tracking
              </span>
              <span class="feature-pill pill-midi">
                <svg viewBox="0 0 24 24" width="14" height="14">
                  <path
                    fill="currentColor"
                    d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"
                  />
                </svg>
                MIDI import/export
              </span>
              <span class="feature-pill pill-adsr">
                <svg viewBox="0 0 24 24" width="14" height="14">
                  <path
                    fill="currentColor"
                    d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
                  />
                </svg>
                ADSR envelope
              </span>
              <span class="feature-pill pill-reverb">
                <svg viewBox="0 0 24 24" width="14" height="14">
                  <path
                    fill="currentColor"
                    d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"
                  />
                  <circle cx="12" cy="12" r="3" fill="currentColor" />
                </svg>
                Reverb effects
              </span>
            </div>
            <p class="about-credits">Vocal Pitch Practice — Redefined.</p>
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
  )
}

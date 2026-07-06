// ============================================================
// Settings Panel — Pitch detection and accuracy configuration
// ============================================================

import type { Component } from 'solid-js'
import { createMemo, createSignal, For, Show } from 'solid-js'
import { AccountSection } from '@/components/account/AccountSection'
import { PricingPanel } from '@/components/billing/PricingPanel'
import { ChangelogModal } from '@/components/ChangelogModal'
import { ConsoleLog } from '@/components/ConsoleLog'
import { SafeSelect } from '@/components/shared/SafeSelect'
import { TierSelector } from '@/components/TierSelector'
import { VocalRangeSelector } from '@/components/VocalRangeSelector'
import { VoiceRangeTestModal } from '@/components/VoiceRangeTestModal'
import { VoiceTypeDetectorModal } from '@/components/VoiceTypeDetectorModal'
import type { PracticeScope, UiMode } from '@/features/tabs/constants'
import { APP_VERSION, COMMIT_SHA, IS_DEV } from '@/lib/defaults'
import { PRIVACY_URL, TERMS_URL } from '@/lib/legal-links'
import { adsr, applySensitivityPreset, gridLinesVisible, playbackSpeed, reverbConfig, sensitivityPreset, setAttack, setBand, setDecay, setDetectionThreshold, setGridLinesVisible, setMinAmplitude, setMinConfidence, setPlaybackSpeed, setRelease, setReverbType, setReverbWetness, setSensitivity, setShowFocusBall, setShowHistoryPanel, setShowPitchDisplay, setShowPlaybackBall, setShowPlaybackSetup, setShowPlayhead, setShowStats, setSustain, setTheme, settings, setTonicAnchor, showFocusBall, showHistoryPanel, showPitchDisplay, showPlaybackBall, showPlaybackSetupInfo, showPlayhead, showStats, theme, } from '@/stores'
import { deleteAllSessionGroups, deleteAllUvrSessions, showNotification, } from '@/stores'
import { showConsoleLog, toggleConsoleLog } from '@/stores/console-store'
import { deleteAllPlaylists } from '@/stores/karaoke-playlist-store'
import type { FontFamily, PitchAlgorithm } from '@/stores/settings-store'
import type { PitchBufferSize } from '@/stores/settings-store'
import { CHARACTER_INFO, characterSounds, colorCodeNotes, flameMode, fontFamily, selectedCharacter, setCharacterSounds, setColorCodeNotes, setFlameMode, setFontFamily, setShowAccuracyPercent, setShowPracticeResultPopup, setShowSidebarNoteList, showAccuracyPercent, showPracticeResultPopup, showSidebarNoteList, } from '@/stores/settings-store'
import { pitchAlgorithm, setPitchAlgorithm } from '@/stores/settings-store'
import { PITCH_BUFFER_DESCRIPTIONS, PITCH_BUFFER_LABELS, PITCH_BUFFER_SIZES, pitchBufferSize, setPitchBufferSize, } from '@/stores/settings-store'
import { practiceScope, setPracticeScope, setUiMode, uiMode, } from '@/stores/settings-store'
import { setSettingsSection, settingsSection } from '@/stores/ui-store'
import styles from './SettingsPanel.module.css'

export const SettingsPanel: Component = () => {
  const s = () => settings()
  const [showResetConfirm, setShowResetConfirm] = createSignal(false)
  const [showClearUvrConfirm, setShowClearUvrConfirm] = createSignal(false)
  const [showFontReloadConfirm, setShowFontReloadConfirm] = createSignal(false)
  const [pendingFont, setPendingFont] = createSignal<FontFamily | null>(null)
  const [showChangelog, setShowChangelog] = createSignal(false)
  const [showVoiceDetector, setShowVoiceDetector] = createSignal(false)
  const [showRangeTest, setShowRangeTest] = createSignal(false)
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
      setBand(idx, num)
    }
  }

  const handleResetStorage = async () => {
    // Wipe ALL client-side state. Clearing only pitchperfect_* keys used to
    // leave behind sidebar collapse state (sidebar-*), karaoke UI prefs (km-*),
    // the anonymous identity / auth token (mp:*), and the dev pitch-test flag —
    // so a "factory reset" wasn't truly factory. Clear everything instead.
    try {
      localStorage.clear()
    } catch {
      /* non-critical */
    }
    try {
      sessionStorage.clear()
    } catch {
      /* non-critical */
    }

    // Clear IndexedDB and model cache
    try {
      const { clearModelCache } = await import('@/lib/model-cache')
      await clearModelCache()
    } catch {
      /* non-critical */
    }

    try {
      const { resetDatabase } = await import('@/db')
      await resetDatabase()
    } catch {
      /* non-critical */
    }

    // Navigate back to the default URL (removing any hashes)
    window.location.href = '/'
  }

  const handleClearKaraokeData = async () => {
    setShowClearUvrConfirm(false)
    try {
      // Sessions + their stems, fingerprints, lyrics and transcriptions.
      deleteAllUvrSessions()
      // The groups and saved playlists built from those sessions.
      await deleteAllSessionGroups()
      await deleteAllPlaylists()
      showNotification(
        'Cleared all karaoke & vocal-separation data.',
        'success',
      )
    } catch {
      showNotification(
        'Could not clear karaoke data — please try again.',
        'error',
      )
    }
  }

  const [testCrash, setTestCrash] = createSignal(false)
  // Shared with the hash router / deep links (#/settings/<section>) and
  // in-app jumps (openSettingsSection — e.g. "Get credits" toasts).
  const activeTab = settingsSection
  const setActiveTab = setSettingsSection

  return (
    <div class={styles.settingsPanel}>
      <div class={styles.settingsContent}>
        <h2 class={styles.settingsTitle} data-testid="settings-title">
          Settings
        </h2>

        <div class={styles.settingsTabs} role="tablist">
          <button
            type="button"
            role="tab"
            class={styles.settingsTab}
            classList={{
              [styles.settingsTabActive]: activeTab() === 'account',
            }}
            aria-selected={activeTab() === 'account'}
            onClick={() => setActiveTab('account')}
            data-testid="settings-tab-account"
          >
            General
          </button>
          <button
            type="button"
            role="tab"
            class={styles.settingsTab}
            classList={{
              [styles.settingsTabActive]: activeTab() === 'singing',
            }}
            aria-selected={activeTab() === 'singing'}
            onClick={() => setActiveTab('singing')}
            data-testid="settings-tab-singing"
          >
            Practice
          </button>
          <button
            type="button"
            role="tab"
            class={styles.settingsTab}
            classList={{
              [styles.settingsTabActive]: activeTab() === 'display',
            }}
            aria-selected={activeTab() === 'display'}
            onClick={() => setActiveTab('display')}
            data-testid="settings-tab-display"
          >
            Display &amp; Controls
          </button>
          <button
            type="button"
            role="tab"
            class={styles.settingsTab}
            classList={{
              [styles.settingsTabActive]: activeTab() === 'credits',
            }}
            aria-selected={activeTab() === 'credits'}
            onClick={() => setActiveTab('credits')}
            data-testid="settings-tab-credits"
          >
            Credits
          </button>
        </div>

        <Show when={activeTab() === 'account'}>
          {/* Account Section */}
          <div class={styles.settingsSection} data-tour="settings.account">
            <h3 class={styles.settingsSectionTitle}>Account</h3>
            <div class={styles.settingsDivider} />
            <AccountSection />
          </div>

          {/* App Mode Section */}
          <div class={styles.settingsSection} data-tour="settings.app-mode">
            <h3 class={styles.settingsSectionTitle}>App Mode</h3>
            <div class={styles.settingsDivider} />
            <p class={styles.settingsDesc}>
              Scope the app to what you practice, and choose how much interface
              you want. Simple mode shows only the practice tabs for your
              instrument (plus Settings) — a focused, distraction-free view.
            </p>

            <div class={styles.settingsRow}>
              <label for="practice-scope-select">I practice</label>
              <SafeSelect
                id="practice-scope-select"
                value={practiceScope()}
                onChange={(e) => {
                  setPracticeScope(e.currentTarget.value as PracticeScope)
                }}
              >
                <option value="all">Everything</option>
                <option value="singing">Singing</option>
                <option value="guitar">Guitar</option>
                <option value="piano">Piano</option>
              </SafeSelect>
            </div>

            <div class={styles.settingsRow}>
              <label for="ui-mode-select">Interface</label>
              <SafeSelect
                id="ui-mode-select"
                value={uiMode()}
                onChange={(e) => {
                  setUiMode(e.currentTarget.value as UiMode)
                }}
              >
                <option value="advanced">Advanced — the full app</option>
                <option value="simple">Simple — practice only</option>
              </SafeSelect>
            </div>
          </div>
        </Show>

        <Show when={activeTab() === 'credits'}>
          {/* Credits — server-side separation top-ups. Deliberately named
              "Credits" (not plans/pricing): on-device stays free and there
              is no subscription to sell. */}
          <div class={styles.settingsSection} data-tour="settings.credits">
            <h3 class={styles.settingsSectionTitle}>Credits</h3>
            <div class={styles.settingsDivider} />
            <p class={styles.settingsDesc}>
              Credits pay only for faster server-side vocal separation.
              Everything that runs on your device is free, forever.
            </p>
            {/* The processing-default picker (tier cards + quality chips)
                lives inside PricingPanel — the Karaoke page toggles use the
                same persisted signals and stay in sync. */}
            <PricingPanel />
          </div>
        </Show>

        <Show when={activeTab() === 'singing'}>
          {/* Sensitivity Presets Section */}
          <div class={styles.settingsSection}>
            <h3 class={styles.settingsSectionTitle}>Sensitivity Presets</h3>
            <div class={styles.settingsDivider} />
            <p class={styles.settingsDesc}>
              Quick presets for different environments.
            </p>

            <div class={styles.settingsRow}>
              <label for="preset-select">Environment</label>
              <SafeSelect
                id="preset-select"
                value={sensitivityPreset()}
                onChange={(e) => {
                  applySensitivityPreset(
                    e.currentTarget.value as 'quiet' | 'home' | 'noisy',
                  )
                }}
              >
                <option value="quiet">Quiet Room (Studio)</option>
                <option value="home">Some Noise (At Home)</option>
                <option value="noisy">High Noise (Outside)</option>
              </SafeSelect>
            </div>
          </div>

          {/* Vocal Range Preset Section */}
          <div class={styles.settingsSection} data-tour="settings.voice-range">
            <h3 class={styles.settingsSectionTitle}>Singing Voice Range</h3>
            <div class={styles.settingsDivider} />
            <p class={styles.settingsDesc}>
              Set your natural singing voice range. This will automatically
              adjust the default octave for new exercises.
            </p>

            <div style="display: flex; flex-direction: column; gap: 12px; align-items: center; width: 100%;">
              <VocalRangeSelector class={styles.settingsTierSelector} />
              <button
                onClick={() => setShowVoiceDetector(true)}
                style="display: inline-flex; align-items: center; gap: 7px; background: var(--bg-secondary); border: 1px solid var(--accent); color: var(--accent); padding: 9px 18px; border-radius: 999px; font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: all 0.2s;"
                onMouseOver={(e) => {
                  e.currentTarget.style.color = '#fff'
                  e.currentTarget.style.background = 'var(--accent)'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.color = 'var(--accent)'
                  e.currentTarget.style.background = 'var(--bg-secondary)'
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="15"
                  height="15"
                  stroke="currentColor"
                  fill="none"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" x2="12" y1="19" y2="22" />
                </svg>
                Don't know? Find my voice
              </button>
              <button
                onClick={() => setShowRangeTest(true)}
                style="display: inline-flex; align-items: center; gap: 7px; background: var(--bg-secondary); border: 1px solid var(--border); color: var(--text-secondary); padding: 9px 18px; border-radius: 999px; font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: all 0.2s;"
                onMouseOver={(e) => {
                  e.currentTarget.style.color = 'var(--accent)'
                  e.currentTarget.style.borderColor = 'var(--accent)'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.color = 'var(--text-secondary)'
                  e.currentTarget.style.borderColor = 'var(--border)'
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="15"
                  height="15"
                  stroke="currentColor"
                  fill="none"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M3 12h2l2-7 3 14 3-10 2 6 2-3h4" />
                </svg>
                Full range test (advanced)
              </button>
            </div>
          </div>

          {/* Accuracy Tier Section */}
          <div class={styles.settingsSection} data-tour="settings.tier">
            <h3 class={styles.settingsSectionTitle}>Accuracy Tier</h3>
            <div class={styles.settingsDivider} />
            <p class={styles.settingsDesc}>
              Choose your skill level. Perfect pitch means being within the
              specified number of cents of the target note.
            </p>

            <TierSelector class={styles.settingsTierSelector} />
          </div>

          {/* Pitch Algorithm Section */}
          <div class={styles.settingsSection} data-tour="settings.algorithm">
            <h3 class={styles.settingsSectionTitle}>Pitch Algorithm</h3>
            <div class={styles.settingsDivider} />
            <p class={styles.settingsDesc}>
              Select the pitch detection algorithm. YIN is the classic,
              well-tested default. MPM (McLeod) offers better harmonic handling
              and fewer octave errors on complex timbres.
            </p>

            <div class={styles.settingsRow}>
              <label for="pitch-algorithm-select">Algorithm</label>
              <SafeSelect
                id="pitch-algorithm-select"
                value={pitchAlgorithm()}
                onChange={(e) => {
                  setPitchAlgorithm(e.currentTarget.value as PitchAlgorithm)
                }}
              >
                <option value="yin">YIN (Classic)</option>
                <option value="mpm">MPM (McLeod)</option>
              </SafeSelect>
            </div>

            <Show when={pitchAlgorithm() === 'mpm'}>
              <div class={styles.settingsRow}>
                <label>Buffer Size</label>
                <div class={styles.pitchBufferPills}>
                  <For each={PITCH_BUFFER_SIZES}>
                    {(size) => (
                      <button
                        class={
                          pitchBufferSize() === size
                            ? [
                                styles.pitchBufferPill,
                                styles.pitchBufferPillActive,
                              ].join(' ')
                            : styles.pitchBufferPill
                        }
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
                class={styles.settingsDesc}
                style="margin-top: 4px; font-size: 0.7rem;"
              >
                {PITCH_BUFFER_DESCRIPTIONS[pitchBufferSize()]}
              </p>
            </Show>
          </div>

          {/* Pitch Detection Section */}
          <div class={styles.settingsSection}>
            <h3 class={styles.settingsSectionTitle}>Pitch Detection</h3>
            <div class={styles.settingsDivider} />

            <div class={styles.settingsRow}>
              <label for="set-threshold">Detection Threshold</label>
              <input
                type="range"
                id="set-threshold"
                min="5"
                max="20"
                step="1"
                value={Math.round(s().detectionThreshold * 100)}
                onInput={(e) => {
                  setDetectionThreshold(parseInt(e.currentTarget.value) / 100)
                }}
              />
              <span class={styles.settingsVal}>
                {s().detectionThreshold.toFixed(2)}
              </span>
              <small>Lower = stricter pitch detection</small>
            </div>

            <div class={styles.settingsRow}>
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
              <span class={styles.settingsVal}>{s().sensitivity}</span>
              <small>Higher = more responsive to quiet signals</small>
            </div>

            <div class={styles.settingsRow}>
              <label for="set-min-confidence">Min Confidence</label>
              <input
                type="range"
                id="set-min-confidence"
                min="30"
                max="90"
                step="5"
                value={Math.round(s().minConfidence * 100)}
                onInput={(e) => {
                  setMinConfidence(parseInt(e.currentTarget.value) / 100)
                }}
              />
              <span class={styles.settingsVal}>
                {Math.round(s().minConfidence * 100)}%
              </span>
              <small>Minimum confidence to accept a pitch</small>
            </div>

            <div class={styles.settingsRow}>
              <label for="set-amplitude">Min Amplitude</label>
              <input
                type="range"
                id="set-amplitude"
                min="1"
                max="10"
                step="1"
                value={s().minAmplitude}
                onInput={(e) => {
                  setMinAmplitude(parseInt(e.currentTarget.value))
                }}
              />
              <span class={styles.settingsVal}>{s().minAmplitude}</span>
              <small>
                Minimum signal loudness required (applies to all algorithms).
              </small>
            </div>
          </div>

          {/* Practice Aids Section */}
          <div
            class={styles.settingsSection}
            data-tour="settings.practice-aids"
          >
            <h3 class={styles.settingsSectionTitle}>Practice Aids</h3>
            <div class={styles.settingsDivider} />

            <div class={styles.settingsRow}>
              <label for="set-tonic-anchor">Tonic Anchor Tone</label>
              <label class={styles.settingsToggle}>
                <input
                  type="checkbox"
                  id="set-tonic-anchor"
                  checked={s().tonicAnchor}
                  onChange={(e) => {
                    setTonicAnchor(e.currentTarget.checked)
                  }}
                />
                <span class={styles.settingsSlider} />
              </label>
              <small>
                Play a reference tone at the start of each run to help lock in
                to the key
              </small>
            </div>
          </div>

          {/* Accuracy Bands Section */}
          <div class={styles.settingsSection}>
            <h3 class={styles.settingsSectionTitle}>Accuracy Bands</h3>
            <div class={styles.settingsDivider} />
            <p class={styles.settingsDesc}>
              Define how many cents off is "Perfect", "Good", etc.
            </p>

            <div class={styles.settingsRow}>
              <label for="band-perfect">Perfect (&le; cents)</label>
              <input
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

            <div class={styles.settingsRow}>
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

            <div class={styles.settingsRow}>
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

            <div class={styles.settingsRow}>
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
          <div class={styles.settingsSection}>
            <h3 class={styles.settingsSectionTitle}>Current Values</h3>
            <div class={styles.settingsDivider} />
            <div class={styles.settingsInfo}>
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
          <div class={styles.settingsSection} data-tour="settings.adsr">
            <h3 class={styles.settingsSectionTitle}>Tone Envelope (ADSR)</h3>
            <div class={styles.settingsDivider} />
            <p class={styles.settingsDesc}>
              Adjust the Attack, Decay, Sustain, Release envelope for note
              playback.
            </p>

            <div class={styles.settingsRow}>
              <label for="adsr-attack">Attack</label>
              <input
                type="range"
                id="adsr-attack"
                min="0"
                max="1000"
                step="10"
                value={adsr().attack}
                onInput={(e) => {
                  setAttack(parseInt(e.currentTarget.value))
                }}
              />
              <span class={styles.settingsVal}>{adsr().attack} ms</span>
              <small>Time to reach full volume</small>
            </div>

            <div class={styles.settingsRow}>
              <label for="adsr-decay">Decay</label>
              <input
                type="range"
                id="adsr-decay"
                min="0"
                max="1000"
                step="10"
                value={adsr().decay}
                onInput={(e) => {
                  setDecay(parseInt(e.currentTarget.value))
                }}
              />
              <span class={styles.settingsVal}>{adsr().decay} ms</span>
              <small>Time to fall to sustain level</small>
            </div>

            <div class={styles.settingsRow}>
              <label for="adsr-sustain">Sustain</label>
              <input
                type="range"
                id="adsr-sustain"
                min="0"
                max="100"
                step="5"
                value={adsr().sustain}
                onInput={(e) => {
                  setSustain(parseInt(e.currentTarget.value))
                }}
              />
              <span class={styles.settingsVal}>{adsr().sustain} %</span>
              <small>Volume during note held</small>
            </div>

            <div class={styles.settingsRow}>
              <label for="adsr-release">Release</label>
              <input
                type="range"
                id="adsr-release"
                min="0"
                max="2000"
                step="50"
                value={adsr().release}
                onInput={(e) => {
                  setRelease(parseInt(e.currentTarget.value))
                }}
              />
              <span class={styles.settingsVal}>{adsr().release} ms</span>
              <small>Time to fade after note ends</small>
            </div>
          </div>
        </Show>

        <Show when={activeTab() === 'display'}>
          {/* Appearance */}
          <div class={styles.settingsSection} data-tour="settings.appearance">
            <h3 class={styles.settingsSectionTitle}>Appearance</h3>
            <div class={styles.settingsDivider} />

            <p class={styles.settingsDesc}>
              Choose the application font. Changing this requires a reload.
            </p>
            <div class={styles.settingsRow}>
              <label for="font-select">Font Family</label>
              <SafeSelect
                value={fontFamily()}
                onChange={(e) => {
                  const newFont = e.target.value as FontFamily
                  if (newFont !== fontFamily()) {
                    setPendingFont(newFont)
                    setShowFontReloadConfirm(true)
                  }
                }}
                id="font-select"
              >
                <option value="inter">Inter (Clean & Modern)</option>
                <option value="outfit">Outfit (Creative)</option>
                <option value="plus-jakarta-sans">Plus Jakarta Sans</option>
                <option value="system">System Default</option>
              </SafeSelect>
            </div>
          </div>

          {/* Visibility Toggles */}
          <div class={styles.settingsSection} data-tour="settings.visibility">
            <h3 class={styles.settingsSectionTitle}>Visibility</h3>
            <div class={styles.settingsDivider} />
            <p class={styles.settingsDesc}>Show or hide interface elements.</p>

            <div class={styles.settingsRow}>
              <label for="vis-gridlines">Grid Lines</label>
              <label class={styles.settingsToggle}>
                <input
                  type="checkbox"
                  id="vis-gridlines"
                  checked={gridLinesVisible()}
                  onChange={(e) => {
                    setGridLinesVisible(e.currentTarget.checked)
                  }}
                />
                <span class={styles.settingsSlider} />
              </label>
              <small>Show horizontal and vertical grid lines</small>
            </div>

            <div class={styles.settingsRow}>
              <label for="vis-sidebar-notes">Sidebar Note List</label>
              <label class={styles.settingsToggle}>
                <input
                  type="checkbox"
                  id="vis-sidebar-notes"
                  checked={showSidebarNoteList()}
                  onChange={(e) => {
                    setShowSidebarNoteList(e.currentTarget.checked)
                  }}
                />
                <span class={styles.settingsSlider} />
              </label>
              <small>
                Show the detailed note list in the Practice sidebar. Hidden by
                default for a cleaner playback layout.
              </small>
            </div>

            <div class={styles.settingsRow}>
              <label for="vis-playback-setup">Playback Setup</label>
              <label class={styles.settingsToggle}>
                <input
                  type="checkbox"
                  id="vis-playback-setup"
                  checked={showPlaybackSetupInfo()}
                  onChange={(e) => {
                    setShowPlaybackSetup(e.currentTarget.checked)
                  }}
                />
                <span class={styles.settingsSlider} />
              </label>
              <small>Show Playback setup component in sidebar</small>
            </div>

            <div class={styles.settingsRow}>
              <label for="vis-stats">Stats Panel</label>
              <label class={styles.settingsToggle}>
                <input
                  type="checkbox"
                  id="vis-stats"
                  checked={showStats()}
                  onChange={(e) => {
                    setShowStats(e.currentTarget.checked)
                  }}
                />
                <span class={styles.settingsSlider} />
              </label>
              <small>Show accuracy stats (Practice tab)</small>
            </div>

            <div class={styles.settingsRow}>
              <label for="vis-pitch-display">Pitch Display</label>
              <label class={styles.settingsToggle}>
                <input
                  type="checkbox"
                  id="vis-pitch-display"
                  checked={showPitchDisplay()}
                  onChange={(e) => {
                    setShowPitchDisplay(e.currentTarget.checked)
                  }}
                />
                <span class={styles.settingsSlider} />
              </label>
              <small>Show live pitch tracker (Practice tab)</small>
            </div>

            <div class={styles.settingsRow}>
              <label for="vis-history">History Panel</label>
              <label class={styles.settingsToggle}>
                <input
                  type="checkbox"
                  id="vis-history"
                  checked={showHistoryPanel()}
                  onChange={(e) => {
                    setShowHistoryPanel(e.currentTarget.checked)
                  }}
                />
                <span class={styles.settingsSlider} />
              </label>
              <small>
                Show the live frequency / waveform history bars below the canvas
                (Practice tab). Off by default.
              </small>
            </div>

            <div class={styles.settingsRow}>
              <label for="vis-practice-result-popup">
                Practice Result Popup
              </label>
              <label class={styles.settingsToggle}>
                <input
                  type="checkbox"
                  id="vis-practice-result-popup"
                  checked={showPracticeResultPopup()}
                  onChange={(e) => {
                    setShowPracticeResultPopup(e.currentTarget.checked)
                  }}
                />
                <span class={styles.settingsSlider} />
              </label>
              <small>
                Show a score overlay after each practice run or session
                completes. When off, results are still recorded in history.
              </small>
            </div>

            <div class={styles.settingsRow}>
              <label for="vis-playback-ball">Jumping Ball (Playback)</label>
              <label class={styles.settingsToggle}>
                <input
                  type="checkbox"
                  id="vis-playback-ball"
                  checked={showPlaybackBall()}
                  onChange={(e) => {
                    const v = e.currentTarget.checked
                    setShowPlaybackBall(v)
                    if (!v && !showPlayhead()) setShowPlayhead(true)
                  }}
                />
                <span class={styles.settingsSlider} />
              </label>
              <small>
                Show the animated jumping ball during playback mode.
              </small>
            </div>

            <div class={styles.settingsRow}>
              <label for="vis-focus-ball">Jumping Ball (Focus Mode)</label>
              <label class={styles.settingsToggle}>
                <input
                  type="checkbox"
                  id="vis-focus-ball"
                  checked={showFocusBall()}
                  onChange={(e) => {
                    setShowFocusBall(e.currentTarget.checked)
                  }}
                />
                <span class={styles.settingsSlider} />
              </label>
              <small>
                Show the animated jumping ball during Focus mode. On by default.
              </small>
            </div>

            <div class={styles.settingsRow}>
              <label for="vis-playhead">Playhead</label>
              <label class={styles.settingsToggle}>
                <input
                  type="checkbox"
                  id="vis-playhead"
                  checked={showPlayhead()}
                  onChange={(e) => {
                    const v = e.currentTarget.checked
                    setShowPlayhead(v)
                    if (!v && !showPlaybackBall()) setShowPlaybackBall(true)
                  }}
                />
                <span class={styles.settingsSlider} />
              </label>
              <small>Show the vertical playhead line during playback</small>
            </div>

            <div class={styles.settingsRow}>
              <label for="vis-theme">Theme</label>
              <label>
                <SafeSelect
                  id="vis-theme"
                  value={theme()}
                  onChange={(e) => {
                    setTheme(e.currentTarget.value as 'dark' | 'light')
                  }}
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                </SafeSelect>
              </label>
              <small>Switch between dark and light mode</small>
            </div>
          </div>

          {/* Visualization Section */}
          <div
            class={styles.settingsSection}
            data-tour="settings.visualization"
          >
            <h3 class={styles.settingsSectionTitle}>Visualization</h3>
            <div class={styles.settingsDivider} />
            <p class={styles.settingsDesc}>
              Enhance the practice experience with visual feedback effects.
            </p>

            <div class={styles.settingsRow}>
              <label for="vis-flame">Burning Notes</label>
              <label class={styles.settingsToggle}>
                <input
                  type="checkbox"
                  id="vis-flame"
                  checked={flameMode()}
                  onChange={(e) => {
                    setFlameMode(e.currentTarget.checked)
                  }}
                />
                <span class={styles.settingsSlider} />
              </label>
              <small>
                Animate the currently-playing note with a burning fire effect
                synced to playback.
              </small>
            </div>

            <div class={styles.settingsRow}>
              <label for="vis-color-code">Accuracy Color Coding</label>
              <label class={styles.settingsToggle}>
                <input
                  type="checkbox"
                  id="vis-color-code"
                  checked={colorCodeNotes()}
                  onChange={(e) => {
                    setColorCodeNotes(e.currentTarget.checked)
                  }}
                />
                <span class={styles.settingsSlider} />
              </label>
              <small>
                Color-code played notes based on pitch accuracy (Green: Perfect,
                Teal: Excellent, etc).
              </small>
            </div>

            <div class={styles.settingsRow}>
              <label for="vis-accuracy-pct">Show Accuracy Percentage</label>
              <label class={styles.settingsToggle}>
                <input
                  type="checkbox"
                  id="vis-accuracy-pct"
                  checked={showAccuracyPercent()}
                  onChange={(e) => {
                    setShowAccuracyPercent(e.currentTarget.checked)
                  }}
                />
                <span class={styles.settingsSlider} />
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
            <div class={styles.settingsRow}>
              <label for="char-sounds">Character Sounds</label>
              <label class={styles.settingsToggle}>
                <input
                  type="checkbox"
                  id="char-sounds"
                  checked={characterSounds()}
                  onChange={(e) => {
                    setCharacterSounds(e.currentTarget.checked)
                  }}
                />
                <span class={styles.settingsSlider} />
              </label>
              <small>
                Play a different timbre per guide character (currently:{' '}
                <strong>
                  {CHARACTER_INFO[selectedCharacter()].displayName}
                </strong>
                ). Disable to use the instrument selected manually.
              </small>
            </div>
          </div>
        </Show>

        <Show when={activeTab() === 'singing'}>
          {/* Playback Speed Section */}
          <div class={styles.settingsSection}>
            <h3 class={styles.settingsSectionTitle}>Playback Speed</h3>
            <div class={styles.settingsDivider} />
            <p class={styles.settingsDesc}>
              Adjust the playback speed of the practice melody.
            </p>

            <div class={styles.settingsRow}>
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
              <span class={styles.settingsVal}>
                {playbackSpeed().toFixed(2)} x
              </span>
              <small>0.25 x = slowest, 2.0 x = fastest</small>
            </div>
          </div>

          {/* Reverb Section */}
          <div class={styles.settingsSection}>
            <h3 class={styles.settingsSectionTitle}>Reverb</h3>
            <div class={styles.settingsDivider} />
            <p class={styles.settingsDesc}>
              Add reverb (echo) to the practice playback for a richer sound.
            </p>

            <div class={styles.settingsRow}>
              <label for="reverb-type">Type</label>
              <SafeSelect
                id="reverb-type"
                value={reverbConfig().type}
                onChange={(e) => {
                  setReverbType(
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
              </SafeSelect>
            </div>

            <div class={styles.settingsRow}>
              <label for="reverb-wetness">Wet Mix</label>
              <input
                type="range"
                id="reverb-wetness"
                min="0"
                max="100"
                step="5"
                value={reverbConfig().wetness}
                onInput={(e) => {
                  setReverbWetness(parseInt(e.currentTarget.value))
                }}
              />
              <span class={styles.settingsVal}>{reverbConfig().wetness} %</span>
              <small>How much reverb vs dry signal</small>
            </div>
          </div>
        </Show>

        <Show when={activeTab() === 'display'}>
          {/* Keyboard Shortcuts Section */}
          <div class={styles.settingsSection} data-tour="settings.shortcuts">
            <h3 class={styles.settingsSectionTitle}>Keyboard Shortcuts</h3>
            <div class={styles.settingsDivider} />
            <p class={styles.settingsDesc}>
              Global shortcuts active when not typing in a text field.
            </p>
            <div class={styles.keymapTable}>
              <div class={[styles.keymapRow, styles.keymapHeader].join(' ')}>
                <span>Key</span>
                <span>Action</span>
              </div>
              <div class={styles.keymapRow}>
                <kbd>Space</kbd>
                <span>Play / Pause / Resume (focus mode)</span>
              </div>
              <div class={styles.keymapRow}>
                <kbd>Esc</kbd>
                <span>Exit focus mode / Stop playback</span>
              </div>
              <div class={styles.keymapRow}>
                <kbd>Home</kbd>
                <span>Go to beginning</span>
              </div>
              <div class={styles.keymapRow}>
                <kbd>R</kbd>
                <span>Toggle Repeat mode</span>
              </div>
              <div class={styles.keymapRow}>
                <kbd>P</kbd>
                <span>Toggle Practice mode</span>
              </div>
              <div class={styles.keymapRow}>
                <kbd>O</kbd>
                <span>Toggle Once mode</span>
              </div>
              <div class={styles.keymapRow}>
                <kbd>↑</kbd>
                <span>Increase playback speed</span>
              </div>
              <div class={styles.keymapRow}>
                <kbd>↓</kbd>
                <span>Decrease playback speed</span>
              </div>
            </div>
          </div>
        </Show>

        <Show when={activeTab() === 'account'}>
          {/* Danger Zone Section */}
          <div
            class={[styles.settingsSection, styles.settingsDangerZone].join(
              ' ',
            )}
          >
            <h3 class={styles.settingsSectionTitle}>Danger Zone</h3>
            <div
              class={[styles.settingsDivider, styles.dangerDivider].join(' ')}
            />
            <p class={styles.settingsDesc}>
              Irreversible actions that affect all your data.
            </p>

            {/* Clear only karaoke / vocal-separation data — keeps melodies,
                practice history, and settings intact. */}
            <div class={[styles.settingsRow, styles.dangerRow].join(' ')}>
              <div class={styles.dangerContent}>
                <label class={styles.dangerLabel}>
                  Clear Karaoke &amp; Vocal Separation Data
                </label>
                <small class={styles.dangerDesc}>
                  Delete all separated songs, stems, lyrics, and karaoke
                  playlists. Your melodies, practice history, and settings are
                  kept.
                </small>
              </div>
              <button
                class={styles.dangerBtn}
                data-testid="danger-clear-uvr-btn"
                onClick={() => setShowClearUvrConfirm(true)}
              >
                Clear
              </button>
            </div>

            <div class={[styles.settingsRow, styles.dangerRow].join(' ')}>
              <div class={styles.dangerContent}>
                <label class={styles.dangerLabel}>
                  Reset to Factory Defaults
                </label>
                <small class={styles.dangerDesc}>
                  Erase everything stored on this device — melodies, sessions,
                  karaoke files, settings, and sign-in — and reload the app with
                  factory defaults.
                </small>
              </div>
              <button
                class={styles.dangerBtn}
                data-testid="danger-reset-btn"
                onClick={() => setShowResetConfirm(true)}
              >
                Reset
              </button>
            </div>

            {/* Clear Karaoke/UVR Confirmation Modal */}
            <Show when={showClearUvrConfirm()}>
              <div class={styles.dangerConfirmOverlay}>
                <div
                  class={styles.dangerConfirmBox}
                  data-testid="danger-clear-uvr-box"
                >
                  <h4 class={styles.dangerConfirmTitle}>Clear Karaoke Data?</h4>
                  <p class={styles.dangerConfirmText}>
                    This permanently deletes every separated song, its stems and
                    lyrics, and all karaoke playlists. Melodies, practice
                    history, and settings are not affected. This cannot be
                    undone.
                  </p>
                  <div class={styles.dangerConfirmActions}>
                    <button
                      class={styles.dangerBtnSecondary}
                      data-testid="danger-clear-uvr-cancel-btn"
                      onClick={() => setShowClearUvrConfirm(false)}
                    >
                      Cancel
                    </button>
                    <button
                      class={styles.dangerBtnPrimary}
                      data-testid="danger-clear-uvr-confirm-btn"
                      onClick={() => {
                        void handleClearKaraokeData()
                      }}
                    >
                      Clear Karaoke Data
                    </button>
                  </div>
                </div>
              </div>
            </Show>

            {/* Reset Confirmation Modal */}
            <Show when={showResetConfirm()}>
              <div class={styles.dangerConfirmOverlay}>
                <div
                  class={styles.dangerConfirmBox}
                  data-testid="danger-confirm-box"
                >
                  <h4 class={styles.dangerConfirmTitle}>Confirm Reset</h4>
                  <p class={styles.dangerConfirmText}>
                    Are you sure you want to reset all data? This will clear all
                    stored melodies, presets, sessions, and settings. This
                    action cannot be undone.
                  </p>
                  <div class={styles.dangerConfirmActions}>
                    <button
                      class={styles.dangerBtnSecondary}
                      data-testid="danger-cancel-btn"
                      onClick={() => setShowResetConfirm(false)}
                    >
                      Cancel
                    </button>
                    <button
                      class={styles.dangerBtnPrimary}
                      data-testid="danger-confirm-btn"
                      onClick={() => {
                        void handleResetStorage()
                      }}
                    >
                      Reset All Data
                    </button>
                  </div>
                </div>
              </div>
            </Show>

            {/* Font Reload Confirmation Modal */}
            <Show when={showFontReloadConfirm()}>
              <div class={styles.dangerConfirmOverlay}>
                <div
                  class={styles.dangerConfirmBox}
                  role="dialog"
                  aria-modal="true"
                >
                  <h4 class={styles.dangerConfirmTitle}>Reload Required</h4>
                  <p class={styles.dangerConfirmText}>
                    Changing the font requires a page reload so the pitch
                    canvases can redraw correctly. Do you want to reload now?
                  </p>
                  <div class={styles.dangerConfirmActions}>
                    <button
                      class={styles.dangerBtnSecondary}
                      onClick={() => setShowFontReloadConfirm(false)}
                    >
                      Cancel
                    </button>
                    <button
                      class={styles.dangerBtnPrimary}
                      onClick={() => {
                        const pf = pendingFont()
                        if (pf) {
                          setFontFamily(pf)
                          window.location.reload()
                        }
                      }}
                    >
                      Yes, Reload
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
            <div
              class={[styles.settingsSection, styles.settingsDangerZone].join(
                ' ',
              )}
            >
              <h3
                class={styles.settingsSectionTitle}
                style="color: var(--yellow);"
              >
                Developer Tools
              </h3>
              <div
                class={styles.settingsDivider}
                style="background: linear-gradient(90deg, var(--yellow), transparent);"
              />
              <p class={styles.settingsDesc}>
                Development-only tools for debugging.
              </p>

              <div class={[styles.settingsRow, styles.dangerRow].join(' ')}>
                <div class={styles.dangerContent}>
                  <label
                    class={styles.dangerLabel}
                    style="color: var(--yellow);"
                  >
                    Test Crash Screen
                  </label>
                  <small class={styles.dangerDesc}>
                    Inject a rendering error to test the global CrashModal
                    boundary.
                  </small>
                </div>
                <button
                  class={styles.dangerBtn}
                  style="background: rgba(220, 160, 0, 0.1); color: var(--yellow); border-color: var(--yellow);"
                  onClick={() => setTestCrash(true)}
                >
                  Trigger Crash
                </button>
              </div>

              <div class={[styles.settingsRow, styles.dangerRow].join(' ')}>
                <div class={styles.dangerContent}>
                  <label
                    class={styles.dangerLabel}
                    style="color: var(--yellow);"
                  >
                    Developer Console Log
                  </label>
                  <small class={styles.dangerDesc}>
                    Toggle the visibility of the developer console log to
                    intercept and view errors/warnings on mobile.
                  </small>
                </div>
                <label class={styles.settingsToggle}>
                  <input
                    type="checkbox"
                    checked={showConsoleLog()}
                    onChange={() => toggleConsoleLog()}
                  />
                  <span class={styles.settingsSlider}></span>
                </label>
              </div>

              <Show when={showConsoleLog()}>
                <ConsoleLog />
              </Show>
            </div>
          </Show>

          {/* About Section */}
          <div class={styles.settingsSection} data-tour="settings.about">
            <h3 class={styles.settingsSectionTitle}>About MercuryPitch</h3>
            <div class={styles.settingsDivider} />
            <div class={styles.aboutContent}>
              <div class={styles.aboutLogo}>
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
              <p class={styles.aboutName} data-testid="about-name">
                MercuryPitch
              </p>
              <div style="display: flex; align-items: center; justify-content: center; gap: 0.5rem; margin-bottom: 1rem;">
                <p
                  class={styles.aboutVersion}
                  style="margin: 0;"
                  data-testid="about-version"
                >
                  v{APP_VERSION}-{COMMIT_SHA}
                </p>
                <Show when={IS_DEV}>
                  <span
                    class={[styles.featurePill, styles.pillDetection].join(' ')}
                    style="padding: 2px 6px; font-size: 0.7rem; font-weight: bold; background: var(--purple); color: white; border-radius: 4px; display: inline-flex; align-items: center;"
                  >
                    DEV
                  </span>
                </Show>
              </div>
              <button
                class={styles.whatsNewBtn}
                data-testid="whats-new-btn"
                onClick={() => setShowChangelog(true)}
              >
                <svg viewBox="0 0 24 24" width="14" height="14">
                  <path
                    fill="currentColor"
                    d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
                  />
                </svg>
                What's New
              </button>
              <p
                class={styles.aboutDesc}
                data-testid="about-desc"
                style="user-select: none; -webkit-user-select: none;"
              >
                Master your voice with MercuryPitch. Compose melodies, extract
                stems from any song, or jam in real-time. Practice with instant
                visual feedback and powerful vocal analysis tools.
              </p>
              <div class={styles.aboutFeatures} data-testid="about-features">
                <span
                  class={[styles.featurePill, styles.pillDetection].join(' ')}
                >
                  <svg viewBox="0 0 24 24" width="14" height="14">
                    <path
                      fill="currentColor"
                      d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zM17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"
                    />
                  </svg>
                  Real-time pitch detection
                </span>
                <span class={[styles.featurePill, styles.pillEditor].join(' ')}>
                  <svg viewBox="0 0 24 24" width="14" height="14">
                    <path
                      fill="currentColor"
                      d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"
                    />
                  </svg>
                  Piano roll editor
                </span>
                <span class={[styles.featurePill, styles.pillJam].join(' ')}>
                  <svg viewBox="0 0 24 24" width="14" height="14">
                    <path
                      fill="currentColor"
                      d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"
                    />
                  </svg>
                  Live Jam Sessions
                </span>
                <span class={[styles.featurePill, styles.pillShazam].join(' ')}>
                  <svg viewBox="0 0 24 24" width="14" height="14">
                    <path
                      fill="currentColor"
                      d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"
                    />
                  </svg>
                  Shazam Melody
                </span>
                <span
                  class={[styles.featurePill, styles.pillKaraoke].join(' ')}
                >
                  <svg viewBox="0 0 24 24" width="14" height="14">
                    <path
                      fill="currentColor"
                      d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6zM10 19.5v-2h4v2h-4z"
                    />
                  </svg>
                  Karaoke Stems
                </span>
                <span class={[styles.featurePill, styles.pillVocal].join(' ')}>
                  <svg viewBox="0 0 24 24" width="14" height="14">
                    <path
                      fill="currentColor"
                      d="M3 22v-2h18v2H3zm6-5H5V5h4v12zm6 0h-4v-7h4v7zm6 0h-4V9h4v8z"
                    />
                  </svg>
                  Vocal Analysis
                </span>
              </div>
              <ChangelogModal
                open={showChangelog()}
                onClose={() => setShowChangelog(false)}
              />
              <p class={styles.aboutCredits}>
                Vocal Pitch Practice — Redefined.
              </p>
              <div class={styles.aboutLinks}>
                <a
                  href="https://github.com/mercurypitch/mercurypitch"
                  target="_blank"
                  rel="noopener noreferrer"
                  class={styles.aboutLink}
                  data-testid="about-link"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16">
                    <path
                      fill="currentColor"
                      d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"
                    />
                  </svg>
                  View on GitHub
                </a>
                <a
                  href={TERMS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  class={styles.aboutLink}
                  data-testid="about-terms-link"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16">
                    <path
                      fill="currentColor"
                      d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"
                    />
                  </svg>
                  Terms of Use
                </a>
                <a
                  href={PRIVACY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  class={styles.aboutLink}
                  data-testid="about-privacy-link"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16">
                    <path
                      fill="currentColor"
                      d="M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"
                    />
                  </svg>
                  Privacy Notice
                </a>
              </div>
            </div>
          </div>
        </Show>
      </div>

      {/* Modals live at the panel root: their trigger buttons sit on the
          Practice sub-tab, so mounting them inside a tab-gated section
          (as before) made the buttons silently no-op on other tabs. */}
      <Show when={showVoiceDetector()}>
        <VoiceTypeDetectorModal onClose={() => setShowVoiceDetector(false)} />
      </Show>
      <Show when={showRangeTest()}>
        <VoiceRangeTestModal onClose={() => setShowRangeTest(false)} />
      </Show>
    </div>
  )
}

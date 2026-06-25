// ============================================================
// AppSidebar — Shared sidebar component
// Contains: Key/Scale controls, Grid toggle, NoteList, PitchDisplay, Stats
// Visible in all tabs; NoteList, PitchDisplay, stats wrapped in Show for Practice only
// ============================================================

import type { Component } from 'solid-js'
import { createMemo, createSignal, For, Show } from 'solid-js'
import { CharacterIcons } from '@/components/CharacterIcons'
import { IconDiamond } from '@/components/exercise-icons'
import { LibraryTab } from '@/components/LibraryTab'
import { NoteList } from '@/components/NoteList'
import { PitchDisplay } from '@/components/PitchDisplay'
import { SafeSelect } from '@/components/shared/SafeSelect'
import { StatsBars } from '@/components/StatsBars'
import { StreakCalendar } from '@/components/StreakCalendar'
import { CalendarHeatmap } from '@/features/practice-intelligence/components/CalendarHeatmap'
import { DailyRoutinePanel } from '@/features/routines/DailyRoutinePanel'
import { TAB_COMPOSE, TAB_SETTINGS, TAB_SINGING, } from '@/features/tabs/constants'
import { ratingToScore } from '@/lib/practice-engine'
import { KEY_OFFSETS, midiToFreq, midiToNote } from '@/lib/scale-data'
import { activeTab as appActiveTab, hasPageTour, sessionResults, setActiveTab, showNotification, startPageTour, } from '@/stores'
import { gridLinesVisible, keyName, scaleType, setGridLinesVisible, setKeyName, setScaleType, setShowPitchDisplay, setShowPlaybackBall, setShowPlayhead, setShowStats, showPitchDisplay, showPlaybackBall, showPlaybackSetupInfo, showPlayhead, showStats, } from '@/stores'
import { melodyStore } from '@/stores/melody-store'
import { CHARACTER_INFO, selectedCharacter, setShowSidebarNoteList, showSidebarNoteList, } from '@/stores/settings-store'
import { customScales as customScalesMap, customScaleTypeId, } from '@/stores/settings-store'
import type { MelodyItem, NoteResult, PitchResult } from '@/types'
import appStyles from './App.module.css'
import styles from './AppSidebar.module.css'
import { MicSensitivityControls } from './MicSensitivityControls'

interface AppSidebarProps {
  /** Called when a preset is loaded */
  onPresetLoad?: (name: string) => void
  /** For octave shift handler from parent */
  onOctaveShift?: (delta: number) => void
  /** Open scale builder modal */
  onOpenScaleBuilder?: () => void
  /** Open Learn walkthroughs */
  onOpenLearn?: () => void
  /** Open Guide tours */
  onOpenGuide?: () => void
  /** Note list props (Practice tab) */
  melody: () => MelodyItem[]
  currentNoteIndex: () => number
  noteResults: () => NoteResult[]
  isPlaying: () => boolean
  /** Pitch display props (Practice tab) */
  pitch: () => PitchResult | null
  targetNoteName: () => string | null
  /** Additional CSS class (e.g. 'open' for mobile toggle) */
  class?: string
  /** Called when the mobile close button is clicked */
  onClose?: () => void
  /** Whether the sidebar is collapsed (desktop) */
  collapsed?: boolean
  /** Called when the collapse toggle is clicked */
  onToggleCollapse?: () => void
  /** Sample the room and auto-pick a mic sensitivity preset. */
  onAutoCalibrate?: () => void | Promise<void>
}

export const AppSidebar: Component<AppSidebarProps> = (props) => {
  // Local alias for reactive tracking
  const activeTab = () => appActiveTab()
  const [viewOctave, setViewOctave] = createSignal(
    melodyStore.getCurrentOctave(),
  )

  const handleViewOctaveShift = (delta: number): void => {
    if (activeTab() === TAB_COMPOSE) {
      // Editor is allowed to mutate the actual melody (transpose notes).
      props.onOctaveShift?.(delta)
      setViewOctave(melodyStore.getCurrentOctave())
      return
    }

    // Practice/sidebar playback setup is view-only: change the displayed
    // scale/octave reference without modifying the user's saved melody.
    const nextOctave = Math.max(1, Math.min(6, viewOctave() + delta))
    setViewOctave(nextOctave)
    melodyStore.setOctave(nextOctave)
    melodyStore.refreshScale(keyName(), nextOctave, scaleType())
  }
  const isPracticeOrSettingsTab = () =>
    ([TAB_SINGING, TAB_SETTINGS] as string[]).includes(activeTab())

  // Live score derived from noteResults — updates as each note is played.
  const liveScore = createMemo(() => {
    const results = props.noteResults()
    if (results.length === 0) return null
    let total = 0
    for (const r of results) {
      total += ratingToScore(r.rating)
    }
    return Math.round(total / results.length)
  })

  return (
    <aside
      class={`app-sidebar${props.class !== undefined && props.class !== '' ? ` ${props.class}` : ''}${(props.collapsed ?? false) ? ' collapsed' : ''}`}
    >
      {/* Desktop collapse toggle */}
      <button
        class={styles.sidebarCollapseBtn}
        onClick={() => props.onToggleCollapse?.()}
        title={
          (props.collapsed ?? false) ? 'Expand sidebar' : 'Collapse sidebar'
        }
      >
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          style={{
            transform: (props.collapsed ?? false) ? 'rotate(180deg)' : '',
          }}
        >
          <path
            fill="currentColor"
            d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"
          />
        </svg>
      </button>

      {/* Mobile close button */}
      <button
        class={styles.sidebarCloseBtn}
        onClick={() => props.onClose?.()}
        title="Close menu"
        aria-label="Close menu"
      >
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path
            fill="currentColor"
            d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
          />
        </svg>
      </button>

      {/* Current melody indicator pill */}
      <Show when={melodyStore.getCurrentMelody()}>
        <button
          class={appStyles.melodyIndicatorPill}
          style={{
            'margin-bottom': '8px',
            'align-self': 'center',
            'max-width': '100%',
            'flex-shrink': 0,
          }}
          onClick={() => void setActiveTab(TAB_SINGING)}
          title={`Now loaded: ${melodyStore.getCurrentMelody()?.name ?? 'Untitled'}`}
        >
          <svg
            class={appStyles.melodyIndicatorIcon}
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
          <span class={appStyles.melodyIndicatorInfo}>
            <span class={appStyles.melodyIndicatorName}>
              {melodyStore.getCurrentMelody()?.name ?? 'Untitled'}
            </span>
            <span class={appStyles.melodyIndicatorCharacter}>
              {CHARACTER_INFO[selectedCharacter()].displayName}
            </span>
          </span>
        </button>
      </Show>

      {/* Learn + Guide buttons */}
      <div class={styles.walkthroughControlGroup}>
        <button
          class={styles.walkthroughControlBtn}
          onClick={() => props.onOpenLearn?.()}
          title="View MercuryPitch walkthroughs"
        >
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path
              fill="currentColor"
              d="M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.43.3 4.5 1.5.15.15.35.05.5 0 .1-.1.1-.25 0-.35C21.25 20 21 19.75 21 19.5V5z"
            />
          </svg>
          <span class={styles.walkthroughControlText}>Learn</span>
        </button>
        <button
          class={[
            styles.walkthroughControlBtn,
            styles.walkthroughControlBtnGuide,
          ].join(' ')}
          onClick={() => props.onOpenGuide?.()}
          title="Interactive guide tours"
        >
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path
              fill="currentColor"
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"
            />
          </svg>
          <span class={styles.walkthroughControlText}>Guide</span>
        </button>
        <Show when={hasPageTour(activeTab())}>
          <button
            class={styles.walkthroughControlBtn}
            onClick={() => startPageTour(activeTab())}
            title="Take a guided tour of this page"
          >
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path
                fill="currentColor"
                d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 4l5 2.5L12 11 7 8.5 12 6zm-5 4l5 2.5V18l-5-2.5V10zm10 0v5.5L12 18v-5.5L17 10z"
              />
            </svg>
            <span class={styles.walkthroughControlText}>Tour</span>
          </button>
        </Show>
      </div>

      <CharacterIcons
        onSelect={(name) => showNotification(`Selected ${name}!`, 'info')}
      />

      {/* Playback Setup section */}
      <Show when={showPlaybackSetupInfo()}>
        <div class={styles.sidebarSection}>
          <h2 class={styles.panelTitle}>Playback Setup</h2>

          <div class={styles.scaleInfo}>
            <SafeSelect
              class={['dropdown-select-style', styles.keySelect].join(' ')}
              id="key-select"
              value={keyName()}
              onChange={(e) => {
                const newKey = e.currentTarget.value
                const currentKey = keyName()

                // In Editor tab, the key dropdown is an editing operation and
                // may transpose the actual melody. In Practice/sidebar usage it
                // must be view-only: update key/scale display, but never write
                // transposed notes back into the user's melody.
                const melody = melodyStore.getCurrentItems()
                if (activeTab() === TAB_COMPOSE && melody.length > 0) {
                  const currentOffset = KEY_OFFSETS[currentKey] ?? 0
                  const newOffset = KEY_OFFSETS[newKey] ?? 0
                  const delta = newOffset - currentOffset

                  if (delta !== 0) {
                    const transposed = melody.map((item) => {
                      const newMidi = item.note.midi + delta
                      const { name, octave } = midiToNote(newMidi)
                      return {
                        ...item,
                        note: {
                          ...item.note,
                          midi: newMidi,
                          name,
                          octave,
                          freq: midiToFreq(newMidi),
                        },
                      }
                    })
                    melodyStore.setMelody(transposed)
                  }
                }

                setKeyName(newKey)
                melodyStore.refreshScale(
                  newKey,
                  melodyStore.getCurrentOctave(),
                  scaleType(),
                )
              }}
            >
              <option value="C">C</option>
              <option value="G">G</option>
              <option value="D">D</option>
              <option value="A">A</option>
              <option value="E">E</option>
              <option value="B">B</option>
              <option value="F">F</option>
              <option value="Bb">Bb</option>
            </SafeSelect>

            <div class={styles.octaveCtrl} data-testid="octave-ctrl">
              <button
                class={styles.octaveBtn}
                data-testid="octave-btn-down"
                title="Lower octave"
                aria-label="Lower octave"
                onClick={() => handleViewOctaveShift(-1)}
              >
                <svg viewBox="0 0 24 24" width="14" height="14">
                  <path
                    fill="currentColor"
                    d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"
                  />
                </svg>
              </button>
              <span class={styles.octaveValue} data-testid="octave-value">
                {viewOctave()}
              </span>
              <button
                class={styles.octaveBtn}
                data-testid="octave-btn-up"
                title="Higher octave"
                aria-label="Higher octave"
                onClick={() => handleViewOctaveShift(1)}
              >
                <svg viewBox="0 0 24 24" width="14" height="14">
                  <path
                    fill="currentColor"
                    d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"
                  />
                </svg>
              </button>
            </div>

            <SafeSelect
              id="scale-select"
              class={['dropdown-select-style', styles.scaleSelect].join(' ')}
              value={scaleType()}
              onChange={(e) => {
                const st = e.currentTarget.value
                setScaleType(st)
                melodyStore.refreshScale(
                  keyName(),
                  melodyStore.getCurrentOctave(),
                  st,
                )
              }}
            >
              <option value="major">Major</option>
              <option value="natural-minor">Minor (Natural)</option>
              <option value="harmonic-minor">Harmonic Minor</option>
              <option value="melodic-minor">Melodic Minor</option>
              <option value="dorian">Dorian</option>
              <option value="mixolydian">Mixolydian</option>
              <option value="phrygian">Phrygian</option>
              <option value="lydian">Lydian</option>
              <option value="pentatonic-major">Pentatonic Major</option>
              <option value="pentatonic-minor">Pentatonic Minor</option>
              <option value="blues">Blues</option>
              <option value="chromatic">Chromatic</option>
              {/* Custom scales saved by the user */}
              <Show when={Object.keys(customScalesMap()).length > 0}>
                <option disabled class={styles.customScaleSeparator}>
                  {'─── Custom Scales ───'}
                </option>
                <For each={Object.keys(customScalesMap()).sort()}>
                  {(name) => (
                    <option
                      class={styles.customScaleOption}
                      value={customScaleTypeId(name, customScalesMap()[name])}
                    >
                      <IconDiamond size={12} /> {name}
                    </option>
                  )}
                </For>
              </Show>
            </SafeSelect>
            <button
              id="open-scale-builder"
              class={[
                'ctrl-btn',
                'roll-ctrl-btn',
                styles.openScaleBuilder,
              ].join(' ')}
              title="Build custom scale"
              onClick={() => props.onOpenScaleBuilder?.()}
            >
              <svg
                viewBox="0 0 24 24"
                width="14"
                height="14"
                style={{ 'margin-right': '4px' }}
              >
                <path
                  fill="currentColor"
                  d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"
                />
              </svg>
              Custom
            </button>
          </div>
        </div>
      </Show>

      {/* Mic & sensitivity quick presets (practice/singing) */}
      <Show when={isPracticeOrSettingsTab()}>
        <div class={styles.sidebarSection}>
          <h2 class={styles.panelTitle}>Mic &amp; Sensitivity</h2>
          <MicSensitivityControls onAutoCalibrate={props.onAutoCalibrate} />
        </div>
      </Show>

      {/* Quick visibility toggles — compact 2x3 grid */}
      <div class={[styles.sidebarSection, styles.visGrid].join(' ')}>
        <div class={styles.visGridCell}>
          <span class={styles.visGridLabel}>Ball</span>
          <label class={['settings-toggle', styles.visGridToggle].join(' ')}>
            <input
              type="checkbox"
              checked={showPlaybackBall()}
              onChange={(e) => {
                const v = e.currentTarget.checked
                setShowPlaybackBall(v)
                if (!v && !showPlayhead()) setShowPlayhead(true)
              }}
            />
            <span class="settings-slider" />
          </label>
        </div>
        <div class={styles.visGridCell}>
          <span class={styles.visGridLabel}>Playhead</span>
          <label class={['settings-toggle', styles.visGridToggle].join(' ')}>
            <input
              type="checkbox"
              checked={showPlayhead()}
              onChange={(e) => {
                const v = e.currentTarget.checked
                setShowPlayhead(v)
                if (!v && !showPlaybackBall()) setShowPlaybackBall(true)
              }}
            />
            <span class="settings-slider" />
          </label>
        </div>
        <div class={styles.visGridCell}>
          <span class={styles.visGridLabel}>Grid</span>
          <label class={['settings-toggle', styles.visGridToggle].join(' ')}>
            <input
              type="checkbox"
              checked={gridLinesVisible()}
              onChange={(e) => {
                setGridLinesVisible(e.currentTarget.checked)
              }}
            />
            <span class="settings-slider" />
          </label>
        </div>
        <div class={styles.visGridCell}>
          <span class={styles.visGridLabel}>Notes</span>
          <label class={['settings-toggle', styles.visGridToggle].join(' ')}>
            <input
              type="checkbox"
              checked={showSidebarNoteList()}
              onChange={(e) => {
                setShowSidebarNoteList(e.currentTarget.checked)
              }}
            />
            <span class="settings-slider" />
          </label>
        </div>
        <div class={styles.visGridCell}>
          <span class={styles.visGridLabel}>Stats</span>
          <label class={['settings-toggle', styles.visGridToggle].join(' ')}>
            <input
              type="checkbox"
              checked={showStats()}
              onChange={(e) => {
                setShowStats(e.currentTarget.checked)
              }}
            />
            <span class="settings-slider" />
          </label>
        </div>
        <div class={styles.visGridCell}>
          <span class={styles.visGridLabel}>Pitch</span>
          <label class={['settings-toggle', styles.visGridToggle].join(' ')}>
            <input
              type="checkbox"
              checked={showPitchDisplay()}
              onChange={(e) => {
                setShowPitchDisplay(e.currentTarget.checked)
              }}
            />
            <span class="settings-slider" />
          </label>
        </div>
      </div>
      <div class={styles.fancyDivider} />

      {/* Library */}
      <div class={styles.sidebarSection}>
        <LibraryTab />
      </div>

      {/* Daily Routine */}
      <div class={styles.sidebarSection}>
        <DailyRoutinePanel />
      </div>

      {/* Streak Calendar */}
      <div class={styles.sidebarSection}>
        <h3 class={styles.panelTitle}>Activity</h3>
        <StreakCalendar />
      </div>

      {/* Stats panel */}
      <Show when={isPracticeOrSettingsTab() && showStats()}>
        <div class={styles.sidebarSection}>
          <div class={styles.statsPanel}>
            <h3>Accuracy</h3>
            <StatsBars noteResults={props.noteResults} />
            <div class={styles.scoreDisplay} data-testid="score-display">
              <span class={styles.scoreLabel} data-testid="score-label">
                Score:
              </span>
              <span class={styles.scoreValue} data-testid="score-value">
                {liveScore() !== null ? `${liveScore()}%` : '--'}
              </span>
            </div>

            {/* Session history — practice tab only */}
            <Show when={sessionResults().length > 0}>
              <div
                id="session-history-panel"
                class={styles.sessionHistoryPanel}
              >
                <h3>Sessions</h3>
                <div
                  id="session-history-list"
                  class={styles.sessionHistoryList}
                >
                  <For each={sessionResults()}>
                    {(entry) => (
                      <div
                        class={styles.sessionHistoryEntry}
                        data-testid="session-history-entry"
                      >
                        <span class={styles.sessionHistoryName}>
                          {entry.sessionName}
                        </span>
                        <span
                          class={[
                            styles.sessionHistoryScore,
                            entry.score >= 80
                              ? styles.scoreHigh
                              : entry.score >= 50
                                ? styles.scoreMid
                                : styles.scoreLow,
                          ].join(' ')}
                        >
                          {entry.score}%
                        </span>
                      </div>
                    )}
                  </For>
                </div>
                <div class={styles.heatmapWrapper}>
                  <CalendarHeatmap weeks={8} />
                </div>
              </div>
            </Show>
          </div>
        </div>
      </Show>

      {/* Note list (bottom-anchored) */}
      <Show when={isPracticeOrSettingsTab() && showSidebarNoteList()}>
        <div
          class={[styles.sidebarSection, styles.sidebarNotesBottom].join(' ')}
        >
          <NoteList
            melody={props.melody}
            currentNoteIndex={props.currentNoteIndex}
            noteResults={props.noteResults}
            isPlaying={props.isPlaying}
          />
        </div>
      </Show>

      {/* Pitch display (bottom-anchored) */}
      <Show when={isPracticeOrSettingsTab() && showPitchDisplay()}>
        <div
          class={[styles.sidebarSection, styles.sidebarNotesBottom].join(' ')}
        >
          <PitchDisplay pitch={props.pitch} targetNote={props.targetNoteName} />
        </div>
      </Show>
    </aside>
  )
}

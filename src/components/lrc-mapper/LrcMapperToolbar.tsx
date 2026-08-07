// ============================================================
// LrcMapperToolbar — the mapping session's controls
// ============================================================
//
// Two rows and a note: what you press while mapping, how the mapping behaves,
// and what the current mode expects of you.
//
// Extracted from StemMixerLyricsPanelBody (Phase 2 of
// docs/plans/lrc-mapper-studio-plan.md) so the full-screen stage can lay the
// same controls out differently without a second implementation of them.

import type { Accessor, Component, Setter } from 'solid-js'
import { createSignal, For, Show } from 'solid-js'
import { SafeSelect } from '@/components/shared/SafeSelect'
import type { LrcGenPass } from '@/features/stem-mixer/lrc-gen-passes'
import { TapCalibrationPanel } from '@/features/stem-mixer/TapCalibrationPanel'
import type { BlockInfo, BlockInstancesMap, LrcGenInputMode, LyricsBlock, } from '@/features/stem-mixer/types'
import { formatPlaybackSpeed, STEM_MIXER_PLAYBACK_SPEEDS, } from '@/lib/playback-speed-options'

export interface LrcMapperToolbarProps {
  lrcGenPass: Accessor<LrcGenPass>
  setLrcGenPass: (pass: LrcGenPass) => void
  lrcGenInputMode: Accessor<LrcGenInputMode>
  setLrcGenInputMode: Setter<LrcGenInputMode>
  lrcGenLineIdx: Accessor<number>
  lrcGenWordIdx: Accessor<number>
  wordPassProgress: Accessor<{ done: number; total: number }>
  getGenLines: () => string[]

  genShiftMs: Accessor<number>
  shiftGenTimings: (deltaMs: number) => number
  lrcTimingOffsetMs: Accessor<number>
  setLrcTimingOffsetMs: Setter<number>

  liveHighlight: Accessor<boolean>
  setLiveHighlight: (on: boolean) => void
  /** Shared with the row list, which reads it when a preview button is hit. */
  loopPreview: Accessor<boolean>
  setLoopPreview: Setter<boolean>
  setPreviewLoop: (loop: boolean) => void

  playing: Accessor<boolean>
  handlePlay: () => void
  handlePause: () => void
  playbackSpeed: Accessor<number>
  setPlaybackSpeed: (speed: number) => void

  handleNextLine: () => void
  handleNextWord: () => void
  handleRedoCurrentLine: () => void
  handleLrcGenFinish: () => void
  handleLrcGenReset: () => void

  blockInstances: Accessor<BlockInstancesMap>
  getBlockById: (blockId: string) => LyricsBlock | undefined
  getBlockForLine: (lineIdx: number) => BlockInfo | null

  /**
   * Which half to render.
   *
   * The panel shows both rows stacked. The full-screen stage splits them: the
   * actions belong on the surface where they can be pressed in time with the
   * music, and everything else lives behind its settings menu. Same controls,
   * two layouts — the alternative was a second implementation of each.
   */
  variant?: 'panel' | 'stage-actions' | 'stage-settings'
  /** Extra classes on the toolbar container. */
  class?: string
  /**
   * Open the full-screen mapper. Absent on the stage itself, where the
   * button would only lead back to where you already are.
   */
  onExpand?: () => void
}

export const LrcMapperToolbar: Component<LrcMapperToolbarProps> = (props) => {
  const [showCalibration, setShowCalibration] = createSignal(false)
  const variant = () => props.variant ?? 'panel'
  const showActions = () => variant() !== 'stage-settings'
  const showSettings = () => variant() !== 'stage-actions'
  // The stage footer carries its own transport and puts progress in the
  // header, so repeating them here would put two Play buttons on one screen.
  const showTransport = () => variant() === 'panel'
  const loopPreview = () => props.loopPreview()
  const setLoopPreview = (on: boolean) => props.setLoopPreview(on)

  return (
    <>
      <div
        class={`sm-lyrics-gen-toolbar${
          props.class !== undefined && props.class !== ''
            ? ` ${props.class}`
            : ''
        }`}
      >
        {/* Row 1 — what you press while mapping. Row 2 is how it behaves.
          Splitting them keeps the buttons that take a tap-accurate press
          away from the settings that only get touched once a session. */}
        <Show when={showActions()}>
          <div class="sm-lyrics-gen-row">
            <Show when={showTransport() && !props.playing()}>
              <button
                class="sm-lyrics-gen-play-btn"
                onClick={() => props.handlePlay()}
                title="Play"
              >
                <svg viewBox="0 0 24 24" width="12" height="12">
                  <path fill="currentColor" d="M8 5v14l11-7z" />
                </svg>
              </button>
            </Show>
            <Show when={showTransport() && props.playing()}>
              <button
                class="sm-lyrics-gen-pause-btn"
                onClick={() => props.handlePause()}
                title="Pause"
              >
                <svg viewBox="0 0 24 24" width="12" height="12">
                  <path
                    fill="currentColor"
                    d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"
                  />
                </svg>
              </button>
            </Show>
            <Show when={showTransport()}>
              <span class="sm-lyrics-gen-progress">
                {(() => {
                  // The word pass only stops on lines that have words to
                  // place, so counting every line there would understate it.
                  if (props.lrcGenPass() === 'words') {
                    const { done, total } = props.wordPassProgress()
                    return `${Math.min(done, total)}/${total}`
                  }
                  return `${Math.min(
                    props.lrcGenLineIdx(),
                    props.getGenLines().length,
                  )}/${props.getGenLines().length}`
                })()}
                {(() => {
                  const lines = props.getGenLines()
                  const idx = props.lrcGenLineIdx()
                  if (idx < lines.length) {
                    const wc = lines[idx]
                      .split(/\s+/)
                      .filter((w: string) => w.length > 0).length
                    return (
                      <>
                        {' '}
                        w{Math.min(props.lrcGenWordIdx(), wc)}/{wc}
                      </>
                    )
                  }
                  return null
                })()}
              </span>
            </Show>
            {(() => {
              const idx = props.lrcGenLineIdx()
              const lines = props.getGenLines()
              if (idx < lines.length) {
                const bi = props.getBlockForLine(idx)
                if (bi) {
                  const block = props.getBlockById(bi.blockId)
                  const total = props.blockInstances()[bi.blockId]?.length ?? 1
                  if (block) {
                    return (
                      <span class="sm-lyrics-gen-instance-badge">
                        {block.label} ({bi.instanceIdx + 1}/{total})
                      </span>
                    )
                  }
                }
              }
              return null
            })()}
            <Show when={props.lrcGenInputMode() === 'tap'}>
              <button
                class="sm-lyrics-gen-nextword-btn"
                onClick={() => props.handleNextWord()}
                title="Stamp the next word onset [W]"
              >
                Next Word
              </button>
              <button
                class="sm-lyrics-gen-nextline-btn"
                onClick={() => props.handleNextLine()}
                title="Stamp the next line onset [L]"
              >
                Next Line
              </button>
            </Show>
            <Show when={props.onExpand !== undefined}>
              <button
                class="sm-lyrics-gen-expand-btn"
                onClick={() => props.onExpand?.()}
                title="Map full screen"
              >
                <svg height="11" viewBox="0 0 24 24" width="11">
                  <path
                    d="M4 4h6v2H6v4H4V4zm10 0h6v6h-2V6h-4V4zM4 14h2v4h4v2H4v-6zm14 0h2v6h-6v-2h4v-4z"
                    fill="currentColor"
                  />
                </svg>
                Full screen
              </button>
            </Show>
            <button
              class="sm-lyrics-gen-redo-btn"
              onClick={() => props.handleRedoCurrentLine()}
              title="Clear and replay the current line"
            >
              Redo line
            </button>
            <span class="sm-lyrics-gen-row-gap" />
            <button
              class="sm-lyrics-gen-finish-btn"
              onClick={() => props.handleLrcGenFinish()}
              title="Save LRC"
            >
              Finish
            </button>
            <button
              class="sm-lyrics-gen-reset-btn"
              onClick={() => props.handleLrcGenReset()}
              title="Restore the lyrics and timings from before this mapping session"
            >
              Discard changes
            </button>
          </div>
        </Show>

        <Show when={showSettings()}>
          <div class="sm-lyrics-gen-row sm-lyrics-gen-row--settings">
            <div class="sm-lyrics-gen-field">
              <span class="sm-lyrics-gen-field-label">Map</span>
              <div
                class="sm-lyrics-gen-mode-switch"
                role="group"
                aria-label="Mapping pass"
              >
                <button
                  classList={{
                    'sm-lyrics-gen-mode-btn': true,
                    'sm-lyrics-gen-mode-btn--active':
                      props.lrcGenPass() === 'all',
                  }}
                  aria-pressed={props.lrcGenPass() === 'all'}
                  onClick={() => props.setLrcGenPass('all')}
                  title="Everything in one go — each tap places the next word, and a line's first word places its start"
                >
                  All
                </button>
                <button
                  classList={{
                    'sm-lyrics-gen-mode-btn': true,
                    'sm-lyrics-gen-mode-btn--active':
                      props.lrcGenPass() === 'lines',
                  }}
                  aria-pressed={props.lrcGenPass() === 'lines'}
                  onClick={() => props.setLrcGenPass('lines')}
                  title="Place the start of each line only"
                >
                  Lines
                </button>
                <button
                  classList={{
                    'sm-lyrics-gen-mode-btn': true,
                    'sm-lyrics-gen-mode-btn--active':
                      props.lrcGenPass() === 'words',
                  }}
                  aria-pressed={props.lrcGenPass() === 'words'}
                  onClick={() => props.setLrcGenPass('words')}
                  title="Line starts are frozen; place the words inside each line"
                >
                  Words
                </button>
              </div>
            </div>
            <div class="sm-lyrics-gen-field">
              <span class="sm-lyrics-gen-field-label">Input</span>
              <div
                class="sm-lyrics-gen-mode-switch"
                role="group"
                aria-label="Lyric mapping input"
              >
                <button
                  classList={{
                    'sm-lyrics-gen-mode-btn': true,
                    'sm-lyrics-gen-mode-btn--active':
                      props.lrcGenInputMode() === 'marker',
                  }}
                  aria-pressed={props.lrcGenInputMode() === 'marker'}
                  onClick={() => props.setLrcGenInputMode('marker')}
                >
                  Marker
                </button>
                <button
                  classList={{
                    'sm-lyrics-gen-mode-btn': true,
                    'sm-lyrics-gen-mode-btn--active':
                      props.lrcGenInputMode() === 'tap',
                  }}
                  aria-pressed={props.lrcGenInputMode() === 'tap'}
                  onClick={() => props.setLrcGenInputMode('tap')}
                >
                  Tap
                </button>
              </div>
            </div>
            <label
              class="sm-lyrics-gen-toggle"
              title="While the song plays, light the words from the timings you have mapped so far — the same highlighting you get outside the mapper"
            >
              <input
                type="checkbox"
                checked={props.liveHighlight()}
                onChange={(e) =>
                  props.setLiveHighlight(e.currentTarget.checked)
                }
              />
              <span>Live highlight</span>
            </label>
            <label
              class="sm-lyrics-gen-toggle"
              title="When you preview a line with its play button, repeat it instead of stopping at the end"
            >
              <input
                type="checkbox"
                checked={loopPreview()}
                onChange={(e) => {
                  const on = e.currentTarget.checked
                  setLoopPreview(on)
                  // Apply to a preview that is already running, so the toggle
                  // is never a control that appears to do nothing.
                  props.setPreviewLoop(on)
                }}
              />
              <span>Repeat line</span>
            </label>
            <label class="sm-lyrics-gen-speed">
              <span>Speed</span>
              <SafeSelect
                class="sm-lyrics-gen-speed-select"
                value={String(props.playbackSpeed())}
                onChange={(e) =>
                  props.setPlaybackSpeed(Number(e.currentTarget.value))
                }
                aria-label="Mapping playback speed"
              >
                <For each={STEM_MIXER_PLAYBACK_SPEEDS}>
                  {(speed) => (
                    <option value={speed}>{formatPlaybackSpeed(speed)}</option>
                  )}
                </For>
              </SafeSelect>
            </label>
            <label class="sm-lyrics-gen-offset">
              <span>Reaction</span>
              <input
                type="number"
                min="0"
                max="500"
                step="10"
                value={props.lrcTimingOffsetMs()}
                onChange={(e) => {
                  const value = Number(e.currentTarget.value)
                  props.setLrcTimingOffsetMs(
                    Number.isFinite(value)
                      ? Math.max(0, Math.min(500, value))
                      : 0,
                  )
                }}
                aria-label="Reaction correction in milliseconds"
              />
              <span>ms</span>
              <button
                class="sm-lyrics-gen-calib-btn"
                onClick={() => setShowCalibration((prev) => !prev)}
                aria-expanded={showCalibration()}
                title="Measure your reaction time instead of guessing it"
              >
                Calibrate
              </button>
            </label>
            {/* Reaction corrects the taps you are about to make. This moves
            the ones already placed — a different job, so it gets its own
            field rather than another number in that one. */}
            <div
              class="sm-lyrics-gen-shift"
              role="group"
              aria-label="Shift every mapped timing"
            >
              <span class="sm-lyrics-gen-field-label">Shift all</span>
              <For each={[-100, -10] as const}>
                {(step) => (
                  <button
                    class="sm-lyrics-gen-shift-btn"
                    onClick={() => props.shiftGenTimings(step)}
                    title={`Move every mapped timing ${-step} ms earlier`}
                  >
                    {step}
                  </button>
                )}
              </For>
              <span
                class="sm-lyrics-gen-shift-readout"
                aria-live="polite"
                title="How far this session has moved the whole mapping"
              >
                {props.genShiftMs() > 0 ? '+' : ''}
                {props.genShiftMs()} ms
              </span>
              <For each={[10, 100] as const}>
                {(step) => (
                  <button
                    class="sm-lyrics-gen-shift-btn"
                    onClick={() => props.shiftGenTimings(step)}
                    title={`Move every mapped timing ${step} ms later`}
                  >
                    +{step}
                  </button>
                )}
              </For>
              <button
                class="sm-lyrics-gen-shift-btn"
                disabled={props.genShiftMs() === 0}
                onClick={() => props.shiftGenTimings(-props.genShiftMs())}
                title="Undo this session's shift"
              >
                Reset
              </button>
            </div>
          </div>
        </Show>
      </div>
      <Show when={showSettings() && showCalibration()}>
        <TapCalibrationPanel
          currentOffsetMs={props.lrcTimingOffsetMs()}
          onApply={(ms) => props.setLrcTimingOffsetMs(ms)}
          onClose={() => setShowCalibration(false)}
        />
      </Show>
      <Show when={showSettings()}>
        <div class="sm-lyrics-gen-guidance" role="note">
          <Show
            when={props.lrcGenPass() === 'lines'}
            fallback={
              <>
                <Show
                  when={props.lrcGenInputMode() === 'marker'}
                  fallback={
                    <>
                      Tap at the first audible sound of each word, not after the
                      singer finishes it. Use Next Line only to skip the
                      remaining words.
                    </>
                  }
                >
                  Press the highlighted word when its first sound begins, then
                  drag through the text as it is sung. Hold still on long vowels
                  and lift at a pause or after the final sound.
                </Show>
                <Show when={props.lrcGenPass() === 'words'}>
                  {' '}
                  Line starts are frozen, so the cursor begins at the second
                  word and single-word lines are skipped.
                </Show>
              </>
            }
          >
            Lines — place only the start of each line. Fetched lyrics usually
            have these already, so play through and re-tap only the lines that
            drift, then switch to Words. Map everything in one stream with All.
          </Show>
          <span class="sm-lyrics-gen-guidance-performance">
            Pitch and live monitors pause for smoother input; the vocal overview
            stays active. Discard changes restores your pre-mapping snapshot.
          </span>
        </div>
      </Show>
    </>
  )
}

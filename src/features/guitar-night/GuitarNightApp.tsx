// Guitar Night presents the inert Velvet Rehearsal entry before any audio or input lifetime begins.
// ============================================================
/*
THESIS: The player enters a private rehearsal room, not a configuration dashboard.
OWN-WORLD: Velvet curtains, walnut, warm ivory, amber lamps, and quiet teal room status.
STORY: Choose a first win, bring one song, or step directly into the current Guitar workspace.
FIRST VIEWPORT: One calm amp-faceplate entry surface leaves the approved room and instruments visible.
FORM: A grounded rehearsal-room welcome with three deliberately unequal paths and no synthetic activity.
*/

import { createMemo, createSignal, For, Match, Show, Switch } from 'solid-js'
import type { GuitarFirstWinExerciseStepV1 } from './first-win-config'
import { resolveGuitarFirstWinConfig } from './first-win-config'
import styles from './GuitarNightApp.module.css'

type EntryView = 'choices' | 'first-win' | 'song'
type GuitarNightAppProps = {
  firstWinConfig?: unknown
}

const TAB_STRING_LABELS = ['e', 'B', 'G', 'D', 'A', 'E']

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function stepFretsForString(
  step: GuitarFirstWinExerciseStepV1,
  stringIndex: number,
): number[] {
  return stringIndex === step.stringIndex ? step.frets : []
}

export function GuitarNightApp(props: GuitarNightAppProps) {
  const firstWinConfig = createMemo(() =>
    resolveGuitarFirstWinConfig(props.firstWinConfig),
  )
  const firstWinStep = createMemo(() => firstWinConfig().exerciseSteps[0])
  const [view, setView] = createSignal<EntryView>('choices')
  const [previewHits, setPreviewHits] = createSignal(0)
  const [selectedSong, setSelectedSong] = createSignal<File | null>(null)
  let detailHeading: HTMLHeadingElement | undefined
  let songInput: HTMLInputElement | undefined

  const focusDetail = () => {
    queueMicrotask(() => detailHeading?.focus())
  }

  const openFirstWin = () => {
    if (!firstWinConfig().enabled) {
      openCurrentGuitar()
      return
    }
    setView('first-win')
    focusDetail()
  }

  const openSongPicker = () => {
    setView('song')
    songInput?.click()
    focusDetail()
  }

  const openCurrentGuitar = () => {
    window.location.assign('/#/guitar')
  }

  const returnToChoices = () => {
    setView('choices')
    queueMicrotask(() =>
      document
        .querySelector<HTMLButtonElement>('[data-entry="start"]')
        ?.focus(),
    )
  }

  const addPreviewHit = () => {
    setPreviewHits((hits) =>
      Math.min(hits + 1, firstWinConfig().freshHitsRequested),
    )
  }

  const previewPassed = () => previewHits() >= firstWinConfig().passHits
  const previewFinished = () =>
    previewHits() >= firstWinConfig().freshHitsRequested

  const completionAction = () =>
    firstWinConfig().completionActions.includes('keep-jamming')
      ? 'keep-jamming'
      : firstWinConfig().completionActions.includes('load-song')
        ? 'load-song'
        : 'keep-jamming'

  const handleCompletion = () => {
    if (completionAction() === 'load-song') {
      setView('song')
      focusDetail()
      return
    }
    openCurrentGuitar()
  }

  const handleSongChange = (event: Event) => {
    const input = event.currentTarget as HTMLInputElement
    setSelectedSong(input.files?.[0] ?? null)
    setView('song')
    focusDetail()
  }

  return (
    <div class={styles.app} data-testid="guitar-night-shell">
      <a class={styles.skipLink} href="#guitar-night-main">
        Skip to Guitar Night
      </a>

      <div
        class={styles.backdrop}
        data-testid="guitar-night-backdrop"
        aria-hidden="true"
      />
      <div class={styles.roomGlow} aria-hidden="true" />

      <div class={styles.topbar}>
        <a class={styles.brand} href="/" aria-label="MercuryPitch home">
          <img src="/favicon.svg" alt="" />
          <span>MercuryPitch</span>
        </a>
        <span class={styles.topbarDivider} aria-hidden="true" />
        <span class={styles.topbarTitle}>Guitar Night</span>
        <span class={styles.roomName}>Velvet Rehearsal</span>
      </div>

      <main class={styles.main} id="guitar-night-main">
        <section class={styles.entryPanel}>
          <div class={styles.panelEdge} aria-hidden="true" />

          <Switch>
            <Match when={view() === 'choices'}>
              <p class={styles.eyebrow}>The room is quiet</p>
              <h1>Guitar Night</h1>
              <p class={styles.lede}>
                Your room is ready. Begin with one string, bring a song, or step
                straight into the full Guitar workspace.
              </p>

              <div
                class={styles.entryActions}
                data-testid="guitar-night-entry-actions"
              >
                <button
                  class={styles.primaryAction}
                  type="button"
                  aria-label="Start"
                  aria-describedby="guitar-night-start-description"
                  data-entry="start"
                  onClick={openFirstWin}
                >
                  <strong>Start</strong>
                  <span id="guitar-night-start-description">
                    Read your first bar on one open string
                  </span>
                </button>
                <button
                  class={styles.secondaryAction}
                  type="button"
                  aria-label="Load a song"
                  aria-describedby="guitar-night-song-description"
                  onClick={openSongPicker}
                >
                  <strong>Load a song</strong>
                  <span id="guitar-night-song-description">
                    Choose one audio file from this device
                  </span>
                </button>
                <button
                  class={styles.expertAction}
                  type="button"
                  aria-label="I know my way around"
                  aria-describedby="guitar-night-expert-description"
                  onClick={openCurrentGuitar}
                >
                  <strong>I know my way around</strong>
                  <span id="guitar-night-expert-description">
                    Open the current Guitar workspace
                  </span>
                </button>
              </div>
            </Match>

            <Match when={view() === 'first-win'}>
              <p class={styles.eyebrow}>First win · touch preview</p>
              <h1 ref={detailHeading} tabindex="-1">
                Start with one string.
              </h1>
              <p class={styles.detailCopy}>
                Tab has six lines. A number tells you which fret to play. A 0
                means play the string open.
              </p>

              <div
                class={styles.tabPreview}
                role="img"
                aria-label={`Tab showing ${firstWinConfig().freshHitsRequested} open ${firstWinStep().stringLabel} notes`}
              >
                <For each={TAB_STRING_LABELS}>
                  {(label, stringIndex) => (
                    <div
                      class={styles.tabString}
                      classList={{
                        [styles.targetString]:
                          stringIndex() === firstWinStep().stringIndex,
                      }}
                    >
                      <span>{label}</span>
                      <i aria-hidden="true" />
                      <div class={styles.tabNotes} aria-hidden="true">
                        <For
                          each={stepFretsForString(
                            firstWinStep(),
                            stringIndex(),
                          )}
                        >
                          {(fret) => <b>{fret}</b>}
                        </For>
                      </div>
                    </div>
                  )}
                </For>
              </div>

              <div class={styles.rhythmPreview}>
                <div class={styles.previewMeta}>
                  <span>{firstWinStep().stringLabel} · standard tuning</span>
                  <span>{firstWinConfig().freshHitsRequested} notes</span>
                </div>
                <div
                  class={styles.beatRow}
                  aria-label={`${previewHits()} of ${firstWinConfig().freshHitsRequested} preview taps`}
                >
                  <For
                    each={Array.from(
                      { length: firstWinConfig().freshHitsRequested },
                      (_, index) => index,
                    )}
                  >
                    {(index) => (
                      <span
                        classList={{
                          [styles.beatFilled]: index < previewHits(),
                        }}
                        aria-hidden="true"
                      />
                    )}
                  </For>
                </div>
                <button
                  class={styles.tapAction}
                  type="button"
                  onClick={addPreviewHit}
                  disabled={previewFinished()}
                >
                  {previewFinished()
                    ? 'First bar complete'
                    : `Tap each ${firstWinStep().stringLabel} note`}
                </button>
                <Show when={previewPassed()}>
                  <p class={styles.smallWin} role="status">
                    {previewFinished()
                      ? `${firstWinConfig().freshHitsRequested} open notes. You just read your first bar of tab.`
                      : `${firstWinConfig().passHits} notes down. Add the last note or keep going.`}
                  </p>
                </Show>
              </div>

              <div class={styles.detailActions}>
                <button type="button" onClick={returnToChoices}>
                  Back
                </button>
                <Show
                  when={previewPassed()}
                  fallback={
                    <button
                      class={styles.workspaceEscape}
                      type="button"
                      onClick={openCurrentGuitar}
                    >
                      Open Guitar workspace
                    </button>
                  }
                >
                  <button
                    class={styles.completionAction}
                    type="button"
                    onClick={handleCompletion}
                  >
                    {completionAction() === 'load-song'
                      ? 'Load a song'
                      : 'Keep jamming'}
                  </button>
                </Show>
              </div>
            </Match>

            <Match when={view() === 'song'}>
              <p class={styles.eyebrow}>Songs · local selection</p>
              <h1 ref={detailHeading} tabindex="-1">
                Bring your own song.
              </h1>
              <p class={styles.detailCopy}>
                Choose one audio file for this room. Nothing is uploaded or
                processed at this step.
              </p>

              <div class={styles.songWell}>
                <Show
                  when={selectedSong() !== null}
                  fallback={
                    <>
                      <strong>No song selected</strong>
                      <span>MP3, WAV, M4A, FLAC, or OGG</span>
                    </>
                  }
                >
                  <strong>{selectedSong()?.name}</strong>
                  <span>
                    {selectedSong()?.type === ''
                      ? 'Audio file'
                      : (selectedSong()?.type ?? 'Audio file')}{' '}
                    · {formatFileSize(selectedSong()?.size ?? 0)}
                  </span>
                  <small>
                    Selected on this device. Song preparation is not connected
                    yet.
                  </small>
                </Show>
              </div>

              <div class={styles.detailActions}>
                <button type="button" onClick={returnToChoices}>
                  Back
                </button>
                <button
                  class={styles.completionAction}
                  type="button"
                  onClick={() => songInput?.click()}
                >
                  {selectedSong() ? 'Choose another' : 'Choose audio'}
                </button>
              </div>
            </Match>
          </Switch>
        </section>
      </main>

      <div class={styles.roomStatus} aria-label="Room status: quiet">
        <span aria-hidden="true" />
        <strong>Room ready</strong>
        <small>No audio or listening has started</small>
      </div>

      <input
        ref={songInput}
        class={styles.fileInput}
        data-testid="guitar-night-song-input"
        type="file"
        accept="audio/*,.mp3,.wav,.m4a,.flac,.ogg"
        onChange={handleSongChange}
        tabindex="-1"
      />
    </div>
  )
}

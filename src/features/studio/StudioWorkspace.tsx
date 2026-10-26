// Studio workspace — arrangement view state, contextual panels and the shared audio transport.
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show, } from 'solid-js'
import { ChevronDown, Plus, RotateCcw } from '@/components/icons'
import { installSpacePlaybackToggle, isInsideOverlay, isTypingTarget, } from '@/lib/space-playback'
import { createReactiveMatch } from '@/lib/use-viewport'
import { useStudioTransport } from './audio/useStudioTransport'
import type { StudioSourceEntry } from './integration/source-catalog'
import { StudioClipDetails } from './panels/StudioClipDetails'
import { StudioPanel } from './panels/StudioPanel'
import { StudioTrackDetails } from './panels/StudioTrackDetails'
import styles from './StudioPage.module.css'
import { StudioSourcePicker } from './StudioSourcePicker'
import { StudioTransport } from './StudioTransport'
import { StudioTimeline } from './timeline/StudioTimeline'
import { StudioTrackControls } from './timeline/StudioTrackControls'
import type { StudioController } from './useStudioController'

type Panel = 'sources' | 'song' | 'clip' | 'track' | 'mix' | null
interface StudioWorkspaceProps {
  studio: StudioController
  startWithSources: boolean
  onLibrary(): void
  onBackup(): void
  onDelete(): void
}

export function StudioWorkspace(props: StudioWorkspaceProps) {
  const phone = createReactiveMatch(
    '(max-width: 600px), (pointer: coarse) and (max-height: 500px)',
  )
  const [panel, setPanel] = createSignal<Panel>(null)
  const [selectedClipId, setSelectedClipId] = createSignal<string | null>(null)
  const [selectedTrackId, setSelectedTrackId] = createSignal<string | null>(
    null,
  )
  const [zoom, setZoom] = createSignal(40)
  const [previewEpoch, setPreviewEpoch] = createSignal(0)
  let opener: HTMLElement | null = null
  let audioInput!: HTMLInputElement
  let importFrame = 0
  const transport = useStudioTransport({
    project: () => props.studio.project(),
    assets: () => props.studio.assets(),
    readCanonicalAsset: (id) => props.studio.readCanonicalAsset(id),
    beforePlay: () => setPreviewEpoch((epoch) => epoch + 1),
  })
  const project = () => props.studio.project()!
  const writable = () => props.studio.writable() && !props.studio.importing()
  const selectedClip = () =>
    project().clips.find((clip) => clip.id === selectedClipId())
  const selectedTrack = () =>
    project().tracks.find((track) => track.id === selectedTrackId())
  const selectedAsset = () =>
    props.studio.assets().find((asset) => asset.id === selectedClip()?.assetId)
  const panelTitle = () =>
    ({
      sources: 'Add takes',
      song: 'Song',
      clip: 'Clip details',
      track: 'Track details',
      mix: 'Mix',
    })[panel() ?? 'song']
  const status = () =>
    !props.studio.writable()
      ? 'Read only'
      : {
          saved: 'Saved in this browser',
          unsaved: 'Changes not saved',
          saving: 'Saving…',
          error: 'Changes not saved',
        }[props.studio.saveState()]
  const trackAssets = createMemo(() => {
    const ids = new Set(
      project()
        .clips.filter((clip) => clip.trackId === selectedTrackId())
        .map((clip) => clip.assetId),
    )
    return props.studio.assets().filter((asset) => ids.has(asset.id))
  })

  function openPanel(next: Panel): void {
    if (next !== 'sources') transport.stopPreview()
    if (!panel())
      opener =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null
    setPanel(next)
    if (next === 'sources') void props.studio.refreshSources()
  }

  function closePanel(): void {
    transport.stopPreview()
    setPanel(null)
    queueMicrotask(() => {
      if (opener?.isConnected === true) opener.focus()
    })
  }

  function togglePlayback(): void {
    if (transport.playing()) transport.pause()
    else void transport.play()
  }

  function chooseFile(): void {
    importFrame = transport.playheadFrame()
    audioInput.click()
  }

  async function addTakes(
    entries: readonly StudioSourceEntry[],
  ): Promise<boolean> {
    const frame = transport.playheadFrame()
    const projectId = project().id
    await transport.releaseAudio()
    if (props.studio.project()?.id !== projectId) return false
    const added = await props.studio.addTakes(entries, frame)
    if (added) closePanel()
    return added
  }
  onMount(() => {
    if (props.startWithSources) openPanel('sources')
    const remove = installSpacePlaybackToggle({
      toggle: togglePlayback,
      ownsSpace: () => !isInsideOverlay(document.activeElement),
      enabled: () => !transport.pending() && project().clips.length > 0,
    })
    onCleanup(remove)
  })
  createEffect(() => {
    if (selectedClipId() !== null && !selectedClip()) {
      setSelectedClipId(null)
      if (panel() === 'clip') closePanel()
    }
    if (selectedTrackId() !== null && !selectedTrack()) {
      setSelectedTrackId(null)
      if (panel() === 'track') closePanel()
    }
  })

  function keyDown(event: KeyboardEvent): void {
    if (
      event.defaultPrevented ||
      isTypingTarget(event.target) ||
      isInsideOverlay(event.target)
    )
      return
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault()
      if (event.shiftKey) props.studio.redo()
      else props.studio.undo()
    } else if (event.key === 'Escape' && panel()) {
      event.preventDefault()
      closePanel()
    } else if (
      event.key === 'Home' &&
      !(event.target instanceof HTMLInputElement)
    ) {
      event.preventDefault()
      void transport.seek(0)
    }
  }

  function Transport() {
    return (
      <StudioTransport
        playing={transport.playing()}
        pending={transport.pending()}
        playheadFrame={transport.playheadFrame()}
        peakL={transport.peakL()}
        peakR={transport.peakR()}
        hasAudio={project().clips.length > 0}
        onToggle={togglePlayback}
        onStart={() => void transport.seek(0)}
      />
    )
  }

  return (
    <div
      class={styles.workspace}
      classList={{
        [styles.phone]: phone(),
        [styles.phonePanelOpen]: phone() && panel() !== null,
      }}
      onKeyDown={keyDown}
    >
      <input
        ref={audioInput}
        hidden
        type="file"
        aria-label="Upload audio"
        accept="audio/*,.wav,.mp3,.m4a,.ogg,.flac"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0]
          event.currentTarget.value = ''
          if (!file) return
          const frame = importFrame
          const projectId = project().id
          const currentProject = props.studio.project
          const addFile = props.studio.addFile
          void transport.releaseAudio().then(async () => {
            if (
              currentProject()?.id === projectId &&
              (await addFile(file, frame))
            )
              closePanel()
          })
        }}
      />
      <div class={styles.topBar}>
        <div class={styles.songIdentity}>
          <button
            type="button"
            class={styles.songTitle}
            title="Song options"
            aria-label="Song options"
            aria-expanded={panel() === 'song'}
            onClick={() =>
              panel() === 'song' ? closePanel() : openPanel('song')
            }
          >
            <span>{project().title}</span>
            <ChevronDown size={14} />
          </button>
          <span class={styles.saveStatus} role="status">
            {status()}
          </span>
        </div>
        <Show when={!phone() || panel() === null}>
          <Transport />
        </Show>
        <div class={styles.topActions}>
          <div class={styles.historyButtons}>
            <button
              type="button"
              class={styles.iconButton}
              aria-label={props.studio.undoLabel() ?? 'Undo'}
              title={props.studio.undoLabel() ?? 'Undo'}
              disabled={!props.studio.canUndo()}
              onClick={() => props.studio.undo()}
            >
              <RotateCcw size={17} />
            </button>
            <button
              type="button"
              class={`${styles.iconButton} ${styles.redo}`}
              aria-label={props.studio.redoLabel() ?? 'Redo'}
              title={props.studio.redoLabel() ?? 'Redo'}
              disabled={!props.studio.canRedo()}
              onClick={() => props.studio.redo()}
            >
              <RotateCcw size={17} />
            </button>
          </div>
          <button
            type="button"
            class={styles.button}
            disabled={!writable() || props.studio.busy()}
            aria-expanded={panel() === 'sources'}
            onClick={() => openPanel('sources')}
          >
            <Plus size={16} /> Add takes
          </button>
          <Show when={phone()}>
            <button
              type="button"
              class={styles.button}
              aria-expanded={panel() === 'mix'}
              onClick={() => openPanel('mix')}
            >
              Mix
            </button>
          </Show>
        </div>
      </div>
      <Show when={transport.error()}>
        {(error) => (
          <p class={styles.inlineError} role="alert">
            {error()}
          </p>
        )}
      </Show>
      <Show when={!props.studio.writable()}>
        <div class={styles.notice}>
          <p>
            This project is open in another tab, or editing has expired here.
          </p>
          <button
            type="button"
            class={styles.button}
            disabled={props.studio.busy()}
            onClick={() => void props.studio.takeOver()}
          >
            Edit in this tab
          </button>
        </div>
      </Show>
      <Show when={props.studio.importing()}>
        <div class={styles.notice} role="status">
          <p>Preparing audio…</p>
          <button
            type="button"
            class={styles.button}
            onClick={() => props.studio.cancelImport()}
          >
            Cancel import
          </button>
        </div>
      </Show>
      <div class={styles.editor}>
        <div class={styles.arrangement}>
          <Show when={!phone()}>
            <div class={styles.viewControls}>
              <label>
                Ruler
                <select
                  aria-label="Timeline ruler"
                  value={project().ruler}
                  disabled={!writable()}
                  onChange={(event) =>
                    props.studio.dispatch({
                      type: 'set-project-settings',
                      changes: {
                        ruler: event.currentTarget.value as 'time' | 'bars',
                      },
                    })
                  }
                >
                  <option value="time">Seconds</option>
                  <option value="bars">Beats</option>
                </select>
              </label>
              <Show when={project().ruler === 'bars'}>
                <label>
                  Tempo
                  <input
                    type="number"
                    min="30"
                    max="300"
                    value={project().tempoBpm}
                    disabled={!writable()}
                    onChange={(event) =>
                      props.studio.dispatch({
                        type: 'set-project-settings',
                        changes: {
                          tempoBpm: event.currentTarget.valueAsNumber,
                        },
                      })
                    }
                  />
                  <span>bpm</span>
                </label>
              </Show>
              <label class={styles.zoom}>
                Zoom
                <input
                  type="range"
                  min="10"
                  max="200"
                  step="5"
                  value={zoom()}
                  aria-label="Timeline zoom"
                  onInput={(event) =>
                    setZoom(event.currentTarget.valueAsNumber)
                  }
                />
              </label>
            </div>
          </Show>
          <StudioTimeline
            project={project()}
            assets={props.studio.assets()}
            selectedClipId={selectedClipId()}
            playheadFrame={transport.playheadFrame()}
            pixelsPerSecond={zoom()}
            writable={writable()}
            phone={phone()}
            onSelectClip={setSelectedClipId}
            onSeek={(frame) => void transport.seek(frame)}
            onCommand={props.studio.dispatch}
            onClipDetails={(id) => {
              setSelectedClipId(id)
              if (!phone()) openPanel('clip')
            }}
            onTrackDetails={(id) => {
              setSelectedTrackId(id)
              openPanel('track')
            }}
            readCanonicalAsset={props.studio.readCanonicalAsset}
          />
        </div>
        <Show when={panel()}>
          <StudioPanel
            title={panelTitle()}
            onClose={closePanel}
            footer={
              <Show when={phone()}>
                <Transport />
              </Show>
            }
          >
            <Show when={panel() === 'sources'}>
              <StudioSourcePicker
                studio={props.studio}
                onAdd={addTakes}
                onFile={chooseFile}
                previewEpoch={previewEpoch()}
                previewing={transport.previewing()}
                previewPending={transport.previewPending()}
                onPreviewGesture={transport.primeAudio}
                onPreview={transport.previewSource}
                onStopPreview={transport.stopPreview}
              />
            </Show>
            <Show when={panel() === 'song'}>
              <div class={styles.detailsFields}>
                <label class={styles.stackedField}>
                  <span>Project name</span>
                  <input
                    aria-label="Project name"
                    value={project().title}
                    maxLength={160}
                    disabled={!writable()}
                    onChange={(event) => {
                      if (!props.studio.rename(event.currentTarget.value))
                        event.currentTarget.value = project().title
                    }}
                  />
                </label>
                <button
                  type="button"
                  class={styles.button}
                  disabled={
                    props.studio.busy() || props.studio.hasUnsavedChanges()
                  }
                  onClick={() => props.onLibrary()}
                >
                  All songs
                </button>
                <button
                  type="button"
                  class={styles.button}
                  disabled={props.studio.busy()}
                  onClick={() => void props.studio.fork()}
                >
                  Duplicate song
                </button>
                <button
                  type="button"
                  class={styles.button}
                  disabled={props.studio.busy()}
                  onClick={() => props.onBackup()}
                >
                  Save project backup
                </button>
                <p class={styles.help}>
                  Includes your arrangement and copied audio. Saved projects
                  stay in this browser.
                </p>
                <div class={styles.fieldDivider} />
                <button
                  type="button"
                  class={styles.dangerButton}
                  disabled={
                    !writable() ||
                    props.studio.busy() ||
                    props.studio.hasUnsavedChanges()
                  }
                  onClick={() => props.onDelete()}
                >
                  Delete project
                </button>
              </div>
            </Show>
            <Show
              when={panel() === 'clip' && selectedClip() && selectedAsset()}
            >
              <StudioClipDetails
                clip={selectedClip()!}
                asset={selectedAsset()!}
                writable={writable()}
                onCommand={props.studio.dispatch}
              />
            </Show>
            <Show when={panel() === 'track' && selectedTrack()}>
              <StudioTrackDetails
                track={selectedTrack()!}
                assets={trackAssets()}
                writable={writable()}
                onCommand={props.studio.dispatch}
                onRemove={() => {
                  if (
                    props.studio.dispatch({
                      type: 'remove-track',
                      trackId: selectedTrack()!.id,
                    })
                  )
                    closePanel()
                }}
              />
            </Show>
            <Show when={panel() === 'mix' && phone()}>
              <div class={styles.phoneMix}>
                <For each={project().tracks.map((track) => track.id)}>
                  {(id) => {
                    const track = () =>
                      project().tracks.find((item) => item.id === id)!
                    return (
                      <div class={styles.phoneTrack}>
                        <button
                          type="button"
                          class={styles.textButton}
                          onClick={() => {
                            setSelectedTrackId(id)
                            openPanel('track')
                          }}
                        >
                          {track().name}
                        </button>
                        <StudioTrackControls
                          track={track()}
                          writable={writable()}
                          compact={true}
                          onCommand={props.studio.dispatch}
                        />
                      </div>
                    )
                  }}
                </For>
              </div>
            </Show>
          </StudioPanel>
        </Show>
      </div>
    </div>
  )
}

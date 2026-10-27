// Studio workspace — arrangement view state, contextual panels and the shared audio transport.
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show, untrack, } from 'solid-js'
import { CheckSmall, ChevronDown, Download, Plus, RotateCcw, SlidersHorizontal, } from '@/components/icons'
import { installSpacePlaybackToggle, isInsideOverlay, isTypingTarget, } from '@/lib/space-playback'
import type { StudioClip } from '@/lib/studio/model/types'
import { STUDIO_SAMPLE_RATE } from '@/lib/studio/model/types'
import { createReactiveMatch } from '@/lib/use-viewport'
import { StudioOutputMeter } from './audio/StudioOutputMeter'
import { useStudioTransport } from './audio/useStudioTransport'
import { createStudioEditor } from './editor/studio-editor'
import { StudioExportPanel } from './export/StudioExportPanel'
import { useStudioExport } from './export/useStudioExport'
import { isStudioAudioDrop, studioDropFrame, studioDroppedTake, } from './integration/drop-audio'
import type { StudioSourceEntry } from './integration/source-catalog'
import { StudioClipDetails } from './panels/StudioClipDetails'
import { StudioPanel } from './panels/StudioPanel'
import { StudioSongPanel } from './panels/StudioSongPanel'
import { StudioTrackDetails } from './panels/StudioTrackDetails'
import { StudioSoundPanel } from './sound/StudioSoundPanel'
import { useStudioComparison } from './sound/useStudioComparison'
import { useStudioSound } from './sound/useStudioSound'
import { RotateCw } from './studio-icons'
import styles from './StudioPage.module.css'
import { StudioSourcePicker } from './StudioSourcePicker'
import { StudioTransport } from './StudioTransport'
import { StudioTimeline } from './timeline/StudioTimeline'
import { StudioTrackControls } from './timeline/StudioTrackControls'
import { studioContentEnd } from './timeline/timeline-geometry'
import { studioTrackColor, studioTrackHue } from './timeline/track-hues'
import type { StudioController } from './useStudioController'

type Panel =
  | 'sources'
  | 'song'
  | 'clip'
  | 'track'
  | 'mix'
  | 'sound'
  | 'export'
  | null
interface StudioWorkspaceProps {
  studio: StudioController
  /** The drawer a newly opened song starts with. */
  startPanel: 'sources' | 'export' | null
  onLibrary(): void
  onBackup(): void
  onDelete(): void
}

export function StudioWorkspace(props: StudioWorkspaceProps) {
  const phone = createReactiveMatch(
    '(max-width: 600px), (pointer: coarse) and (max-height: 500px)',
  )
  // Touch screens wider than a phone edit with finger-sized targets.
  const coarse = createReactiveMatch('(pointer: coarse)')
  // Where an open panel overlays the timeline instead of standing beside it.
  const overlay = createReactiveMatch(
    '(max-width: 1100px), (pointer: coarse) and (max-height: 500px)',
  )
  const tablet = () => coarse() && !phone()
  const [panel, setPanel] = createSignal<Panel>(null)
  const [selectedClipId, setSelectedClipId] = createSignal<string | null>(null)
  const [selectedTrackId, setSelectedTrackId] = createSignal<string | null>(
    null,
  )
  const [zoom, setZoom] = createSignal(40)
  const [previewEpoch, setPreviewEpoch] = createSignal(0)
  let workspace!: HTMLDivElement
  const [keyboardPreview, setKeyboardPreview] = createSignal<StudioClip | null>(
    null,
  )
  const [announcement, setAnnouncement] = createSignal('')
  const [dropActive, setDropActive] = createSignal(false)
  let dropping = false
  let disposed = false
  onCleanup(() => {
    disposed = true
  })
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
  const canProcess = () => !props.studio.busy() && !props.studio.importing()
  const baseWritable = () => props.studio.writable() && canProcess()
  const sound = useStudioSound({
    project: () => props.studio.project(),
    assets: () => props.studio.assets(),
    canStart: () => baseWritable() && !exporter.busy() && !comparison.busy(),
    readCanonicalAsset: (id) => props.studio.readCanonicalAsset(id),
    releaseAudio: releaseFinishingAudio,
    onCommand: (command) => props.studio.dispatch(command),
  })
  const exporter = useStudioExport({
    project: () => props.studio.project(),
    assets: () => props.studio.assets(),
    canStart: () => canProcess() && !sound.busy() && !comparison.busy(),
    readCanonicalAsset: (id) => props.studio.readCanonicalAsset(id),
    releaseAudio: releaseFinishingAudio,
  })
  const comparison = useStudioComparison({
    project: () => props.studio.project(),
    assets: () => props.studio.assets(),
    canStart: () => canProcess() && !sound.busy() && !exporter.busy(),
    readCanonicalAsset: (id) => props.studio.readCanonicalAsset(id),
    transport,
    beforePrepare: () => setPreviewEpoch((epoch) => epoch + 1),
    onPrepared: (result) => void transport.setMasterGain(result),
  })

  function releaseFinishingAudio(): Promise<void> {
    comparison.stop()
    setPreviewEpoch((epoch) => epoch + 1)
    return transport.releaseAudio()
  }

  async function runSongAction(action: () => unknown): Promise<void> {
    if (finishing()) return
    const id = props.studio.project()?.id

    await releaseFinishingAudio()
    if (!disposed && id !== undefined && props.studio.project()?.id === id)
      action()
  }
  createEffect(() => {
    const result = exporter.result()
    if (result)
      untrack(
        () =>
          void transport.setMasterGain({
            projectId: result.token.projectId,
            revision: result.token.revision,
            gainDb: result.gainDb,
            safetyGainDb: result.safetyGainDb,
          }),
      )
  })
  const finishing = () => sound.busy() || exporter.busy() || comparison.busy()
  const writable = () => baseWritable() && !finishing()
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
      sound: 'Sound',
      export: 'Export',
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

  const editor = createStudioEditor({
    project: () => props.studio.project(),
    writable,
    playheadFrame: transport.playheadFrame,
    pixelsPerSecond: zoom,
    dispatch: (command) => props.studio.dispatch(command),
    selectClip: setSelectedClipId,
    previewClip: setKeyboardPreview,
    announce: setAnnouncement,
    focusClip: (clipId, trackId) =>
      queueMicrotask(() => {
        const selector =
          clipId !== null
            ? `[data-studio-clip="${CSS.escape(clipId)}"]`
            : `[data-studio-track-header="${CSS.escape(trackId)}"]`
        workspace.querySelector<HTMLElement>(selector)?.focus()
      }),
  })
  createEffect(editor.sync)
  onCleanup(editor.dispose)

  async function dropAudio(event: DragEvent): Promise<void> {
    const transfer = event.dataTransfer
    if (!isStudioAudioDrop(transfer) || !transfer) return
    event.preventDefault()
    setDropActive(false)
    if (!writable() || dropping || props.studio.busy()) return
    const frame = studioDropFrame(
      event.target,
      event.clientX,
      transport.playheadFrame(),
    )
    const projectId = project().id
    const files = [...transfer.files]
    const source = studioDroppedTake(transfer, props.studio.sources())
    dropping = true
    setPreviewEpoch((epoch) => epoch + 1)
    editor.cancel()
    try {
      await releaseFinishingAudio()
      if (props.studio.project()?.id !== projectId || !writable()) return
      const added = files.length
        ? await props.studio.addFiles(files, frame)
        : source
          ? await props.studio.addTake(source, frame)
          : false
      if (added) {
        closePanel()
        setAnnouncement('Audio added on new lanes.')
      }
    } finally {
      dropping = false
    }
  }

  function openPanel(next: Panel): void {
    if (next !== 'sound') comparison.stop()
    if (next !== 'sources') transport.stopPreview()
    const active = document.activeElement
    if (active instanceof HTMLElement && !active.closest('[data-studio-panel]'))
      opener = active
    setPanel(next)
    if (next === 'sources') void props.studio.refreshSources()
  }

  function closePanel(): void {
    comparison.stop()
    transport.stopPreview()
    setPanel(null)
    queueMicrotask(() => {
      if (opener?.isConnected === true) opener.focus()
    })
  }

  function togglePlayback(): void {
    if (finishing()) return
    comparison.stop()
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
    await releaseFinishingAudio()
    if (props.studio.project()?.id !== projectId) return false
    const added = await props.studio.addTakes(entries, frame)
    if (added) closePanel()
    return added
  }
  onMount(() => {
    if (props.startPanel !== null) openPanel(props.startPanel)
    const remove = installSpacePlaybackToggle({
      toggle: togglePlayback,
      ownsSpace: () => !isInsideOverlay(document.activeElement),
      enabled: () =>
        !transport.pending() && !finishing() && project().clips.length > 0,
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

  function historyAction(direction: 'undo' | 'redo'): void {
    if (!writable()) return
    editor.cancel()
    if (direction === 'undo') props.studio.undo()
    else props.studio.redo()
    queueMicrotask(() => {
      const active = document.activeElement
      if (active && active !== document.body && workspace.contains(active))
        return
      const clip = workspace.querySelector<HTMLElement>('[data-studio-clip]')
      ;(clip ?? workspace).focus()
    })
  }

  function keyDown(event: KeyboardEvent): void {
    if (editor.keyDown(event)) return
    if (
      event.defaultPrevented ||
      isTypingTarget(event.target) ||
      isInsideOverlay(event.target)
    )
      return
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault()
      historyAction(event.shiftKey ? 'redo' : 'undo')
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

  function Transport(local: { foot?: boolean }) {
    return (
      <StudioTransport
        footSpace={local.foot === true ? '--page-dock-space' : undefined}
        playing={transport.playing()}
        pending={transport.pending() || finishing()}
        playheadFrame={transport.playheadFrame()}
        endFrame={Math.max(
          60 * STUDIO_SAMPLE_RATE,
          studioContentEnd(project().clips) + 10 * STUDIO_SAMPLE_RATE,
        )}
        peakL={transport.peakL()}
        peakR={transport.peakR()}
        meter={transport.meter()}
        meterReady={transport.meterReady()}
        onResetPeakHold={transport.resetPeakHold}
        hasAudio={project().clips.length > 0}
        repeating={transport.repeating()}
        onRepeat={() => void transport.setRepeat(!transport.repeating())}
        onToggle={togglePlayback}
        onStart={() => void transport.seek(0)}
        onSeek={(frame) => void transport.seek(frame)}
      />
    )
  }

  return (
    <div
      ref={workspace}
      tabIndex={-1}
      data-tour="studio.workspace"
      class={styles.workspace}
      classList={{
        [styles.phone]: phone(),
        [styles.tablet]: tablet(),
        [styles.phonePanelOpen]: phone() && panel() !== null,
      }}
      onKeyDown={keyDown}
      onKeyUp={editor.keyUp}
      onFocusOut={editor.cancel}
      onDragOver={(event) => {
        if (!isStudioAudioDrop(event.dataTransfer)) return
        event.preventDefault()
        if (event.dataTransfer)
          event.dataTransfer.dropEffect = writable() ? 'copy' : 'none'
        setDropActive(writable())
      }}
      onDragLeave={(event) => {
        if (
          !(event.relatedTarget instanceof Node) ||
          !workspace.contains(event.relatedTarget)
        )
          setDropActive(false)
      }}
      onDrop={(event) => void dropAudio(event)}
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
          void releaseFinishingAudio().then(async () => {
            if (
              currentProject()?.id === projectId &&
              (await addFile(file, frame))
            )
              closePanel()
          })
        }}
      />
      <p class={styles.srOnly} role="status">
        {announcement()}
      </p>
      <Show when={dropActive()}>
        <div class={styles.dropHint}>
          <Plus size={18} /> Drop audio to add new lanes
        </div>
      </Show>
      <header class={styles.topBar}>
        <div class={styles.songIdentity}>
          <button
            type="button"
            class={styles.songTitle}
            title="Song options"
            aria-label="Song options"
            data-tour="studio.song-options"
            aria-expanded={panel() === 'song'}
            onClick={() =>
              panel() === 'song' ? closePanel() : openPanel('song')
            }
          >
            <span>{project().title}</span>
            <ChevronDown size={14} />
          </button>
          <span
            class={styles.saveStatus}
            data-state={
              props.studio.writable() ? props.studio.saveState() : 'read-only'
            }
            role="status"
          >
            <Show
              when={
                props.studio.writable() && props.studio.saveState() === 'saved'
              }
            >
              <CheckSmall size={12} />
            </Show>
            {status()}
          </span>
        </div>
        <Show when={!phone()}>
          <Transport />
        </Show>
        <div class={styles.topActions}>
          <div class={styles.historyButtons} data-tour="studio.history">
            <button
              type="button"
              class={styles.iconButton}
              aria-label={props.studio.undoLabel() ?? 'Undo'}
              title={`${props.studio.undoLabel() ?? 'Undo'} (Ctrl+Z)`}
              disabled={!writable() || !props.studio.canUndo()}
              onClick={() => historyAction('undo')}
            >
              <RotateCcw size={17} />
            </button>
            <button
              type="button"
              class={styles.iconButton}
              aria-label={props.studio.redoLabel() ?? 'Redo'}
              title={`${props.studio.redoLabel() ?? 'Redo'} (Ctrl+Shift+Z)`}
              disabled={!writable() || !props.studio.canRedo()}
              onClick={() => historyAction('redo')}
            >
              <RotateCw size={17} />
            </button>
          </div>
          <span class={styles.divider} aria-hidden="true" />
          <button
            type="button"
            class={styles.button}
            disabled={!writable() || props.studio.busy()}
            aria-expanded={panel() === 'sources'}
            data-tour="studio.add-takes"
            title="Add takes"
            onClick={() => openPanel('sources')}
          >
            <Plus size={16} />
            <span class={styles.label}>Add takes</span>
          </button>
          <Show when={phone()}>
            <button
              type="button"
              class={styles.button}
              aria-expanded={panel() === 'mix'}
              data-tour="studio.mix"
              onClick={() => openPanel('mix')}
            >
              Mix
            </button>
          </Show>
          <button
            type="button"
            class={styles.button}
            data-tour="studio.sound"
            aria-expanded={panel() === 'sound'}
            title="Sound"
            onClick={() => openPanel('sound')}
          >
            <SlidersHorizontal />
            <span class={styles.label}>Sound</span>
          </button>
          <button
            type="button"
            class={styles.primaryButton}
            data-tour="studio.export"
            aria-expanded={panel() === 'export'}
            onClick={() => openPanel('export')}
          >
            <Download />
            <span>Export</span>
          </button>
        </div>
      </header>
      <Show
        when={finishing() && panel() !== (exporter.busy() ? 'export' : 'sound')}
      >
        <div class={styles.notice} role="status">
          <p>Preparing song audio…</p>
          <button
            type="button"
            class={styles.button}
            onClick={() => openPanel(exporter.busy() ? 'export' : 'sound')}
          >
            Show progress
          </button>
        </div>
      </Show>
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
          <StudioTimeline
            project={project()}
            assets={props.studio.assets()}
            selectedClipId={selectedClipId()}
            keyboardPreviewClip={keyboardPreview()}
            onPointerEditStart={editor.cancel}
            playheadFrame={transport.playheadFrame()}
            playing={transport.playing()}
            pixelsPerSecond={zoom()}
            writable={writable()}
            phone={phone()}
            tablet={tablet()}
            onZoom={setZoom}
            drawerOpen={panel() !== null && overlay()}
            onAddTakes={
              panel() === 'sources' ? undefined : () => openPanel('sources')
            }
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
                <Transport foot />
              </Show>
            }
          >
            <Show when={panel() === 'sound'}>
              <StudioSoundPanel
                project={project()}
                writable={writable()}
                balance={sound}
                comparison={comparison}
                meter={
                  <>
                    <StudioOutputMeter
                      snapshot={transport.meter()}
                      ready={transport.meterReady()}
                      peakL={transport.peakL()}
                      peakR={transport.peakR()}
                      onReset={transport.resetPeakHold}
                    />
                    <p class={styles.help}>
                      {transport.masterReady()
                        ? 'Playback uses measured master settings.'
                        : 'Preview levels. Export or Compare measures the whole song.'}
                    </p>
                  </>
                }
                onCommand={props.studio.dispatch}
              />
            </Show>
            <Show when={panel() === 'export'}>
              <StudioExportPanel
                project={project()}
                controller={exporter}
                canExport={canProcess() && !sound.busy() && !comparison.busy()}
              />
            </Show>
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
              <StudioSongPanel
                studio={props.studio}
                writable={writable()}
                processing={finishing()}
                onLibrary={props.onLibrary}
                onBackup={() => void runSongAction(props.onBackup)}
                onDelete={props.onDelete}
                onFork={() => void runSongAction(props.studio.fork)}
              />
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
                <For
                  each={[...project().tracks]
                    .sort((a, b) => a.order - b.order)
                    .map((track) => track.id)}
                >
                  {(id, index) => {
                    const track = () =>
                      project().tracks.find((item) => item.id === id)!
                    return (
                      <div
                        class={styles.phoneTrack}
                        style={{
                          '--studio-track': studioTrackColor(
                            studioTrackHue(track(), index()),
                          ),
                        }}
                      >
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
      <Show when={phone() && panel() === null}>
        <Transport foot />
      </Show>
    </div>
  )
}

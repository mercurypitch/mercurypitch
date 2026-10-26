// Studio source picker — metadata browsing, explicit previews and one batch at the playhead.
import { batch, createEffect, createMemo, createSignal, For, on, onCleanup, onMount, Show, } from 'solid-js'
import { FileUpload, Pause, Play } from '@/components/icons'
import { STUDIO_TAKE_DRAG_TYPE } from './integration/drop-audio'
import type { StudioSourceEntry } from './integration/source-catalog'
import styles from './StudioPage.module.css'
import type { StudioController } from './useStudioController'

interface StudioSourcePickerProps {
  studio: Pick<
    StudioController,
    | 'sources'
    | 'sourceError'
    | 'busy'
    | 'writable'
    | 'importing'
    | 'refreshSources'
    | 'readSourcePreview'
    | 'project'
  >
  onAdd(entries: readonly StudioSourceEntry[]): Promise<boolean>
  onFile(): void
  onPreviewGesture(): Promise<boolean>
  onPreview(blob: Blob): Promise<boolean>
  onStopPreview(): void
  previewEpoch: number
  previewing: boolean
  previewPending: boolean
}

const FILTERS = [
  'All',
  'Karaoke',
  'Hear Yourself',
  'Guitar',
  'Piano',
  'Drums',
  'Files',
]
const duration = (ms: number) =>
  `${Math.floor(ms / 60_000)}:${Math.floor((ms / 1000) % 60)
    .toString()
    .padStart(2, '0')}`

export function StudioSourcePicker(props: StudioSourcePickerProps) {
  const [filter, setFilter] = createSignal('All')
  const [selected, setSelected] = createSignal<ReadonlySet<string>>(
    new Set<string>(),
  )
  const [previewId, setPreviewId] = createSignal<string | null>(null)
  const [previewPhase, setPreviewPhase] = createSignal<
    'reading' | 'starting' | 'active' | null
  >(null)
  const [previewError, setPreviewError] = createSignal<string | null>(null)
  let previewAbort: AbortController | undefined
  let disposed = false
  const visible = createMemo(() =>
    props.studio
      .sources()
      .filter(
        (source) => filter() === 'All' || source.sourceLabel === filter(),
      ),
  )
  const choices = () =>
    props.studio.sources().filter((source) => selected().has(source.id))
  const stopPreview = () => {
    previewAbort?.abort()
    previewAbort = undefined
    batch(() => {
      setPreviewId(null)
      setPreviewPhase(null)
    })
    props.onStopPreview()
  }
  const current = (abort: AbortController) =>
    !disposed && previewAbort === abort && !abort.signal.aborted
  createEffect(on(() => props.previewEpoch, stopPreview, { defer: true }))
  createEffect(
    on(
      () => props.studio.project()?.id,
      () => {
        stopPreview()
        setSelected(new Set<string>())
      },
      { defer: true },
    ),
  )
  createEffect(() => {
    if (
      previewPhase() === 'active' &&
      !props.previewing &&
      !props.previewPending
    )
      stopPreview()
  })
  onCleanup(() => {
    disposed = true
    stopPreview()
  })
  onMount(() => {
    const visibilityChanged = () => {
      if (document.hidden) stopPreview()
    }
    document.addEventListener('visibilitychange', visibilityChanged)
    onCleanup(() =>
      document.removeEventListener('visibilitychange', visibilityChanged),
    )
  })

  async function preview(source: StudioSourceEntry): Promise<void> {
    const wasPlaying = previewId() === source.id
    stopPreview()
    if (wasPlaying) return
    const abort = new AbortController()
    previewAbort = abort
    batch(() => {
      setPreviewId(source.id)
      setPreviewPhase('reading')
      setPreviewError(null)
    })
    try {
      // Take audio ownership while still inside the click, before reading the
      // kept Blob. A DB await must not consume the browser's activation window.
      const primed = props.onPreviewGesture()
      if (!(await primed)) {
        if (current(abort)) {
          setPreviewError('Audio could not start. Try Preview again.')
          stopPreview()
        }
        return
      }
      if (!current(abort)) return
      const blob = await props.studio.readSourcePreview(source, {
        signal: abort.signal,
      })
      if (!current(abort)) return
      setPreviewPhase('starting')
      const played = await props.onPreview(blob)
      if (!current(abort)) return
      if (played) setPreviewPhase('active')
      else stopPreview()
    } catch (error) {
      if (current(abort)) {
        setPreviewError(
          error instanceof Error
            ? error.message
            : 'This take could not be played.',
        )
        stopPreview()
      }
    }
  }

  async function addSelected(): Promise<void> {
    const entries = choices()
    const projectId = props.studio.project()?.id
    stopPreview()
    if (
      (await props.onAdd(entries)) &&
      !disposed &&
      props.studio.project()?.id === projectId
    )
      setSelected(new Set<string>())
  }

  return (
    <div class={styles.sources}>
      <div class={styles.filters} role="group" aria-label="Take source">
        <For each={FILTERS}>
          {(name) => (
            <button
              type="button"
              class={styles.filterButton}
              aria-pressed={filter() === name}
              onClick={() => {
                if (filter() !== name) stopPreview()
                setFilter(name)
              }}
            >
              {name}
            </button>
          )}
        </For>
      </div>
      <p class={styles.help}>
        Takes start at the playhead. Line them up by ear.
      </p>
      <button
        type="button"
        class={styles.fileButton}
        disabled={props.studio.busy() || !props.studio.writable()}
        onClick={() => {
          stopPreview()
          props.onFile()
        }}
      >
        <FileUpload />
        <span>
          Choose file<small>WAV, MP3 and other supported audio</small>
        </span>
      </button>
      <Show when={props.studio.sourceError() ?? previewError()}>
        {(error) => (
          <p class={styles.inlineError} role="alert">
            {error()}
          </p>
        )}
      </Show>
      <Show when={filter() !== 'Files'}>
        <div class={styles.sourceHeading}>
          <h3>Kept takes</h3>
          <button
            type="button"
            class={styles.textButton}
            disabled={props.studio.busy()}
            onClick={() => void props.studio.refreshSources()}
          >
            Refresh
          </button>
        </div>
        <Show
          when={visible().length}
          fallback={
            <p class={styles.help}>
              Keep a recording in the app and it will appear here.
            </p>
          }
        >
          <ul class={styles.sourceList}>
            <For each={visible()}>
              {(source) => (
                <li
                  draggable={props.studio.writable() && !props.studio.busy()}
                  onDragStart={(event) => {
                    if (!event.dataTransfer) return
                    event.dataTransfer.setData(STUDIO_TAKE_DRAG_TYPE, source.id)
                    event.dataTransfer.effectAllowed = 'copy'
                    stopPreview()
                  }}
                >
                  <label class={styles.sourceChoice}>
                    <input
                      type="checkbox"
                      checked={selected().has(source.id)}
                      disabled={props.studio.busy()}
                      onChange={(event) => {
                        const next = new Set(selected())
                        if (event.currentTarget.checked) next.add(source.id)
                        else next.delete(source.id)
                        setSelected(next)
                      }}
                    />
                    <span>
                      <strong>{source.title}</strong>
                      <small>
                        {source.sourceLabel} · {duration(source.durationMs)}
                      </small>
                      <span class={styles.sourceDescription}>
                        {source.audioDescription}
                      </span>
                    </span>
                  </label>
                  <button
                    type="button"
                    class={styles.iconButton}
                    aria-label={`${previewId() === source.id ? 'Stop preview of' : 'Preview'} ${source.title}`}
                    title={`Preview ${source.title}`}
                    disabled={props.studio.importing()}
                    onClick={() => void preview(source)}
                  >
                    <Show when={previewId() === source.id} fallback={<Play />}>
                      <Pause />
                    </Show>
                  </button>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </Show>
      <button
        type="button"
        class={styles.primaryButton}
        disabled={
          !choices().length || props.studio.busy() || !props.studio.writable()
        }
        onClick={() => void addSelected()}
      >
        Add {choices().length || ''} {choices().length === 1 ? 'take' : 'takes'}
      </button>
    </div>
  )
}

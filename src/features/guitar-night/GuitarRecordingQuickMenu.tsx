// The quick melody drawer switches existing local takes without reading audio for its list.
import { createEffect, createSignal, For, onCleanup, Show } from 'solid-js'
import { Portal } from 'solid-js/web'
import { CheckSmall, MusicLibrary, MusicNote, Trash2, X, } from '@/components/icons'
import type { GuitarRecording } from '@/lib/guitar/recording-types'
import { useFocusTrap } from '@/lib/use-focus-trap'
import { recordingTime } from './GuitarRecordingControls'
import styles from './GuitarRecordingQuickMenu.module.css'
import { GuitarRecordingRemoveDialog, useGuitarRecordingRemoval, } from './GuitarRecordingRemoval'

export function GuitarRecordingQuickMenu(props: {
  isOpen: boolean
  anchor(): HTMLElement | undefined
  rows: readonly GuitarRecording[]
  currentId?: string
  onClose(): void
  onGallery(): void
  onSelect(id: string): Promise<void> | void
  onRemove?(id: string): Promise<void>
}) {
  const [position, setPosition] = createSignal({
    top: 0,
    left: 8,
    maxHeight: 320,
  })
  const [pending, setPending] = createSignal<string | null>(null)
  const [error, setError] = createSignal<string | null>(null)
  let root: HTMLDivElement | undefined
  let closeButton: HTMLButtonElement | undefined
  let disposed = false
  onCleanup(() => {
    disposed = true
  })
  const removal = useGuitarRecordingRemoval({
    remove: (id) => props.onRemove!(id),
    fallbackFocus: () => closeButton,
  })
  const close = () => {
    if (pending() !== null || removal.busy()) return
    props.onClose()
  }
  createEffect(() => {
    if (!props.isOpen) removal.cancel()
  })
  useFocusTrap(() => root, {
    isOpen: () => props.isOpen,
    onClose: close,
    initialFocus: () =>
      root?.querySelector<HTMLButtonElement>(
        '[data-current="true"] [data-select]',
      ) ?? closeButton,
  })
  createEffect(() => {
    if (!props.isOpen) return
    setError(null)
    const place = () => {
      const rect = props.anchor()?.getBoundingClientRect()
      if (rect === undefined) return
      const width = Math.min(344, window.innerWidth - 16)
      const top = Math.min(
        rect.bottom + 8,
        Math.max(8, window.innerHeight - 180),
      )
      setPosition({
        top,
        left: Math.max(
          8,
          Math.min(rect.right - width, window.innerWidth - width - 8),
        ),
        maxHeight: Math.max(120, window.innerHeight - top - 8),
      })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    onCleanup(() => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    })
  })
  const select = async (row: GuitarRecording) => {
    if (pending() !== null || removal.busy()) return
    if (row.id === props.currentId) {
      close()
      return
    }
    const selectRow = props.onSelect
    setPending(row.id)
    setError(null)
    try {
      await selectRow(row.id)
      if (!disposed) props.onClose()
    } catch (cause) {
      if (!disposed)
        setError(
          cause instanceof Error
            ? cause.message
            : 'This melody could not be opened. Try again.',
        )
    } finally {
      if (!disposed) setPending(null)
    }
  }
  const shortDate = (value: string) => {
    const date = new Date(value)
    return Number.isNaN(date.getTime())
      ? 'Date unavailable'
      : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }
  return (
    <Show when={props.isOpen}>
      <Portal>
        <div class={styles.backdrop} onPointerDown={close} aria-hidden="true" />
        <div
          ref={root}
          class={styles.menu}
          role="dialog"
          aria-modal="true"
          aria-label="Switch melody"
          tabIndex={-1}
          style={{
            top: `${position().top}px`,
            left: `${position().left}px`,
            'max-height': `${position().maxHeight}px`,
          }}
        >
          <div class={styles.heading}>
            <div>
              <strong>Your melodies</strong>
              <span>Choose a take for the recorder</span>
            </div>
            <button
              ref={closeButton}
              type="button"
              aria-label="Close melody switcher"
              disabled={pending() !== null || removal.busy()}
              onClick={close}
            >
              <X />
            </button>
          </div>
          <Show
            when={props.rows.length > 0}
            fallback={
              <p class={styles.empty}>
                Your recorded ideas will appear here. Record your first melody
                when you are ready.
              </p>
            }
          >
            <ul class={styles.list}>
              <For each={props.rows.slice(0, 8)}>
                {(row) => (
                  <li data-current={row.id === props.currentId}>
                    <button
                      type="button"
                      data-select
                      class={styles.select}
                      aria-label={`${row.id === props.currentId ? 'Loaded' : 'Load'} ${row.title}`}
                      aria-current={
                        row.id === props.currentId ? 'true' : undefined
                      }
                      disabled={pending() !== null || removal.busy()}
                      onClick={() => void select(row)}
                    >
                      <Show
                        when={row.id === props.currentId}
                        fallback={<MusicNote />}
                      >
                        <CheckSmall />
                      </Show>
                      <span>
                        <strong>{row.title}</strong>
                        <small>
                          {pending() === row.id
                            ? 'Opening melody…'
                            : `${recordingTime(row.frames / row.sampleRate)} · ${shortDate(row.createdAt)} · ${row.state === 'capturing' ? 'Needs recovery' : row.state === 'kept' ? 'Kept' : 'Draft'}`}
                        </small>
                      </span>
                    </button>
                    <Show when={props.onRemove}>
                      <button
                        type="button"
                        class={styles.remove}
                        aria-label={`Remove ${row.title}`}
                        title={
                          row.state === 'capturing'
                            ? 'Recover this interrupted recording before removing it.'
                            : `Remove ${row.title}`
                        }
                        disabled={
                          pending() !== null ||
                          removal.busy() ||
                          row.state === 'capturing'
                        }
                        onClick={() => removal.request(row)}
                      >
                        <Trash2 />
                      </button>
                    </Show>
                  </li>
                )}
              </For>
            </ul>
          </Show>
          <Show when={error()}>
            {(message) => (
              <p class={styles.error} role="alert">
                {message()}
              </p>
            )}
          </Show>
          <button
            class={styles.gallery}
            type="button"
            disabled={pending() !== null || removal.busy()}
            onClick={() => {
              props.onClose()
              props.onGallery()
            }}
          >
            <MusicLibrary /> Open full gallery
            <Show when={props.rows.length > 8}> ({props.rows.length})</Show>
          </button>
        </div>
        <GuitarRecordingRemoveDialog removal={removal} />
      </Portal>
    </Show>
  )
}

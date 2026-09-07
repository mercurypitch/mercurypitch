// A personal melody shelf opens note-only previews without loading audio or taking over the room.
import { createEffect, createMemo, createResource, createSignal, For, onCleanup, Show, untrack, } from 'solid-js'
import { ChevronDown, Headphones, MusicLibrary, MusicNote, Trash2, } from '@/components/icons'
import { createGuitarRecordingStore } from '@/db/services/guitar-recording-service'
import type { GuitarRecording } from '@/lib/guitar/recording-types'
import { midiToNote } from '@/lib/scale-data'
import { GuitarNightMixerDialog } from './GuitarNightMixControls'
import { recordingTime } from './GuitarRecordingControls'
import styles from './GuitarRecordingGallery.module.css'
import { GuitarRecordingQuickMenu } from './GuitarRecordingQuickMenu'
import { GuitarRecordingRemoveDialog, useGuitarRecordingRemoval, } from './GuitarRecordingRemoval'

export const MELODY_RECORDER_ART = '/guitar-night/melody-recorder.webp'

export function GuitarRecordingGalleryButton(props: {
  count: number
  onOpen(): void
  disabled?: boolean
  rows?: readonly GuitarRecording[]
  currentId?: string
  onSelect?(id: string): Promise<void> | void
  onRemove?(id: string): Promise<void>
  onQuickOpenChange?(open: boolean): void
}) {
  const [quickOpen, setQuickOpen] = createSignal(false)
  let trigger: HTMLButtonElement | undefined
  let longPressTimer = 0
  let origin: { x: number; y: number } | null = null
  let suppressClick = false
  const cancelPress = () => {
    window.clearTimeout(longPressTimer)
    longPressTimer = 0
    origin = null
  }
  const setOpen = (open: boolean) => {
    if (open && (props.disabled === true || props.onSelect === undefined))
      return
    setQuickOpen(open)
  }
  createEffect(() => {
    props.onQuickOpenChange?.(quickOpen())
  })
  createEffect(() => {
    if (props.disabled === true) setOpen(false)
  })
  onCleanup(() => {
    cancelPress()
    props.onQuickOpenChange?.(false)
  })
  return (
    <div class={styles.triggerGroup}>
      <button
        ref={trigger}
        type="button"
        class={styles.trigger}
        disabled={props.disabled}
        aria-haspopup="dialog"
        aria-label={`My melodies, ${props.count} ${props.count === 1 ? 'recording' : 'recordings'}`}
        title={
          props.onSelect
            ? 'Open your melody gallery. Hold or right-click for the quick switcher.'
            : undefined
        }
        onClick={() => {
          if (suppressClick) {
            suppressClick = false
            return
          }
          setOpen(false)
          props.onOpen()
        }}
        onContextMenu={(event) => {
          if (props.onSelect === undefined) return
          event.preventDefault()
          setOpen(true)
        }}
        onPointerDown={(event) => {
          if (
            props.disabled === true ||
            props.onSelect === undefined ||
            !['touch', 'pen'].includes(event.pointerType)
          )
            return
          cancelPress()
          suppressClick = false
          origin = { x: event.clientX, y: event.clientY }
          longPressTimer = window.setTimeout(() => {
            longPressTimer = 0
            suppressClick = true
            untrack(() => setOpen(true))
          }, 450)
        }}
        onPointerMove={(event) => {
          if (
            origin !== null &&
            Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 10
          )
            cancelPress()
        }}
        onPointerUp={cancelPress}
        onPointerCancel={cancelPress}
        onPointerLeave={cancelPress}
      >
        <span aria-hidden="true">
          <MusicLibrary />
        </span>
        <strong>My melodies</strong>
        <small class={styles.count}>{props.count}</small>
      </button>
      <Show when={props.onSelect}>
        <button
          type="button"
          class={styles.quickTrigger}
          aria-label="Quick switch melody"
          aria-haspopup="dialog"
          aria-expanded={quickOpen()}
          disabled={props.disabled}
          onClick={() => setOpen(!quickOpen())}
        >
          <ChevronDown />
        </button>
        <GuitarRecordingQuickMenu
          isOpen={quickOpen()}
          anchor={() => trigger}
          rows={props.rows ?? []}
          currentId={props.currentId}
          onSelect={(id) => props.onSelect!(id)}
          onRemove={props.onRemove}
          onClose={() => setOpen(false)}
          onGallery={props.onOpen}
        />
      </Show>
    </div>
  )
}

function pitchName(midi: number): string {
  const note = midiToNote(midi)
  return `${note.name}${note.octave}`
}

function recordedDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Recording date unavailable'
    : date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
}

function MelodyCard(props: {
  row: GuitarRecording
  onReview(id: string): void
  onRemove?(row: GuitarRecording): void
}) {
  const [preview, { refetch }] = createResource(
    () => props.row.id,
    (id) =>
      createGuitarRecordingStore()
        .preview(id)
        .then(
          (value) => ({ value, error: null }),
          () => ({ value: null, error: 'Note preview unavailable.' }),
        ),
  )
  const evidence = () => preview()?.value
  const state = () =>
    props.row.state === 'kept'
      ? props.row.takeId === null
        ? 'Notes kept'
        : 'Kept'
      : props.row.state === 'capturing'
        ? 'Needs recovery'
        : 'Draft'
  return (
    <li class={styles.card} data-state={props.row.state}>
      <div class={styles.cardHeading}>
        <time dateTime={props.row.createdAt}>
          {recordedDate(props.row.createdAt)}
        </time>
        <span class={styles.savedState}>{state()}</span>
      </div>
      <h3>{props.row.title}</h3>
      <div class={styles.contour}>
        <Show
          when={evidence()}
          fallback={
            <p>
              {preview.loading
                ? 'Opening note preview…'
                : (preview()?.error ??
                  'Review this draft to recover its notes.')}
            </p>
          }
        >
          {(data) => (
            <Show
              when={data().noteCount > 0}
              fallback={<p>Audio recorded. No stable notes identified.</p>}
            >
              <svg
                viewBox="0 0 100 48"
                preserveAspectRatio="none"
                role="img"
                aria-label={`Captured melody, ${data().noteCount} notes`}
              >
                <path class={styles.guides} d="M0 10H100 M0 24H100 M0 38H100" />
                <For each={data().marks}>
                  {(mark) => (
                    <rect
                      x={mark.x}
                      y={mark.y}
                      width={mark.width}
                      height="1.8"
                      rx="0.6"
                    />
                  )}
                </For>
              </svg>
            </Show>
          )}
        </Show>
      </div>
      <dl class={styles.metadata}>
        <div>
          <dt>Duration</dt>
          <dd>{recordingTime(props.row.frames / props.row.sampleRate)}</dd>
        </div>
        <div>
          <dt>Notes heard</dt>
          <dd>{evidence()?.noteCount ?? '—'}</dd>
        </div>
        <div>
          <dt>Range</dt>
          <dd>
            {evidence()?.lowestMidi != null && evidence()?.highestMidi != null
              ? `${pitchName(evidence()!.lowestMidi!)}–${pitchName(evidence()!.highestMidi!)}`
              : '—'}
          </dd>
        </div>
      </dl>
      <p class={styles.source}>
        {props.row.inputKind === 'interface' ? 'Direct input' : 'Room mic'}
        <span>{props.row.backing?.title ?? 'Free form'}</span>
      </p>
      <Show when={props.row.interruption}>
        <p class={styles.notice}>
          Interrupted take. The saved portion is here.
        </p>
      </Show>
      <Show when={props.row.state === 'kept' && props.row.takeId === null}>
        <p class={styles.notice}>
          Audio removed; your note evidence is still here.
        </p>
      </Show>
      <div class={styles.cardActions}>
        <Show when={props.onRemove}>
          <button
            type="button"
            class={styles.remove}
            aria-label={`Remove ${props.row.title}`}
            title={
              props.row.state === 'capturing'
                ? 'Recover this interrupted recording before removing it.'
                : `Remove ${props.row.title}`
            }
            disabled={props.row.state === 'capturing'}
            onClick={() => props.onRemove?.(props.row)}
          >
            <Trash2 />
          </button>
        </Show>
        <Show when={preview()?.error}>
          <button type="button" onClick={() => void refetch()}>
            Retry preview
          </button>
        </Show>
        <button
          type="button"
          aria-label={`${props.row.state === 'capturing' ? 'Recover' : 'Review'} ${props.row.title}`}
          onClick={() => props.onReview(props.row.id)}
        >
          <Headphones />
          {props.row.state === 'capturing' ? 'Recover take' : 'Review take'}
        </button>
      </div>
    </li>
  )
}

export function GuitarRecordingGallery(props: {
  isOpen: boolean
  rows: readonly GuitarRecording[]
  onClose(): void
  onReview(id: string): void
  onRemove?(id: string): Promise<void>
}) {
  const [shown, setShown] = createSignal(8)
  const totalSeconds = createMemo(() =>
    props.rows.reduce((sum, row) => sum + row.frames / row.sampleRate, 0),
  )
  let host: HTMLDivElement | undefined
  const removal = useGuitarRecordingRemoval({
    remove: (id) => props.onRemove!(id),
    fallbackFocus: () =>
      host?.querySelector<HTMLButtonElement>(
        '[aria-label="Close My melodies"]',
      ) ?? undefined,
  })
  createEffect(() => {
    if (!props.isOpen) removal.cancel()
  })
  return (
    <div ref={host} class={styles.host}>
      <GuitarNightMixerDialog
        isOpen={props.isOpen}
        label="My melodies"
        kicker="Your recording shelf"
        title="My melodies"
        closeLabel="Close My melodies"
        onClose={props.onClose}
        panelClass={styles.panel}
        scrimClass={styles.scrim}
        headingArt={
          <img
            class={styles.art}
            src={MELODY_RECORDER_ART}
            width="160"
            height="160"
            alt=""
          />
        }
        detail="Little ideas worth coming back to."
      >
        <div class={styles.collectionInfo}>
          <span>
            {props.rows.length}{' '}
            {props.rows.length === 1 ? 'recording' : 'recordings'}
            <Show when={props.rows.length > 0}>
              {' '}
              · {recordingTime(totalSeconds())} captured
            </Show>
          </span>
          <span>Only on this device</span>
        </div>
        <Show
          when={props.rows.length > 0}
          fallback={
            <div class={styles.empty}>
              <MusicNote />
              <h3>Your next melody belongs here.</h3>
              <p>
                Record a phrase, a riff, or an idea. Its sound and the notes we
                hear will be waiting here.
              </p>
              <button type="button" onClick={() => props.onClose()}>
                Back to the recorder
              </button>
            </div>
          }
        >
          <ul class={styles.grid}>
            <For each={props.rows.slice(0, shown())}>
              {(row) => (
                <MelodyCard
                  row={row}
                  onReview={props.onReview}
                  onRemove={
                    props.onRemove === undefined ? undefined : removal.request
                  }
                />
              )}
            </For>
          </ul>
          <Show when={shown() < props.rows.length}>
            <button
              type="button"
              class={styles.more}
              onClick={() => setShown((value) => value + 8)}
            >
              Show more melodies
            </button>
          </Show>
          <p class={styles.footnote}>
            The shape of what you played, in its original timing. Open a take to
            listen, keep, correct, or practise it.
          </p>
        </Show>
      </GuitarNightMixerDialog>
      <GuitarRecordingRemoveDialog removal={removal} />
    </div>
  )
}

// ============================================================
// Studio MIDI render service — keeps each MIDI clip's audio in step with its notes: a preview in memory while it is edited, a kept asset once it is done
// ============================================================
//
// A MIDI clip plays audio rendered from its notes: the notes are the source
// and the audio a cache of them (docs/plans/studio-midi.md, decision 7). A
// clip is stale once its render key no longer names its notes on its lane's
// sound (clip-keys.ts); a draft the note editor shows before it commits
// wants a render too.
//
//   PREVIEWS — each stale clip and each draft gets a render in memory once
//   the notes are left alone for a quarter second. The transport plays the
//   song through a snapshot in which a clip with a preview ready plays it
//   (midi-preview-snapshot.ts). Renders run one at a time; one no clip
//   needs any more is aborted, and a preview no clip needs is dropped and
//   its memory given back.
//
//   KEEPING — a render becomes an asset as a take does, swapped in without
//   an undo step (imports.ts): when the editor closes, when the song opens,
//   before an export, and a second after an undo or redo. A render is never
//   applied to notes that changed meanwhile: whether a clip still wants it
//   is read again as it lands, as it is kept, and by the command itself.
//
//   FAILURE — a render that fails leaves its clip on its earlier audio, and
//   its lane says so. A key is tried at most twice a session, the second
//   time only when a keep asks for it, so a kit that will not start does
//   not loop.
import type { Accessor } from 'solid-js'
import { createEffect, createMemo, createSignal, on, onCleanup, untrack, } from 'solid-js'
import type { StudioMidiKeys } from '@/lib/studio/midi/clip-keys'
import { studioMidiKeys } from '@/lib/studio/midi/clip-keys'
import { studioLaneMidiSound } from '@/lib/studio/midi/lane-sound'
import type { StudioNoteSet } from '@/lib/studio/midi/notes'
import type { StudioMidiSoundKind } from '@/lib/studio/midi/render-key'
import { studioSequence } from '@/lib/studio/model/sequences'
import type { StudioAsset, StudioProject, StudioSequence, } from '@/lib/studio/model/types'
import type { StudioRenderImport } from '../controller/imports'
import type { StudioMidiPreview } from './midi-preview-audio'
import { createStudioMidiPreview, studioMidiPreviewBlob, studioMidiPreviewSamples, } from './midi-preview-audio'
import type { StudioMidiSnapshot } from './midi-preview-snapshot'
import { studioMidiPreviewSnapshot } from './midi-preview-snapshot'
import type { StudioMidiRender, StudioMidiRenderInput, } from './render/render-studio-midi'

/** What a clip's render is doing, for its lane to show. */
export type StudioMidiRenderState = 'idle' | 'rendering' | 'failed'

/** How many times a key is rendered, at most, in a session. */
const MAX_TRIES = 2
const PREVIEW_DELAY_MS = 250
const TRAVEL_DELAY_MS = 1000

/** Keys whose render failed, and how often: shared by every song opened in the page. */
export function createStudioMidiRenderFailures() {
  const counts = new Map<string, number>()
  const count = (key: string) => counts.get(key) ?? 0
  return {
    count,
    add: (key: string) => void counts.set(key, count(key) + 1),
    spent: (key: string) => count(key) >= MAX_TRIES,
  }
}

export type StudioMidiRenderFailures = ReturnType<
  typeof createStudioMidiRenderFailures
>

const sessionFailures = createStudioMidiRenderFailures()

/** The renderer, loaded with import() the first time a clip needs it. */
const lazyRender = (input: StudioMidiRenderInput) =>
  import('./render/render-studio-midi').then((module) =>
    module.renderStudioMidi(input),
  )

export interface StudioMidiRenderServiceOptions {
  /** The song as it is kept: its present, every clip on its own audio. */
  project: Accessor<StudioProject | null>
  assets: Accessor<readonly StudioAsset[]>
  /** Keep a render as the audio of the clips whose notes have its key (useStudioController). */
  keep(render: StudioRenderImport): Promise<boolean>
  /** Undo and redo, counted: a render a step lands on is kept a second later. */
  travels?: Accessor<number>
  /** Whether a render can be kept now: the song is open for editing here. */
  canKeep?: Accessor<boolean>
  render?(input: StudioMidiRenderInput): Promise<StudioMidiRender>
  keys?: StudioMidiKeys
  failures?: StudioMidiRenderFailures
  previewDelayMs?: number
  travelDelayMs?: number
  now?: () => Date
}

/** A render some clip wants: its notes and time, its lane's sound, and the clips and lanes it is for. */
interface Want {
  readonly key: string
  readonly sequence: StudioSequence
  readonly sound: StudioMidiSoundKind
  readonly clipIds: readonly string[]
  readonly trackIds: readonly string[]
  /** The song's own notes want it, not only a draft: it is kept once asked. */
  readonly kept: boolean
}

interface Wants {
  readonly byKey: ReadonlyMap<string, Want>
  /** The render each clip plays: its draft's, or its notes'. */
  readonly byClip: ReadonlyMap<string, string>
}

interface Draft {
  readonly sequence: StudioSequence
  /** The key of the clip's notes as the draft began: an edit or an undo since ends it. */
  readonly base: string
}

interface Running {
  readonly abort: AbortController
  readonly done: Promise<StudioMidiPreview | null>
}

function addWant(
  wants: Map<string, Want>,
  key: string,
  part: Omit<Want, 'key' | 'clipIds' | 'trackIds' | 'kept'>,
  clip: { id: string; trackId: string },
  kept: boolean,
): void {
  const known = wants.get(key)
  wants.set(key, {
    key,
    ...part,
    clipIds: [...(known?.clipIds ?? []), clip.id],
    trackIds: [...(known?.trackIds ?? []), clip.trackId],
    kept: kept || known?.kept === true,
  })
}

/** The lanes a render is for, as their names read. */
function laneWords(project: StudioProject | null, want: Want): string {
  const names = [...new Set(want.trackIds)].map(
    (id) => project?.tracks.find((track) => track.id === id)?.name ?? 'A lane',
  )
  return names.length > 1
    ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
    : (names[0] ?? 'A lane')
}

function reason(error: unknown): string {
  return error instanceof Error && error.message !== ''
    ? ` ${error.message}`
    : ''
}

function aborted(signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve) => {
    if (signal === undefined) return
    if (signal.aborted) resolve()
    else signal.addEventListener('abort', () => resolve(), { once: true })
  })
}

export function createStudioMidiRenderService(
  options: StudioMidiRenderServiceOptions,
) {
  const keys = options.keys ?? studioMidiKeys
  const failures = options.failures ?? sessionFailures
  const render = options.render ?? lazyRender
  const delay = options.previewDelayMs ?? PREVIEW_DELAY_MS
  const now = options.now ?? (() => new Date())
  const [drafts, setDrafts] = createSignal<ReadonlyMap<string, Draft>>(
    new Map(),
  )
  // Drafts given since the notes were last left alone: hashed once they are.
  const [drafting, setDrafting] = createSignal<ReadonlyMap<string, Draft>>(
    new Map(),
  )
  const [previews, setPreviews] = createSignal<
    ReadonlyMap<string, StudioMidiPreview>
  >(new Map())
  // Keys whose render failed since they were last wanted, and why.
  const [failed, setFailed] = createSignal<ReadonlyMap<string, string>>(
    new Map(),
  )
  const [notice, setNotice] = createSignal<{ text: string } | null>(null)
  const [runningKeys, setRunningKeys] = createSignal<ReadonlySet<string>>(
    new Set(),
  )
  const running = new Map<string, Running>()
  // Renders run one at a time, in the order asked.
  let slot: Promise<unknown> = Promise.resolve()
  let keeping: Promise<void> = Promise.resolve()
  let quiet: ReturnType<typeof setTimeout> | undefined
  let travelTimer: ReturnType<typeof setTimeout> | undefined
  let flushing = false
  let disposed = false

  /** Each live draft's render: one whose clip's notes changed since it began has ended. */
  function addDrafts(
    project: StudioProject,
    byKey: Map<string, Want>,
    byClip: Map<string, string>,
  ): void {
    for (const [clipId, draft] of drafts()) {
      const clip = project.clips.find((each) => each.id === clipId)
      const track = project.tracks.find((each) => each.id === clip?.trackId)
      if (!clip || !track || keys.clipKey(project, clip) !== draft.base)
        continue
      const sound = studioLaneMidiSound(track)
      const key = keys.key(draft.sequence, sound)
      if (key === clip.midi?.renderKey) continue
      addWant(byKey, key, { sequence: draft.sequence, sound }, clip, false)
      byClip.set(clipId, key)
    }
  }

  const wants = createMemo((): Wants => {
    const project = options.project()
    const byKey = new Map<string, Want>()
    const byClip = new Map<string, string>()
    if (project === null) return { byKey, byClip }
    for (const stale of keys.staleClips(project)) {
      const part = { sequence: stale.sequence, sound: stale.sound }
      addWant(byKey, stale.key, part, stale.clip, true)
      byClip.set(stale.clip.id, stale.key)
    }
    addDrafts(project, byKey, byClip)
    return { byKey, byClip }
  })

  function forget(key: string): void {
    if (!failed().has(key)) return
    const next = new Map(failed())
    next.delete(key)
    setFailed(next)
  }

  function fail(want: Want, error: unknown, stage: 'render' | 'keep'): void {
    failures.add(want.key)
    setFailed(new Map(failed()).set(want.key, reason(error).trim()))
    const lanes = laneWords(options.project(), want)
    setNotice({
      text:
        stage === 'render'
          ? `${lanes} still plays its earlier audio: Studio couldn't render the new notes.${reason(error)}`
          : `Studio couldn't keep the new audio for ${lanes}.${reason(error)}`,
    })
  }

  /** The preview, if `want` still wants it as it lands; else its memory back. */
  function land(
    want: Want,
    preview: StudioMidiPreview,
  ): StudioMidiPreview | null {
    if (disposed || !wants().byKey.has(want.key)) {
      preview.release()
      return null
    }
    setPreviews(new Map(previews()).set(want.key, preview))
    return preview
  }

  async function attempt(
    want: Want,
    signal: AbortSignal,
  ): Promise<StudioMidiPreview | null> {
    // The song as the render starts, read once: a change since is caught as it lands.
    const project = untrack(options.project)
    if (signal.aborted || disposed || project === null) return null
    try {
      const rendered = await render({
        notes: want.sequence.notes,
        tempoBpm: want.sequence.tempoBpm,
        lengthTicks: want.sequence.lengthTicks,
        sound: want.sound,
        signal,
      })
      const preview = await createStudioMidiPreview(
        rendered.samples,
        want.key,
        project.id,
        now().toISOString(),
        signal,
      )
      return land(want, preview)
    } catch (error) {
      if (!signal.aborted && !disposed) fail(want, error, 'render')
      return null
    }
  }

  /** A render is over: it no longer runs, unless another took its key since. */
  function ended(key: string, abort: AbortController): void {
    if (running.get(key)?.abort === abort) running.delete(key)
    setRunningKeys(new Set(running.keys()))
  }

  /** The preview of `want`: ready, rendering, or rendered next. Null when it cannot be. */
  function ensure(want: Want): Promise<StudioMidiPreview | null> {
    const ready = previews().get(want.key)
    if (ready !== undefined) return Promise.resolve(ready)
    const queued = running.get(want.key)
    if (queued !== undefined) return queued.done
    if (failures.spent(want.key) || failed().has(want.key))
      return Promise.resolve(null)
    const abort = new AbortController()
    // Run once the render before it settles: it reads the song as it starts.
    // eslint-disable-next-line solid/reactivity
    const done = slot.then(() => attempt(want, abort.signal))
    void done.finally(() => ended(want.key, abort))
    slot = done.catch(() => undefined)
    running.set(want.key, { abort, done })
    setRunningKeys(new Set(running.keys()))
    return done
  }

  /** Render every preview the song wants and does not hold. */
  function pump(): void {
    for (const want of wants().byKey.values()) void ensure(want)
  }

  /** The notes were left alone: take in the drafts given since, and render. */
  function settleNotes(): void {
    quiet = undefined
    if (disposed) return
    if (drafting().size > 0) {
      flushing = true
      setDrafts(new Map([...drafts(), ...drafting()]))
      setDrafting(new Map())
      flushing = false
    }
    pump()
  }

  function soon(): void {
    clearTimeout(quiet)
    quiet = setTimeout(settleNotes, delay)
  }

  /** A preview no clip plays any more is dropped, its memory given back. */
  function dropUnwanted(next: Wants): void {
    const unwanted = [...previews()].filter(([key]) => !next.byKey.has(key))
    if (unwanted.length === 0) return
    const kept = new Map(previews())
    for (const [key, preview] of unwanted) {
      preview.release()
      kept.delete(key)
    }
    setPreviews(kept)
  }

  /** A failure no clip wants is forgotten, so it may be tried again; a key spent this session shows as failed. */
  function markFailures(next: Wants): void {
    const marks = new Map([...failed()].filter(([key]) => next.byKey.has(key)))
    for (const key of next.byKey.keys())
      if (failures.spent(key) && !marks.has(key)) marks.set(key, '')
    const same =
      marks.size === failed().size &&
      [...marks.keys()].every((key) => failed().has(key))
    if (!same) setFailed(marks)
  }

  /** Follow the renders the song wants: abort the rest, and render what is missing once the notes rest. */
  function follow(next: Wants): void {
    for (const [key, run] of running)
      if (!next.byKey.has(key)) run.abort.abort()
    dropUnwanted(next)
    markFailures(next)
    const missing = [...next.byKey.keys()].some(
      (key) => !previews().has(key) && !running.has(key) && !failed().has(key),
    )
    if (missing && !flushing) soon()
  }
  createEffect(on(wants, (next) => untrack(() => follow(next))))

  /** Whether the song's own notes still want `key`: the notes did not change meanwhile. */
  const stillWanted = (key: string) => wants().byKey.get(key)?.kept === true

  /**
   * The name a render's audio is kept under: its first clip's, so the clip
   * keeps its name. None when that clip's audio has none, as a clip drawn
   * from scratch has not (new-midi-clips.ts): it goes on showing its lane's.
   */
  function titleOf(want: Want): string | undefined {
    const clip = options
      .project()
      ?.clips.find((each) => each.id === want.clipIds[0])
    const asset = options.assets().find((each) => each.id === clip?.assetId)
    const name = asset?.originalName?.replace(/\.[^.]+$/, '') ?? ''
    return name === '' ? undefined : name
  }

  async function keepOne(want: Want): Promise<void> {
    // A keep gives a failed render its one more try.
    forget(want.key)
    const preview = await ensure(want)
    if (preview === null || !stillWanted(want.key)) return
    try {
      await options.keep({
        samples: studioMidiPreviewSamples(preview),
        renderKey: want.key,
        title: titleOf(want),
      })
    } catch (error) {
      if (
        !disposed &&
        !(error instanceof DOMException && error.name === 'AbortError')
      )
        fail(want, error, 'keep')
    }
  }

  /** The next render the song's notes want kept, of `only` when given, not tried in this keep and not spent. */
  function nextToKeep(
    tried: ReadonlySet<string>,
    only?: ReadonlySet<string>,
  ): Want | undefined {
    for (const want of wants().byKey.values())
      if (
        want.kept &&
        only?.has(want.key) !== false &&
        !tried.has(want.key) &&
        !failures.spent(want.key)
      )
        return want
    return undefined
  }

  async function keepStale(only?: ReadonlySet<string>): Promise<void> {
    const tried = new Set<string>()
    for (;;) {
      if (disposed || options.canKeep?.() === false) return
      const want = nextToKeep(tried, only)
      if (want === undefined) return
      tried.add(want.key)
      await keepOne(want)
    }
  }

  /** Keep every stale clip's render as its audio, or those of `only`: one keep at a time, each after the last. */
  function keepAll(only?: ReadonlySet<string>): Promise<void> {
    const run = () => keepStale(only)
    keeping = keeping.then(run, run)
    return keeping
  }

  // A song opens: what it was left with stale is kept now. An edit made
  // since waits for its own moment.
  let opened = false
  createEffect(() => {
    if (opened || options.project() === null || options.canKeep?.() === false)
      return
    opened = true
    const stale = new Set(
      [...untrack(wants).byKey.values()]
        .filter((want) => want.kept)
        .map((want) => want.key),
    )
    if (stale.size > 0) void keepAll(stale)
  })

  const travels = options.travels
  if (travels !== undefined)
    createEffect(
      on(
        travels,
        () => {
          clearTimeout(travelTimer)
          travelTimer = setTimeout(
            () => void keepAll(),
            options.travelDelayMs ?? TRAVEL_DELAY_MS,
          )
        },
        { defer: true },
      ),
    )

  // What each clip plays: its preview, once it is ready.
  const played = createMemo(
    (): ReadonlyMap<string, StudioAsset> => {
      const ready = new Map<string, StudioAsset>()
      for (const [clipId, key] of wants().byClip) {
        const preview = previews().get(key)
        if (preview !== undefined) ready.set(clipId, preview.asset)
      }
      return ready
    },
    new Map(),
    {
      equals: (a, b) =>
        a.size === b.size && [...a].every(([id, asset]) => b.get(id) === asset),
    },
  )

  const snapshot = createMemo((): StudioMidiSnapshot | null => {
    const project = options.project()
    if (project === null) return null
    const ready = played()
    return studioMidiPreviewSnapshot(project, options.assets(), (clip) =>
      ready.get(clip.id),
    )
  })

  function renderState(clipId: string): StudioMidiRenderState {
    if (drafting().has(clipId)) return 'rendering'
    const key = wants().byClip.get(clipId)
    if (key === undefined) return 'idle'
    if (failed().has(key)) return 'failed'
    if (previews().has(key)) return 'idle'
    return 'rendering'
  }

  const waitingLanes = createMemo(
    () =>
      new Set(
        [...wants().byKey.values()]
          .filter((want) => want.kept && !failed().has(want.key))
          .flatMap((want) => want.trackIds),
      ) as ReadonlySet<string>,
    new Set<string>(),
    {
      equals: (a, b) => a.size === b.size && [...a].every((id) => b.has(id)),
    },
  )

  onCleanup(() => {
    disposed = true
    clearTimeout(quiet)
    clearTimeout(travelTimer)
    for (const run of running.values()) run.abort.abort()
    for (const preview of previews().values()) preview.release()
  })

  return {
    /** The song as the transport plays it: each stale clip on its preview once ready. */
    snapshot,
    /** A preview's canonical copy, or the song's own audio. */
    readPreview(assetId: string): Blob | undefined {
      for (const preview of previews().values())
        if (preview.asset.id === assetId) return studioMidiPreviewBlob(preview)
      return undefined
    },
    /** Notes the editor shows before it commits them, on the clip's own time, rendered once left alone; null ends the draft. */
    preview(clipId: string, draft: StudioNoteSet | null): void {
      const project = untrack(options.project)
      const clip = project?.clips.find((each) => each.id === clipId)
      const base = project && clip ? keys.clipKey(project, clip) : null
      const own =
        clip?.midi && project && studioSequence(project, clip.midi.sequenceId)
      const pending = new Map(untrack(drafting))
      if (draft === null || base === null || !own) {
        pending.delete(clipId)
        const kept = new Map(untrack(drafts))
        kept.delete(clipId)
        setDrafts(kept)
      } else {
        // The draft's notes on the clip's own time, made once, so it hashes once.
        const sequence = {
          ...own,
          notes: draft.notes,
          nextNoteId: draft.nextNoteId,
        }
        pending.set(clipId, { sequence, base })
      }
      setDrafting(pending)
      soon()
    },
    /** The editor closed: its drafts end, and every stale clip's render is kept now. */
    editorClosed(): Promise<void> {
      clearTimeout(quiet)
      setDrafting(new Map())
      setDrafts(new Map())
      return keepAll()
    },
    renderState,
    /** Keep what is stale before an export: resolves once it is kept, failed, or `signal` aborts. */
    settle(signal?: AbortSignal): Promise<void> {
      return Promise.race([keepAll(), aborted(signal)])
    },
    /** Whether a clip's notes wait for a render to be kept. */
    keepsPending: () =>
      [...wants().byKey.values()].some(
        (want) => want.kept && !failed().has(want.key),
      ),
    /** The lanes whose MIDI clips wait for a render to be kept: the lane freezer leaves them alone. */
    waitingLanes,
    /** Why a lane plays its earlier audio: a fresh object each time it is said. */
    notice,
    /** Keys rendering now or queued, for tests and the lane preview. */
    rendering: runningKeys,
  }
}

export type StudioMidiRenderService = ReturnType<
  typeof createStudioMidiRenderService
>

import type { Component } from 'solid-js'
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show, } from 'solid-js'
import { Plus, Search } from '@/components/icons'
import { ZEN_EXERCISES } from '@/features/zen/exercise-catalog'
import type { AdminGuidedExercise, AdminGuidedExerciseDraft, AdminGuidedExerciseVersion, ApiResult, } from '@/features/zen/guided-exercise-service'
import { archiveGuidedExercise, cloneGuidedExerciseDraft, createGuidedExercise, downloadAdminGuidedExerciseMedia, listAdminGuidedExercises, publishGuidedExercise, saveGuidedExerciseDraft, uploadGuidedExerciseMedia, validateGuidedExerciseDraft, } from '@/features/zen/guided-exercise-service'
import type { ZenExampleAudio, ZenExerciseDefinition, } from '@/features/zen/types'
import { validateZenExercise } from '@/features/zen/validate-exercise'
import { showNotification } from '@/stores/notifications-store'
import styles from './AdminExercisesPage.module.css'
import type { ExerciseEditorStatus, ExerciseEditorValidationIssue, ExerciseLifecycle, } from './exercises/ExerciseEditor'
import { ExerciseEditor } from './exercises/ExerciseEditor'

interface AdminExercisesPageProps {
  adminKey: string
  onPublished?: () => void
  onDirtyChange?: (dirty: boolean) => void
}

const blankExercise = (): ZenExerciseDefinition => ({
  id: 'untitled-exercise',
  version: 1,
  title: '',
  category: 'tone',
  level: 'foundation',
  summary: '',
  goal: '',
  instructions: '',
  bpm: 72,
  countInBeats: 2,
  loopBeats: 8,
  defaultRootMidi: 57,
  targets: [
    {
      id: 'note-1',
      startBeat: 1,
      durationBeats: 1,
      semitone: 0,
      cue: 'Ah',
      showCue: true,
    },
  ],
  defaultTargetVisibility: 'on',
  defaultProgressCue: 'playhead',
  scoring: {
    pitchWeight: 0.55,
    coverageWeight: 0.25,
    steadinessWeight: 0.2,
    toleranceCents: 100,
  },
})

function preferredVersion(
  exercise: AdminGuidedExercise,
): AdminGuidedExerciseVersion | null {
  const draft = exercise.versions.find(
    (version) => version.lifecycle === 'draft',
  )
  if (draft !== undefined) return draft
  const published = exercise.versions.find(
    (version) => version.version === exercise.publishedVersion,
  )
  return published ?? exercise.versions[0] ?? null
}

function resultError<T>(result: ApiResult<T>): Error {
  if (result.ok) return new Error('Unexpected successful result')
  return new Error(result.error)
}

function mediaDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const source = URL.createObjectURL(file)
    const audio = document.createElement('audio')
    const cleanup = (): void => {
      audio.removeAttribute('src')
      audio.load()
      URL.revokeObjectURL(source)
    }
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => {
      const durationMs = Math.round(audio.duration * 1000)
      cleanup()
      if (!Number.isFinite(durationMs) || durationMs <= 0) {
        reject(new Error('The audio duration could not be read.'))
        return
      }
      resolve(durationMs)
    }
    audio.onerror = () => {
      cleanup()
      reject(new Error('The selected audio file could not be read.'))
    }
    audio.src = source
  })
}

export const AdminExercisesPage: Component<AdminExercisesPageProps> = (
  props,
) => {
  const [rows, setRows] = createSignal<AdminGuidedExercise[]>([])
  const [loading, setLoading] = createSignal(true)
  const [pageError, setPageError] = createSignal<string | null>(null)
  const [query, setQuery] = createSignal('')
  const [statusFilter, setStatusFilter] = createSignal<
    'all' | 'draft' | 'published' | 'archived'
  >('all')
  const [selectedId, setSelectedId] = createSignal<string | null>(null)
  const [selectedVersionNumber, setSelectedVersionNumber] = createSignal<
    number | null
  >(null)
  const [working, setWorking] = createSignal<ZenExerciseDefinition | null>(null)
  const [serverDraft, setServerDraft] =
    createSignal<AdminGuidedExerciseDraft | null>(null)
  const [exampleMediaId, setExampleMediaId] = createSignal<string | null>(null)
  const [isNew, setIsNew] = createSignal(false)
  const [dirty, setDirty] = createSignal(false)
  const [editorStatus, setEditorStatus] =
    createSignal<ExerciseEditorStatus>('idle')
  const [serverIssues, setServerIssues] = createSignal<
    ExerciseEditorValidationIssue[]
  >([])
  let examplePreviewObjectUrl: string | null = null
  let examplePreviewRequest = 0
  let activeSelectionKey = ''

  const revokeExamplePreview = (): void => {
    if (examplePreviewObjectUrl === null) return
    URL.revokeObjectURL(examplePreviewObjectUrl)
    examplePreviewObjectUrl = null
  }

  const cancelExamplePreview = (): void => {
    examplePreviewRequest += 1
    revokeExamplePreview()
  }

  createEffect(() => {
    props.onDirtyChange?.(dirty())
  })

  onCleanup(() => {
    cancelExamplePreview()
    props.onDirtyChange?.(false)
  })

  const selectedRow = createMemo(
    () => rows().find((row) => row.id === selectedId()) ?? null,
  )

  const selectedVersion = createMemo(
    () =>
      selectedRow()?.versions.find(
        (version) => version.version === selectedVersionNumber(),
      ) ?? null,
  )

  const lifecycle = createMemo<ExerciseLifecycle>(() => {
    if (isNew() || selectedVersion()?.lifecycle === 'draft') return 'draft'
    if (selectedRow()?.status === 'archived') return 'archived'
    if (selectedVersion()?.lifecycle === 'superseded') return 'superseded'
    return 'published'
  })

  const validationIssues = createMemo<ExerciseEditorValidationIssue[]>(() => {
    const value = working()
    if (value === null) return serverIssues()
    const local = validateZenExercise(value).map((issue) => ({
      ...issue,
      severity: 'error' as const,
    }))
    const seen = new Set(local.map((issue) => `${issue.path}:${issue.message}`))
    return [
      ...local,
      ...serverIssues().filter(
        (issue) => !seen.has(`${issue.path}:${issue.message}`),
      ),
    ]
  })

  const visibleRows = createMemo(() => {
    const needle = query().trim().toLowerCase()
    return rows().filter((row) => {
      const version = preferredVersion(row)
      const definition = version?.exercise
      const hasDraft = row.versions.some(
        (candidate) => candidate.lifecycle === 'draft',
      )
      const state =
        row.status === 'archived'
          ? 'archived'
          : hasDraft
            ? 'draft'
            : 'published'
      if (statusFilter() !== 'all' && statusFilter() !== state) return false
      if (needle === '') return true
      return (
        row.id.toLowerCase().includes(needle) ||
        definition?.title.toLowerCase().includes(needle) === true ||
        definition?.targets.some((target) =>
          target.cue.toLowerCase().includes(needle),
        ) === true
      )
    })
  })

  const openVersion = (
    row: AdminGuidedExercise,
    version: AdminGuidedExerciseVersion,
  ): void => {
    if (dirty() && !confirm('Discard the unsaved exercise changes?')) return
    if (version?.exercise === null || version?.exercise === undefined) {
      setPageError(`Version ${version.version} of "${row.id}" is unreadable.`)
      return
    }
    cancelExamplePreview()
    const exercise = structuredClone(version.exercise)
    const privateDraftMediaId =
      version.lifecycle === 'draft' ? version.exampleMediaId : null
    const selectionKey = `${row.id}:${version.version}`
    activeSelectionKey = selectionKey
    if (privateDraftMediaId !== null && exercise.exampleAudio !== undefined) {
      exercise.exampleAudio.src = ''
    }
    setSelectedId(row.id)
    setSelectedVersionNumber(version.version)
    setWorking(exercise)
    setServerDraft(
      version.lifecycle === 'draft'
        ? {
            exercise: version.exercise,
            version: version.version,
            draftRevision: version.draftRevision,
            exampleMediaId: version.exampleMediaId,
          }
        : null,
    )
    setExampleMediaId(version.exampleMediaId)
    setIsNew(false)
    setDirty(false)
    setServerIssues(version.issues)
    setPageError(null)
    if (privateDraftMediaId !== null) {
      const request = ++examplePreviewRequest
      const adminKey = props.adminKey
      void downloadAdminGuidedExerciseMedia(privateDraftMediaId, adminKey).then(
        (result) => {
          if (
            request !== examplePreviewRequest ||
            activeSelectionKey !== selectionKey
          ) {
            return
          }
          if (!result.ok) {
            setPageError(
              `Saved example audio could not be loaded: ${result.error}`,
            )
            return
          }
          revokeExamplePreview()
          examplePreviewObjectUrl = URL.createObjectURL(result.data)
          setWorking((current) =>
            current?.exampleAudio === undefined
              ? current
              : {
                  ...current,
                  exampleAudio: {
                    ...current.exampleAudio,
                    src: examplePreviewObjectUrl ?? '',
                  },
                },
          )
        },
      )
    }
  }

  const selectRow = (row: AdminGuidedExercise): void => {
    const version = preferredVersion(row)
    if (version === null) {
      setPageError(`"${row.id}" has no readable exercise version.`)
      return
    }
    openVersion(row, version)
  }

  const load = async (preferredId?: string): Promise<void> => {
    const adminKey = props.adminKey
    const currentId = selectedId()
    setLoading(true)
    setPageError(null)
    const result = await listAdminGuidedExercises(adminKey)
    setLoading(false)
    if (!result.ok) {
      setPageError(result.error)
      return
    }
    setRows(result.data)
    const nextId = preferredId ?? currentId
    const next =
      result.data.find((row) => row.id === nextId) ?? result.data[0] ?? null
    if (next !== null) selectRow(next)
  }

  const beginNew = (): void => {
    if (dirty() && !confirm('Discard the unsaved exercise changes?')) return
    cancelExamplePreview()
    activeSelectionKey = 'new'
    setSelectedId(null)
    setSelectedVersionNumber(null)
    setWorking(blankExercise())
    setServerDraft(null)
    setExampleMediaId(null)
    setIsNew(true)
    setDirty(true)
    setServerIssues([])
    setPageError(null)
  }

  const save = async (
    value: ZenExerciseDefinition,
  ): Promise<{
    id: string
    draft: AdminGuidedExerciseDraft
  }> => {
    const creating = isNew()
    const adminKey = props.adminKey
    const mediaId = exampleMediaId()
    const sortOrder = rows().length
    const existingId = selectedId()
    const existingDraft = serverDraft()
    setEditorStatus('saving')
    try {
      if (creating) {
        const result = await createGuidedExercise(value, adminKey, {
          exampleMediaId: mediaId,
          sortOrder,
        })
        if (!result.ok) {
          setServerIssues(result.issues ?? [])
          throw resultError(result)
        }
        setServerDraft(result.data.draft)
        setSelectedId(result.data.exercise.id)
        setIsNew(false)
        setDirty(false)
        await load(result.data.exercise.id)
        showNotification('Exercise draft created', 'success')
        return {
          id: result.data.exercise.id,
          draft: result.data.draft,
        }
      }

      if (existingId === null || existingDraft === null) {
        throw new Error('Create a draft revision before editing this exercise.')
      }
      const result = await saveGuidedExerciseDraft(
        existingId,
        value,
        existingDraft.draftRevision,
        adminKey,
        { exampleMediaId: mediaId },
      )
      if (!result.ok) {
        setServerIssues(result.issues ?? [])
        throw resultError(result)
      }
      setServerDraft(result.data.draft)
      const savedExercise = structuredClone(result.data.draft.exercise)
      if (savedExercise.exampleAudio !== undefined && mediaId !== null) {
        savedExercise.exampleAudio.src = examplePreviewObjectUrl ?? ''
      }
      setWorking(savedExercise)
      setDirty(false)
      setServerIssues([])
      showNotification('Draft saved', 'success')
      return { id: existingId, draft: result.data.draft }
    } finally {
      setEditorStatus('idle')
    }
  }

  const saveFromEditor = async (
    value: ZenExerciseDefinition,
  ): Promise<void> => {
    await save(value)
  }

  const publish = async (value: ZenExerciseDefinition): Promise<void> => {
    const needsSave = dirty()
    const currentId = selectedId()
    const currentDraft = serverDraft()
    const adminKey = props.adminKey
    const onPublished = props.onPublished
    const saved = needsSave
      ? await save(value)
      : { id: currentId, draft: currentDraft }
    const { id, draft } = saved
    if (id === null || draft === null) {
      throw new Error('Create a draft revision before publishing.')
    }

    setEditorStatus('publishing')
    try {
      const validation = await validateGuidedExerciseDraft(id, adminKey)
      if (!validation.ok) {
        setServerIssues(validation.issues ?? [])
        throw resultError(validation)
      }
      if (!validation.data.valid) {
        setServerIssues(validation.data.issues)
        throw new Error('Resolve the publication issues before publishing.')
      }
      if (
        !confirm(
          `Publish ${value.title || value.id} as immutable version ${draft.version}?`,
        )
      ) {
        return
      }
      const result = await publishGuidedExercise(
        id,
        draft.draftRevision,
        adminKey,
      )
      if (!result.ok) {
        setServerIssues(result.issues ?? [])
        throw resultError(result)
      }
      setDirty(false)
      setServerIssues([])
      onPublished?.()
      await load(id)
      showNotification(`Version ${result.data.version} published`, 'success')
    } finally {
      setEditorStatus('idle')
    }
  }

  const createRevision = async (): Promise<void> => {
    const id = selectedId()
    const adminKey = props.adminKey
    if (id === null) return
    setEditorStatus('duplicating')
    try {
      const result = await cloneGuidedExerciseDraft(id, adminKey)
      if (!result.ok) throw resultError(result)
      await load(id)
      showNotification(
        `Draft version ${result.data.draft.version} created`,
        'success',
      )
    } finally {
      setEditorStatus('idle')
    }
  }

  const archive = async (): Promise<void> => {
    const id = selectedId()
    const value = working()
    const adminKey = props.adminKey
    if (
      id === null ||
      value === null ||
      !confirm(`Archive "${value.title || id}"? Existing takes will remain.`)
    ) {
      return
    }
    setEditorStatus('archiving')
    try {
      const result = await archiveGuidedExercise(id, adminKey)
      if (!result.ok) throw resultError(result)
      await load(id)
      showNotification('Exercise archived', 'info')
    } finally {
      setEditorStatus('idle')
    }
  }

  const uploadExample = async (
    file: File,
    value: ZenExerciseDefinition,
    recordedDurationMs?: number,
  ): Promise<ZenExampleAudio> => {
    const adminKey = props.adminKey
    const metadata = value.exampleAudio
    if (metadata === undefined || metadata.transcript.trim() === '') {
      throw new Error('Add the example transcript before uploading audio.')
    }
    const durationMs =
      recordedDurationMs === undefined
        ? await mediaDuration(file)
        : Math.max(1, Math.round(recordedDurationMs))
    const result = await uploadGuidedExerciseMedia(
      file,
      {
        durationMs,
        source: metadata.source,
        transcript: metadata.transcript,
        locale: metadata.locale,
      },
      adminKey,
    )
    if (!result.ok) throw resultError(result)
    revokeExamplePreview()
    examplePreviewObjectUrl = URL.createObjectURL(file)
    setExampleMediaId(result.data.id)
    setDirty(true)
    return {
      src: examplePreviewObjectUrl,
      durationMs: result.data.durationMs,
      locale: result.data.locale,
      source: result.data.source,
      transcript: result.data.transcript,
    }
  }

  const importSeeds = async (): Promise<void> => {
    const currentRows = rows()
    const adminKey = props.adminKey
    const onPublished = props.onPublished
    if (dirty() && !confirm('Discard the unsaved changes before importing?')) {
      return
    }
    const existing = new Set(currentRows.map((row) => row.id))
    const missingSeeds = ZEN_EXERCISES.filter((seed) => !existing.has(seed.id))
    if (missingSeeds.length === 0) {
      showNotification('All starter exercise IDs are already present', 'info')
      return
    }
    const existingNote =
      currentRows.length === 0
        ? ''
        : ' Existing stable IDs will be left unchanged.'
    if (
      !confirm(
        `Publish ${missingSeeds.length} starter ${missingSeeds.length === 1 ? 'exercise' : 'exercises'} now? This creates immutable published version 1 for each starter.${existingNote}`,
      )
    ) {
      return
    }
    revokeExamplePreview()
    setDirty(false)
    setEditorStatus('publishing')
    let imported = 0
    try {
      for (const seed of missingSeeds) {
        const created = await createGuidedExercise(seed, adminKey, {
          sortOrder: currentRows.length + imported,
        })
        if (!created.ok) throw resultError(created)
        const published = await publishGuidedExercise(
          seed.id,
          created.data.draft.draftRevision,
          adminKey,
        )
        if (!published.ok) throw resultError(published)
        imported += 1
      }
      await load()
      onPublished?.()
      showNotification(
        `${imported} immutable starter ${imported === 1 ? 'version' : 'versions'} published`,
        'success',
      )
    } catch (error) {
      if (imported > 0) {
        await load()
        onPublished?.()
      }
      const message = error instanceof Error ? error.message : String(error)
      setPageError(
        imported === 0
          ? message
          : `${imported} starter ${imported === 1 ? 'version was' : 'versions were'} published before the process stopped. The next starter may remain as a draft. ${message}`,
      )
      showNotification('Starter publication stopped', 'error')
    } finally {
      setEditorStatus('idle')
    }
  }

  onMount(() => void load())

  return (
    <section class={styles.page} aria-label="Vocal exercise catalogue">
      <aside class={styles.catalogue}>
        <div class={styles.catalogueActions}>
          <button type="button" class={styles.newButton} onClick={beginNew}>
            <Plus size={15} />
            New exercise
          </button>
          <button
            type="button"
            class={styles.seedButton}
            onClick={() => void importSeeds()}
            disabled={editorStatus() !== 'idle'}
          >
            Publish starter set
          </button>
        </div>

        <label class={styles.search}>
          <Search />
          <span class={styles.srOnly}>Search exercises</span>
          <input
            type="search"
            value={query()}
            placeholder="Search title, cue, or slug"
            onInput={(event) => setQuery(event.currentTarget.value)}
          />
        </label>

        <div class={styles.filters} aria-label="Catalogue status filter">
          <For each={['all', 'draft', 'published', 'archived'] as const}>
            {(filter) => (
              <button
                type="button"
                aria-pressed={statusFilter() === filter}
                classList={{ [styles.filterActive]: statusFilter() === filter }}
                onClick={() => setStatusFilter(filter)}
              >
                {filter}
              </button>
            )}
          </For>
        </div>

        <Show when={loading()}>
          <p class={styles.catalogueState} role="status">
            Loading catalogue…
          </p>
        </Show>
        <Show when={!loading() && visibleRows().length === 0}>
          <div class={styles.empty}>
            <strong>No exercises here yet</strong>
            <p>
              Create one from scratch or publish the provisional starter set as
              immutable version 1 exercises.
            </p>
          </div>
        </Show>

        <div class={styles.exerciseList}>
          <For each={visibleRows()}>
            {(row) => {
              const version = () => preferredVersion(row)
              const title = () => {
                const value = version()?.exercise?.title.trim()
                return value === undefined || value === '' ? row.id : value
              }
              const hasDraft = () =>
                row.versions.some(
                  (candidate) => candidate.lifecycle === 'draft',
                )
              const status = () =>
                row.status === 'archived'
                  ? 'Archived'
                  : hasDraft()
                    ? 'Draft'
                    : `Published v${row.publishedVersion ?? '—'}`
              return (
                <button
                  type="button"
                  class={styles.exerciseRow}
                  classList={{
                    [styles.exerciseRowActive]: selectedId() === row.id,
                  }}
                  onClick={() => selectRow(row)}
                >
                  <span class={styles.rowTopline}>
                    <strong>{title()}</strong>
                    <small>{status()}</small>
                  </span>
                  <span class={styles.rowMeta}>
                    {row.category} · {row.level} · {row.versions.length}{' '}
                    {row.versions.length === 1 ? 'version' : 'versions'}
                  </span>
                </button>
              )
            }}
          </For>
        </div>
      </aside>

      <main class={styles.editorPane}>
        <Show when={pageError()}>
          {(message) => (
            <div class={styles.pageError} role="alert">
              <strong>Content could not be loaded</strong>
              <p>{message()}</p>
              <button type="button" onClick={() => void load()}>
                Try again
              </button>
            </div>
          )}
        </Show>

        <Show
          when={working()}
          fallback={
            <div class={styles.selectPrompt}>
              <strong>Select or create an exercise</strong>
              <p>
                The editor uses the same targets, labels, and canvas renderer as
                Zen practice.
              </p>
            </div>
          }
        >
          {(value) => (
            <>
              <Show when={dirty()}>
                <div class={styles.unsaved} role="status">
                  Unsaved draft changes
                </div>
              </Show>
              <Show when={selectedRow()?.versions}>
                {(versions) => (
                  <div
                    class={styles.versionStrip}
                    aria-label="Exercise version history"
                  >
                    <span>Version history</span>
                    <For each={versions()}>
                      {(version) => (
                        <button
                          type="button"
                          aria-pressed={
                            selectedVersionNumber() === version.version
                          }
                          aria-label={`Open version ${version.version}, ${version.lifecycle}`}
                          classList={{
                            [styles.versionActive]:
                              selectedVersionNumber() === version.version,
                          }}
                          disabled={version.exercise === null}
                          title={
                            version.exercise === null
                              ? `Version ${version.version} is unreadable`
                              : `Open immutable version ${version.version}`
                          }
                          onClick={() => openVersion(selectedRow()!, version)}
                        >
                          <strong>v{version.version}</strong>
                          <small>{version.lifecycle}</small>
                        </button>
                      )}
                    </For>
                  </div>
                )}
              </Show>
              <Show
                when={
                  selectedVersion() !== null &&
                  selectedVersion()?.lifecycle !== 'draft'
                }
              >
                <div class={styles.immutableNotice} role="status">
                  Viewing immutable version {selectedVersion()?.version}. Fields
                  are read-only; use Preview to inspect the exact singer
                  experience.
                </div>
              </Show>
              <ExerciseEditor
                value={value()}
                lifecycle={lifecycle()}
                status={editorStatus()}
                validationIssues={validationIssues()}
                identityLocked={!isNew()}
                onChange={(next) => {
                  setWorking(next)
                  setDirty(true)
                  setServerIssues([])
                }}
                onSave={lifecycle() === 'draft' ? saveFromEditor : undefined}
                onPublish={lifecycle() === 'draft' ? publish : undefined}
                onArchive={lifecycle() === 'archived' ? undefined : archive}
                onDuplicate={
                  lifecycle() === 'published' ? createRevision : undefined
                }
                onExampleAudioFile={uploadExample}
                onRemoveExampleAudio={() => {
                  cancelExamplePreview()
                  setExampleMediaId(null)
                  setDirty(true)
                  return Promise.resolve()
                }}
              />
            </>
          )}
        </Show>
      </main>
    </section>
  )
}

export default AdminExercisesPage

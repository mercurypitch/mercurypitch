// ============================================================
// Piano Night music panel — explicit, device-local source selection
// ============================================================
//
// This lazy-mounted surface is the only place Piano Night asks IndexedDB,
// localStorage, or the MIDI import worker for music. Every row is projected to
// the same stage-first source contract before the performance runtime sees it.

import type { Accessor, JSX } from 'solid-js'
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show, } from 'solid-js'
import { CheckSmall, FileUpload, MusicLibrary, ScoreDocument, Search, } from '@/components/icons'
import type { PianoComposition } from '@/features/piano-project/piano-composition-stage'
import { pianoCompositionToStage } from '@/features/piano-project/piano-composition-stage'
import type { PianoProject } from '@/features/piano-project/piano-project'
import type { PianoNightMusicCatalog, PianoNightMusicCatalogIssue, PianoNightMusicCatalogResult, PianoNightMusicSource as PianoNightMusicDataSource, } from './piano-night-music-source'
import { createPianoNightMusicSource } from './piano-night-music-source'
import type { PianoNightSource } from './piano-night-source'
import { PIANO_NIGHT_INCLUDED_SOURCE, pianoProjectToPianoNightSource, } from './piano-night-source'
import { pianoProjectNeedsTrackAssignment } from './piano-night-track-assignment'
import styles from './PianoNightMusicPanel.module.css'
import type { PianoNightTrackSelection } from './PianoNightTrackAssignment'
import { PianoNightTrackAssignmentEditor } from './PianoNightTrackAssignment'

const INITIAL_VISIBLE_ROWS = 40
const SEARCH_THRESHOLD = 8
const DEFAULT_MUSIC_SOURCE = createPianoNightMusicSource()

interface PianoNightMusicPanelProps {
  panelClass?: string
  currentSourceId: Accessor<string>
  legacyPianoPath: string
  onSelect(source: PianoNightSource): boolean
  onNavigationLockChange?(locked: boolean): void
  /** Injectable in focused tests; production uses the lazy default port. */
  musicSource?: PianoNightMusicDataSource
}

interface MusicRow {
  readonly source: PianoNightSource
  readonly group: 'included' | 'composition' | 'project'
  readonly persistence: 'saved' | 'session-only' | null
}

interface TrackAssignmentTarget {
  readonly project: PianoProject
  readonly origin: 'import' | 'library'
}

function compositionToSource(composition: PianoComposition): PianoNightSource {
  return Object.freeze({
    id: `piano-night:composition:${composition.id}`,
    provenance: 'composition',
    provenanceLabel: 'MercuryPitch composition',
    practiceTrackLabel: 'Composed melody',
    additionalTrackCount: 0,
    keyLabel: 'Key not specified',
    hasAuthoredCoach: false,
    tempoMapChangeCount: 0,
    stage: pianoCompositionToStage(composition),
  })
}

function catalogRows(catalog: PianoNightMusicCatalog | null): MusicRow[] {
  const rows: MusicRow[] = [
    {
      source: PIANO_NIGHT_INCLUDED_SOURCE,
      group: 'included',
      persistence: null,
    },
  ]
  if (catalog === null) return rows

  for (const composition of catalog.compositions) {
    rows.push({
      source: compositionToSource(composition),
      group: 'composition',
      persistence: 'saved',
    })
  }
  for (const entry of catalog.projects) {
    const source = pianoProjectToPianoNightSource(entry.project)
    if (source.id === PIANO_NIGHT_INCLUDED_SOURCE.id) continue
    rows.push({
      source,
      group: 'project',
      persistence: entry.persistence,
    })
  }
  return rows
}

function matchesQuery(row: MusicRow, query: string): boolean {
  if (query === '') return true
  return [
    row.source.stage.title,
    row.source.provenanceLabel,
    row.source.practiceTrackLabel,
  ]
    .join(' ')
    .toLocaleLowerCase()
    .includes(query)
}

function metadataLine(source: PianoNightSource): string {
  const noteLabel = source.stage.notes.length === 1 ? 'note' : 'notes'
  return `${source.stage.notes.length} ${noteLabel} · ${Math.round(source.stage.initialTempoBpm)} BPM`
}

function secondaryMetadata(row: MusicRow): string {
  const details = [row.source.practiceTrackLabel]
  if (row.source.additionalTrackCount > 0) {
    details.push(
      row.source.additionalTrackCount === 1
        ? '1 additional track selected'
        : `${row.source.additionalTrackCount} additional tracks selected`,
    )
  }
  if (row.persistence === 'session-only') {
    details.push('Available this session only')
  }
  return details.join(' · ')
}

function IssueList(props: {
  issues: Accessor<readonly PianoNightMusicCatalogIssue[]>
}): JSX.Element {
  return (
    <Show when={props.issues().length > 0}>
      <div class={styles.issueBox} role="status">
        <strong>Some library items need attention</strong>
        <ul>
          <For each={props.issues().slice(0, 3)}>
            {(issue) => (
              <li>
                {issue.message}
                <Show when={issue.count > 1}> ({issue.count})</Show>
              </li>
            )}
          </For>
        </ul>
      </div>
    </Show>
  )
}

export function PianoNightMusicPanel(
  props: PianoNightMusicPanelProps,
): JSX.Element {
  const [catalogResult, setCatalogResult] =
    createSignal<PianoNightMusicCatalogResult | null>(null)
  const [loading, setLoading] = createSignal(true)
  const [query, setQuery] = createSignal('')
  const [visibleRows, setVisibleRows] = createSignal(INITIAL_VISIBLE_ROWS)
  const [importingName, setImportingName] = createSignal<string | null>(null)
  const [importError, setImportError] = createSignal<string | null>(null)
  const [assignmentTarget, setAssignmentTarget] =
    createSignal<TrackAssignmentTarget | null>(null)
  const [savingSelection, setSavingSelection] = createSignal(false)
  const [selectionError, setSelectionError] = createSignal<string | null>(null)
  let panelElement: HTMLElement | undefined
  let fileInput: HTMLInputElement | undefined
  let disposed = false
  let catalogGeneration = 0
  let importGeneration = 0
  let selectionGeneration = 0
  let importAbort: AbortController | null = null
  let assignmentReturnProjectId: string | null = null

  const catalog = createMemo(() => catalogResult()?.value ?? null)
  const catalogFailure = createMemo(() => {
    const result = catalogResult()
    return result?.ok === false ? result : null
  })
  const rows = createMemo(() => catalogRows(catalog()))
  const userRowCount = createMemo(() => Math.max(0, rows().length - 1))
  const normalizedQuery = createMemo(() => query().trim().toLocaleLowerCase())
  const filteredRows = createMemo(() =>
    rows().filter((row) => matchesQuery(row, normalizedQuery())),
  )
  const displayedRows = createMemo(() => filteredRows().slice(0, visibleRows()))
  const issues = createMemo(() => catalog()?.issues ?? [])

  const loadCatalog = async (): Promise<void> => {
    const generation = ++catalogGeneration
    const source = props.musicSource ?? DEFAULT_MUSIC_SOURCE
    setLoading(true)
    setImportError(null)
    const result = await source.loadCatalog()
    if (disposed || generation !== catalogGeneration) return
    setCatalogResult(result)
    setLoading(false)
  }

  const chooseRow = (row: MusicRow): void => {
    if (row.source.id === props.currentSourceId()) return
    if (!props.onSelect(row.source)) {
      setImportError('This project has no playable score notes.')
    }
  }

  const openTrackAssignment = (
    project: PianoProject,
    origin: TrackAssignmentTarget['origin'],
  ): void => {
    setSelectionError(null)
    assignmentReturnProjectId = origin === 'library' ? project.id : null
    setAssignmentTarget({ project, origin })
  }

  const closeTrackAssignment = (): void => {
    if (savingSelection()) return
    const shouldRefresh = assignmentTarget()?.origin === 'import'
    const returnProjectId = assignmentReturnProjectId
    setAssignmentTarget(null)
    setSelectionError(null)
    assignmentReturnProjectId = null
    if (shouldRefresh) void loadCatalog()
    queueMicrotask(() => {
      const buttons = panelElement?.querySelectorAll<HTMLButtonElement>(
        'button:not(:disabled)',
      )
      const returnTarget =
        returnProjectId === null
          ? undefined
          : Array.from(buttons ?? []).find(
              (button) => button.dataset.trackProjectId === returnProjectId,
            )
      ;(returnTarget ?? buttons?.[0])?.focus()
    })
  }

  const replaceCatalogProject = (project: PianoProject): void => {
    setCatalogResult((current) => {
      if (current === null) return current
      const projects = current.value.projects.map((entry) =>
        entry.project.id === project.id
          ? Object.freeze({ ...entry, project })
          : entry,
      )
      return {
        ...current,
        value: Object.freeze({
          ...current.value,
          projects: Object.freeze(projects),
        }),
      }
    })
  }

  const saveTrackAssignment = async (
    selection: PianoNightTrackSelection,
  ): Promise<void> => {
    const target = assignmentTarget()
    if (target === null || savingSelection()) return
    const generation = ++selectionGeneration
    const source = props.musicSource ?? DEFAULT_MUSIC_SOURCE
    setSavingSelection(true)
    setSelectionError(null)

    const result = await source.updateProjectSelection(
      target.project.id,
      selection.scoreTrackId,
      selection.backingTrackIds,
    )
    if (disposed || generation !== selectionGeneration) return
    setSavingSelection(false)
    if (!result.ok) {
      setSelectionError(result.message)
      return
    }

    setAssignmentTarget({ ...target, project: result.project })
    if (target.origin === 'library') replaceCatalogProject(result.project)
    if (!props.onSelect(pianoProjectToPianoNightSource(result.project))) {
      setSelectionError('The selected Score track has no playable notes.')
    }
  }

  const openImporter = (): void => {
    if (importingName() !== null) return
    fileInput?.click()
  }

  const importFile = async (file: File): Promise<void> => {
    importAbort?.abort()
    const abort = new AbortController()
    importAbort = abort
    const generation = ++importGeneration
    const source = props.musicSource ?? DEFAULT_MUSIC_SOURCE
    setImportingName(file.name)
    setImportError(null)

    const result = await source.importMidi(file, { signal: abort.signal })
    if (disposed || generation !== importGeneration || abort.signal.aborted) {
      return
    }
    importAbort = null
    setImportingName(null)
    if (!result.ok) {
      if (result.code !== 'cancelled') setImportError(result.message)
      return
    }

    if (pianoProjectNeedsTrackAssignment(result.project)) {
      openTrackAssignment(result.project, 'import')
      return
    }

    const selected = props.onSelect(
      pianoProjectToPianoNightSource(result.project),
    )
    if (selected) return
    setImportError('The imported project has no playable score notes.')
    await loadCatalog()
  }

  const onFileChange: JSX.EventHandler<HTMLInputElement, Event> = (event) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (file !== undefined) void importFile(file)
  }

  onMount(() => {
    void loadCatalog()
  })

  createEffect(() => {
    props.onNavigationLockChange?.(savingSelection())
  })

  onCleanup(() => {
    disposed = true
    catalogGeneration += 1
    importGeneration += 1
    selectionGeneration += 1
    importAbort?.abort()
    importAbort = null
    props.onNavigationLockChange?.(false)
  })

  return (
    <section
      ref={panelElement}
      id="piano-night-panel-music"
      class={`${props.panelClass ?? ''} ${styles.panel}`.trim()}
      role="tabpanel"
      aria-labelledby="piano-night-tab-music"
      aria-busy={loading() || importingName() !== null || savingSelection()}
    >
      <Show when={assignmentTarget()} keyed>
        {(target) => (
          <PianoNightTrackAssignmentEditor
            project={target.project}
            saving={savingSelection()}
            error={selectionError()}
            onBack={closeTrackAssignment}
            onSave={(selection) => void saveTrackAssignment(selection)}
          />
        )}
      </Show>

      <Show when={assignmentTarget() === null}>
        <span class={styles.kicker}>Music on this device</span>
        <div class={styles.headingRow}>
          <div>
            <h2>Choose what to play</h2>
            <p>
              Stage a MercuryPitch composition, a saved Piano project, or one
              MIDI file from this device.
            </p>
          </div>
          <button
            class={styles.importButton}
            type="button"
            onClick={openImporter}
            disabled={importingName() !== null}
          >
            <FileUpload />
            <span>
              <strong>
                {importingName() === null ? 'Import MIDI' : 'Importing…'}
              </strong>
              <small>{importingName() ?? 'Saved here before it plays'}</small>
            </span>
          </button>
          <input
            ref={fileInput}
            class={styles.fileInput}
            type="file"
            accept=".mid,.midi,audio/midi,audio/x-midi"
            onChange={onFileChange}
            tabindex="-1"
            aria-hidden="true"
          />
        </div>

        <Show when={importError()}>
          {(message) => (
            <div class={styles.errorBox} role="alert">
              <strong>Music could not be staged</strong>
              <span>{message()}</span>
            </div>
          )}
        </Show>

        <Show when={catalogFailure()}>
          {(failure) => (
            <div class={styles.errorBox} role="alert">
              <strong>Device library unavailable</strong>
              <span>{failure().message}</span>
              <button type="button" onClick={() => void loadCatalog()}>
                Retry
              </button>
            </div>
          )}
        </Show>

        <IssueList issues={issues} />

        <Show
          when={
            catalogResult()?.ok === true && catalogResult()?.status === 'empty'
          }
        >
          <div class={styles.emptyLibrary} role="status">
            <MusicLibrary />
            <span>
              <strong>No saved music on this device yet</strong>
              <small>
                The included study is ready, or import a MIDI to add one.
              </small>
            </span>
          </div>
        </Show>

        <Show when={userRowCount() > SEARCH_THRESHOLD}>
          <label class={styles.searchField}>
            <Search />
            <span class={styles.srOnly}>Search music on this device</span>
            <input
              type="search"
              value={query()}
              placeholder="Search compositions and MIDI"
              onInput={(event) => {
                setQuery(event.currentTarget.value)
                setVisibleRows(INITIAL_VISIBLE_ROWS)
              }}
            />
          </label>
        </Show>

        <div class={styles.libraryHeader}>
          <span>
            {normalizedQuery() === '' ? 'Ready to stage' : 'Search results'}
          </span>
          <small>
            {filteredRows().length}{' '}
            {filteredRows().length === 1 ? 'source' : 'sources'}
          </small>
        </div>

        <Show
          when={!loading()}
          fallback={
            <div class={styles.loadingRows} aria-label="Loading device music">
              <i />
              <i />
              <i />
            </div>
          }
        >
          <Show
            when={displayedRows().length > 0}
            fallback={
              <div class={styles.emptyState}>
                <MusicLibrary />
                <strong>No music matches this search</strong>
                <span>Try a shorter title or clear the search.</span>
              </div>
            }
          >
            <div class={styles.musicList}>
              <For each={displayedRows()}>
                {(row) => {
                  const isCurrent = () =>
                    row.source.id === props.currentSourceId()
                  const canAssignTracks =
                    row.group === 'project' &&
                    row.persistence === 'saved' &&
                    row.source.project !== undefined &&
                    pianoProjectNeedsTrackAssignment(row.source.project)
                  return (
                    <div
                      class={styles.musicRowShell}
                      classList={{
                        [styles.musicRowShellCurrent]: isCurrent(),
                      }}
                    >
                      <button
                        type="button"
                        class={styles.musicRow}
                        classList={{
                          [styles.musicRowCurrent]: isCurrent(),
                          [styles.musicRowWithTracks]: canAssignTracks,
                        }}
                        aria-pressed={isCurrent()}
                        onClick={() => chooseRow(row)}
                      >
                        <span class={styles.rowIcon} aria-hidden="true">
                          <Show when={isCurrent()} fallback={<ScoreDocument />}>
                            <CheckSmall />
                          </Show>
                        </span>
                        <span class={styles.rowCopy}>
                          <span class={styles.rowTopline}>
                            <strong>{row.source.stage.title}</strong>
                            <i>
                              {isCurrent()
                                ? 'On stage'
                                : row.source.provenanceLabel}
                            </i>
                          </span>
                          <small>{metadataLine(row.source)}</small>
                          <small>{secondaryMetadata(row)}</small>
                        </span>
                      </button>
                      <Show when={canAssignTracks && row.source.project}>
                        {(project) => (
                          <button
                            class={styles.trackButton}
                            type="button"
                            data-track-project-id={project().id}
                            aria-label={`Edit track assignment for ${row.source.stage.title}`}
                            onClick={() =>
                              openTrackAssignment(project(), 'library')
                            }
                          >
                            Tracks
                          </button>
                        )}
                      </Show>
                    </div>
                  )
                }}
              </For>
            </div>
          </Show>
        </Show>

        <Show when={filteredRows().length > visibleRows()}>
          <button
            class={styles.showMore}
            type="button"
            onClick={() =>
              setVisibleRows((count) => count + INITIAL_VISIBLE_ROWS)
            }
          >
            Show more music
          </button>
        </Show>

        <div class={styles.libraryFooter}>
          <p>
            Imported projects play one selected Score track with optional
            pitched Hear accompaniment. Drum lanes remain saved but silent for
            now.
          </p>
          <a href={props.legacyPianoPath}>Open the current Piano workspace</a>
        </div>
      </Show>
    </section>
  )
}

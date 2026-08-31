// ============================================================
// Drum Project Library — device-local groove ledger and guarded edits
// ============================================================

import type { JSX } from 'solid-js'
import { createEffect, createMemo, createSignal, createUniqueId, For, Match, on, onMount, Show, Switch, } from 'solid-js'
import { AlertTriangle, CheckSmall, ChevronLeft, Loader2, MusicLibrary, Pencil, Trash2, } from '@/components/icons'
import type { DrumProjectLibraryProps, DrumProjectLibraryRow, } from './drum-persistence-ui'
import { drumProjectOperationLabel as operationLabel, formatPersistenceCount as count, formatPersistenceDate as localDate, } from './drum-persistence-ui'
import styles from './DrumProjectLibrary.module.css'
import { DrumProjectSavePrompt } from './DrumProjectSavePrompt'

export type {
  DrumCurrentProjectView,
  DrumProjectLibraryRow,
  DrumProjectLibraryProps,
  DrumProjectLibraryState,
  DrumProjectLibraryView,
  DrumProjectOperationAction,
  DrumProjectOperationState,
} from './drum-persistence-ui'

export function DrumProjectLibrary(
  props: DrumProjectLibraryProps,
): JSX.Element {
  const headingId = createUniqueId()
  const replacementHeadingId = createUniqueId()
  const deleteHeadingId = createUniqueId()
  const restoreHeadingId = createUniqueId()
  const eraseHeadingId = createUniqueId()
  const [renameTargetId, setRenameTargetId] = createSignal<string | null>(null)
  const [renameName, setRenameName] = createSignal('')
  const [deleteTargetId, setDeleteTargetId] = createSignal<string | null>(null)
  const [replacementTargetId, setReplacementTargetId] = createSignal<
    string | null
  >(null)
  const [replacementName, setReplacementName] = createSignal('')
  const [restoreConfirming, setRestoreConfirming] = createSignal(false)
  const [eraseConfirming, setEraseConfirming] = createSignal(false)
  const [eraseSubmitted, setEraseSubmitted] = createSignal(false)
  let renameInput: HTMLInputElement | undefined
  let replacementInput: HTMLInputElement | undefined
  let retrySaveButton: HTMLButtonElement | undefined
  let restoreTrigger: HTMLButtonElement | undefined
  let restoreConfirmButton: HTMLButtonElement | undefined
  let eraseTrigger: HTMLButtonElement | undefined
  let eraseConfirmButton: HTMLButtonElement | undefined
  let focusedSaveError = false

  const readyLibrary = createMemo(() => {
    const library = props.view.library
    return library.kind === 'ready' ? library : null
  })
  const orderedProjects = createMemo(() =>
    [...(readyLibrary()?.projects ?? [])].sort(
      (left, right) => right.editedAt - left.editedAt,
    ),
  )
  const replacementTarget = createMemo(() => {
    const id = replacementTargetId()
    if (id === null) return null
    return orderedProjects().find((project) => project.id === id) ?? null
  })
  const operationBusy = createMemo(
    () => props.view.operation.kind === 'pending',
  )
  const currentStatus = createMemo(() => {
    const current = props.view.current
    if (!current.persisted) return 'Not saved'
    return current.dirty ? 'Unsaved changes' : 'Saved on this device'
  })

  onMount(() => {
    if (props.view.library.kind === 'idle') props.onLoad()
  })

  createEffect(() => {
    const shouldFocus =
      props.view.operation.kind === 'error' &&
      props.view.operation.action === 'save'
    if (!shouldFocus) {
      focusedSaveError = false
      return
    }
    if (focusedSaveError) return
    focusedSaveError = true
    queueMicrotask(() => retrySaveButton?.focus())
  })

  createEffect(
    on(
      () => props.view.operation,
      (operation) => {
        if (!eraseSubmitted() || operation.kind === 'pending') return
        setEraseSubmitted(false)
        queueMicrotask(() => eraseTrigger?.focus())
      },
    ),
  )

  const closeInlineActions = (): void => {
    setRenameTargetId(null)
    setDeleteTargetId(null)
    setReplacementTargetId(null)
  }

  const beginRename = (project: DrumProjectLibraryRow): void => {
    setDeleteTargetId(null)
    setReplacementTargetId(null)
    setRenameTargetId(project.id)
    setRenameName(project.name)
    queueMicrotask(() => {
      renameInput?.focus()
      renameInput?.select()
    })
  }

  const beginDelete = (projectId: string): void => {
    setRenameTargetId(null)
    setReplacementTargetId(null)
    setDeleteTargetId(projectId)
  }

  const beginOpen = (project: DrumProjectLibraryRow): void => {
    closeInlineActions()
    if (props.view.current.dirty) {
      setReplacementTargetId(project.id)
      setReplacementName(
        props.view.current.name.trim() || props.view.current.suggestedName,
      )
      queueMicrotask(() => replacementInput?.focus())
      return
    }
    props.onOpenProject(project.id)
  }

  const submitRename: JSX.EventHandler<HTMLFormElement, SubmitEvent> = (
    event,
  ) => {
    event.preventDefault()
    const projectId = renameTargetId()
    const name = renameName().trim()
    if (projectId === null || name === '' || operationBusy()) return
    setRenameTargetId(null)
    props.onRenameProject(projectId, name)
  }

  const saveThenOpen = (): void => {
    const target = replacementTarget()
    const name = replacementName().trim()
    if (target === null || name === '' || operationBusy()) return
    setReplacementTargetId(null)
    props.onSaveCurrentThenOpen(target.id, name)
  }

  const discardThenOpen = (): void => {
    const target = replacementTarget()
    if (target === null || operationBusy()) return
    setReplacementTargetId(null)
    props.onDiscardCurrentThenOpen(target.id)
  }

  return (
    <section
      class={styles.library}
      aria-labelledby={headingId}
      aria-busy={operationBusy() ? true : undefined}
      data-testid="drum-project-library"
    >
      <header class={styles.intro}>
        <div>
          <Show when={props.onBack}>
            {(onBack) => (
              <button
                class={styles.backAction}
                type="button"
                onClick={() => onBack()()}
              >
                <ChevronLeft aria-hidden="true" />
                <span>Groove editor</span>
              </button>
            )}
          </Show>
          <span class={styles.kicker}>ON THIS DEVICE</span>
          <h2 id={headingId}>Your grooves</h2>
          <p>Saved pockets open silently and keep their place in the rack.</p>
        </div>
        <div
          class={styles.currentProject}
          data-dirty={props.view.current.dirty}
        >
          <span>ON STAGE</span>
          <strong>{props.view.current.name || 'First Pocket'}</strong>
          <small>{currentStatus()}</small>
        </div>
      </header>

      <div class={styles.operationRail}>
        <Show when={props.view.operation.kind === 'pending'}>
          <p class={styles.operationStatus} role="status" aria-live="polite">
            <span class={styles.spinner} aria-hidden="true">
              <Loader2 />
            </span>
            {operationLabel(
              props.view.operation.kind === 'pending'
                ? props.view.operation.action
                : 'save',
            )}
          </p>
        </Show>
        <Show when={props.view.operation.kind === 'error'}>
          <div class={styles.operationError} role="alert">
            <AlertTriangle aria-hidden="true" />
            <span>
              <strong>The project action did not finish</strong>
              <small>
                {props.view.operation.kind === 'error'
                  ? props.view.operation.message
                  : ''}
              </small>
            </span>
            <Show
              when={
                props.view.operation.kind === 'error' &&
                props.view.operation.action === 'save'
              }
            >
              <button
                ref={retrySaveButton}
                class={styles.primaryAction}
                type="button"
                data-project-save-retry="true"
                onClick={() => props.onRetrySave()}
              >
                Try save again
              </button>
              <Show when={props.view.current.persisted}>
                <button
                  ref={restoreTrigger}
                  class={styles.dangerQuietAction}
                  type="button"
                  onClick={() => {
                    setRestoreConfirming(true)
                    queueMicrotask(() => restoreConfirmButton?.focus())
                  }}
                >
                  Restore last saved
                </button>
              </Show>
            </Show>
          </div>
        </Show>
      </div>

      <div class={styles.scrollRegion}>
        <Show when={restoreConfirming()}>
          <div
            class={styles.recoveryConfirm}
            role="alertdialog"
            aria-modal="false"
            aria-labelledby={restoreHeadingId}
          >
            <div class={styles.formCopy}>
              <span>UNSAVED CHANGES</span>
              <h3 id={restoreHeadingId}>Restore last saved version?</h3>
              <p>
                This replaces the unsaved groove and mix on stage. Your saved
                project remains on this device.
              </p>
            </div>
            <div class={styles.formActions}>
              <button
                ref={restoreConfirmButton}
                class={styles.dangerAction}
                type="button"
                disabled={operationBusy()}
                onClick={() => props.onRevertCurrent()}
              >
                Restore saved version
              </button>
              <button
                class={styles.quietAction}
                type="button"
                disabled={operationBusy()}
                onClick={() => {
                  setRestoreConfirming(false)
                  queueMicrotask(() => restoreTrigger?.focus())
                }}
              >
                Keep unsaved changes
              </button>
            </div>
          </div>
        </Show>

        <DrumProjectSavePrompt
          open={props.view.savePromptOpen}
          current={props.view.current}
          operation={props.view.operation}
          onSave={props.onSaveCurrent}
          onCancel={props.onCancelSavePrompt}
        />

        <Switch>
          <Match
            when={
              props.view.library.kind === 'idle' ||
              props.view.library.kind === 'loading'
            }
          >
            <div class={styles.libraryState} role="status">
              <span class={styles.spinner} aria-hidden="true">
                <Loader2 />
              </span>
              <span>
                <strong>Opening your drum projects</strong>
                <small>Reading saved grooves on this device…</small>
              </span>
            </div>
          </Match>
          <Match when={props.view.library.kind === 'error'}>
            <div class={styles.libraryState} role="alert">
              <AlertTriangle aria-hidden="true" />
              <span>
                <strong>Projects could not be opened</strong>
                <small>
                  {props.view.library.kind === 'error'
                    ? (props.view.library.message ??
                      'First Pocket is still ready on stage.')
                    : ''}
                </small>
              </span>
              <button type="button" onClick={() => props.onRetry()}>
                Try again
              </button>
            </div>
          </Match>
          <Match
            when={
              props.view.library.kind === 'ready' &&
              orderedProjects().length === 0
            }
          >
            <div class={styles.libraryState}>
              <MusicLibrary aria-hidden="true" />
              <span>
                <strong>No saved grooves yet</strong>
                <small>Shape First Pocket, then save it here.</small>
              </span>
            </div>
          </Match>
          <Match when={props.view.library.kind === 'ready'}>
            <div class={styles.ledgerHeading}>
              <span>SAVED PROJECTS</span>
              <small>{count(orderedProjects().length, 'groove')}</small>
            </div>
            <ol class={styles.projectList} aria-label="Saved drum projects">
              <For each={orderedProjects()}>
                {(project) => (
                  <li
                    class={styles.projectShell}
                    data-on-stage={project.onStage}
                  >
                    <article
                      class={styles.projectRow}
                      data-clickable={!project.onStage || undefined}
                      onClick={(event) => {
                        if (project.onStage || operationBusy()) return
                        // The row is one big Open target; inner controls
                        // (rename, delete, the Open button itself) keep
                        // their own behavior.
                        if (
                          event.target instanceof Element &&
                          event.target.closest('button, a, input, form') !==
                            null
                        ) {
                          return
                        }
                        beginOpen(project)
                      }}
                    >
                      <div class={styles.projectIdentity}>
                        <span>{project.variationLabel}</span>
                        <h3>{project.name}</h3>
                        <small>
                          {localDate(
                            project.editedAt,
                            'Edited date unavailable',
                            'Edited ',
                          )}
                        </small>
                      </div>
                      <dl class={styles.projectFacts}>
                        <div>
                          <dt>Length</dt>
                          <dd>{count(project.barCount, 'bar')}</dd>
                        </div>
                        <div>
                          <dt>Pattern</dt>
                          <dd>{count(project.hitCount, 'hit')}</dd>
                        </div>
                        <div>
                          <dt>Tempo</dt>
                          <dd>{Math.round(project.tempoBpm)} BPM</dd>
                        </div>
                      </dl>
                      <div class={styles.rowActions}>
                        <Show
                          when={!project.onStage}
                          fallback={
                            <span class={styles.onStage}>
                              <CheckSmall aria-hidden="true" /> On stage
                            </span>
                          }
                        >
                          <button
                            class={styles.openAction}
                            type="button"
                            disabled={operationBusy()}
                            onClick={() => beginOpen(project)}
                          >
                            Open
                          </button>
                        </Show>
                        <button
                          class={styles.iconAction}
                          type="button"
                          disabled={operationBusy()}
                          aria-label={`Rename ${project.name}`}
                          onClick={() => beginRename(project)}
                        >
                          <Pencil aria-hidden="true" />
                        </button>
                        <button
                          class={styles.iconAction}
                          type="button"
                          disabled={operationBusy()}
                          aria-label={`Delete ${project.name}`}
                          onClick={() => beginDelete(project.id)}
                        >
                          <Trash2 aria-hidden="true" />
                        </button>
                      </div>
                    </article>

                    <Show when={renameTargetId() === project.id}>
                      <form
                        class={styles.inlineEditor}
                        aria-label={`Rename ${project.name}`}
                        onSubmit={submitRename}
                      >
                        <label class={styles.nameField}>
                          <span>New project name</span>
                          <input
                            ref={renameInput}
                            value={renameName()}
                            maxlength={80}
                            autocomplete="off"
                            disabled={operationBusy()}
                            onInput={(event) =>
                              setRenameName(event.currentTarget.value)
                            }
                          />
                        </label>
                        <div class={styles.formActions}>
                          <button
                            class={styles.primaryAction}
                            type="submit"
                            disabled={
                              renameName().trim() === '' || operationBusy()
                            }
                          >
                            Rename project
                          </button>
                          <button
                            class={styles.quietAction}
                            type="button"
                            disabled={operationBusy()}
                            onClick={() => setRenameTargetId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    </Show>

                    <Show when={deleteTargetId() === project.id}>
                      <div
                        class={styles.inlineConfirm}
                        role="alertdialog"
                        aria-modal="false"
                        aria-labelledby={deleteHeadingId}
                      >
                        <div class={styles.formCopy}>
                          <span>DELETE SAVED PROJECT</span>
                          <h3 id={deleteHeadingId}>Delete {project.name}?</h3>
                          <p>
                            {project.onStage
                              ? 'The groove on stage stays open, but it will no longer be saved.'
                              : 'This removes the saved project from this device.'}
                          </p>
                        </div>
                        <div class={styles.formActions}>
                          <button
                            class={styles.dangerAction}
                            type="button"
                            disabled={operationBusy()}
                            onClick={() => {
                              setDeleteTargetId(null)
                              props.onDeleteProject(project.id)
                            }}
                          >
                            Delete project
                          </button>
                          <button
                            class={styles.quietAction}
                            type="button"
                            disabled={operationBusy()}
                            onClick={() => setDeleteTargetId(null)}
                          >
                            Keep project
                          </button>
                        </div>
                      </div>
                    </Show>

                    <Show when={replacementTargetId() === project.id}>
                      <div
                        class={styles.inlineConfirm}
                        role="alertdialog"
                        aria-modal="false"
                        aria-labelledby={replacementHeadingId}
                      >
                        <div class={styles.formCopy}>
                          <span>UNSAVED CHANGES</span>
                          <h3 id={replacementHeadingId}>
                            Open {project.name}?
                          </h3>
                          <p>
                            Save the groove on stage first, or discard its
                            unsaved changes.
                          </p>
                        </div>
                        <Show when={!props.view.current.persisted}>
                          <label class={styles.nameField}>
                            <span>Current project name</span>
                            <input
                              ref={replacementInput}
                              value={replacementName()}
                              maxlength={80}
                              autocomplete="off"
                              disabled={operationBusy()}
                              onInput={(event) =>
                                setReplacementName(event.currentTarget.value)
                              }
                            />
                          </label>
                        </Show>
                        <div class={styles.confirmActions}>
                          <button
                            class={styles.primaryAction}
                            type="button"
                            disabled={
                              replacementName().trim() === '' || operationBusy()
                            }
                            onClick={saveThenOpen}
                          >
                            Save current and open
                          </button>
                          <button
                            class={styles.dangerQuietAction}
                            type="button"
                            disabled={operationBusy()}
                            onClick={discardThenOpen}
                          >
                            Discard and open
                          </button>
                          <button
                            class={styles.quietAction}
                            type="button"
                            disabled={operationBusy()}
                            onClick={() => setReplacementTargetId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </Show>
                  </li>
                )}
              </For>
            </ol>
          </Match>
        </Switch>

        <Show
          when={
            readyLibrary() !== null &&
            ((readyLibrary()?.skippedCount ?? 0) > 0 ||
              (readyLibrary()?.futureCount ?? 0) > 0)
          }
        >
          <div class={styles.catalogNotice} role="status">
            <AlertTriangle aria-hidden="true" />
            <span>
              <Show when={(readyLibrary()?.skippedCount ?? 0) > 0}>
                <small>
                  {count(readyLibrary()?.skippedCount ?? 0, 'saved groove')}{' '}
                  could not be read and{' '}
                  {(readyLibrary()?.skippedCount ?? 0) === 1 ? 'was' : 'were'}{' '}
                  skipped.
                </small>
              </Show>
              <Show when={(readyLibrary()?.futureCount ?? 0) > 0}>
                <small>
                  {count(readyLibrary()?.futureCount ?? 0, 'saved groove')} came
                  from a newer Drum Night and stays untouched.
                </small>
              </Show>
            </span>
          </div>
        </Show>

        <section class={styles.eraseSection}>
          <div>
            <span>LOCAL PRIVACY</span>
            <strong>Drum projects and summary history</strong>
            <small>
              Erasing this library leaves kits, rooms, input mappings, and other
              MercuryPitch data untouched. Replays kept in Hear Yourself are
              managed there.
            </small>
          </div>
          <Show
            when={eraseConfirming()}
            fallback={
              <button
                ref={eraseTrigger}
                class={styles.dangerQuietAction}
                type="button"
                disabled={operationBusy()}
                onClick={() => {
                  setEraseConfirming(true)
                  queueMicrotask(() => eraseConfirmButton?.focus())
                }}
              >
                Erase Drum projects and takes
              </button>
            }
          >
            <div
              class={styles.eraseConfirm}
              role="alertdialog"
              aria-modal="false"
              aria-labelledby={eraseHeadingId}
            >
              <div class={styles.formCopy}>
                <span>THIS DEVICE ONLY</span>
                <h3 id={eraseHeadingId}>
                  Erase Drum projects and summary history?
                </h3>
                <p>
                  Every saved Drum groove and compact take summary will be
                  removed from this device. Hear Yourself replays stay there.
                </p>
              </div>
              <div class={styles.formActions}>
                <button
                  ref={eraseConfirmButton}
                  class={styles.dangerAction}
                  type="button"
                  disabled={operationBusy()}
                  onClick={() => {
                    setEraseConfirming(false)
                    setEraseSubmitted(true)
                    props.onEraseAll()
                  }}
                >
                  Erase Drum data
                </button>
                <button
                  class={styles.quietAction}
                  type="button"
                  disabled={operationBusy()}
                  onClick={() => {
                    setEraseConfirming(false)
                    queueMicrotask(() => eraseTrigger?.focus())
                  }}
                >
                  Keep Drum data
                </button>
              </div>
            </div>
          </Show>
        </section>
      </div>

      <footer class={styles.privacyNote}>
        Projects stay on this device. Audio and device setup are never part of a
        drum project; explicitly kept replays live separately in Hear Yourself.
      </footer>
    </section>
  )
}

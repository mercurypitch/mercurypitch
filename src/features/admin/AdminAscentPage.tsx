import type { Component } from 'solid-js'
import { createEffect, createSignal, For, Match, onCleanup, onMount, Show, Switch, untrack, } from 'solid-js'
import { ASCENT_ID, ASCENT_WEEKS, DAYS_PER_WEEK, } from '@/features/path/path-content'
import type { AdminGuidedExercise, AdminGuidedExerciseVersion, GuidedPathAssignment, GuidedPathAssignmentDraft, } from '@/features/zen/guided-exercise-service'
import { deleteGuidedPathAssignment, listAdminGuidedExercises, listGuidedPathAssignments, saveGuidedPathAssignment, } from '@/features/zen/guided-exercise-service'
import styles from './AdminAscentPage.module.css'

interface AdminAscentPageProps {
  adminKey: string
  onAssignmentsChanged?: () => void
  onDirtyChange?: (dirty: boolean) => void
}

type LoadState = 'loading' | 'ready' | 'error'

interface AssignmentEditor {
  id?: string
  weekNumber: number
  dayNumber: number
  slotNumber: number
  exerciseId: string
  exerciseVersion: number
}

type AssignmentField = Exclude<keyof AssignmentEditor, 'id'>
type AssignmentErrors = Partial<Record<AssignmentField, string>>

const DAY_NUMBERS = Array.from(
  { length: DAYS_PER_WEEK + 1 },
  (_, index) => index,
)
const MAX_SLOT_NUMBER = 99

function orderedAssignments(
  assignments: readonly GuidedPathAssignment[],
): GuidedPathAssignment[] {
  return [...assignments].sort(
    (left, right) =>
      left.weekNumber - right.weekNumber ||
      left.dayNumber - right.dayNumber ||
      left.slotNumber - right.slotNumber,
  )
}

function assignableVersions(
  exercise: AdminGuidedExercise,
): AdminGuidedExerciseVersion[] {
  return exercise.versions
    .filter(
      (version) =>
        version.lifecycle === 'published' || version.lifecycle === 'superseded',
    )
    .sort((left, right) => right.version - left.version)
}

function defaultVersion(exercise: AdminGuidedExercise): number {
  const versions = assignableVersions(exercise)
  const published = versions.find(
    (version) => version.version === exercise.publishedVersion,
  )
  return published?.version ?? versions[0]?.version ?? 0
}

function dayLabel(dayNumber: number): string {
  return dayNumber === 0 ? 'Week library' : `Day ${dayNumber}`
}

export const AdminAscentPage: Component<AdminAscentPageProps> = (props) => {
  const adminKey = untrack(() => props.adminKey)
  const onAssignmentsChanged = untrack(() => props.onAssignmentsChanged)
  const onDirtyChange = untrack(() => props.onDirtyChange)
  const [loadState, setLoadState] = createSignal<LoadState>('loading')
  const [loadError, setLoadError] = createSignal('')
  const [exercises, setExercises] = createSignal<AdminGuidedExercise[]>([])
  const [assignments, setAssignments] = createSignal<GuidedPathAssignment[]>([])
  const [editor, setEditor] = createSignal<AssignmentEditor | null>(null)
  const [fieldErrors, setFieldErrors] = createSignal<AssignmentErrors>({})
  const [actionError, setActionError] = createSignal('')
  const [notice, setNotice] = createSignal('')
  const [mutation, setMutation] = createSignal<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = createSignal<string | null>(
    null,
  )
  let loadRequest = 0

  createEffect(() => {
    onDirtyChange?.(editor() !== null)
  })

  const load = async (): Promise<void> => {
    const request = ++loadRequest
    setLoadState('loading')
    setLoadError('')
    const [exerciseResult, assignmentResult] = await Promise.all([
      listAdminGuidedExercises(adminKey),
      listGuidedPathAssignments(ASCENT_ID, adminKey),
    ])
    if (request !== loadRequest) return
    if (!exerciseResult.ok || !assignmentResult.ok) {
      const messages = [
        exerciseResult.ok ? null : exerciseResult.error,
        assignmentResult.ok ? null : assignmentResult.error,
      ].filter((message): message is string => message !== null)
      setLoadError(
        messages.length === 0
          ? 'Ascent authoring data could not be loaded.'
          : [...new Set(messages)].join(' '),
      )
      setLoadState('error')
      return
    }
    setExercises(exerciseResult.data)
    setAssignments(orderedAssignments(assignmentResult.data))
    setLoadState('ready')
  }

  onMount(() => {
    void load()
  })

  onCleanup(() => {
    ++loadRequest
    onDirtyChange?.(false)
  })

  const assignableExercises = (): AdminGuidedExercise[] =>
    exercises().filter((exercise) => assignableVersions(exercise).length > 0)

  const assignmentsFor = (
    weekNumber: number,
    dayNumber: number,
  ): GuidedPathAssignment[] =>
    assignments().filter(
      (assignment) =>
        assignment.weekNumber === weekNumber &&
        assignment.dayNumber === dayNumber,
    )

  const assignmentCountForWeek = (weekNumber: number): number =>
    assignments().filter((assignment) => assignment.weekNumber === weekNumber)
      .length

  const nextSlot = (weekNumber: number, dayNumber: number): number => {
    const used = assignmentsFor(weekNumber, dayNumber).map(
      (assignment) => assignment.slotNumber,
    )
    return used.length === 0 ? 1 : Math.max(...used) + 1
  }

  const clearFieldError = (field: AssignmentField): void => {
    setFieldErrors((current) => {
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  const updateEditor = <K extends AssignmentField>(
    field: K,
    value: AssignmentEditor[K],
  ): void => {
    setEditor((current) =>
      current === null ? current : { ...current, [field]: value },
    )
    clearFieldError(field)
    setActionError('')
  }

  const openAdd = (weekNumber: number, dayNumber: number): void => {
    const first = assignableExercises()[0]
    setEditor({
      weekNumber,
      dayNumber,
      slotNumber: nextSlot(weekNumber, dayNumber),
      exerciseId: first?.id ?? '',
      exerciseVersion: first === undefined ? 0 : defaultVersion(first),
    })
    setFieldErrors({})
    setActionError('')
    setNotice('')
  }

  const openEdit = (assignment: GuidedPathAssignment): void => {
    setEditor({
      id: assignment.id,
      weekNumber: assignment.weekNumber,
      dayNumber: assignment.dayNumber,
      slotNumber: assignment.slotNumber,
      exerciseId: assignment.exerciseId,
      exerciseVersion: assignment.exerciseVersion,
    })
    setFieldErrors({})
    setActionError('')
    setNotice('')
  }

  const selectExercise = (exerciseId: string): void => {
    const exercise = exercises().find(
      (candidate) => candidate.id === exerciseId,
    )
    setEditor((current) =>
      current === null
        ? current
        : {
            ...current,
            exerciseId,
            exerciseVersion:
              exercise === undefined ? 0 : defaultVersion(exercise),
          },
    )
    clearFieldError('exerciseId')
    clearFieldError('exerciseVersion')
    setActionError('')
  }

  const selectedExercise = (): AdminGuidedExercise | null => {
    const draft = editor()
    if (draft === null) return null
    return (
      exercises().find((exercise) => exercise.id === draft.exerciseId) ?? null
    )
  }

  const selectedVersions = (): AdminGuidedExerciseVersion[] => {
    const exercise = selectedExercise()
    return exercise === null ? [] : assignableVersions(exercise)
  }

  const selectedPublishedVersion = (): number | null =>
    selectedExercise()?.publishedVersion ?? null

  const validateEditor = (draft: AssignmentEditor): AssignmentErrors => {
    const errors: AssignmentErrors = {}
    if (
      !Number.isInteger(draft.weekNumber) ||
      draft.weekNumber < 1 ||
      draft.weekNumber > ASCENT_WEEKS.length
    ) {
      errors.weekNumber = 'Choose a week from 1 to 7.'
    }
    if (
      !Number.isInteger(draft.dayNumber) ||
      draft.dayNumber < 0 ||
      draft.dayNumber > DAYS_PER_WEEK
    ) {
      errors.dayNumber = 'Choose the week library or a day from 1 to 7.'
    }
    if (
      !Number.isInteger(draft.slotNumber) ||
      draft.slotNumber < 1 ||
      draft.slotNumber > MAX_SLOT_NUMBER
    ) {
      errors.slotNumber = `Slot must be between 1 and ${MAX_SLOT_NUMBER}.`
    }

    const exercise = exercises().find(
      (candidate) => candidate.id === draft.exerciseId,
    )
    if (exercise === undefined) {
      errors.exerciseId = 'Choose an exercise.'
    } else {
      const version = assignableVersions(exercise).find(
        (candidate) => candidate.version === draft.exerciseVersion,
      )
      if (version === undefined) {
        errors.exerciseVersion =
          'Choose a published or superseded exercise version.'
      }
    }

    const collision = assignments().find(
      (assignment) =>
        assignment.id !== draft.id &&
        assignment.weekNumber === draft.weekNumber &&
        assignment.dayNumber === draft.dayNumber &&
        assignment.slotNumber === draft.slotNumber,
    )
    if (collision !== undefined) {
      errors.slotNumber = `Slot ${draft.slotNumber} is already occupied in ${dayLabel(draft.dayNumber)}.`
    }
    return errors
  }

  const saveEditor = async (): Promise<void> => {
    const draft = editor()
    if (draft === null) return
    const errors = validateEditor(draft)
    setFieldErrors(errors)
    setActionError('')
    if (Object.keys(errors).length > 0) return

    const payload: GuidedPathAssignmentDraft = {
      ...(draft.id === undefined ? {} : { id: draft.id }),
      weekNumber: draft.weekNumber,
      dayNumber: draft.dayNumber,
      slotNumber: draft.slotNumber,
      exerciseId: draft.exerciseId,
      exerciseVersion: draft.exerciseVersion,
    }
    setMutation('save')
    const result = await saveGuidedPathAssignment(ASCENT_ID, payload, adminKey)
    setMutation(null)
    if (!result.ok) {
      setActionError(result.error)
      return
    }
    setAssignments((current) =>
      orderedAssignments([
        ...current.filter(
          (assignment) =>
            assignment.id !== result.data.id &&
            !(
              assignment.weekNumber === result.data.weekNumber &&
              assignment.dayNumber === result.data.dayNumber &&
              assignment.slotNumber === result.data.slotNumber
            ),
        ),
        result.data,
      ]),
    )
    setEditor(null)
    onAssignmentsChanged?.()
    setNotice(
      `${result.data.exerciseId} v${result.data.exerciseVersion} is pinned to Week ${result.data.weekNumber}, ${dayLabel(result.data.dayNumber)}, slot ${result.data.slotNumber}.`,
    )
  }

  const removeAssignment = async (
    assignment: GuidedPathAssignment,
  ): Promise<void> => {
    const assignmentId = assignment.id
    const wasEditing = editor()?.id === assignmentId
    setMutation(`delete:${assignmentId}`)
    setActionError('')
    const result = await deleteGuidedPathAssignment(assignmentId, adminKey)
    setMutation(null)
    if (!result.ok) {
      setActionError(result.error)
      return
    }
    setAssignments((current) =>
      current.filter((candidate) => candidate.id !== assignmentId),
    )
    setConfirmDeleteId(null)
    if (wasEditing) setEditor(null)
    onAssignmentsChanged?.()
    setNotice(
      `Removed the assignment from Week ${assignment.weekNumber}, ${dayLabel(assignment.dayNumber)}.`,
    )
  }

  const AssignmentCard: Component<{
    assignment: GuidedPathAssignment
  }> = (cardProps) => {
    const exercise = () =>
      exercises().find(
        (candidate) => candidate.id === cardProps.assignment.exerciseId,
      )
    const version = () =>
      exercise()?.versions.find(
        (candidate) =>
          candidate.version === cardProps.assignment.exerciseVersion,
      )
    const title = () =>
      version()?.exercise?.title ??
      exercise()?.versions.find((candidate) => candidate.exercise !== null)
        ?.exercise?.title ??
      cardProps.assignment.exerciseId
    const lifecycle = () => version()?.lifecycle ?? 'missing'
    const newerPublished = () => {
      const published = exercise()?.publishedVersion
      return (
        published !== null &&
        published !== undefined &&
        published > cardProps.assignment.exerciseVersion
      )
    }

    return (
      <article class={styles.assignmentCard}>
        <div class={styles.cardTopline}>
          <span class={styles.slot}>
            Slot {cardProps.assignment.slotNumber}
          </span>
          <span
            class={styles.versionStatus}
            classList={{
              [styles.statusPublished]: lifecycle() === 'published',
              [styles.statusSuperseded]: lifecycle() === 'superseded',
              [styles.statusMissing]: lifecycle() === 'missing',
            }}
          >
            v{cardProps.assignment.exerciseVersion} · {lifecycle()}
          </span>
        </div>
        <strong>{title()}</strong>
        <span class={styles.exerciseId}>{cardProps.assignment.exerciseId}</span>
        <Show when={exercise()?.status === 'archived'}>
          <span class={styles.cardWarning}>Exercise archived</span>
        </Show>
        <Show when={newerPublished()}>
          <span class={styles.updateAvailable}>
            v{exercise()?.publishedVersion} available; this assignment stays
            pinned
          </span>
        </Show>
        <div class={styles.cardActions}>
          <button
            type="button"
            onClick={() => openEdit(cardProps.assignment)}
            disabled={mutation() !== null}
          >
            Edit
          </button>
          <Show
            when={confirmDeleteId() === cardProps.assignment.id}
            fallback={
              <button
                type="button"
                class={styles.removeButton}
                onClick={() => setConfirmDeleteId(cardProps.assignment.id)}
                disabled={mutation() !== null}
              >
                Remove
              </button>
            }
          >
            <button
              type="button"
              class={styles.confirmRemove}
              onClick={() => void removeAssignment(cardProps.assignment)}
              disabled={mutation() !== null}
            >
              {mutation() === `delete:${cardProps.assignment.id}`
                ? 'Removing…'
                : 'Confirm'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDeleteId(null)}
              disabled={mutation() !== null}
            >
              Cancel
            </button>
          </Show>
        </div>
      </article>
    )
  }

  const DayCell: Component<{ weekNumber: number; dayNumber: number }> = (
    cellProps,
  ) => (
    <div
      class={styles.dayCell}
      classList={{ [styles.libraryCell]: cellProps.dayNumber === 0 }}
      role="cell"
      aria-label={`Week ${cellProps.weekNumber}, ${dayLabel(cellProps.dayNumber)}`}
    >
      <For
        each={assignmentsFor(cellProps.weekNumber, cellProps.dayNumber)}
        fallback={<span class={styles.cellEmpty}>No assignments</span>}
      >
        {(assignment) => <AssignmentCard assignment={assignment} />}
      </For>
      <button
        type="button"
        class={styles.addButton}
        onClick={() => openAdd(cellProps.weekNumber, cellProps.dayNumber)}
        disabled={assignableExercises().length === 0 || mutation() !== null}
        title={
          assignableExercises().length === 0
            ? 'Publish an exercise version before adding assignments'
            : `Add to Week ${cellProps.weekNumber}, ${dayLabel(cellProps.dayNumber)}`
        }
      >
        Add assignment
      </button>
    </div>
  )

  const MobileDaySection: Component<{
    weekNumber: number
    dayNumber: number
  }> = (sectionProps) => {
    const dayAssignments = () =>
      assignmentsFor(sectionProps.weekNumber, sectionProps.dayNumber)
    const headingId = () =>
      `ascent-mobile-week-${sectionProps.weekNumber}-day-${sectionProps.dayNumber}`

    return (
      <section
        class={styles.mobileDaySection}
        classList={{
          [styles.mobileLibrarySection]: sectionProps.dayNumber === 0,
        }}
        aria-labelledby={headingId()}
      >
        <div class={styles.mobileDayHeading}>
          <div>
            <h3 id={headingId()}>{dayLabel(sectionProps.dayNumber)}</h3>
            <span>
              {dayAssignments().length}{' '}
              {dayAssignments().length === 1 ? 'assignment' : 'assignments'}
            </span>
          </div>
          <button
            type="button"
            class={styles.addButton}
            onClick={() =>
              openAdd(sectionProps.weekNumber, sectionProps.dayNumber)
            }
            disabled={assignableExercises().length === 0 || mutation() !== null}
            aria-label={`Add assignment to Week ${sectionProps.weekNumber}, ${dayLabel(sectionProps.dayNumber)}`}
            title={
              assignableExercises().length === 0
                ? 'Publish an exercise version before adding assignments'
                : undefined
            }
          >
            Add assignment
          </button>
        </div>

        <Show
          when={dayAssignments().length > 0}
          fallback={
            <p class={styles.mobileCellEmpty}>No exercises pinned here yet.</p>
          }
        >
          <div class={styles.mobileAssignmentList}>
            <For each={dayAssignments()}>
              {(assignment) => <AssignmentCard assignment={assignment} />}
            </For>
          </div>
        </Show>
      </section>
    )
  }

  return (
    <section class={styles.root} aria-busy={loadState() === 'loading'}>
      <Switch>
        <Match when={loadState() === 'loading'}>
          <div class={styles.statePanel} role="status">
            <span class={styles.spinner} aria-hidden="true" />
            <h3>Loading Ascent assignments</h3>
            <p>Fetching the exercise catalogue and all seven weeks.</p>
          </div>
        </Match>

        <Match when={loadState() === 'error'}>
          <div class={styles.statePanel} role="alert">
            <span class={styles.stateLabel}>Could not load Ascent</span>
            <h3>Authoring data is unavailable</h3>
            <p>{loadError()}</p>
            <button type="button" onClick={() => void load()}>
              Try again
            </button>
          </div>
        </Match>

        <Match when={loadState() === 'ready'}>
          <div class={styles.toolbar}>
            <div>
              <strong>{assignments().length} assignments</strong>
              <span>
                {assignableExercises().length} exercises with published history
              </span>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              disabled={mutation() !== null}
            >
              Refresh
            </button>
          </div>

          <Show when={notice() !== ''}>
            <p class={styles.notice} role="status">
              {notice()}
            </p>
          </Show>
          <Show when={actionError() !== '' && editor() === null}>
            <p class={styles.actionError} role="alert">
              {actionError()}
            </p>
          </Show>

          <Show when={assignableExercises().length === 0}>
            <div class={styles.catalogueEmpty} role="status">
              <strong>No assignable exercise versions</strong>
              <p>
                Publish at least one vocal exercise before adding it to The
                Ascent. Existing assignments, if any, remain visible and pinned.
              </p>
            </div>
          </Show>

          <Show when={assignments().length === 0}>
            <div class={styles.assignmentEmpty} role="status">
              No Ascent assignments yet. Use any lane’s Add assignment button to
              build the week library or a day-specific lesson.
            </div>
          </Show>

          <Show when={editor()}>
            {(current) => (
              <form
                class={styles.editor}
                onSubmit={(event) => {
                  event.preventDefault()
                  void saveEditor()
                }}
                aria-labelledby="ascent-assignment-editor-title"
              >
                <div class={styles.editorHeading}>
                  <div>
                    <span>{current().id === undefined ? 'New' : 'Edit'}</span>
                    <h3 id="ascent-assignment-editor-title">
                      Ascent assignment
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditor(null)}
                    disabled={mutation() !== null}
                  >
                    Close
                  </button>
                </div>

                <fieldset
                  class={styles.editorFields}
                  disabled={mutation() !== null}
                >
                  <label>
                    Week
                    <select
                      value={String(current().weekNumber)}
                      onChange={(event) =>
                        updateEditor(
                          'weekNumber',
                          Number(event.currentTarget.value),
                        )
                      }
                      aria-invalid={fieldErrors().weekNumber !== undefined}
                    >
                      <For each={ASCENT_WEEKS}>
                        {(week) => (
                          <option value={week.order}>
                            Week {week.order} · {week.title}
                          </option>
                        )}
                      </For>
                    </select>
                    <Show when={fieldErrors().weekNumber}>
                      {(message) => (
                        <small class={styles.fieldError}>{message()}</small>
                      )}
                    </Show>
                  </label>

                  <label>
                    Placement
                    <select
                      value={String(current().dayNumber)}
                      onChange={(event) =>
                        updateEditor(
                          'dayNumber',
                          Number(event.currentTarget.value),
                        )
                      }
                      aria-invalid={fieldErrors().dayNumber !== undefined}
                    >
                      <For each={DAY_NUMBERS}>
                        {(dayNumber) => (
                          <option value={dayNumber}>
                            {dayLabel(dayNumber)}
                          </option>
                        )}
                      </For>
                    </select>
                    <Show when={fieldErrors().dayNumber}>
                      {(message) => (
                        <small class={styles.fieldError}>{message()}</small>
                      )}
                    </Show>
                  </label>

                  <label>
                    Slot
                    <input
                      type="number"
                      min="1"
                      max={MAX_SLOT_NUMBER}
                      step="1"
                      value={current().slotNumber}
                      onInput={(event) =>
                        updateEditor(
                          'slotNumber',
                          Number(event.currentTarget.value),
                        )
                      }
                      aria-invalid={fieldErrors().slotNumber !== undefined}
                    />
                    <Show when={fieldErrors().slotNumber}>
                      {(message) => (
                        <small class={styles.fieldError}>{message()}</small>
                      )}
                    </Show>
                  </label>

                  <label class={styles.exerciseField}>
                    Exercise
                    <select
                      value={current().exerciseId}
                      onChange={(event) =>
                        selectExercise(event.currentTarget.value)
                      }
                      aria-invalid={fieldErrors().exerciseId !== undefined}
                    >
                      <option value="">Select an exercise</option>
                      <For each={assignableExercises()}>
                        {(exercise) => {
                          const title =
                            exercise.versions.find(
                              (version) =>
                                version.version === exercise.publishedVersion,
                            )?.exercise?.title ??
                            exercise.versions.find(
                              (version) => version.exercise !== null,
                            )?.exercise?.title ??
                            exercise.id
                          return (
                            <option value={exercise.id}>
                              {title}
                              {exercise.status === 'archived'
                                ? ' · archived'
                                : ''}
                            </option>
                          )
                        }}
                      </For>
                    </select>
                    <Show when={fieldErrors().exerciseId}>
                      {(message) => (
                        <small class={styles.fieldError}>{message()}</small>
                      )}
                    </Show>
                  </label>

                  <label>
                    Pinned version
                    <select
                      value={String(current().exerciseVersion)}
                      onChange={(event) =>
                        updateEditor(
                          'exerciseVersion',
                          Number(event.currentTarget.value),
                        )
                      }
                      aria-invalid={fieldErrors().exerciseVersion !== undefined}
                    >
                      <For each={selectedVersions()}>
                        {(version) => (
                          <option value={version.version}>
                            v{version.version} · {version.lifecycle}
                          </option>
                        )}
                      </For>
                    </select>
                    <Show when={fieldErrors().exerciseVersion}>
                      {(message) => (
                        <small class={styles.fieldError}>{message()}</small>
                      )}
                    </Show>
                  </label>
                </fieldset>

                <Show
                  when={
                    selectedPublishedVersion() !== null &&
                    selectedPublishedVersion() !== current().exerciseVersion
                  }
                >
                  <p class={styles.pinNotice}>
                    Current assignment: v{current().exerciseVersion}. Latest
                    published: v{selectedPublishedVersion()}. It will not change
                    unless you explicitly select another version.
                  </p>
                </Show>

                <Show when={actionError() !== ''}>
                  <p class={styles.actionError} role="alert">
                    {actionError()}
                  </p>
                </Show>

                <div class={styles.editorActions}>
                  <button
                    type="submit"
                    class={styles.saveButton}
                    disabled={mutation() !== null}
                  >
                    {mutation() === 'save'
                      ? 'Saving…'
                      : current().id === undefined
                        ? 'Add assignment'
                        : 'Save assignment'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditor(null)}
                    disabled={mutation() !== null}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </Show>

          <div
            class={styles.laneScroller}
            role="table"
            aria-label="The Ascent exercise assignments"
          >
            <div class={styles.lanes}>
              <div class={styles.gridHeader} role="row">
                <div class={styles.weekColumnHeader} role="columnheader">
                  Week
                </div>
                <For each={DAY_NUMBERS}>
                  {(dayNumber) => (
                    <div role="columnheader">
                      {dayNumber === 0 ? 'Week library' : `Day ${dayNumber}`}
                    </div>
                  )}
                </For>
              </div>

              <For each={ASCENT_WEEKS}>
                {(week) => (
                  <div class={styles.weekLane} role="row">
                    <div class={styles.weekSummary} role="rowheader">
                      <span>Week {week.order}</span>
                      <strong>{week.title}</strong>
                      <small>{week.subtitle}</small>
                    </div>
                    <For each={DAY_NUMBERS}>
                      {(dayNumber) => (
                        <DayCell
                          weekNumber={week.order}
                          dayNumber={dayNumber}
                        />
                      )}
                    </For>
                  </div>
                )}
              </For>
            </div>
          </div>

          <section
            class={styles.mobileWeeks}
            aria-label="The Ascent exercise assignments by week"
          >
            <For each={ASCENT_WEEKS}>
              {(week) => (
                <details class={styles.mobileWeek} open={week.order === 1}>
                  <summary class={styles.mobileWeekSummary}>
                    <span class={styles.mobileWeekIdentity}>
                      <span>Week {week.order}</span>
                      <strong>{week.title}</strong>
                      <small>{week.subtitle}</small>
                    </span>
                    <span class={styles.mobileWeekCount}>
                      {assignmentCountForWeek(week.order)}{' '}
                      {assignmentCountForWeek(week.order) === 1
                        ? 'assignment'
                        : 'assignments'}
                    </span>
                  </summary>
                  <div class={styles.mobileWeekDays}>
                    <For each={DAY_NUMBERS}>
                      {(dayNumber) => (
                        <MobileDaySection
                          weekNumber={week.order}
                          dayNumber={dayNumber}
                        />
                      )}
                    </For>
                  </div>
                </details>
              )}
            </For>
          </section>
        </Match>
      </Switch>
    </section>
  )
}

export default AdminAscentPage

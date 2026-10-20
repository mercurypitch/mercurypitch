// ============================================================
// LessonControls — publish, unpublish and the wording pickers, per lesson
// ============================================================
//
// The Lessons page's controls, in two sizes: a table cell with the lesson's
// state on this site and its one switch, and a card's panels with the why,
// "Use default", the history and the hook and tease pickers. Both read the
// same `LessonActions`, so a save from either shows in both.
//
// Focus stays where the hand is. Publish and Unpublish are one button that
// changes its words, a picker's choices stay mounted as the chosen one
// moves, and a "Use default" that disappears once it has done its work hands
// the focus to the switch beside it. A control busy saving is
// aria-disabled, not disabled, so it keeps the focus too. Each button names
// its lesson in words a screen reader hears ("Publish Lesson 3").

import type { JSX } from 'solid-js'
import { createUniqueId, For, Match, Show, Switch } from 'solid-js'
import { Eye, EyeOff, RotateCcw } from '@/components/icons'
import type { LessonStateField } from '@/lib/lesson-state'
import type { CopyChoice, LessonCopyChoices } from './copy-choices'
import { chosenId, savedValue, unknownSaved } from './copy-choices'
import type { LessonRow } from './lesson-admin'
import { lessonName } from './lesson-admin'
import type { PublishView } from './lesson-publish'
import { asSentence, changeLine, defaultSentence, reasonLine, stateWord, } from './lesson-publish'
import styles from './LessonControls.module.css'
import type { Tone } from './LessonStatus'
import { Status } from './LessonStatus'
import type { LessonStateController, LogRead, SaveOutcome, } from './useLessonState'

export type CopyField = Exclude<LessonStateField, 'published'>

/** What the controls can do, as the page provides it. */
export interface LessonActions {
  readonly lessons: LessonStateController
  /** Lesson `row`'s state on this site; null while the lesson state is unread. */
  readonly viewOf: (row: LessonRow) => PublishView | null
  /** Publish it (asking first for a draft that waits on a sign-off), or unpublish it. */
  readonly toggle: (row: LessonRow) => void
  /** Clear its publish override; true once stored. */
  readonly useDefault: (row: LessonRow) => Promise<boolean>
  /** Save a wording: a variant id, or null for the default. */
  readonly saveCopy: (
    row: LessonRow,
    field: CopyField,
    value: string | null,
  ) => void
  /** Lock the studio to ask for the key again; absent outside the studio. */
  readonly onChangeKey?: () => void
}

/** How many changes the history keeps open to read, the latest included. */
const HISTORY_SHOWN = 6

function publishTone(view: PublishView): Tone {
  if (view.reason === 'film' || view.reason === 'no-page') return 'none'
  return view.published ? 'done' : 'todo'
}

const outcomeText = (outcome: SaveOutcome): string =>
  outcome.kind === 'saving' ? 'Saving…' : outcome.message

const keyRefused = (outcome: SaveOutcome): boolean =>
  outcome.kind === 'failed' && outcome.error.kind === 'forbidden'

/** What a save said, under the control that made it; the page's live region speaks it. */
function Outcome(props: {
  outcome: SaveOutcome | undefined
  onChangeKey?: () => void
}): JSX.Element {
  return (
    <Show when={props.outcome}>
      {(outcome) => (
        <p class={styles.outcome} data-kind={outcome().kind}>
          {outcomeText(outcome())}
          <Show when={keyRefused(outcome()) && props.onChangeKey !== undefined}>
            <button
              type="button"
              class={styles.action}
              data-variant="quiet"
              onClick={() => props.onChangeKey?.()}
            >
              Change admin key
            </button>
          </Show>
        </p>
      )}
    </Show>
  )
}

/** Where the lesson state stands while there is no view to draw. */
function Unread(props: { lessons: LessonStateController }): JSX.Element {
  return (
    <Status tone={props.lessons.stateError() === null ? 'checking' : 'unknown'}>
      {props.lessons.stateError() === null ? 'Reading…' : 'Could not read'}
    </Status>
  )
}

/**
 * Publish or Unpublish, and "Use default" while the state is set here. One
 * switch button, whose words follow the state, so it keeps the focus.
 */
function PublishControls(props: {
  row: LessonRow
  view: PublishView
  actions: LessonActions
  /** The table's size: the switch alone. */
  compact?: boolean
  /** The sentence that says what the default is, for "Use default". */
  defaultId?: string
}): JSX.Element {
  const name = (): string => lessonName(props.row.lesson)
  const busy = (): boolean =>
    props.actions.lessons.saving(props.row.lesson.n, 'published')
  let toggle: HTMLButtonElement | undefined

  const useDefault = (): void => {
    if (busy()) return
    void props.actions.useDefault(props.row).then((saved) => {
      // The button that was pressed is gone; the switch takes the focus.
      const lost =
        document.activeElement === null ||
        document.activeElement === document.body
      if (saved && lost) toggle?.focus({ preventScroll: true })
    })
  }

  return (
    <div class={styles.controls}>
      <div class={styles.buttons}>
        <Show
          when={props.view.canPublish}
          fallback={
            <button type="button" class={styles.action} disabled>
              <span class={styles.srOnly}>Publish {name()}: </span>
              No page yet
            </button>
          }
        >
          <button
            ref={toggle}
            type="button"
            class={styles.action}
            data-variant={props.view.published ? 'quiet' : 'primary'}
            aria-disabled={busy() ? 'true' : undefined}
            onClick={() => {
              if (!busy()) props.actions.toggle(props.row)
            }}
          >
            <Show when={props.view.published} fallback={<Eye />}>
              <EyeOff />
            </Show>
            {props.view.published ? 'Unpublish' : 'Publish'}
            <span class={styles.srOnly}> {name()}</span>
          </button>
        </Show>
        <Show when={props.compact !== true && props.view.overridden}>
          <button
            type="button"
            class={styles.action}
            data-variant="quiet"
            aria-disabled={busy() ? 'true' : undefined}
            aria-describedby={props.defaultId}
            onClick={useDefault}
          >
            <RotateCcw size={14} />
            Use default<span class={styles.srOnly}> for {name()}</span>
          </button>
        </Show>
      </div>
      <Outcome
        outcome={props.actions.lessons.outcome(props.row.lesson.n, 'published')}
        onChangeKey={props.actions.onChangeKey}
      />
    </div>
  )
}

/**
 * The table's "Published here" cell: the state, why, and the switch beside
 * them. A lesson with no page yet has only its disabled control, which
 * says as much; the trailer, a film, has no control at all.
 */
export function PublishCell(props: {
  row: LessonRow
  actions: LessonActions
}): JSX.Element {
  return (
    <Show
      when={props.actions.viewOf(props.row)}
      fallback={<Unread lessons={props.actions.lessons} />}
    >
      {(view) => (
        <Show
          when={view().reason !== 'no-page'}
          fallback={
            <div class={styles.cellOnly}>
              <PublishControls
                row={props.row}
                view={view()}
                actions={props.actions}
                compact
              />
            </div>
          }
        >
          <div class={styles.cell}>
            <Status tone={publishTone(view())}>{stateWord(view())}</Status>
            <span class={styles.sub}>{reasonLine(view())}</span>
            <Show when={view().reason !== 'film'}>
              <PublishControls
                row={props.row}
                view={view()}
                actions={props.actions}
                compact
              />
            </Show>
          </div>
        </Show>
      )}
    </Show>
  )
}

/** Lesson `row`'s history: its latest change, and the few before it on request. */
function LessonHistory(props: {
  name: string
  log: LogRead | undefined
}): JSX.Element {
  const changes = () => (props.log?.kind === 'read' ? props.log.changes : [])
  const earlier = () => changes().slice(1, HISTORY_SHOWN)
  return (
    <div class={styles.history}>
      <span class={styles.label}>Latest change</span>
      <Switch>
        <Match when={props.log === undefined || props.log.kind === 'reading'}>
          <p class={styles.muted}>Reading its history…</p>
        </Match>
        <Match when={props.log?.kind === 'failed' && props.log}>
          {(failed) => (
            <p class={styles.muted}>
              {failed().error.kind === 'forbidden'
                ? 'Its history could not be read: the admin key was not accepted.'
                : `Its history could not be read. ${asSentence(failed().error.message)}`}
            </p>
          )}
        </Match>
        <Match when={changes()[0]}>
          {(latest) => (
            <>
              <p class={styles.latest}>{changeLine(latest())}</p>
              <Show when={earlier().length > 0}>
                <details class={styles.earlier}>
                  <summary>
                    {/* One run of text, so the summary's flex box keeps its spaces. */}
                    <span>
                      Earlier changes
                      <span class={styles.srOnly}> to {props.name}</span> (
                      {earlier().length})
                    </span>
                  </summary>
                  <ol>
                    <For each={earlier()}>
                      {(change) => <li>{changeLine(change)}</li>}
                    </For>
                  </ol>
                </details>
              </Show>
            </>
          )}
        </Match>
        <Match when={changes().length === 0}>
          <p class={styles.muted}>
            No change made here yet: the code decides all of it.
          </p>
        </Match>
      </Switch>
    </div>
  )
}

/** The card's "On this site" panel: the state and why, the controls and the history. */
export function PublishPanel(props: {
  row: LessonRow
  actions: LessonActions
}): JSX.Element {
  const heading = createUniqueId()
  const defaultId = createUniqueId()
  const name = (): string => lessonName(props.row.lesson)
  return (
    <section class={styles.panel} aria-labelledby={heading}>
      <h4 id={heading} class={styles.panelTitle}>
        On this site
      </h4>
      <Show
        when={props.actions.viewOf(props.row)}
        fallback={<Unread lessons={props.actions.lessons} />}
      >
        {(view) => (
          <>
            <p class={styles.stateLine}>
              <Status tone={publishTone(view())}>{stateWord(view())}</Status>
              <span class={styles.muted}>{reasonLine(view())}</span>
            </p>
            <p id={defaultId} class={styles.why}>
              {defaultSentence(props.row)}
              <Show when={props.row.waitingOn}>
                {(waitingOn) => <> It waits on {waitingOn()}.</>}
              </Show>
            </p>
            <Show when={view().reason !== 'film'}>
              <PublishControls
                row={props.row}
                view={view()}
                actions={props.actions}
                defaultId={defaultId}
              />
            </Show>
          </>
        )}
      </Show>
      <LessonHistory
        name={name()}
        log={props.actions.lessons.logOf(props.row.lesson.n)}
      />
    </section>
  )
}

/** One picker: the wordings a lesson's code holds for a field, the chosen one pressed. */
export function CopyPicker(props: {
  row: LessonRow
  field: CopyField
  legend: string
  about: string
  choices: readonly CopyChoice[]
  actions: LessonActions
}): JSX.Element {
  const id = createUniqueId()
  const n = (): number => props.row.lesson.n
  const saved = (): string | null | undefined =>
    props.actions.lessons.overrideOf(n())[props.field]
  const busy = (): boolean => props.actions.lessons.saving(n(), props.field)
  const chosen = (): string | null => chosenId(props.choices, saved())
  const unknown = (): string | null => unknownSaved(props.choices, saved())
  const choose = (choice: CopyChoice): void => {
    const value = savedValue(choice)
    if (busy() || value === (saved() ?? null)) return
    props.actions.saveCopy(props.row, props.field, value)
  }
  // A saved id with no default in the list to go back to: the lesson has
  // no such wording at all, so clearing it is the one thing to do.
  const clear = (): void => {
    if (!busy()) props.actions.saveCopy(props.row, props.field, null)
  }

  return (
    <Show
      when={props.choices.length > 1 || unknown() !== null}
      fallback={
        <div class={styles.picker}>
          <span class={styles.label}>{props.legend}</span>
          <p class={styles.about}>{props.about}</p>
          <p class={styles.only}>{props.choices[0]?.text}</p>
          <p class={styles.muted}>The only wording its code holds.</p>
          {/* A save that cleared a wording this build lacks lands here. */}
          <Outcome
            outcome={props.actions.lessons.outcome(n(), props.field)}
            onChangeKey={props.actions.onChangeKey}
          />
        </div>
      }
    >
      <fieldset
        class={styles.picker}
        aria-describedby={`${id}-about`}
        aria-busy={busy() ? 'true' : undefined}
      >
        <legend class={styles.label}>{props.legend}</legend>
        <p id={`${id}-about`} class={styles.about}>
          {props.about}
        </p>
        <Show when={unknown()}>
          {(stored) => (
            <p class={styles.warning}>
              Saved here as “{stored()}”, a wording this build does not hold, so
              the pages show the default.
            </p>
          )}
        </Show>
        <Show
          when={unknown() !== null && !props.choices.some((c) => c.isDefault)}
        >
          <div class={styles.buttons}>
            <button
              type="button"
              class={styles.action}
              data-variant="quiet"
              aria-disabled={busy() ? 'true' : undefined}
              onClick={clear}
            >
              <RotateCcw size={14} />
              Clear it
              <span class={styles.srOnly}>
                {' '}
                from {lessonName(props.row.lesson)}'s {props.field}
              </span>
            </button>
          </div>
        </Show>
        <ul class={styles.choices}>
          <For each={props.choices}>
            {(choice, i) => (
              <li>
                <button
                  type="button"
                  class={styles.choice}
                  aria-pressed={chosen() === choice.id}
                  aria-disabled={busy() ? 'true' : undefined}
                  aria-describedby={
                    choice.note === '' ? undefined : `${id}-note-${i()}`
                  }
                  onClick={() => choose(choice)}
                >
                  <span class={styles.srOnly}>
                    {lessonName(props.row.lesson)} {props.field}:{' '}
                  </span>
                  <span class={styles.choiceText}>{choice.text}</span>
                  <span class={styles.tags}>
                    <Show when={choice.isDefault}>
                      <span class={styles.tag}>Default</span>
                    </Show>
                    <Show when={chosen() === choice.id}>
                      <span
                        class={styles.tag}
                        data-tone="chosen"
                        aria-hidden="true"
                      >
                        Chosen
                      </span>
                    </Show>
                  </span>
                </button>
                <Show when={choice.note !== ''}>
                  <p id={`${id}-note-${i()}`} class={styles.note}>
                    {choice.note}
                  </p>
                </Show>
              </li>
            )}
          </For>
        </ul>
        <Outcome
          outcome={props.actions.lessons.outcome(n(), props.field)}
          onChangeKey={props.actions.onChangeKey}
        />
      </fieldset>
    </Show>
  )
}

/** "Lesson 3", or "the trailer" inside a sentence. */
function inSentence(name: string): string {
  return name === 'Trailer' ? 'the trailer' : name
}

function teaseAbout(n: number, name: string): string {
  return n <= 1
    ? `The line above ${name}'s hook on the next-lesson card of the lesson before it. The trailer, before it, has no page to show it.`
    : `The line above ${name}'s hook on Lesson ${n - 1}'s next-lesson card.`
}

/** The card's "Wording" panel: the hook picker, and the tease picker where the lesson has a tease. */
export function WordingPanel(props: {
  row: LessonRow
  actions: LessonActions
  choices: LessonCopyChoices
}): JSX.Element {
  const heading = createUniqueId()
  const name = (): string => lessonName(props.row.lesson)
  const hasTease = (): boolean =>
    props.choices.teases.length > 0 ||
    props.actions.lessons.overrideOf(props.row.lesson.n).tease != null
  return (
    <section class={styles.panel} aria-labelledby={heading}>
      <h4 id={heading} class={styles.panelTitle}>
        Wording
      </h4>
      <Show
        when={props.actions.lessons.state() !== null}
        fallback={<Unread lessons={props.actions.lessons} />}
      >
        <CopyPicker
          row={props.row}
          field="hook"
          legend="Hook"
          about={`The question ${inSentence(name())} opens with.`}
          choices={props.choices.hooks}
          actions={props.actions}
        />
        <Show
          when={hasTease()}
          fallback={
            <p class={styles.muted}>
              No tease: its code holds none for {inSentence(name())}.
            </p>
          }
        >
          <CopyPicker
            row={props.row}
            field="tease"
            legend="Tease"
            about={teaseAbout(props.row.lesson.n, name())}
            choices={props.choices.teases}
            actions={props.actions}
          />
        </Show>
      </Show>
    </section>
  )
}

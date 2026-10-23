// ============================================================
// PlanQuestions — the four question screens
// ============================================================
//
// What Merc asks after First Light: the instrument (Q1), what the person is
// working toward (Q2), what gets in the way (Q3) and what they have tried
// (Q4). One question to a screen, and every one can be passed. The words are
// the approved mockup's (your-plan-in-four-taps.html, 19 Oct); the options
// and Merc's replies come from questions.ts and are never retyped here.
//
// Four things are easy to break:
//
// - The wait after a single pick (Q1, Q2) is one timer. Each pick restarts
//   it, and anything that moves the screen (the quiet Skip or Next, Back,
//   Not now) or takes it away clears it, or the screen would move on twice.
// - What is handed back is cut to what is picked. A line typed under
//   "Something else" or "Another app" stays in the field while its option is
//   tapped off, so it is there if the option comes back, but onDone hands
//   back an empty line for an option that is not picked. The store blanks an
//   unpicked line too (pickedLines in plan-record.ts); this filter is the
//   second guard.
// - The choices are one value that is replaced, never written into. Every
//   change goes through pruneChoices, and `initial` is only read: it may be
//   the frozen EMPTY_CHOICES, or the host's own store.
// - Merc is the host's. The screens never mount one: they report poses
//   through onMercState, and the host's one MercPresence draws him above
//   them. `drop` as they open, `listen` on Q3, `hop` on each pick, `idle`
//   otherwise.
//
// What the host sees: a tap on Q1 or Q2 moves on PICK_ADVANCE_MS later, or at
// once on the quiet control under the answers, which reads Skip while nothing
// stands and Next while an answer does, and keeps that answer either way. Q3
// and Q4 have one button that says what it does (Next or Show my plan with
// something picked, Skip this one or Skip to my plan with nothing) and passes
// the question either way. Back goes one question back with its answer still
// picked; Not now says which question it came on. The hairline is the host's
// (First Light's); the screens add the eyebrow. Back and Not now are
// PlanExits', and what the host owes the screens (the box, and where Merc
// sits) is written in full in that file's header. The root fills that box and
// scrolls its own content, and each question opens at the top of it.

import type { Component, JSX } from 'solid-js'
import { createMemo, createSignal, createUniqueId, For, Match, onCleanup, onMount, Show, Switch, untrack, } from 'solid-js'
import { Dynamic } from 'solid-js/web'
import { CheckSmall, ChevronLeft, Ear, Guitar, Mic, PianoKeys, } from '@/components/icons'
import type { MercState } from '@/lib/merc/constants'
import type { PlanTexts } from './plan-record'
import { Q3_OTHER_MAX, Q4_APP_MAX } from './plan-record'
import { PlanExits } from './PlanExits'
import styles from './PlanQuestions.module.css'
import type { Instrument, PlanChoices, PlanOption, Q1Answer, Q2Id, Q3Id, Q4Id, QuestionId, } from './questions'
import { EMPTY_CHOICES, EVERYTHING, INSTRUMENTS, MERC_INTRO, pruneChoices, q2Options, Q3_MAX, q3Options, q4Options, } from './questions'

/** How long a single pick stays on screen before the next question opens. */
export const PICK_ADVANCE_MS = 1000

/** Merc drops in as the screens open, and has settled by now. */
const DROP_MS = 1300

/** How long a hop lasts before he is back to resting. */
const HOP_MS = 900

/** A hop on a question that takes several answers is shorter, so the next tap can hop. */
const QUICK_HOP_MS = 700

const REST_POSE: Record<QuestionId, MercState> = {
  q1: 'idle',
  q2: 'idle',
  q3: 'listen',
  q4: 'idle',
}

const NEXT_QUESTION: Partial<Record<QuestionId, QuestionId>> = {
  q1: 'q2',
  q2: 'q3',
  q3: 'q4',
}

const PREVIOUS_QUESTION: Partial<Record<QuestionId, QuestionId>> = {
  q2: 'q1',
  q3: 'q2',
  q4: 'q3',
}

/** The icon on each Q1 card. */
const GLYPH: Record<Instrument, Component> = {
  singing: Mic,
  guitar: Guitar,
  piano: PianoKeys,
  ear: Ear,
}

type TypedField = 'q3other' | 'q4app'

export interface PlanQuestionsProps {
  /** Seen the app before the plan existed: Merc greets them with a line of their own. */
  returning: boolean
  /** Answers to open on, picked already: the review of an answered plan. Only read. */
  initial?: PlanChoices
  /** The lines typed under "Something else" and "Another app" last time. */
  initialTexts?: PlanTexts
  /** Merc's pose, as the screens ask for it. The host's one MercPresence draws him. */
  onMercState: (s: MercState) => void
  /**
   * Next on the last question. `pills` maps the label of each Q4 pick to where
   * it sits on screen, which the plan flies its chips from. A typed line is
   * empty unless its option is picked.
   */
  onDone: (
    c: PlanChoices,
    t: PlanTexts,
    pills: ReadonlyMap<string, DOMRect>,
  ) => void
  /** Not now: the question it came on, and the answers so far. */
  onDecline: (on: QuestionId, c: PlanChoices) => void
}

// ── What Merc says ──────────────────────────────────────────────────────

/** The option whose line Merc says for a screen: the first Q3 pick, the last Q4 pick. */
function speakingOption(
  on: QuestionId,
  c: PlanChoices,
): { line: string } | undefined {
  switch (on) {
    case 'q1':
      return c.q1 === EVERYTHING.id
        ? EVERYTHING
        : INSTRUMENTS.find((i) => i.id === c.q1)
    case 'q2':
      return q2Options(c.q1).find((o) => o.id === c.q2)
    case 'q3':
      return q3Options(c.q1).find((o) => o.id === c.q3[0])
    case 'q4':
      return q4Options(c.q1).find((o) => o.id === c.q4[c.q4.length - 1])
  }
}

/**
 * What a screen says when it opens: its own opening line, or the reply to the
 * answer it already has (going back, or reviewing).
 */
function restingLine(
  on: QuestionId,
  c: PlanChoices,
  returning: boolean,
): string {
  const spoken = speakingOption(on, c)
  if (spoken !== undefined) return spoken.line
  if (on === 'q1' && returning) return MERC_INTRO.q1Returning
  return MERC_INTRO[on]
}

// ── What is handed back ─────────────────────────────────────────────────

function seededTexts(t: PlanTexts | undefined): PlanTexts {
  return {
    q3other: (t?.q3other ?? '').slice(0, Q3_OTHER_MAX),
    q4app: (t?.q4app ?? '').slice(0, Q4_APP_MAX),
  }
}

/** The typed lines, each only if its option is picked. */
function pickedTexts(c: PlanChoices, t: PlanTexts): PlanTexts {
  return {
    q3other: c.q3.includes('other') ? t.q3other : '',
    q4app: c.q4.includes('app') ? t.q4app : '',
  }
}

/** A copy for the host to keep: what it is handed is never one of ours to write into. */
function copyOf(c: PlanChoices): PlanChoices {
  return { ...c, q3: [...c.q3], q4: [...c.q4] }
}

/** Where each picked Q4 answer sits on screen, by its label, in the order tapped. */
function pillRects(
  root: HTMLElement | undefined,
  c: PlanChoices,
): ReadonlyMap<string, DOMRect> {
  const rects = new Map<string, DOMRect>()
  if (root === undefined) return rects
  const options = q4Options(c.q1)
  for (const id of c.q4) {
    const label = options.find((o) => o.id === id)?.label
    const pill = root.querySelector<HTMLElement>(
      `[data-question="q4"] [data-option="${id}"]`,
    )
    if (label !== undefined && pill !== null) {
      rects.set(label, pill.getBoundingClientRect())
    }
  }
  return rects
}

// ── Pieces of a screen ──────────────────────────────────────────────────

function Eyebrow(props: { n: number }): JSX.Element {
  return <p class={styles.eyebrow}>{`Question ${props.n} of 4`}</p>
}

/** The question, with the words that matter in the accent. */
function Heading(props: {
  id: string
  lead: string
  lit: string
  tail: string
}): JSX.Element {
  return (
    <h1 id={props.id} class={styles.question} tabindex="-1">
      {props.lead}
      <span class={styles.lit}>{props.lit}</span>
      {props.tail}
    </h1>
  )
}

interface OptionListProps<Id extends string> {
  question: 'q2' | 'q3' | 'q4'
  /** One answer (round ticks) or several (square ones). */
  pick: 'one' | 'many'
  /** The id of the question's heading, which names the group. */
  labelledBy: string
  /** The id of the line that says how many can be picked, which describes the group. */
  describedBy: string
  options: PlanOption<Id>[]
  isPicked: (id: Id) => boolean
  /** An answer that cannot be picked now. It stays on screen, marked aria-disabled. */
  isLocked?: (id: Id) => boolean
  onPick: (o: PlanOption<Id>) => void
}

function OptionList<Id extends string>(
  props: OptionListProps<Id>,
): JSX.Element {
  return (
    <div
      class={styles.options}
      role="group"
      aria-labelledby={props.labelledBy}
      aria-describedby={props.describedBy}
      data-question={props.question}
      data-pick={props.pick}
    >
      <For each={props.options}>
        {(o) => (
          <button
            type="button"
            class={styles.option}
            aria-pressed={props.isPicked(o.id)}
            aria-disabled={props.isLocked?.(o.id) === true ? 'true' : undefined}
            data-option={o.id}
            onClick={() => props.onPick(o)}
          >
            <span class={styles.tick} aria-hidden="true">
              <CheckSmall size={13} />
            </span>
            <span>{o.label}</span>
          </button>
        )}
      </For>
    </div>
  )
}

/**
 * Enter puts the keyboard away. Bound natively (`on:keydown`), not through
 * Solid's delegated listener at the document: a host that stops keydown from
 * propagating would silence that one (MISTAKES.md).
 */
function blurOnEnter(e: KeyboardEvent & { currentTarget: HTMLElement }): void {
  if (e.key !== 'Enter') return
  e.preventDefault()
  e.currentTarget.blur()
}

interface TypedLineProps {
  field: TypedField
  /** What a screen reader calls the field. */
  label: string
  placeholder: string
  max: number
  value: string
  onType: (value: string) => void
}

function TypedLine(props: TypedLineProps): JSX.Element {
  const inputId = createUniqueId()
  const countId = createUniqueId()
  return (
    <div class={styles.field}>
      <label class={styles.srOnly} for={inputId}>
        {props.label}
      </label>
      <input
        id={inputId}
        class={styles.input}
        type="text"
        data-field={props.field}
        maxLength={props.max}
        enterkeyhint="done"
        placeholder={props.placeholder}
        autocomplete="off"
        value={props.value}
        aria-describedby={countId}
        onInput={(e) => props.onType(e.currentTarget.value)}
        on:keydown={blurOnEnter}
      />
      <small id={countId} class={styles.count}>
        {`${props.max - props.value.length} left`}
      </small>
    </div>
  )
}

/**
 * The quiet way on from Q1 and Q2. It says what the tap does: Skip while no
 * answer stands, Next while one does. Either way it moves on at once and
 * keeps whatever answer stands, so it never takes a pick back.
 */
function QuietButton(props: {
  standing: boolean
  onPass: () => void
}): JSX.Element {
  return (
    <button
      type="button"
      class={styles.pass}
      data-testid="plan-quiet"
      onClick={() => props.onPass()}
    >
      {props.standing ? 'Next' : 'Skip'}
    </button>
  )
}

/**
 * The button under Q3 and Q4. It says what the tap does: with something
 * picked it is the full button, "Next" or "Show my plan" and an arrow; with
 * nothing picked it is the quiet "Skip this one" or "Skip to my plan". Both
 * pass the question.
 */
function NextButton(props: {
  picked: boolean
  next: string
  skip: string
  onNext: () => void
}): JSX.Element {
  return (
    <div class={styles.nextRow}>
      <button
        type="button"
        class={styles.next}
        classList={{ [styles.nextQuiet]: !props.picked }}
        data-testid="plan-next"
        onClick={() => props.onNext()}
      >
        <Show when={props.picked} fallback={props.skip}>
          {props.next}
          <span class={styles.nextArrow} aria-hidden="true">
            <ChevronLeft />
          </span>
        </Show>
      </button>
    </div>
  )
}

// ── The screens ─────────────────────────────────────────────────────────

export function PlanQuestions(props: PlanQuestionsProps): JSX.Element {
  // What the screens open on is read once: they keep their own answers from
  // then on, and hand them back as they stand.
  const seed = untrack(() => ({
    choices: pruneChoices(props.initial ?? EMPTY_CHOICES),
    texts: seededTexts(props.initialTexts),
    returning: props.returning,
  }))

  const [step, setStep] = createSignal<QuestionId>('q1')
  const [choices, setChoices] = createSignal<PlanChoices>(seed.choices)
  const [texts, setTexts] = createSignal<PlanTexts>(seed.texts)
  const [line, setLine] = createSignal(
    restingLine('q1', seed.choices, seed.returning),
  )
  const [pops, setPops] = createSignal(0)
  // One screen is up at a time, so one id serves each of these on every one.
  const headingId = createUniqueId()
  const pickId = createUniqueId()
  const hintId = createUniqueId()

  // A new list of options is made only when the first answer changes, so a
  // pick does not rebuild the rows under the finger that made it.
  const firstAnswer = createMemo(() => choices().q1)
  const goals = createMemo(() => q2Options(firstAnswer()))
  const hardParts = createMemo(() => q3Options(firstAnswer()))
  const tried = createMemo(() => q4Options(firstAnswer()))
  const partsFull = createMemo(() => choices().q3.length >= Q3_MAX)

  let root: HTMLDivElement | undefined
  let advanceTimer: ReturnType<typeof setTimeout> | undefined
  let poseTimer: ReturnType<typeof setTimeout> | undefined

  onCleanup(() => {
    clearTimeout(advanceTimer)
    clearTimeout(poseTimer)
  })

  /** Merc's pose, and the one he settles into after `afterMs`. */
  function mercPose(pose: MercState, then?: MercState, afterMs = HOP_MS): void {
    clearTimeout(poseTimer)
    props.onMercState(pose)
    if (then !== undefined) {
      poseTimer = setTimeout(() => props.onMercState(then), afterMs)
    }
  }

  onMount(() => mercPose('drop', 'idle', DROP_MS))

  /** Merc's reply to a pick: his line changes, and it pops. */
  function reply(said: string): void {
    setLine(said)
    setPops((n) => n + 1)
  }

  function focusField(field: TypedField): void {
    root?.querySelector<HTMLInputElement>(`[data-field="${field}"]`)?.focus()
  }

  /** Opens a question, with Merc saying what fits what it already holds. */
  function arrive(on: QuestionId, c: PlanChoices): void {
    clearTimeout(advanceTimer)
    setStep(on)
    setLine(restingLine(on, c, props.returning))
    mercPose(REST_POSE[on])
    // The root is one scroll region for all four questions, so the new one
    // opens at the top, not where the last one was scrolled to.
    if (root !== undefined) root.scrollTop = 0
    root?.querySelector<HTMLElement>('h1')?.focus()
  }

  // ── Q1 and Q2: one answer, and the screen moves on ──

  function pickOne(on: 'q1' | 'q2', next: PlanChoices, said: string): void {
    setChoices(next)
    reply(said)
    mercPose('hop', REST_POSE[on])
    clearTimeout(advanceTimer)
    const following = NEXT_QUESTION[on]
    if (following === undefined) return
    advanceTimer = setTimeout(
      () => arrive(following, choices()),
      PICK_ADVANCE_MS,
    )
  }

  function pickFirst(o: PlanOption<Q1Answer>): void {
    pickOne('q1', pruneChoices({ ...choices(), q1: o.id }), o.line)
  }

  function pickGoal(o: PlanOption<Q2Id>): void {
    pickOne('q2', pruneChoices({ ...choices(), q2: o.id }), o.line)
  }

  // ── Q3 and Q4: several answers ──

  function addedPick(on: 'q3' | 'q4', next: PlanChoices, said: string): void {
    setChoices(next)
    reply(said)
    mercPose('hop', REST_POSE[on], QUICK_HOP_MS)
  }

  /** A pick tapped off: Merc goes back to what the screen now holds. */
  function removedPick(on: 'q3' | 'q4', next: PlanChoices): void {
    const settled = pruneChoices(next)
    setChoices(settled)
    setLine(restingLine(on, settled, props.returning))
  }

  function togglePart(o: PlanOption<Q3Id>): void {
    const c = choices()
    if (c.q3.includes(o.id)) {
      removedPick('q3', { ...c, q3: c.q3.filter((id) => id !== o.id) })
    } else if (c.q3.length < Q3_MAX) {
      addedPick('q3', pruneChoices({ ...c, q3: [...c.q3, o.id] }), o.line)
      if (o.id === 'other') focusField('q3other')
    }
  }

  function toggleTried(o: PlanOption<Q4Id>): void {
    const c = choices()
    if (c.q4.includes(o.id)) {
      removedPick('q4', { ...c, q4: c.q4.filter((id) => id !== o.id) })
    } else {
      addedPick('q4', pruneChoices({ ...c, q4: [...c.q4, o.id] }), o.line)
      if (o.id === 'app') focusField('q4app')
    }
  }

  function typeLine(field: TypedField, value: string): void {
    const max = field === 'q3other' ? Q3_OTHER_MAX : Q4_APP_MAX
    setTexts({ ...texts(), [field]: value.slice(0, max) })
  }

  // ── The quiet control, Next, Back and Not now ──

  /**
   * The quiet control on Q1 and Q2, Skip or Next: on at once, cancelling the
   * wait and keeping any answer that stands. The label is the only difference.
   */
  function pass(): void {
    const following = NEXT_QUESTION[step()]
    if (following !== undefined) arrive(following, choices())
  }

  /** The button on Q3 and Q4. Nothing picked passes the question. */
  function next(): void {
    const c = choices()
    if (step() === 'q3') {
      arrive('q4', c)
      return
    }
    props.onDone(copyOf(c), pickedTexts(c, texts()), pillRects(root, c))
  }

  function back(): void {
    const previous = PREVIOUS_QUESTION[step()]
    if (previous !== undefined) arrive(previous, choices())
  }

  function decline(): void {
    clearTimeout(advanceTimer)
    props.onDecline(step(), copyOf(choices()))
  }

  // ── What is on screen ──

  const firstScreen = (): JSX.Element => (
    <div class={`${styles.screen} ${styles.wide}`}>
      <Eyebrow n={1} />
      <Heading
        id={headingId}
        lead="What do you want to work on "
        lit="most"
        tail="?"
      />
      <p id={pickId} class={styles.srOnly}>
        Pick one
      </p>
      <div
        class={styles.choices}
        role="group"
        aria-labelledby={headingId}
        aria-describedby={pickId}
      >
        <div class={styles.cards}>
          <For each={INSTRUMENTS}>
            {(i) => (
              <button
                type="button"
                class={styles.card}
                aria-pressed={choices().q1 === i.id}
                data-option={i.id}
                onClick={() => pickFirst(i)}
              >
                <img
                  class={styles.cardArt}
                  src={i.art}
                  alt=""
                  draggable={false}
                />
                <span class={styles.cardGlyph} aria-hidden="true">
                  <Dynamic component={GLYPH[i.id]} />
                </span>
                <span class={styles.cardCheck} aria-hidden="true">
                  <CheckSmall size={15} />
                </span>
                <span class={styles.cardLabel}>{i.label}</span>
              </button>
            )}
          </For>
        </div>
        <button
          type="button"
          class={styles.ghost}
          aria-pressed={choices().q1 === EVERYTHING.id}
          data-option={EVERYTHING.id}
          onClick={() => pickFirst(EVERYTHING)}
        >
          {EVERYTHING.label}
        </button>
      </div>
      <QuietButton standing={choices().q1 !== null} onPass={pass} />
    </div>
  )

  const goalScreen = (): JSX.Element => (
    <div class={styles.screen}>
      <Eyebrow n={2} />
      <Heading
        id={headingId}
        lead="What are you "
        lit="working toward"
        tail="?"
      />
      <p id={pickId} class={styles.srOnly}>
        Pick one
      </p>
      <OptionList
        question="q2"
        pick="one"
        labelledBy={headingId}
        describedBy={pickId}
        options={goals()}
        isPicked={(id) => choices().q2 === id}
        onPick={pickGoal}
      />
      <QuietButton standing={choices().q2 !== null} onPass={pass} />
    </div>
  )

  const partScreen = (): JSX.Element => (
    <div class={styles.screen}>
      <Eyebrow n={3} />
      <Heading
        id={headingId}
        lead="What's the "
        lit="hardest part"
        tail=" right now?"
      />
      <p id={hintId} class={styles.sub}>
        {partsFull()
          ? "That's two. Tap one again to change it."
          : 'Pick up to two.'}
      </p>
      <OptionList
        question="q3"
        pick="many"
        labelledBy={headingId}
        describedBy={hintId}
        options={hardParts()}
        isPicked={(id) => choices().q3.includes(id)}
        isLocked={(id) => partsFull() && !choices().q3.includes(id)}
        onPick={togglePart}
      />
      <Show when={choices().q3.includes('other')}>
        <TypedLine
          field="q3other"
          label="Something else, in a few words"
          placeholder="In a few words"
          max={Q3_OTHER_MAX}
          value={texts().q3other}
          onType={(value) => typeLine('q3other', value)}
        />
      </Show>
      <NextButton
        picked={choices().q3.length > 0}
        next="Next"
        skip="Skip this one"
        onNext={next}
      />
    </div>
  )

  const triedScreen = (): JSX.Element => (
    <div class={styles.screen}>
      <Eyebrow n={4} />
      <Heading
        id={headingId}
        lead="The last time you practiced, "
        lit="what did you use"
        tail="?"
      />
      <p id={hintId} class={styles.sub}>
        Pick any.
      </p>
      <OptionList
        question="q4"
        pick="many"
        labelledBy={headingId}
        describedBy={hintId}
        options={tried()}
        isPicked={(id) => choices().q4.includes(id)}
        onPick={toggleTried}
      />
      <Show when={choices().q4.includes('app')}>
        <TypedLine
          field="q4app"
          label="Which app?"
          placeholder="Which one?"
          max={Q4_APP_MAX}
          value={texts().q4app}
          onType={(value) => typeLine('q4app', value)}
        />
      </Show>
      <NextButton
        picked={choices().q4.length > 0}
        next="Show my plan"
        skip="Skip to my plan"
        onNext={next}
      />
    </div>
  )

  return (
    <div ref={root} class={styles.root}>
      {/* One element for the whole run, so a screen reader hears each change. */}
      <p
        class={styles.say}
        aria-live="polite"
        aria-atomic="true"
        data-pop={pops() === 0 ? undefined : pops() % 2}
      >
        {line()}
      </p>
      <Switch>
        <Match when={step() === 'q1'}>{firstScreen()}</Match>
        <Match when={step() === 'q2'}>{goalScreen()}</Match>
        <Match when={step() === 'q3'}>{partScreen()}</Match>
        <Match when={step() === 'q4'}>{triedScreen()}</Match>
      </Switch>
      {/* After the screen in the DOM, so Tab reaches the answers before the
          way out; PlanExits puts them in the corners. */}
      <PlanExits
        onBack={step() === 'q1' ? undefined : back}
        onNotNow={decline}
      />
    </div>
  )
}

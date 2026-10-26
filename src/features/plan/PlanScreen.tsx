// ============================================================
// PlanScreen — your plan: up to three stops, each built from the answers
// ============================================================
//
// What ends the four questions: Merc's line, the headline, a card for each
// stop the plan has (Start here big, then Learn and Play), the menu switch
// when the plan offers one, and the ways on (Start here, Show me around, See
// every room, Not now). The plan is the host's to build; this screen shows it
// as it is given, with every word from build-plan.ts, plan-copy.ts and
// questions.ts and none retyped here, and says what was tapped. It opens
// nothing itself.
//
// Six things are easy to break:
//
// - The chips fly as the screen mounts (fly-chips.ts): each from the pill
//   that made it, the rest rising in. It reads where the chips stand, so no
//   card slides in, and a card never makes a stacking context (see the
//   stylesheet), or a chip would go under the next card on its way.
// - The credits line sits on whichever card is Karaoke Night, Start here or
//   Play (a voiceprint can lead with it), and on no other. It wears the icon
//   of what it says: a gift, the gift; a balance or a first pack, the credit
//   coin First Light draws beside its credit counts, as neither is a present.
// - A stop's reason can be empty: a plan rebuilt from the stored record has
//   no voiceprint reason. Then the card has no reason line, not an empty one.
// - Merc is the host's. The screen never mounts one; it reports `celebrate`
//   as the plan opens and `point`, at Start here, a moment later.
// - The screen fills the host's box and scrolls its own content (what the
//   host owes the screens is in PlanExits.tsx's header). The cards and the
//   switch are in the scroll region, and so is Change my answers, last in it,
//   when the host gives a way to change them; the ways on are a row under it,
//   never pinned over it, so no card is partly under them. Not now is
//   PlanExits': it sits in the corner of the host's box, outside the region,
//   and comes last in the DOM, so Tab meets the plan first.
// - The main button starts the first stop, exactly as its card does: the same
//   `onOpenStop` with the plan's own Start here, so the same count and the
//   same way in, and its label is the card's own kicker (the owner: the
//   biggest button starts the recommended stop, not a tour). Show me around
//   stays beside it as the second button, and still enters Start here with
//   its room's tour; See every room is the quiet link.
//
// What the host sees: onOpenStop with the card's own stop, from the card or
// the main button; onScopeChange with what the switch should now be (it is
// the host's to keep); onShowMeAround, onSeeEveryRoom, onChangeAnswers and
// onNotNow with nothing.

import type { JSX } from 'solid-js'
import { createMemo, createUniqueId, For, onCleanup, onMount, Show, } from 'solid-js'
import { CreditCoin } from '@/components/billing/CreditCoin'
import { GiftIcon } from '@/components/billing/GiftIcon'
import { ChevronLeft } from '@/components/icons'
import type { MercState } from '@/lib/merc/constants'
import type { Plan, PlanStop, ScopeOffer } from './build-plan'
import { PLAN_DESTS, planStops } from './build-plan'
import { flyChips } from './fly-chips'
import { KICKER } from './plan-copy'
import type { CreditsLine } from './plan-credits'
import { PlanExits } from './PlanExits'
import styles from './PlanScreen.module.css'
import { MERC_INTRO } from './questions'

/** Merc cheers as the plan opens; by now the chips have landed and he points. */
export const CELEBRATE_MS = 1200

/** Under the menu switch: it changes a setting that stays changeable. */
const SCOPE_NOTE = 'You can change it any time in Settings, App Mode.'

/** A plan opened without the questions before it: every chip rises in. */
const NO_PILLS: ReadonlyMap<string, DOMRect> = new Map()

export interface PlanScreenProps {
  plan: Plan
  /** The credits line, for the Karaoke Night card; null when there is none to show. */
  credits: CreditsLine | null
  /** Is the menu switch on? It is off until the person taps it. */
  scopeOn: boolean
  /**
   * Where each answer from the last question sat on screen, by its label: its
   * chip flies in from there. Read once, as the screen opens.
   */
  fromPills?: ReadonlyMap<string, DOMRect>
  onScopeChange: (on: boolean) => void
  /** Merc's pose, as the screen asks for it. The host's one MercPresence draws him. */
  onMercState: (s: MercState) => void
  onShowMeAround: () => void
  onOpenStop: (stop: PlanStop) => void
  onSeeEveryRoom: () => void
  /**
   * Back to the questions, on the answers given. Given only where an answered
   * plan is looked at again (the layer's review): then "Change my answers"
   * ends the scroll region, after the cards and before the ways on. First
   * Light's plan, which has just been answered, never gives it.
   */
  onChangeAnswers?: () => void
  onNotNow: () => void
}

/** Every chip on the screen, in the order they stand. */
function chipsIn(root: HTMLElement | undefined): HTMLElement[] {
  if (root === undefined) return []
  return [...root.querySelectorAll<HTMLElement>('[data-chip]')]
}

// ── Pieces of a card ────────────────────────────────────────────────────

/** The answers that made a card, each in the words the person tapped. */
function Chips(props: { chips: readonly string[] }): JSX.Element {
  return (
    <Show when={props.chips.length > 0}>
      <span class={styles.chips} data-part="chips">
        <For each={props.chips}>
          {(chip) => (
            <span class={styles.chip} data-chip={chip}>
              {chip}
            </span>
          )}
        </For>
      </span>
    </Show>
  )
}

/**
 * What the person has in credits, or what a gift or a first pack is. The gift
 * wears the gift; a balance and a first pack are credits, not presents, so
 * they wear the credit coin. Both icons are decoration and hide themselves
 * from a screen reader, and both are 18 px, so the line does not change shape
 * with its kind.
 */
function Credits(props: { line: CreditsLine }): JSX.Element {
  return (
    <span class={styles.credits} data-part="credits">
      <span class={styles.creditsIcon}>
        <Show
          when={props.line.kind === 'gift'}
          fallback={<CreditCoin size={18} />}
        >
          <GiftIcon size={18} />
        </Show>
      </span>
      <span>
        <span class={styles.creditsTitle}>{props.line.title}</span>
        <span class={styles.creditsSub}>{props.line.sub}</span>
      </span>
    </span>
  )
}

interface StopCardProps {
  stop: PlanStop
  /** Shown only if this stop is Karaoke Night. */
  credits: CreditsLine | null
  onOpen: (stop: PlanStop) => void
}

/** One stop: its picture, what and where it is, why, and what made it. */
function StopCard(props: StopCardProps): JSX.Element {
  const dest = () => PLAN_DESTS[props.stop.dest]
  const credits = () =>
    props.stop.dest === 'karaokeNight' ? props.credits : null
  return (
    <button
      type="button"
      class={styles.stop}
      data-kind={props.stop.kind}
      data-dest={props.stop.dest}
      onClick={() => props.onOpen(props.stop)}
    >
      <span class={styles.cover}>
        <img src={dest().cover} alt="" draggable={false} />
      </span>
      <span class={styles.body}>
        <span class={styles.kicker}>
          <span class={styles.dot} aria-hidden="true" />
          <span>
            <span data-part="kind">{KICKER[props.stop.kind]}</span>{' '}
            <span aria-hidden="true">·</span>{' '}
            <span data-part="room">{dest().room}</span>
          </span>
        </span>
        <span class={styles.title} data-part="title">
          {props.stop.title}
        </span>
        <Show when={props.stop.why !== ''}>
          <span class={styles.why} data-part="why">
            {props.stop.why}
          </span>
        </Show>
        <Chips chips={props.stop.chips} />
        <Show when={credits()}>{(line) => <Credits line={line()} />}</Show>
      </span>
    </button>
  )
}

// ── The menu switch ─────────────────────────────────────────────────────

interface ScopeSwitchProps {
  offer: ScopeOffer
  on: boolean
  onChange: (on: boolean) => void
}

/** The one switch a plan can offer. Its words are a label too, so they flip it. */
function ScopeSwitch(props: ScopeSwitchProps): JSX.Element {
  const switchId = createUniqueId()
  const labelId = createUniqueId()
  const noteId = createUniqueId()
  return (
    <div class={styles.scope}>
      <label class={styles.scopeText} for={switchId}>
        <span id={labelId} class={styles.scopeLabel}>
          {props.offer.label}
        </span>
        <span id={noteId} class={styles.scopeNote}>
          {SCOPE_NOTE}
        </span>
      </label>
      <button
        id={switchId}
        type="button"
        role="switch"
        class={styles.switch}
        aria-checked={props.on}
        aria-labelledby={labelId}
        aria-describedby={noteId}
        onClick={() => props.onChange(!props.on)}
      >
        <span class={styles.track} aria-hidden="true">
          <span class={styles.thumb} />
        </span>
      </button>
    </div>
  )
}

// ── The screen ──────────────────────────────────────────────────────────

export function PlanScreen(props: PlanScreenProps): JSX.Element {
  const headingId = createUniqueId()
  // Start here is the big card; the rest, and the switch, stand beside or under it.
  const others = createMemo(() => planStops(props.plan).slice(1))
  const alone = () => others().length === 0 && props.plan.scope === null

  let root: HTMLDivElement | undefined
  let heading: HTMLHeadingElement | undefined
  let poseTimer: ReturnType<typeof setTimeout> | undefined

  onCleanup(() => clearTimeout(poseTimer))

  onMount(() => {
    props.onMercState('celebrate')
    poseTimer = setTimeout(() => props.onMercState('point'), CELEBRATE_MS)
    heading?.focus({ preventScroll: true })
    void flyChips(chipsIn(root), props.fromPills ?? NO_PILLS)
  })

  const open = (stop: PlanStop): void => props.onOpenStop(stop)

  return (
    <div ref={root} class={styles.root}>
      {/* The scroll region: Merc's line, the headline and the cards. The ways
          on are outside it, under it, so nothing scrolls beneath them. */}
      <div class={styles.scroll}>
        <p class={styles.say}>{MERC_INTRO.plan}</p>
        <h1 id={headingId} ref={heading} class={styles.headline} tabindex="-1">
          {props.plan.headline.lead}
          <span class={styles.lit}>{props.plan.headline.lit}</span>
        </h1>
        <div
          class={styles.stops}
          role="group"
          aria-labelledby={headingId}
          data-solo={alone() ? '' : undefined}
        >
          <StopCard
            stop={props.plan.start}
            credits={props.credits}
            onOpen={open}
          />
          <Show when={!alone()}>
            <div class={styles.side}>
              <For each={others()}>
                {(stop) => (
                  <StopCard stop={stop} credits={props.credits} onOpen={open} />
                )}
              </For>
              <Show when={props.plan.scope}>
                {(offer) => (
                  <ScopeSwitch
                    offer={offer()}
                    on={props.scopeOn}
                    onChange={(on) => props.onScopeChange(on)}
                  />
                )}
              </Show>
            </div>
          </Show>
        </div>
        <Show when={props.onChangeAnswers !== undefined}>
          <button
            type="button"
            class={styles.change}
            onClick={() => props.onChangeAnswers?.()}
          >
            Change my answers
          </button>
        </Show>
      </div>
      <div class={styles.actions}>
        <button
          type="button"
          class={styles.primary}
          onClick={() => open(props.plan.start)}
        >
          {KICKER.start}
          <span class={styles.arrow} aria-hidden="true">
            <ChevronLeft />
          </span>
        </button>
        <div class={styles.more}>
          <button
            type="button"
            class={styles.secondary}
            onClick={() => props.onShowMeAround()}
          >
            Show me around
          </button>
          <button
            type="button"
            class={styles.skip}
            onClick={() => props.onSeeEveryRoom()}
          >
            See every room
          </button>
        </div>
      </div>
      {/* After the cards in the DOM, so Tab reaches the plan before the way
          out; PlanExits puts the button in the corner. The props carry no
          onBack, so the plan shows no Back. */}
      <PlanExits onNotNow={props.onNotNow} />
    </div>
  )
}

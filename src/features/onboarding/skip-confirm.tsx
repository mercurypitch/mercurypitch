// ============================================================
// Skip confirm — First Light asks once before a way out skips what it gets you
// ============================================================
//
// Three taps ask "are you sure?" first (owner request, 23 Oct 2026): the
// welcome's close, the Not now that skips the voiceprint (First light, the
// Fork and the voiceprint run), and the questions' Not now. Everything else
// leaves at once: the twin and the prints (the voiceprint is saved already),
// Keep's Not now, a replay, and a welcome with nothing left to offer.
//
// The beat underneath stays mounted while the confirm is open, so a first
// note can still land and the voiceprint run keeps counting. Two rules keep
// that honest:
// - Yes, skip runs the handler it was handed, and every handler reads the
//   flow's state when it runs, so it acts on the state at that moment.
// - When the beat it was asked on moves on underneath (the voiceprint
//   finished, the microphone was refused), the question is no longer true and
//   the confirm closes by itself, counted neither as kept nor as skipped.
//
// The events of each way out (`onboarding_skipped`, `onboarding_track_short`,
// the plan's decline) fire from its handler, so only after Yes, skip.

import type { Component } from 'solid-js'
import { createEffect, createSignal, untrack } from 'solid-js'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import type { FeaturedPromo } from '@/db/services/billing-service'
import { giftTitle } from '@/lib/launch-gift-copy'
import { currentBeat, micDenied, savedVoiceprints, voiceprint, } from '@/stores/onboarding-store'
import type { Beat } from './flow'
import { trackOnboarding } from './funnel'

/** What a way out skips: the whole intro, the voiceprint or the plan. */
export type SkipAsk = 'intro' | 'voiceprint' | 'plan'

/** A confirm's title and the line under it. */
export interface SkipWords {
  title: string
  body: string
}

/** The confirm's words (owner copy, 23 Oct 2026). The plan's are the plan
 *  feature's own (BeatPlan's PLAN_SKIP_ASK), handed in. */
export const SKIP_COPY = {
  intro: { title: 'Skip the intro?', body: 'Stay, and you get:' },
  voiceprint: {
    title: 'Skip your voiceprint?',
    body: 'About 90 seconds of singing gets you your range, your voiceprint and your legend twin. You can make one later in the Voice Mirror.',
  },
  keep: 'Keep going',
  skip: 'Yes, skip',
  gainVoiceprint:
    'Your range, your voiceprint and your legend twin, from about 90 seconds of singing',
  gainPlan:
    'A plan from four quick questions: where to start, what to learn and what to play',
} as const

/** The beats each ask is put on. A way out on any other beat leaves at once. */
const ASKED_ON: Record<SkipAsk, readonly Beat[]> = {
  intro: ['sky'],
  voiceprint: ['first-light', 'fork', 'voiceprint'],
  plan: ['questions'],
}

/** One event a confirm opened, one it was kept, for each ask: the funnel
 *  carries no properties, so the name says which confirm it was. */
const ASKED_EVENT = {
  intro: 'onboarding_skip_asked_intro',
  voiceprint: 'onboarding_skip_asked_voiceprint',
  plan: 'onboarding_skip_asked_plan',
} as const satisfies Record<SkipAsk, string>
const KEPT_EVENT = {
  intro: 'onboarding_skip_kept_intro',
  voiceprint: 'onboarding_skip_kept_voiceprint',
  plan: 'onboarding_skip_kept_plan',
} as const satisfies Record<SkipAsk, string>

export interface IntroGainFacts {
  /** The flow's voiceprint run is ahead: none made in this run, none saved
   *  on this device, and the microphone not refused. */
  voiceprintDue: boolean
  /** The plan is neither answered nor turned down. */
  planDue: boolean
  /** The launch gift on offer, or null. */
  gift: FeaturedPromo | null
}

/** What staying in the intro gets, each line only while it applies. */
export function introGains(facts: IntroGainFacts): string[] {
  const lines: string[] = []
  if (facts.voiceprintDue) lines.push(SKIP_COPY.gainVoiceprint)
  if (facts.planDue) lines.push(SKIP_COPY.gainPlan)
  // The gift as the Keep card names it, its title and fine print in one line.
  // Not the offer line under it ("Use all 5 by ..."): out of the card, the 5
  // has nothing to count.
  if (facts.gift !== null)
    lines.push(`${giftTitle(facts.gift.credits)} with a free account`)
  return lines
}

interface Asking {
  kind: SkipAsk
  /** The beat it was asked on. */
  beat: Beat
  /** The way out the person tapped, run on Yes, skip. */
  skip: () => void
}

export interface SkipConfirm {
  /** Ask before `skip` runs, or run it at once when nothing needs asking. */
  ask: (kind: SkipAsk, skip: () => void) => void
  /** The confirm itself, rendered inside the flow so it wears its skin. */
  Confirm: Component
}

/**
 * The confirm's state for one run of First Light. `planDue` is the flow's
 * reading at open, `gift` its launch gift (null with an account), and
 * `planWords` what the plan's confirm says.
 */
export function createSkipConfirm(
  host: { replay?: boolean },
  planDue: boolean,
  gift: () => FeaturedPromo | null,
  planWords: SkipWords,
): SkipConfirm {
  const [asking, setAsking] = createSignal<Asking | null>(null)

  // Someone with saved voiceprints has no run in the flow: their Fork offers
  // their prints and the Voice Mirror, never the 90 seconds, so the confirm
  // promises none.
  const voiceprintDue = (): boolean =>
    voiceprint() === null && savedVoiceprints().length === 0 && !micDenied()
  const gains = (): string[] =>
    introGains({ voiceprintDue: voiceprintDue(), planDue, gift: gift() })

  const applies = (kind: SkipAsk): boolean => {
    if (host.replay === true || !ASKED_ON[kind].includes(currentBeat()))
      return false
    if (kind === 'intro') return gains().length > 0
    if (kind === 'voiceprint') return voiceprintDue()
    return true
  }

  // The beat moved on under the confirm (the voiceprint finished), so it
  // closes, counted as neither. Its trap hands the focus back to the way out
  // that opened it, a pass after First Light put it on the new beat's heading,
  // so the heading takes it back once the trap is done.
  createEffect(() => {
    const open = asking()
    if (open === null || currentBeat() === open.beat) return
    setAsking(null)
    queueMicrotask(() =>
      document
        .querySelector<HTMLElement>('[data-onboarding-flow] [data-beat] h1')
        ?.focus({ preventScroll: true }),
    )
  })

  const ask = (kind: SkipAsk, skip: () => void): void => {
    // One confirm at a time: a second way out reached while one is open
    // neither counts again nor swaps the handler.
    if (untrack(asking) !== null) return
    if (!untrack(() => applies(kind))) {
      skip()
      return
    }
    trackOnboarding(ASKED_EVENT[kind])
    setAsking({ kind, beat: untrack(currentBeat), skip })
  }

  const keep = (): void => {
    const open = asking()
    if (open === null) return
    setAsking(null)
    trackOnboarding(KEPT_EVENT[open.kind])
  }

  const confirm = (): void => {
    const open = asking()
    if (open === null) return
    setAsking(null)
    open.skip()
  }

  const copy = (): SkipWords => {
    const kind = asking()?.kind ?? 'intro'
    return kind === 'plan' ? planWords : SKIP_COPY[kind]
  }

  const Confirm: Component = () => (
    <ConfirmDialog
      open={asking() !== null}
      title={copy().title}
      message={copy().body}
      details={asking()?.kind === 'intro' ? gains() : undefined}
      keepLabel={SKIP_COPY.keep}
      confirmLabel={SKIP_COPY.skip}
      isolateKeyboard
      onConfirm={confirm}
      onCancel={keep}
    />
  )

  return { ask, Confirm }
}

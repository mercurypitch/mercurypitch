// ============================================================
// Voice Mirror — "How it works" onboarding overview.
//
// One screen, four looping demo cards (glide up, glide down, hold,
// sing it back) that tell the story hands-free: a spotlight cycles
// through the cards one by one — the active card animates at full
// brightness while the rest dim to a static frame — then restarts,
// forever, until "Let's go". Hovering (desktop) or tapping (mobile)
// a card steals the spotlight; the cycle resumes when the pointer
// leaves or the pinned card finishes one loop.
//
// The "Let's go" tap is the user gesture that acquires the mic —
// the caller passes start('guided') straight through, so the iOS
// gesture-chain requirement is untouched.
// ============================================================

import type { Component } from 'solid-js'
import { createSignal, For, onCleanup, onMount } from 'solid-js'
import type { DemoKind } from '@/lib/mirror/demo-timeline'
import { buildDemoTimeline } from '@/lib/mirror/demo-timeline'
import { trackFunnel } from './funnel'
import { TaskDemo } from './TaskDemo'

interface HowItWorksProps {
  /** The mic-acquiring gesture — must call start('guided') synchronously. */
  onLetsGo: () => void
  onBack: () => void
}

interface StepCard {
  kind: DemoKind
  title: string
  blurb: string
}

const STEPS: StepCard[] = [
  {
    kind: 'glide-up',
    title: 'Glide up',
    blurb: 'Slide from your lowest comfy note to your highest — like a siren.',
  },
  {
    kind: 'glide-down',
    title: 'Glide down',
    blurb: 'Then slide back down, top to bottom. Same siren, reversed.',
  },
  {
    kind: 'hold',
    title: 'Hold a note',
    blurb: 'Pick any comfortable note and keep it steady — the ring tightens.',
  },
  {
    kind: 'match',
    title: 'Sing it back',
    blurb: 'Hear a tone, then match it with your voice. Any octave counts.',
  },
]

export const HowItWorks: Component<HowItWorksProps> = (props) => {
  // The auto-advancing spotlight, and an interaction pin that overrides it.
  const [spotlight, setSpotlight] = createSignal(0)
  const [pinned, setPinned] = createSignal<number | null>(null)
  const activeIndex = (): number => pinned() ?? spotlight()
  // A tap pins only until that card's loop wraps; a hover pins until leave.
  let pinnedByTap = false
  let advancedAt = 0

  function advance(from: number): void {
    setSpotlight((from + 1) % STEPS.length)
    advancedAt = performance.now()
  }

  onMount(() => {
    trackFunnel('howto_view')
    advancedAt = performance.now()
    // Watchdog: the cycle normally advances on the active card's loop end,
    // but that loop pauses when its canvas is offscreen (small viewports)
    // or under reduced motion — the story must keep stepping regardless.
    const watchdog = setInterval(() => {
      if (pinned() !== null) {
        advancedAt = performance.now()
        return
      }
      const loopMs =
        buildDemoTimeline(STEPS[spotlight()].kind).durationSec * 1000
      if (performance.now() - advancedAt > loopMs + 2000) {
        advance(spotlight())
      }
    }, 1000)
    onCleanup(() => clearInterval(watchdog))
  })

  function handleLoopEnd(index: number): void {
    if (pinned() === index) {
      if (!pinnedByTap) return // hover keeps the card looping
      setPinned(null)
      pinnedByTap = false
      advance(index)
      return
    }
    if (pinned() === null && spotlight() === index) {
      advance(index)
    }
  }

  // Pin on pointermove, not pointerenter: enter also fires when a card
  // renders under a stationary cursor (right after the "Start singing"
  // click), which would silently pin card 1 and stall the story. Always
  // downgrade a tap-pin to a hover-pin — leaving pinnedByTap stale would
  // make pointer-leave refuse to unpin this card.
  function pinByPointer(index: number, pointerType: string): void {
    if (pointerType !== 'mouse') return
    pinnedByTap = false
    setPinned(index)
  }

  function unpinByPointer(pointerType: string): void {
    if (pointerType !== 'mouse' || pinnedByTap) return
    const resumeFrom = pinned()
    setPinned(null)
    if (resumeFrom !== null) setSpotlight(resumeFrom)
  }

  function pinByTap(index: number): void {
    pinnedByTap = true
    setPinned(index)
  }

  return (
    <section class="mirror-panel mirror-howto">
      <p class="mirror-progress">How it works</p>
      <h2 class="mirror-howto-title">Three little tasks, one voiceprint</h2>
      <p class="mirror-howto-sub">
        Watch what to do — it all takes about 60 seconds.
      </p>
      {/* Pinning is a pointer-only garnish — the auto-cycle already shows
          every step, so cards stay plain (non-focusable) divs. */}
      <div class="mirror-howto-steps">
        <For each={STEPS}>
          {(step, index) => (
            <div
              class="mirror-howto-card"
              classList={{ 'is-active': activeIndex() === index() }}
              onPointerMove={(e) => pinByPointer(index(), e.pointerType)}
              onPointerLeave={(e) => unpinByPointer(e.pointerType)}
              onClick={() => pinByTap(index())}
            >
              <div class="mirror-howto-head">
                <span class="mirror-howto-num">{index() + 1}</span>
                <h3>{step.title}</h3>
              </div>
              <TaskDemo
                kind={step.kind}
                size="card"
                label={`Animated demo: ${step.blurb}`}
                active={() => activeIndex() === index()}
                onLoopEnd={() => handleLoopEnd(index())}
              />
              <p class="mirror-howto-blurb">{step.blurb}</p>
            </div>
          )}
        </For>
      </div>
      <div
        class="mirror-howto-dots"
        role="img"
        aria-label={`Showing step ${activeIndex() + 1} of ${STEPS.length}`}
      >
        <For each={STEPS}>
          {(_, index) => (
            <span
              class="mirror-howto-dot"
              classList={{ 'is-active': activeIndex() === index() }}
            />
          )}
        </For>
      </div>
      <button class="mirror-cta" onClick={() => props.onLetsGo()}>
        Let's go
      </button>
      <p class="mirror-trust">
        Your audio never leaves this device — everything runs right here.
      </p>
      <button class="mirror-textbtn" onClick={() => props.onBack()}>
        Back
      </button>
    </section>
  )
}

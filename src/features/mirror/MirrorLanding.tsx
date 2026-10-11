// ============================================================
// Voice Mirror start screen — the first screen of every door.
// ============================================================
//
// /mirror, /vocal-range-test, /voice-type-test,
// /which-singer-has-my-vocal-range and /free-sing all open here. It wears
// the onboarding's welcome (src/features/onboarding/beats/BeatSky.tsx): Merc's
// sky plate behind it (MirrorBackdrop), an eyebrow, a headline whose payoff
// words carry the brand gradient, one sentence of promise and one large pill.
//
// The order is the hierarchy. One primary action, the pill; "How it works"
// under it as a quiet text button; and the way to Break Glass at the foot of
// the page, a quiet link just above the legal row. It used to sit straight
// under the pill in a second colour, asking a visitor who came for their
// range to pick between two games before they had sung a note (owner review,
// 11 Oct 2026: "the main page, where it has the break the glass link and
// everything").
//
// The H1 and the promise of each door are what the ads and the search pages
// promise, so they are data here and pinned by MirrorLanding.test.tsx.

import type { JSX } from 'solid-js'
import { createSignal } from 'solid-js'
import type { MirrorEntryIntent } from './entry-intent'
import { trackFunnel } from './funnel'
import { IconGlass } from './icons'

interface DoorCopy {
  /** The H1, split so its payoff words can carry the brand gradient. The
   *  full stop rides in `lit`: a span followed by text reads to some
   *  assistive tech as two words ("vocal range ."). */
  headline: { lead: string; lit: string }
  /** The door's promise, one paragraph. */
  lede: string
  /** The one primary action. */
  cta: string
  howItWorks: string
  /** What the primary action starts. */
  mode: 'guided' | 'free'
}

const DOOR_COPY: Record<MirrorEntryIntent, DoorCopy> = {
  'vocal-range': {
    headline: { lead: 'Find your ', lit: 'vocal range.' },
    lede: 'Glide from your lowest comfortable note to your highest. Your result leads with both notes, your span in semitones and a broad voice-type guide; two short follow-ups add accuracy and steadiness.',
    cta: 'Test my vocal range',
    howItWorks: 'How the test works',
    mode: 'guided',
  },
  'voice-mirror': {
    headline: { lead: 'Meet your ', lit: 'voice twin.' },
    lede: 'Sing a couple of short tasks and we name the legend your range lines up with, then map your voice as a voiceprint you can share.',
    cta: 'Find my voice twin',
    howItWorks: 'How it works',
    mode: 'guided',
  },
  // The open take: kept off the other doors so it cannot be picked by
  // accident, but addressable for anyone (a creator brief, a link) pointed
  // at /free-sing on purpose.
  'free-sing': {
    headline: { lead: 'Just ', lit: 'sing.' },
    lede: 'Forty seconds of anything you like. Your shower song counts. No targets and no score: we measure the range you actually use, the note you keep coming back to, and how long your phrases run.',
    cta: 'Just sing · 40 s',
    howItWorks: 'How it works',
    mode: 'free',
  },
}

/** The privacy story as an "i" affordance rather than a paragraph.
 *
 *  It used to be two sentences of body copy on both the landing and the mic
 *  screen, competing with the thing the visitor came to do. The promise still
 *  has to be one gesture away (it is the reason someone grants a microphone),
 *  so this mirrors Glass's TrustInfo, with one addition: Glass opens on click
 *  only, which leaves desktop users clicking a thing that looks hoverable.
 *  Hover is handled in CSS for fine pointers; the click toggle stays for touch,
 *  where hover does not exist. */
export function TrustInfo(): JSX.Element {
  const [open, setOpen] = createSignal(false)
  return (
    <div class="mirror-info">
      <button
        type="button"
        class="mirror-info-btn"
        aria-expanded={open()}
        aria-label="Privacy: how your audio is handled"
        onClick={() => setOpen((v) => !v)}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9.5" />
          <path d="M12 10.8v5.4" />
          <circle cx="12" cy="7.6" r="0.6" fill="currentColor" />
        </svg>
      </button>
      <div class="mirror-info-pop" role="note" data-open={open()}>
        Private by design: your audio never leaves this device. The analysis
        runs here in your browser, and the recording stays with you.
      </div>
    </div>
  )
}

export interface MirrorLandingProps {
  entryIntent: MirrorEntryIntent
  onStart: (mode: 'guided' | 'free') => void
  onHowItWorks: () => void
}

/** The start screen: two blocks in the page shell, the screen itself and the
 *  side door that sits at the foot above the legal row. */
export function MirrorLanding(props: MirrorLandingProps): JSX.Element {
  const door = (): DoorCopy => DOOR_COPY[props.entryIntent]

  return (
    <>
      <section
        class="mirror-panel mirror-landing"
        data-door={props.entryIntent}
      >
        <TrustInfo />
        <p class="mirror-eyebrow">MercuryPitch</p>
        <h1 class="mirror-headline">
          {door().headline.lead}
          <span class="mirror-lit">{door().headline.lit}</span>
        </h1>
        <p class="mirror-lede">{door().lede}</p>
        <div class="mirror-start-actions">
          <button
            type="button"
            class="mirror-pill"
            onClick={() => props.onStart(door().mode)}
          >
            {door().cta}
          </button>
          <button
            type="button"
            class="mirror-quiet"
            onClick={() => props.onHowItWorks()}
          >
            {door().howItWorks}
          </button>
        </div>
      </section>
      <div class="mirror-sidedoor">
        <a
          class="mirror-sidedoor-link"
          href="/glass"
          onClick={() => trackFunnel('cta_glass_click')}
        >
          <IconGlass size={18} />
          Break glass with your voice
        </a>
      </div>
    </>
  )
}

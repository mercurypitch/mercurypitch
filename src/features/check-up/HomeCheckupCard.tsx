// ============================================================
// HomeCheckupCard — "A week since your last Check-up", on Home
// ============================================================
//
// The reason to come back on day 7 (docs/specs/weekly-check-up.ears.md). Home
// shows it while a Check-up is due: the newest voiceprint in the history a
// week old or more, and the card not sent away this week. It offers the same
// ninety seconds again, in the Voice Mirror's Check-up mode, and "Not this
// week". That button goes with the card, so the focus it had goes to the
// page's main region, as the plan card's X does, and a keyboard user is not
// dropped at the top of the page.
//
// The history is listVoiceprints, the one Settings shows: signed in, the
// account's takes; signed out, this browser's. It is read once as the card
// draws and again when the auth version moves, as the streak card reads its
// own. A read that fails draws no card and says nothing.
//
// Signed out, one quiet line says where the Check-ups live and what an account
// adds. It is the account's headline benefit, never a lock: the Check-up and
// its comparison work without one, in this browser (account-nudge.ts says why
// nothing is ever held behind an account).
//
// A chunk of its own, reached through src/pages/HomeCheckupCardMount.tsx, so
// Home's first paint carries the mount and not this.

import type { JSX } from 'solid-js'
import { createResource, createSignal, createUniqueId, Show } from 'solid-js'
import { accountHeld } from '@/db/services/auth-service'
import { authVersion } from '@/db/services/user-service'
import type { VoiceprintRecord } from '@/db/services/voiceprint-service'
import { listVoiceprints } from '@/db/services/voiceprint-service'
import { checkupCardShown, checkupCardWording, dismissCheckupCard, newestTakeMs, readCardDismissal, } from '@/lib/check-up/due'
import { openAuthModal } from '@/stores/ui-store'
import styles from './HomeCheckupCard.module.css'

/** Where "Start my Check-up" goes: the Voice Mirror, saying it is the Check-up. */
export const CHECKUP_MIRROR_HREF = '/mirror?checkup=1'

export interface HomeCheckupCardProps {
  /** The clock, for a test; the wall clock otherwise. */
  now?: () => number
}

/** "19 October", with the year when it is not this one. */
function dayName(ms: number, now: number): string {
  const sameYear = new Date(ms).getFullYear() === new Date(now).getFullYear()
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(ms)
}

/** The card's heading and line for a last take at `newest`. */
export function checkupCardWords(
  newest: number,
  now: number,
): { heading: string; line: string } {
  const day = dayName(newest, now)
  if (checkupCardWording(newest, now) === 'day') {
    return {
      heading: `Your last Check-up was on ${day}.`,
      line: 'Sing the same 90 seconds again, and see what moved.',
    }
  }
  return {
    heading: 'A week since your last Check-up',
    line: `Sing the same 90 seconds as on ${day}, and see what moved.`,
  }
}

async function readHistory(): Promise<VoiceprintRecord[] | null> {
  try {
    return await listVoiceprints()
  } catch {
    return null
  }
}

export function HomeCheckupCard(props: HomeCheckupCardProps): JSX.Element {
  const now = (): number => props.now?.() ?? Date.now()
  const titleId = createUniqueId()
  const [dismissedAt, setDismissedAt] = createSignal(readCardDismissal())
  // `latest`, so a sign-in on Home re-reads without putting the slot back.
  const [history] = createResource(() => [authVersion()], readHistory)
  const takes = (): VoiceprintRecord[] | null => history.latest ?? null
  const newest = (): number | null => {
    const read = takes()
    return read === null ? null : newestTakeMs(read)
  }
  const shown = (): boolean => {
    const read = takes()
    return read !== null && checkupCardShown(read, dismissedAt(), now())
  }

  return (
    <Show when={shown() ? newest() : null}>
      {(last) => (
        <section
          class={`${styles.card} home-checkup-card`}
          aria-labelledby={titleId}
          data-testid="home-checkup-card"
        >
          <p class={styles.eyebrow}>Weekly Check-up</p>
          <h2 class={styles.title} id={titleId}>
            {checkupCardWords(last(), now()).heading}
          </h2>
          <p class={styles.line}>{checkupCardWords(last(), now()).line}</p>
          <div class={styles.actions}>
            <a class={styles.start} href={CHECKUP_MIRROR_HREF}>
              Start my Check-up
            </a>
            <button
              type="button"
              class={styles.skip}
              onClick={() => {
                const at = now()
                dismissCheckupCard(at)
                setDismissedAt(at)
                // The button is gone with the card, and the focus it had would
                // fall to the top of the page: keep it in the page's main
                // region, where it was.
                document
                  .getElementById('main-content')
                  ?.focus({ preventScroll: true })
              }}
            >
              Not this week
            </button>
          </div>
          <Show when={!accountHeld()}>
            <p class={styles.account} data-testid="home-checkup-account">
              Your Check-ups stay in this browser. A free account keeps every
              one, on every device.{' '}
              <button
                type="button"
                class={styles.accountButton}
                onClick={() => openAuthModal('register')}
              >
                Create a free account
              </button>
            </p>
          </Show>
        </section>
      )}
    </Show>
  )
}

// ============================================================
// LegendRoom — the Legend, sung in the native room
// ============================================================
//
// Slice 3 of docs/plans/native-more-and-community.md, pushed from the More
// sheet's Together group and from the Sing room's exercises, and hosted as
// a premium room: full-bleed, held upright, the rail away, Back out of it
// (premium-rooms.ts). The web draws its Legend in web chrome
// (WeeklyLegendHero.tsx, ChallengeStage.tsx); this draws the same
// challenge, scored the same way, in the native rooms' own light: the dark
// stage, glass, lit violet for the singer's turn, teal for a lit note and
// red for a miss, each with a mark (legend.css; the approved mock-ups are
// the canvas "Legend Native Room").
//
// Its door is the running Legend: the line drawn as a poster that lights
// as it plays at its written pitch, its title and close, what it asks for,
// the Founder's score and the singer's best, Sing it (on the board) and
// Practice (never recorded), the top three and the singer's own standing in
// words, and the past Legends to practise. Sing it asks once before a first
// ranked take: one consent, every board (board-consent.ts), and it can be
// taken back on the Account screen. The door is LegendDoor.tsx; the take
// (legend-take.ts) and its result are drawn by LegendTakeView.tsx.
//
// Never a period in the copy: a Legend runs one to eight weeks
// (challenge-period-neutral.test.ts). Behind NATIVE_LEAGUES, as a lazy
// chunk (NativeShell.tsx): a store build carries none of it.

import type { JSX } from 'solid-js'
import { createEffect, createResource, createSignal, on, onCleanup, Show, } from 'solid-js'
import './legend.css'
import { Sheet } from '@/components/mobile/Sheet'
import { grantBoardConsent, hasBoardConsent, } from '@/features/challenges/board-consent'
import { roomFinalizing } from '@/features/challenges/challenge-result-store'
import { weeklyAttemptVersion } from '@/features/challenges/weekly-attempt'
import type { WeeklyChallenge } from '@/features/challenges/weekly-service'
import { getWeeklyArchive, getWeeklyBoard, readActiveWeekly, } from '@/features/challenges/weekly-service'
import { MicIcon, TrophyIcon } from '../icons'
import { accountSignedIn, refreshAccount } from '../settings/account-state'
import { openSignIn } from '../settings/sign-in-state'
import { createLegendTake } from './legend-take'
import { LegendDoor } from './LegendDoor'
import { LegendTakeView } from './LegendTakeView'

/** How often the close's words are worked out again. */
const CLOCK_MS = 60_000

export function LegendRoom(): JSX.Element {
  const take = createLegendTake()

  const [now, setNow] = createSignal(Date.now())
  const clock = setInterval(() => setNow(Date.now()), CLOCK_MS)
  onCleanup(() => clearInterval(clock))

  const [active, { refetch: readAgain }] = createResource(readActiveWeekly)
  const running = (): WeeklyChallenge | null => {
    const read = active()
    return read?.status === 'ok' ? read.challenge : null
  }
  // Read again for a singer who signs in from the room: their standing is
  // on the board only for a read that carried their account.
  const [board, { refetch: readBoard }] = createResource(
    () => {
      const id = running()?.id
      return id === undefined ? undefined : { id, signedIn: accountSignedIn() }
    },
    (source) => getWeeklyBoard(source.id),
  )
  const [archive] = createResource(getWeeklyArchive)
  // A posted take is on the board now.
  createEffect(
    on(
      weeklyAttemptVersion,
      () => {
        void readBoard()
      },
      { defer: true },
    ),
  )

  // Consent is a fetch, so it is read ahead: the take's mic must open in
  // the tap that starts it, with no wait in between. Unknown asks first.
  const [consent, setConsent] = createSignal<boolean | undefined>(undefined)
  createEffect(
    on(accountSignedIn, (signedIn) => {
      setConsent(undefined)
      if (!signedIn) return
      void hasBoardConsent().then((given) => {
        if (accountSignedIn()) setConsent(given)
      })
    }),
  )
  const [consentOpen, setConsentOpen] = createSignal(false)
  const [granting, setGranting] = createSignal(false)
  const [consentFailed, setConsentFailed] = createSignal(false)
  const [consentGiven, setConsentGiven] = createSignal(false)

  const singRanked = (): void => {
    const picked = running()
    if (picked === null) return
    if (!accountSignedIn()) {
      openSignIn()
      return
    }
    if (consent() !== true) {
      setConsentFailed(false)
      setConsentOpen(true)
      return
    }
    setConsentGiven(false)
    take.start(picked, 'ranked')
  }

  const acceptConsent = async (): Promise<void> => {
    if (granting()) return
    setGranting(true)
    setConsentFailed(false)
    const given = await grantBoardConsent()
    setGranting(false)
    if (!given) {
      setConsentFailed(true)
      return
    }
    setConsent(true)
    setConsentOpen(false)
    // The mic opens in a tap, so the take waits for the next one.
    setConsentGiven(true)
    void refreshAccount()
  }

  const practiceInstead = (): void => {
    const picked = running()
    setConsentOpen(false)
    if (picked !== null) take.start(picked, 'practice')
  }

  const phase = (): string => take.state().phase

  return (
    <div
      class="mp-legend mp-dark-stage"
      data-testid="shell-legend"
      data-phase={phase()}
    >
      <Show
        when={phase() === 'idle'}
        fallback={
          <LegendTakeView
            take={take}
            board={() => board() ?? null}
            onDone={() => take.done()}
            onAgain={() => {
              const picked = take.challenge()
              if (picked === null) return
              // A ranked take asks again what Sing it asks: an account and
              // consent, either of which may have gone since.
              if (take.kind() === 'ranked') singRanked()
              else take.start(picked, 'practice')
            }}
          />
        }
      >
        <div class="mp-legend__scroller" data-scrolls="true">
          <LegendDoor
            take={take}
            now={now}
            running={running}
            reading={() => active.loading}
            unreachable={() => active()?.status === 'unreachable'}
            onRetry={() => {
              void readAgain()
            }}
            board={() => board() ?? null}
            archive={() => archive() ?? []}
          />
        </div>
        <Show when={running()}>
          <div class="mp-legend-dock" data-testid="legend-dock">
            <Show when={consentGiven()}>
              <p class="mp-legend-note" role="status">
                You are on the board now. Tap Sing it to start.
              </p>
            </Show>
            <Show when={roomFinalizing()}>
              <p
                class="mp-legend-note"
                role="status"
                data-testid="legend-saving"
              >
                Saving your last take
              </p>
            </Show>
            <div
              class="mp-legend-pair"
              data-stack={accountSignedIn() ? undefined : 'true'}
            >
              <button
                type="button"
                class="mp-legend-btn mp-legend-btn--fill"
                data-testid="legend-sing"
                aria-disabled={roomFinalizing() ? 'true' : undefined}
                onClick={singRanked}
              >
                <MicIcon size={20} />
                {accountSignedIn() ? 'Sing it' : 'Sign in to sing it'}
              </button>
              <button
                type="button"
                class="mp-legend-btn mp-legend-btn--line"
                data-testid="legend-practice"
                aria-disabled={roomFinalizing() ? 'true' : undefined}
                onClick={() => {
                  const picked = running()
                  if (picked !== null) take.start(picked, 'practice')
                }}
              >
                Practice
              </button>
            </div>
            <p class="mp-legend-note">
              Sing it puts one take on the board; practice is never recorded.
            </p>
          </div>
        </Show>
      </Show>

      <Sheet
        isOpen={consentOpen()}
        close={() => setConsentOpen(false)}
        ariaLabel="Sing it for the board?"
        snap="content"
      >
        <div class="mp-legend-consent" data-testid="legend-consent">
          <span class="mp-legend-consent__icon" aria-hidden="true">
            <TrophyIcon size={24} />
          </span>
          <h2 class="mp-legend-consent__title">Sing it for the board?</h2>
          <p class="mp-legend-consent__body">
            A ranked take puts your display name and score on this Legend's
            public board, and keeps them on its podium after it closes. You can
            turn public boards off again on the Account screen at any time, and
            past podiums hide your name when you do.
          </p>
          <p class="mp-legend-consent__body">
            Prefer not to? Sing it as practice: nothing is recorded to the
            board.
          </p>
          <Show when={consentFailed()}>
            <p class="mp-legend-note" data-tone="error" role="alert">
              Could not save that. Try again.
            </p>
          </Show>
          <button
            type="button"
            class="mp-legend-btn mp-legend-btn--fill"
            data-testid="legend-consent-yes"
            aria-disabled={granting() ? 'true' : undefined}
            onClick={() => {
              void acceptConsent()
            }}
          >
            Show my name on public boards
          </button>
          <button
            type="button"
            class="mp-legend-btn mp-legend-btn--line"
            data-testid="legend-consent-practice"
            onClick={practiceInstead}
          >
            Practice without ranking
          </button>
          <button
            type="button"
            class="mp-legend-btn mp-legend-btn--ghost"
            data-testid="legend-consent-later"
            onClick={() => setConsentOpen(false)}
          >
            Not now
          </button>
        </div>
      </Sheet>
    </div>
  )
}

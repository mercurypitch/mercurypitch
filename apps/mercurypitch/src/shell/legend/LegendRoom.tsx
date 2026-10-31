// ============================================================
// LegendRoom — the Legend, sung in the native room
// ============================================================
//
// Slice 3 of docs/plans/native-more-and-community.md, pushed from the More
// sheet's Together group and hosted as a premium room: full-bleed, held
// upright, the rail away, Back out of it (premium-rooms.ts). The web draws
// its Legend in web chrome (WeeklyLegendHero.tsx, ChallengeStage.tsx); this
// draws the same challenge, scored the same way, in the native kit.
//
// Its door is the running Legend: its title, when it closes, the line to
// hear at its written pitch, Sing it (on the board) and Practice (never
// recorded), the top three and the singer's own standing in words, and the
// past Legends to practise. Sing it asks once before a first ranked take:
// one consent, every board (board-consent.ts), and it can be taken back on
// the Account screen. The take itself is legend-take.ts.
//
// Never a period in the copy: a Legend runs one to eight weeks
// (challenge-period-neutral.test.ts). Behind NATIVE_LEAGUES, as a lazy
// chunk (NativeShell.tsx): a store build carries none of it.

import type { JSX } from 'solid-js'
import { createEffect, createMemo, createResource, createSignal, For, on, onCleanup, Show, } from 'solid-js'
import './legend.css'
import { Sheet } from '@/components/mobile/Sheet'
import { needsSignIn } from '@/db/services/auth-service'
import { grantBoardConsent, hasBoardConsent, } from '@/features/challenges/board-consent'
import { challengeResultCopy } from '@/features/challenges/challenge-result-copy'
import { roomChallengeResult, roomFinalizing, } from '@/features/challenges/challenge-result-store'
import { challengeTargetHighlights } from '@/features/challenges/challenge-stage-model'
import { weeklyAttemptVersion } from '@/features/challenges/weekly-attempt'
import type { ArchivedWeeklyChallenge, WeeklyBoard, WeeklyChallenge, } from '@/features/challenges/weekly-service'
import { getWeeklyArchive, getWeeklyBoard, podiumOf, readActiveWeekly, } from '@/features/challenges/weekly-service'
import type { ZenCanvasRenderModel } from '@/features/zen/zen-canvas-renderer'
import { ZenPitchCanvas } from '@/features/zen/ZenPitchCanvas'
import { getComfortableMidiRange } from '@/lib/vocal-range'
import { vocalRangePreset } from '@/stores/settings-store'
import { CalendarIcon, WarnIcon } from '../icons'
import { accountSignedIn, refreshAccount } from '../settings/account-state'
import { openSignIn } from '../settings/sign-in-state'
import { closesLine, countsLine, endedLine, rangeLine, rangeSide, standingLine, takeLine, } from './legend-lines'
import type { LegendTake } from './legend-take'
import { createLegendTake } from './legend-take'

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
          <TakeView
            take={take}
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
          <Door
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
            consentGiven={consentGiven}
            onSing={singRanked}
          />
        </div>
      </Show>

      <Sheet
        isOpen={consentOpen()}
        close={() => setConsentOpen(false)}
        ariaLabel="Sing it for the board?"
        snap="content"
      >
        <div class="mp-legend-consent" data-testid="legend-consent">
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
            <p class="mp-legend__error" role="alert">
              Could not save that. Try again.
            </p>
          </Show>
          <button
            type="button"
            class="mp-set-button"
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
            class="mp-set-button mp-set-button--secondary"
            data-testid="legend-consent-practice"
            onClick={practiceInstead}
          >
            Practice without ranking
          </button>
          <button
            type="button"
            class="mp-set-button mp-set-button--secondary"
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

interface DoorProps {
  take: LegendTake
  now: () => number
  running: () => WeeklyChallenge | null
  reading: () => boolean
  unreachable: () => boolean
  onRetry: () => void
  board: () => WeeklyBoard | null
  archive: () => ArchivedWeeklyChallenge[]
  consentGiven: () => boolean
  onSing: () => void
}

/** The running Legend, its board, and the past ones. */
function Door(props: DoorProps): JSX.Element {
  const range = (): 'above' | 'below' | null => {
    const picked = props.running()
    if (picked === null) return null
    return rangeSide(
      picked.targetItems,
      getComfortableMidiRange(vocalRangePreset()),
    )
  }
  const podium = () => (props.board()?.top ?? []).slice(0, 3)

  return (
    <div class="mp-legend-door" data-testid="legend-door">
      <Show when={props.reading() && props.running() === null}>
        <p class="mp-legend__caption" role="status">
          Loading the Legend
        </p>
      </Show>

      <Show when={!props.reading() && props.unreachable()}>
        <div class="mp-set-note mp-set-note--warn" role="status">
          <WarnIcon size={20} />
          <p>
            <strong>Could not load the Legend.</strong> Check the connection and
            try again.
          </p>
        </div>
        <button
          type="button"
          class="mp-set-button mp-set-button--secondary"
          data-testid="legend-retry"
          onClick={() => props.onRetry()}
        >
          Try again
        </button>
      </Show>

      <Show
        when={
          !props.reading() && !props.unreachable() && props.running() === null
        }
      >
        <p class="mp-legend__caption" data-testid="legend-none">
          No Legend is open right now. The next one opens soon.
        </p>
      </Show>

      <Show when={props.running()}>
        {(picked) => (
          <>
            <section class="mp-legend-hero" data-testid="legend-hero">
              <p class="mp-legend-hero__eyebrow">
                <CalendarIcon size={16} />
                <span>{closesLine(picked().endsAt, props.now())}</span>
              </p>
              <h2 class="mp-legend-hero__title">{picked().title}</h2>
              <Show when={picked().description}>
                <p class="mp-legend-hero__body">{picked().description}</p>
              </Show>
              <div class="mp-legend-hero__hear">
                <button
                  type="button"
                  class="mp-set-button mp-set-button--secondary mp-set-button--small"
                  data-testid="legend-hear"
                  aria-pressed={props.take.linePlaying()}
                  onClick={() => props.take.playLine(picked())}
                >
                  {props.take.linePlaying() ? 'Stop the line' : 'Hear the line'}
                </button>
                <Show when={picked().hearItUrl}>
                  {(url) => (
                    <a
                      class="mp-legend__link"
                      href={url()}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Hear the original
                    </a>
                  )}
                </Show>
              </div>
              <Show when={range()}>
                {(side) => (
                  <p class="mp-legend__caption" data-testid="legend-range">
                    {rangeLine(side(), vocalRangePreset())}
                  </p>
                )}
              </Show>
              <Show when={props.consentGiven()}>
                <p class="mp-legend__caption" role="status">
                  You are on the board now. Tap Sing it to start.
                </p>
              </Show>
              <Show when={roomFinalizing()}>
                <p
                  class="mp-legend__caption"
                  role="status"
                  data-testid="legend-saving"
                >
                  Saving your last take
                </p>
              </Show>
              <div class="mp-legend-hero__actions">
                <button
                  type="button"
                  class="mp-set-button"
                  data-testid="legend-sing"
                  aria-disabled={roomFinalizing() ? 'true' : undefined}
                  onClick={() => props.onSing()}
                >
                  {accountSignedIn() ? 'Sing it' : 'Sign in to sing it'}
                </button>
                <button
                  type="button"
                  class="mp-set-button mp-set-button--secondary"
                  data-testid="legend-practice"
                  aria-disabled={roomFinalizing() ? 'true' : undefined}
                  onClick={() => props.take.start(picked(), 'practice')}
                >
                  Practice
                </button>
              </div>
              <p class="mp-legend__caption">
                Sing it puts one take on the board; practice is never recorded.
              </p>
            </section>

            <Show when={props.board()}>
              {(scores) => (
                <section class="mp-legend-group" data-testid="legend-board">
                  <h3 class="mp-legend-group__title">The board</h3>
                  <Show when={countsLine(scores())}>
                    {(line) => <p class="mp-legend__caption">{line()}</p>}
                  </Show>
                  <ol class="mp-legend-podium">
                    <For each={podium()}>
                      {(entry) => (
                        <li
                          class="mp-legend-podium__row"
                          data-founder={entry.isFounder ? 'on' : undefined}
                        >
                          <span class="mp-legend-podium__rank">
                            {entry.rank}
                          </span>
                          <span class="mp-legend-podium__name">
                            {entry.displayName}
                          </span>
                          <span class="mp-legend-podium__score">
                            {Math.round(entry.best)}%
                          </span>
                        </li>
                      )}
                    </For>
                  </ol>
                  <Show when={standingLine(scores())}>
                    {(line) => (
                      <p class="mp-legend__standing" data-testid="legend-you">
                        {line()}
                      </p>
                    )}
                  </Show>
                </section>
              )}
            </Show>
          </>
        )}
      </Show>

      <Show when={props.archive().length > 0}>
        <section class="mp-legend-group" data-testid="legend-past">
          <h3 class="mp-legend-group__title">Past Legends</h3>
          <For each={props.archive()}>
            {(past) => (
              <div class="mp-legend-past" data-legend-past={past.id}>
                <div class="mp-legend-past__text">
                  <span class="mp-legend-past__title">{past.title}</span>
                  <span class="mp-legend-past__sub">{endedLine(past)}</span>
                  <Show when={podiumOf(past.results).length > 0}>
                    <span class="mp-legend-past__sub">
                      {podiumOf(past.results)
                        .map(
                          (place) =>
                            `${place.rank} ${place.displayName ?? 'Name withheld'}`,
                        )
                        .join(', ')}
                    </span>
                  </Show>
                </div>
                <button
                  type="button"
                  class="mp-set-button mp-set-button--secondary mp-set-button--small"
                  data-testid="legend-past-practice"
                  onClick={() => props.take.start(past, 'practice')}
                >
                  Practice
                </button>
              </div>
            )}
          </For>
        </section>
      </Show>
    </div>
  )
}

interface TakeViewProps {
  take: LegendTake
  onDone: () => void
  /** The same take again: a ranked one through Sing it's checks. */
  onAgain: () => void
}

/** The line on the stage while it is sung, then the take's result. */
function TakeView(props: TakeViewProps): JSX.Element {
  const phase = (): string => props.take.state().phase
  const title = (): string => props.take.challenge()?.title ?? ''

  const highlights = createMemo(
    (): ReturnType<typeof challengeTargetHighlights> => {
      const session = props.take.session()
      if (session === null) return new Map()
      const done = props.take.outcome()
      const points = done?.points ?? session.activePoints()
      const clock =
        done !== null ? session.loopDurationSec() : session.elapsedSec()
      return challengeTargetHighlights(points, session.targets(), clock)
    },
  )

  const model = (): ZenCanvasRenderModel | null => {
    const session = props.take.session()
    if (session === null) return null
    const done = props.take.outcome()
    const definition = session.exercise()
    return {
      durationSec: session.loopDurationSec(),
      elapsedSec:
        done !== null ? session.loopDurationSec() : session.elapsedSec(),
      ...(definition === null
        ? {}
        : { timeGridIntervalSec: 60 / definition.bpm }),
      viewport: session.viewport(),
      targets: session.targets(),
      targetVisibility: 'on',
      showPlayhead: done === null && session.status() === 'running',
      points: done?.points ?? session.activePoints(),
      targetHighlights: highlights(),
    }
  }

  const lit = (): number => {
    let count = 0
    for (const highlight of highlights().values()) {
      if (highlight.cleared) count += 1
    }
    return count
  }

  const result = () => {
    const presented = roomChallengeResult()
    return presented !== null &&
      presented.challengeId === props.take.challenge()?.id
      ? presented
      : null
  }

  return (
    <div class="mp-legend-take" data-testid="legend-take">
      <div class="mp-legend-take__head">
        <h2 class="mp-legend-take__title">{title()}</h2>
        <p class="mp-legend-take__hint" aria-live="polite">
          <Show
            when={phase() === 'starting'}
            fallback={
              <Show when={phase() === 'live'}>
                Sing each note as the line reaches it.{' '}
                {`${lit()} of ${props.take.session()?.targets().length ?? 0} lit`}
              </Show>
            }
          >
            Opening the microphone
          </Show>
        </p>
      </div>

      <Show when={model()}>
        {(current) => (
          <div class="mp-legend-take__stage">
            <ZenPitchCanvas
              model={current}
              summary={() => `${title()}: ${lit()} notes lit`}
            />
          </div>
        )}
      </Show>

      <Show when={phase() === 'live'}>
        <div class="mp-legend-take__dock">
          <button
            type="button"
            class="mp-set-button mp-set-button--secondary"
            data-testid="legend-stop"
            onClick={() => props.take.stop()}
          >
            {props.take.kind() === 'ranked' ? 'End and score' : 'Stop'}
          </button>
        </div>
      </Show>

      <Show when={phase() === 'blocked'}>
        <div class="mp-legend-result" role="alert" data-testid="legend-blocked">
          <p class="mp-legend-result__line">
            {props.take.block() === 'denied'
              ? 'The microphone is off for this app. Allow it in Settings, then try again.'
              : 'The microphone did not open. Check that no other app is using it, then try again.'}
          </p>
          <div class="mp-legend-result__actions">
            <button
              type="button"
              class="mp-set-button"
              data-testid="legend-back"
              onClick={() => props.onDone()}
            >
              Back to the Legend
            </button>
          </div>
        </div>
      </Show>

      <Show when={phase() === 'result' ? props.take.outcome() : null}>
        {(done) => (
          <div class="mp-legend-result" data-testid="legend-result">
            <p class="mp-legend-result__score">{done().summary.score}%</p>
            <Show
              when={props.take.kind() === 'ranked'}
              fallback={
                <p class="mp-legend-result__line">
                  Practice runs stay off the board.
                </p>
              }
            >
              <Show when={props.take.saveState() === 'saving'}>
                <p class="mp-legend-result__line" role="status">
                  Saving your take
                </p>
              </Show>
              <Show
                when={props.take.saveState() === 'posted' ? result() : null}
              >
                {(posted) => (
                  <>
                    <p class="mp-legend-result__headline">
                      {challengeResultCopy(posted()).headline}
                    </p>
                    <p class="mp-legend-result__line">
                      {takeLine(posted().score, posted().targetScore)}
                    </p>
                    <Show when={posted().badgeGranted}>
                      <p class="mp-legend-result__line">Its badge is yours.</p>
                    </Show>
                  </>
                )}
              </Show>
              <Show when={props.take.saveState() === 'failed'}>
                <Show
                  when={needsSignIn()}
                  fallback={
                    <p class="mp-legend-result__line" role="alert">
                      Your score was not posted. Try the line again when you are
                      ready.
                    </p>
                  }
                >
                  <p class="mp-legend-result__line" role="alert">
                    Sign in to post Legend scores: this take was not recorded.
                  </p>
                  <button
                    type="button"
                    class="mp-set-button mp-set-button--secondary"
                    data-testid="legend-result-sign-in"
                    onClick={() => openSignIn()}
                  >
                    Sign in
                  </button>
                </Show>
              </Show>
            </Show>
            <div class="mp-legend-result__actions">
              <button
                type="button"
                class="mp-set-button"
                data-testid="legend-again"
                aria-disabled={
                  props.take.saveState() === 'saving' ? 'true' : undefined
                }
                onClick={() => {
                  if (props.take.saveState() === 'saving') return
                  props.onAgain()
                }}
              >
                Again
              </button>
              <button
                type="button"
                class="mp-set-button mp-set-button--secondary"
                data-testid="legend-done"
                onClick={() => props.onDone()}
              >
                Done
              </button>
            </div>
          </div>
        )}
      </Show>
    </div>
  )
}

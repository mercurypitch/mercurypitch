// ============================================================
// LeaguesScreen — your rung, this week's standings, and the ladder
// ============================================================
//
// Slice 2 of docs/plans/native-more-and-community.md, read-only, pushed
// from the More sheet's Together group. The web draws its league inside the
// Leaderboard (CommunityLeaderboard.tsx), in web chrome; this draws the same
// answers in the Settings stack's grouped list, from the same service, with
// the cut read by the rules the Progress card shares (league-board.ts).
//
// Signed out, it offers the sign-in sheet and shows the ladder. Signed in,
// it shows what the phone kept at once (league-store.ts) and reads the
// league again; a read that gets no answer says so and offers to try again,
// rather than showing an account with no league. A league read before the
// week turned is last week's: open across the cut, the screen reads the
// new week's rather than go on showing the old one.
//
// Every name on the board is the server's: a member's own name only where
// they let public boards show it (leaderboardOptIn, one consent for every
// board), a weekly stand-in otherwise. The phone adds none.
//
// Behind NATIVE_LEAGUES, as a lazy chunk (NativeShell.tsx): a store build
// carries none of it.

import type { JSX } from 'solid-js'
import { createEffect, createMemo, createSignal, For, on, onCleanup, onMount, Show, untrack, } from 'solid-js'
import './leagues.css'
import type { LeagueMe } from '@/db/services/league-service'
import { msUntilNextCut } from '@/db/services/league-service'
import { getUserId } from '@/db/services/user-service'
import { leagueBoard, leagueNeighbours, leagueZoneOf, LOCKED_TROPHY, rungRevealed, } from '@/lib/league-board'
import { ChevronIcon, TrophyIcon, WarnIcon } from '../icons'
import { accountSignedIn } from '../settings/account-state'
import { SettingsGroup } from '../settings/SettingsList'
import { openSignIn } from '../settings/sign-in-state'
import { boardLine, nextCutLine, placeLine, pointsWord, rulesLines, rungLine, rungName, zoneLine, } from './league-lines'
import { leagueCard, leagueLadder, leagueReadFailed, leagueReading, leagueReadThisWeek, refreshLeague, } from './league-store'

/** How often the next cut's words are worked out again. */
const CLOCK_MS = 60_000

export function LeaguesScreen(): JSX.Element {
  const [now, setNow] = createSignal(Date.now())
  const clock = setInterval(() => setNow(Date.now()), CLOCK_MS)
  onCleanup(() => clearInterval(clock))

  let root: HTMLDivElement | undefined
  /** Give focus to the first thing that stands for the league now. */
  const focusLeague = (): void => {
    root?.querySelector<HTMLElement>('[data-league-focus]')?.focus()
  }

  onMount(() => {
    void refreshLeague()
  })
  // Signing in from the card below: read the league of who signed in. Not
  // deferred: the first run records signed-out, so the sign-in that
  // follows is a change from it.
  createEffect(
    on(accountSignedIn, (signedIn, was) => {
      if (signedIn && was === false) void refreshLeague()
    }),
  )

  /**
   * Whether the kept league was read this week, asked again each minute.
   * Judged on the clock as it is, not as of the last tick: a read that has
   * just landed must never look older than the clock that judges it, or
   * the screen would read again, and again, until the next tick.
   */
  const readThisWeek = (): boolean => {
    now()
    return leagueReadThisWeek()
  }
  /**
   * The account's answer, kept or fresh, but never last week's league. Only
   * a league belongs to a week: an answer without one ("not on this server
   * yet") holds whenever it was read.
   */
  const week = createMemo((): LeagueMe | null => {
    const card = leagueCard()
    if (card === null) return null
    return !card.eligible || readThisWeek() ? card : null
  })
  // The week turned while the league was kept or on screen: read this
  // week's. Once a turn: a read that fails waits for Try again.
  createEffect(() => {
    const card = leagueCard()
    if (card === null || !card.eligible || readThisWeek()) return
    if (untrack(leagueReading) || untrack(leagueReadFailed)) return
    void refreshLeague()
  })
  const league = createMemo((): LeagueMe | null => {
    const card = week()
    return card?.eligible === true && card.league !== undefined ? card : null
  })
  const myRank = (): number | undefined => league()?.league?.rank
  /**
   * The rung last known, whatever its week, for what the ladder unveils:
   * the cut moves a singer a rung at most, and a trophy once seen stays
   * seen while this week's league is read.
   */
  const knownRank = (): number | undefined => leagueCard()?.league?.rank
  const near = () => leagueNeighbours(myRank(), leagueLadder())
  const ladder = () => [...leagueLadder()].sort((a, b) => b.rank - a.rank)

  /** What stands in for the league while there is none to show. */
  const waiting = (): JSX.Element => {
    const card = week()
    if (card?.reason === 'unavailable') {
      return (
        <p
          class="mp-set__caption"
          data-testid="league-unavailable"
          data-league-focus=""
          tabindex="-1"
        >
          Leagues are not on this server yet.
        </p>
      )
    }
    if (card !== null && !card.eligible) {
      return (
        <p
          class="mp-set__caption"
          data-testid="league-registered-only"
          data-league-focus=""
          tabindex="-1"
        >
          Leagues are for registered singers.
        </p>
      )
    }
    if (leagueReading()) {
      return (
        <p class="mp-set__caption" role="status" data-testid="league-loading">
          Loading your league
        </p>
      )
    }
    return null
  }

  return (
    <div class="mp-set mp-league" data-testid="shell-leagues" ref={root}>
      <Show when={!accountSignedIn()}>
        <section class="mp-league-invite" data-testid="league-invite">
          <span class="mp-league-invite__icon" aria-hidden="true">
            <TrophyIcon size={24} />
          </span>
          <h2
            class="mp-league-invite__title"
            data-league-focus=""
            tabindex="-1"
          >
            Climb a rung every week
          </h2>
          <p class="mp-league-invite__body">
            Leagues are for registered singers. Practice earns points through
            the week, and every Monday the top of each league moves up.
          </p>
          <button
            type="button"
            class="mp-set-button"
            data-testid="league-sign-in"
            onClick={() => openSignIn()}
          >
            Sign in
          </button>
        </section>
      </Show>

      <Show when={accountSignedIn()}>
        <Show when={leagueReadFailed()}>
          <div class="mp-set-note mp-set-note--warn" role="status">
            <WarnIcon size={20} />
            <p>
              <strong>Could not load your league.</strong> Check the connection
              and try again.
            </p>
          </div>
          {/* Not `disabled` while the read is out: a disabled button drops
              the focus it has. It stays until a read lands, then hands
              focus to what took its place. */}
          <button
            type="button"
            class="mp-set-button mp-set-button--secondary"
            data-testid="league-retry"
            aria-disabled={leagueReading() ? 'true' : undefined}
            onClick={() => {
              if (leagueReading()) return
              void refreshLeague().then(() => {
                if (!leagueReadFailed()) focusLeague()
              })
            }}
          >
            Try again
          </button>
        </Show>

        <Show when={league()} fallback={waiting()}>
          {(card) => (
            <>
              <section class="mp-league-hero" data-testid="league-hero">
                <Show when={card().league?.trophyAsset}>
                  {(src) => (
                    <img
                      class="mp-league-hero__trophy"
                      src={src()}
                      alt=""
                      width="88"
                      height="88"
                    />
                  )}
                </Show>
                <div class="mp-league-hero__text">
                  <p class="mp-league-hero__eyebrow">Your league</p>
                  <h2
                    class="mp-league-hero__name"
                    data-league-focus=""
                    tabindex="-1"
                  >
                    {card().league?.name}
                  </h2>
                  <p class="mp-league-hero__place">{placeLine(card())}</p>
                </div>
              </section>

              <SettingsGroup title="This week">
                <Show when={zoneLine(leagueZoneOf(card()), near())}>
                  {(line) => (
                    <div class="mp-set-row" data-league-fact="zone">
                      <span class="mp-set-row__label">{line()}</span>
                    </div>
                  )}
                </Show>
                <Show when={card().league}>
                  {(rung) => (
                    <For each={rulesLines(rung(), near())}>
                      {(line) => (
                        <div class="mp-set-row" data-league-fact="rule">
                          <span class="mp-set-row__label">{line}</span>
                        </div>
                      )}
                    </For>
                  )}
                </Show>
                <div class="mp-set-row" data-league-fact="cut">
                  <span class="mp-set-row__label">
                    {nextCutLine(msUntilNextCut(now()))}
                  </span>
                </div>
              </SettingsGroup>

              <SettingsGroup title="Standings">
                <Show
                  when={(card().standings ?? []).length > 0}
                  fallback={
                    // The phone keeps no board (league-store.ts): a league
                    // from storage has none until the read lands.
                    card().standings === undefined ? (
                      <div
                        class="mp-set-row"
                        data-testid="league-board-loading"
                      >
                        <span class="mp-set-row__label">
                          {leagueReading()
                            ? 'Loading the standings'
                            : 'The standings show once this phone can reach them.'}
                        </span>
                      </div>
                    ) : (
                      <div class="mp-set-row" data-testid="league-empty">
                        <span class="mp-set-row__label">
                          Nobody has scored this week yet. Finish an exercise or
                          a challenge to open the board.
                        </span>
                      </div>
                    )
                  }
                >
                  <For each={leagueBoard(card(), leagueLadder())}>
                    {(item) =>
                      item.kind === 'line' ? (
                        <div
                          class="mp-league-line"
                          data-zone={item.zone}
                          data-league-line={item.zone}
                        >
                          <ChevronIcon size={16} />
                          <span>{boardLine(item.zone, item.to)}</span>
                        </div>
                      ) : (
                        <div
                          class="mp-league-row"
                          data-zone={item.zone}
                          data-league-row={item.row.rank}
                          data-you={
                            item.row.userId === getUserId() ? 'on' : undefined
                          }
                        >
                          <span class="mp-league-row__rank">
                            {item.row.rank}
                          </span>
                          {/* The name gives way to a long one; the You
                              beside it never does. */}
                          <span class="mp-league-row__name">
                            <span class="mp-league-row__text">
                              {item.row.displayName}
                            </span>
                            <Show when={item.row.userId === getUserId()}>
                              <span class="mp-league-row__you">You</span>
                            </Show>
                          </span>
                          <span class="mp-league-row__points">
                            {pointsWord(item.row.points)}
                          </span>
                        </div>
                      )
                    }
                  </For>
                </Show>
              </SettingsGroup>
            </>
          )}
        </Show>
      </Show>

      <Show when={ladder().length > 0}>
        <SettingsGroup title="The ladder">
          <For each={ladder()}>
            {(rung) => {
              const revealed = (): boolean => rungRevealed(rung, knownRank())
              return (
                <div
                  class="mp-league-rung"
                  data-league-rung={rung.rank}
                  data-current={rung.rank === myRank() ? 'on' : undefined}
                >
                  <img
                    class="mp-league-rung__art"
                    src={
                      revealed()
                        ? (rung.trophyAsset ?? LOCKED_TROPHY)
                        : LOCKED_TROPHY
                    }
                    alt=""
                    width="40"
                    height="40"
                  />
                  <span class="mp-league-rung__text">
                    <span class="mp-league-rung__name">{rungName(rung)}</span>
                    <Show when={rungLine(rung, myRank(), revealed())}>
                      {(line) => (
                        <span class="mp-league-rung__sub">{line()}</span>
                      )}
                    </Show>
                  </span>
                </div>
              )
            }}
          </For>
        </SettingsGroup>
      </Show>
    </div>
  )
}

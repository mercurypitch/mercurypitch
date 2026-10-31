// ============================================================
// MoreSheet — the fifth rail item, a grouped list that can grow
// ============================================================
//
// The kit's sheet holding an inset grouped list: Rooms, then You, with
// Settings last. Each row is a chip tinted by its group, the name, one line
// of what is true now (more-lines.ts), and a chevron. The tiles it replaces
// were four to a row at 11 px with a third of the sheet empty, and had no
// room for a fourth group.
//
// THE LINES READ STORES, NEVER THE NETWORK. Every line is a synchronous read
// of a signal some other part of the app keeps filled: the room library the
// boot seeds, the account card a sign-in kept, the falling-notes store. The
// sheet mounts its rows only while open (Sheet wraps them in a Show), so the
// reads cost nothing while it is closed and follow their stores while open.
//
// TOGETHER, ON ITS SWITCHES. Leagues, Legend and Community form a group
// between Rooms and You, each row behind a build switch in
// src/lib/native-build.ts (docs/plans/native-more-and-community.md). Leagues
// and Legend ride NATIVE_LEAGUES; with no switch on, the group is not drawn
// at all.
//
// A test build also gets Developer, because a TestFlight build has no
// devtools and a panel only a keyboard can reach is a panel the tester does
// not have. That tile once said "Console" and called
// `setupDeveloperConsole()`, which mounts a host for a floating panel that
// renders nothing while its own Settings toggle is off — so on the build it
// existed for, the tap did nothing, every time (device round 1, P3). It
// pushes the developer screen now. The floating console has no switch in
// this app's Settings (docs/agent/DEVICE-DEBUGGING.md, "Which console is in
// which build").
//
// THE ROOMS ARE TABS HERE, NOT DOORS. The web bar sends Karaoke, Piano and
// Guitar to `/karaoke`, `/piano-night` and `/guitar-night` — standalone HTML
// entries. This bundle has exactly one document (vite.config.ts forbids more),
// so those URLs are a 404 inside the WebView. The native sheet navigates to
// the in-app tabs instead.

import type { Component, JSX } from 'solid-js'
import { Show } from 'solid-js'
import { Sheet } from '@/components/mobile/Sheet'
import { importsInFlight, karaokeNewSongs, } from '@/features/karaoke-room/karaoke-import-queue'
import { roomLibrary } from '@/features/karaoke-room/karaoke-room-library'
import { TAB_GUITAR, TAB_KARAOKE, TAB_PIANO } from '@/features/tabs/constants'
import { API_BASE_URL, COMMIT_SHA } from '@/lib/defaults'
import { KARAOKE_IMPORT, NATIVE_LEAGUES } from '@/lib/native-build'
import { gameState, selectedSongName } from '@/stores/falling-notes-store'
import { savedMidiSongs } from '@/stores/saved-midi-songs-store'
import { AccountIcon, CalendarIcon, ChevronIcon, ConsoleIcon, GearIcon, GuitarIcon, KaraokeIcon, PianoIcon, TrophyIcon, } from './icons'
import { leagueCard, leagueReadThisWeek } from './leagues/league-store'
import { legendCard, legendStanding } from './legend/legend-store'
import { accountLine, developerLine, guitarLine, karaokeLine, leaguesLine, legendLine, pianoLine, settingsLine, } from './more-lines'
import { accountCard, accountProviderLine, accountSignedIn, } from './settings/account-state'
import { knownInput } from './settings/level-check'
import { goToTab } from './shell-navigation'

export interface MoreSheetProps {
  open: () => boolean
  onClose: () => void
  onPushSettings: () => void
  /** Account, with Settings under it. */
  onPushAccount: () => void
  onPushDeveloper: () => void
  /** Leagues, on a build with them (NATIVE_LEAGUES). */
  onPushLeagues: () => void
  /** The Legend room (NATIVE_LEAGUES). */
  onPushLegend: () => void
}

const DEVELOPER_AVAILABLE = import.meta.env.VITE_PORTABLE_CONSOLE === 'true'

type MoreTint = 'rooms' | 'together' | 'you'

interface MoreGroupProps {
  title: string
  tint: MoreTint
  children: JSX.Element
}

function MoreGroup(props: MoreGroupProps): JSX.Element {
  const titleId = (): string => `mp-more-${props.tint}`
  return (
    <section
      class={`mp-more-group mp-more-group--${props.tint}`}
      aria-labelledby={titleId()}
    >
      <h2 id={titleId()} class="mp-more-group__title">
        {props.title}
      </h2>
      <ul class="mp-more-list">{props.children}</ul>
    </section>
  )
}

interface MoreRowProps {
  /** `data-more-item`: what the tests, the probes and the shots tap. */
  id: string
  icon: JSX.Element
  name: string
  /** The one line of state under the name. */
  line: string
  /** Something new on the other side: a dot, never a number. */
  fresh?: boolean
  onPress: () => void
}

function MoreRow(props: MoreRowProps): JSX.Element {
  return (
    <li>
      <button
        type="button"
        class="mp-more-row"
        data-more-item={props.id}
        onClick={() => props.onPress()}
      >
        <span class="mp-more-row__chip" aria-hidden="true">
          {props.icon}
        </span>
        <span class="mp-more-row__text">
          <span class="mp-more-row__name">{props.name}</span>
          <span class="mp-more-row__state">{props.line}</span>
        </span>
        <Show when={props.fresh === true}>
          <span class="mp-more-row__dot" data-more-new="">
            <span class="mp-sr-only">New</span>
          </span>
        </Show>
        <ChevronIcon class="mp-more-row__chev" size={16} />
      </button>
    </li>
  )
}

/**
 * The singer's own songs, ready and not sung yet, that are still in the
 * library: a stale id (a song deleted elsewhere) is not new. A store build
 * imports nothing, and folds the read away with the constant.
 */
function unsungSongs(): number {
  if (!KARAOKE_IMPORT) return 0
  const fresh = karaokeNewSongs()
  if (fresh.length === 0) return 0
  const own = new Set(
    roomLibrary()
      .filter((song) => song.kind === 'yours')
      .map((song) => song.sessionId),
  )
  return fresh.filter((id) => own.has(id)).length
}

export const MoreSheet: Component<MoreSheetProps> = (props) => {
  const leaveTo = (run: () => void): void => {
    props.onClose()
    run()
  }

  const karaoke = (): string =>
    karaokeLine({
      ready: roomLibrary().length,
      separating: KARAOKE_IMPORT ? importsInFlight() : 0,
      unsung: unsungSongs(),
    })

  const account = (): string =>
    accountLine({
      signedIn: accountSignedIn(),
      name: accountCard()?.name ?? '',
      provider: accountProviderLine(),
    })

  return (
    <Sheet
      isOpen={props.open()}
      close={props.onClose}
      ariaLabel="More"
      class="mp-more"
    >
      <div class="mp-more-body">
        <MoreGroup title="Rooms" tint="rooms">
          <MoreRow
            id="karaoke"
            icon={<KaraokeIcon />}
            name="Karaoke"
            line={karaoke()}
            fresh={unsungSongs() > 0}
            onPress={() => leaveTo(() => goToTab(TAB_KARAOKE))}
          />
          <MoreRow
            id="piano"
            icon={<PianoIcon />}
            name="Piano"
            line={pianoLine(gameState() === 'paused', selectedSongName())}
            onPress={() => leaveTo(() => goToTab(TAB_PIANO))}
          />
          <MoreRow
            id="guitar"
            icon={<GuitarIcon />}
            name="Guitar"
            line={guitarLine(savedMidiSongs().length)}
            onPress={() => leaveTo(() => goToTab(TAB_GUITAR))}
          />
        </MoreGroup>

        {/* Together, on a build with any of its rows: a ternary, as
            Developer's is, so a store build carries no group, no row and
            no read of the league the row names (league-store.ts). The
            row's line is worked out inside the branch for the same
            reason: a closure outside it would keep the store alive. */}
        {NATIVE_LEAGUES ? (
          <MoreGroup title="Together" tint="together">
            <MoreRow
              id="leagues"
              icon={<TrophyIcon />}
              name="Leagues"
              line={leaguesLine({
                signedIn: accountSignedIn(),
                me: leagueCard(),
                thisWeek: leagueReadThisWeek(),
              })}
              onPress={() => leaveTo(props.onPushLeagues)}
            />
            <MoreRow
              id="legend"
              icon={<CalendarIcon />}
              name="Legend"
              line={legendLine({
                challenge: legendCard(),
                best: legendStanding()?.best ?? null,
                nowMs: Date.now(),
              })}
              onPress={() => leaveTo(props.onPushLegend)}
            />
          </MoreGroup>
        ) : null}

        <MoreGroup title="You" tint="you">
          <MoreRow
            id="account"
            icon={<AccountIcon />}
            name="Account"
            line={account()}
            onPress={() => leaveTo(props.onPushAccount)}
          />
          {/* A ternary, not a Show: the constant folds, so a store build
              keeps only the null arm and carries no row at all. Behind a
              Show the row's markup stayed in the bundle, never drawn. */}
          {DEVELOPER_AVAILABLE ? (
            <MoreRow
              id="developer"
              icon={<ConsoleIcon />}
              name="Developer"
              line={developerLine(COMMIT_SHA, API_BASE_URL)}
              onPress={() => leaveTo(props.onPushDeveloper)}
            />
          ) : null}
          <MoreRow
            id="settings"
            icon={<GearIcon />}
            name="Settings"
            line={settingsLine(knownInput() === 'denied')}
            onPress={() => leaveTo(props.onPushSettings)}
          />
        </MoreGroup>
      </div>
    </Sheet>
  )
}

// ============================================================
// CommunityScreen — what singers shared, and your own figures
// ============================================================
//
// Slice 4c of docs/plans/native-more-and-community.md, pushed from the More
// sheet's Together group. The web draws Community in CommunityShare.tsx, in
// web chrome with its modals and routing; this draws the same answers in
// the Settings stack's grouped list, from the same services: the public
// melodies and results (share-service.ts), and the signed-in singer's own
// figures, ProfileView's, from the same run-kinds module.
//
// Read-only. Nothing is posted or shared from the phone in this slice, and
// a melody has no Open: the web opens one in Compose, its editor, which the
// phone does not carry, and the Sing room sings only the singer's own
// melodies, chosen from its own song list. A result opens over the list
// (CommunityResultScreen.tsx), so Back leaves the result first. Back lands
// on the row that opened it, the list scrolled where it was and the row
// clear of the dock (list-place.ts), and asks the worker nothing: what was
// read is still here, and a block made from the result asked already.
//
// Every share by another singer ends in a "...", which opens the singer
// sheet with the share named in the report (slice 4b). The singer's own
// shares carry none. A singer blocked from here leaves both lists at once,
// the lists are read again, and the focus comes back to the "..." now at
// that place (sheet-focus.ts): each list is a board of its own. The foot
// carries the contact form, as the sheet does.
//
// Behind NATIVE_COMMUNITY, as a lazy chunk (NativeShell.tsx): a store build
// carries none of it.

import type { JSX } from 'solid-js'
import { createEffect, createMemo, For, on, onCleanup, onMount, Show, } from 'solid-js'
import './community.css'
import { SingerMoreButton, SingerMoreSpace, } from '@/components/moderation/SingerMoreButton'
import type { SharedMelodyView, SharedSessionView, } from '@/db/services/share-service'
import { getUserId } from '@/db/services/user-service'
import { focusLost } from '@/lib/focus-lost'
import { singerOfEntry, withoutBlocked } from '@/lib/singer-rows'
import { blockedSingerIds, ensureBlockedSingers, } from '@/stores/blocked-singers-store'
import { ChevronIcon, MoreIcon, WarnIcon } from '../icons'
import { pushScreen } from '../run-shell-store'
import { accountSignedIn } from '../settings/account-state'
import { signInOpen } from '../settings/sign-in-state'
import { COMMUNITY_EMPTY, COMMUNITY_FAILED, COMMUNITY_LOADING, MELODIES_EMPTY, melodyFacts, offlineWords, resultAverage, resultFacts, RESULTS_ABOUT, RESULTS_EMPTY, shareMoreLabel, } from './community-lines'
import type { CommunityBoard } from './community-store'
import { communityBoard, communityListTop, communityProblem, communityReading, forgetCommunityResult, openCommunityResult, openedResultId, refreshCommunity, viewerNow, } from './community-store'
import { CommunityContact } from './CommunityContact'
import { CommunityProfileCard } from './CommunityProfileCard'
import { revealRow, scrollerOf } from './list-place'

/** The singer behind a share who can be reported or blocked, or null. */
function actionableSinger(share: { userId?: string }): string | null {
  return singerOfEntry({ userId: share.userId }, getUserId())
}

/** The share is the reader's own: it says so, and offers no "...". */
function ownShare(share: { userId?: string }): boolean {
  return accountSignedIn() && share.userId === getUserId()
}

/** The end of a share's row: its "...", the You chip, or the room for one. */
function ShareEnd(props: {
  share: SharedMelodyView | SharedSessionView
  kind: 'melody' | 'session'
  roomForMore: boolean
}): JSX.Element {
  return (
    <Show
      when={actionableSinger(props.share)}
      fallback={
        props.roomForMore ? (
          <SingerMoreSpace class="mp-community-row__more" />
        ) : null
      }
    >
      {(userId) => (
        <SingerMoreButton
          subject={{
            userId: userId(),
            displayName: props.share.author,
            report: { kind: props.kind, id: props.share.id },
            // A block wants an answer given after it, not one out before.
            onBlocked: () => void refreshCommunity(true),
          }}
          icon={<MoreIcon size={22} />}
          label={shareMoreLabel(props.share)}
          class="mp-community-row__more"
        />
      )}
    </Show>
  )
}

/**
 * The line under a share's name, wrapping between its facts and never
 * inside one; the singer's name, the first, wraps where it must.
 */
function Facts(props: { parts: string[] }): JSX.Element {
  return (
    <span class="mp-community-row__sub">
      <For each={props.parts}>
        {(part, index) => (
          <>
            {index() > 0 ? ' ' : ''}
            <span class="mp-community-row__fact">
              {index() < props.parts.length - 1 ? `${part},` : part}
            </span>
          </>
        )}
      </For>
    </span>
  )
}

function YouChip(props: { share: { userId?: string } }): JSX.Element {
  return (
    <Show when={ownShare(props.share)}>
      <span class="mp-community-row__you">You</span>
    </Show>
  )
}

function MelodyRow(props: {
  melody: SharedMelodyView
  roomForMore: boolean
}): JSX.Element {
  return (
    <div class="mp-community-row" data-community-melody={props.melody.id}>
      <span class="mp-community-row__main">
        <span class="mp-community-row__text">
          <span class="mp-community-row__name">
            <span class="mp-community-row__title">{props.melody.name}</span>
            <YouChip share={props.melody} />
          </span>
          <Facts parts={melodyFacts(props.melody)} />
        </span>
      </span>
      <ShareEnd
        share={props.melody}
        kind="melody"
        roomForMore={props.roomForMore}
      />
    </div>
  )
}

function ResultRow(props: {
  result: SharedSessionView
  roomForMore: boolean
}): JSX.Element {
  return (
    <div class="mp-community-row" data-community-result={props.result.id}>
      <button
        type="button"
        class="mp-community-row__main mp-community-row__open"
        data-community-open={props.result.id}
        onClick={(event) => {
          const top = scrollerOf(event.currentTarget)?.scrollTop ?? 0
          openCommunityResult(props.result, top)
          pushScreen('community-result')
        }}
      >
        <span class="mp-community-row__text">
          <span class="mp-community-row__name">
            <span class="mp-community-row__title">{props.result.name}</span>
            <YouChip share={props.result} />
          </span>
          <Facts parts={resultFacts(props.result)} />
        </span>
        <span class="mp-community-row__score">
          {resultAverage(props.result)}%
        </span>
        <ChevronIcon class="mp-community-row__chev" size={16} />
      </button>
      <ShareEnd
        share={props.result}
        kind="session"
        roomForMore={props.roomForMore}
      />
    </div>
  )
}

/** One list, a board of its own for the singer sheet's focus. */
function ShareBoard(props: {
  board: 'community-melodies' | 'community-results'
  title: string
  about?: string
  empty: string
  count: number
  children: JSX.Element
}): JSX.Element {
  return (
    <section
      class="mp-set-group mp-community-board"
      data-singer-board={props.board}
      aria-labelledby={`${props.board}-title`}
    >
      <h2
        id={`${props.board}-title`}
        class="mp-set-group__title"
        data-singer-board-heading={props.board}
        tabindex="-1"
      >
        {props.title}
      </h2>
      <Show when={props.about}>
        {(about) => <p class="mp-set__caption">{about()}</p>}
      </Show>
      <Show
        when={props.count > 0}
        fallback={
          <p class="mp-set__caption" data-community-empty={props.board}>
            {props.empty}
          </p>
        }
      >
        <div class="mp-set-list">{props.children}</div>
      </Show>
    </section>
  )
}

/** The read that failed, or that the phone did not send, and Try again. */
function ProblemNote(props: { onRetry: () => void }): JSX.Element {
  const words = () =>
    communityProblem() === 'offline' ? offlineWords() : COMMUNITY_FAILED
  return (
    <Show when={communityProblem()}>
      <div
        class="mp-set-note mp-set-note--warn"
        role="status"
        data-testid="community-problem"
        data-problem={communityProblem() ?? undefined}
      >
        <WarnIcon size={20} />
        <p>
          <strong>{words().title}</strong> {words().body}
        </p>
      </div>
      {/* Not `disabled` while the read is out: a disabled button drops
          the focus it has. */}
      <button
        type="button"
        class="mp-set-button mp-set-button--secondary"
        data-testid="community-retry"
        aria-disabled={communityReading() ? 'true' : undefined}
        onClick={() => props.onRetry()}
      >
        Try again
      </button>
    </Show>
  )
}

export function CommunityScreen(): JSX.Element {
  let root: HTMLDivElement | undefined

  /** Give focus to the first thing that stands for what was read. */
  const focusFirst = (): void => {
    root?.querySelector<HTMLElement>('[data-community-focus]')?.focus()
  }

  /**
   * Back from a result: the list where it was, and the focus on the row
   * that opened it, whole between the bar and the dock.
   */
  const returnToRow = (id: string): void => {
    const scroller = scrollerOf(root ?? null)
    const top = communityListTop()
    if (scroller !== null && top !== null) scroller.scrollTop = top
    const rows = root?.querySelectorAll<HTMLElement>('[data-community-open]')
    const row = [...(rows ?? [])].find(
      (candidate) => candidate.getAttribute('data-community-open') === id,
    )
    if (row === undefined) return
    row.focus({ preventScroll: true })
    if (scroller !== null) revealRow(row, scroller)
  }

  onMount(() => {
    ensureBlockedSingers()
    const back = openedResultId()
    forgetCommunityResult()
    // Back from a result asks the worker nothing: the list it opened from
    // is still read. Only an account changed meanwhile reads again.
    if (back !== null && communityBoard() !== null) returnToRow(back)
    else void refreshCommunity()
  })

  // An account signed in or out here: what it may see is read for it. The
  // profile's Sign in went with the sign-in, and the focus with it: the
  // profile's name takes it once the read lands, or the sheet closes.
  // Keyed by the account, not the token: a token refreshed for the same
  // account reads nothing again.
  const viewer = createMemo(viewerNow)
  createEffect(
    on(
      viewer,
      () => {
        void refreshCommunity().then(() => {
          if (focusLost()) focusFirst()
        })
        ensureBlockedSingers()
      },
      { defer: true },
    ),
  )
  createEffect(
    on(
      signInOpen,
      (open) => {
        if (open) return
        queueMicrotask(() => {
          if (accountSignedIn() && focusLost()) focusFirst()
        })
      },
      { defer: true },
    ),
  )

  // Back online with the screen up: read what the phone did not send.
  const onOnline = (): void => {
    if (communityProblem() === 'offline') void refreshCommunity()
  }
  window.addEventListener('online', onOnline)
  onCleanup(() => window.removeEventListener('online', onOnline))

  const retry = (): void => {
    if (communityReading()) return
    // Try again went with the problem: the focus follows it, unless the
    // singer has put it somewhere else meanwhile.
    void refreshCommunity().then(() => {
      if (communityProblem() === null && focusLost()) focusFirst()
    })
  }

  /** What the last read found, a singer blocked from here gone at once. */
  const shown = createMemo((): CommunityBoard | null => {
    const board = communityBoard()
    const blocked = blockedSingerIds()
    if (board === null || blocked.size === 0) return board
    return {
      melodies: withoutBlocked(board.melodies, blocked, (row) => row.userId),
      results: withoutBlocked(board.results, blocked, (row) => row.userId),
    }
  })
  const melodies = (): SharedMelodyView[] => shown()?.melodies ?? []
  const results = (): SharedSessionView[] => shown()?.results ?? []
  const melodyRoom = createMemo(() =>
    melodies().some((melody) => actionableSinger(melody) !== null),
  )
  const resultRoom = createMemo(() =>
    results().some((result) => actionableSinger(result) !== null),
  )

  return (
    <div class="mp-set mp-community" data-testid="shell-community" ref={root}>
      <ProblemNote onRetry={retry} />

      <CommunityProfileCard />

      <Show
        when={shown()}
        fallback={
          <Show when={communityReading()}>
            <p
              class="mp-set__caption"
              role="status"
              data-testid="community-loading"
            >
              {COMMUNITY_LOADING}
            </p>
          </Show>
        }
      >
        <Show
          when={melodies().length + results().length > 0}
          fallback={
            <p
              class="mp-set__caption"
              data-testid="community-empty"
              data-singer-board-heading="community-melodies community-results"
              tabindex="-1"
            >
              {COMMUNITY_EMPTY}
            </p>
          }
        >
          <ShareBoard
            board="community-melodies"
            title="Melodies"
            empty={MELODIES_EMPTY}
            count={melodies().length}
          >
            <For each={melodies()}>
              {(melody) => (
                <MelodyRow melody={melody} roomForMore={melodyRoom()} />
              )}
            </For>
          </ShareBoard>
          <ShareBoard
            board="community-results"
            title="Results"
            about={RESULTS_ABOUT}
            empty={RESULTS_EMPTY}
            count={results().length}
          >
            <For each={results()}>
              {(result) => (
                <ResultRow result={result} roomForMore={resultRoom()} />
              )}
            </For>
          </ShareBoard>
        </Show>
      </Show>

      <CommunityContact />
    </div>
  )
}

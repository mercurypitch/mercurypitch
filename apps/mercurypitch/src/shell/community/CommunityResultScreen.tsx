// ============================================================
// CommunityResultScreen — a shared result, opened from Community's list
// ============================================================
//
// SharedRunResult's content (src/features/community/SharedRunResult.tsx),
// redrawn in the native kit: the result's name, who shared it and when, the
// average and each run's score, and what a shared result is not. Pushed
// over the list (ShellScreens.tsx), so the phone's Back and the bar's leave
// it for the list, whose row that opened it takes the focus back.
//
// The result is the one the list read (community-store.ts): nothing is
// asked of the worker here. Its singer, when it is not the reader, has the
// "..." that reports the result or blocks them. Blocked from here, the
// result is hidden at once and the list is read again; the focus goes to
// the screen's heading, the board's (sheet-focus.ts).

import type { JSX } from 'solid-js'
import { For, Show, untrack } from 'solid-js'
import './community.css'
import { SingerMoreButton } from '@/components/moderation/SingerMoreButton'
import type { SharedSessionView } from '@/db/services/share-service'
import { getUserId } from '@/db/services/user-service'
import { singerOfEntry } from '@/lib/singer-rows'
import { blockedSingerIds } from '@/stores/blocked-singers-store'
import { MoreIcon } from '../icons'
import { RESULT_BLOCKED, RESULT_GONE, RESULT_NOTE, resultAverage, sharedOn, } from './community-lines'
import { openedResult, refreshCommunity } from './community-store'
import { CommunityContact } from './CommunityContact'

const BOARD = 'community-result'

function ResultBody(props: { result: SharedSessionView }): JSX.Element {
  const singer = (): string | null =>
    singerOfEntry({ userId: props.result.userId }, getUserId())
  const runs = (): number => props.result.results.length
  return (
    <>
      <div class="mp-community-result__by">
        <p class="mp-community-result__line">
          by {props.result.author}, {sharedOn(props.result.date)}
        </p>
        <Show when={singer()}>
          {(userId) => (
            <SingerMoreButton
              subject={{
                userId: userId(),
                displayName: props.result.author,
                report: { kind: 'session', id: props.result.id },
                onBlocked: () => void refreshCommunity(true),
              }}
              icon={<MoreIcon size={22} />}
              class="mp-community-result__more"
            />
          )}
        </Show>
      </div>
      <div class="mp-community-result__average">
        <span class="mp-community-result__score">
          {resultAverage(props.result)}%
        </span>
        <span class="mp-community-result__of">
          {runs() === 1 ? 'from 1 run' : `on average, from ${runs()} runs`}
        </span>
      </div>
      <section class="mp-set-group" aria-labelledby="community-result-scores">
        <h3 id="community-result-scores" class="mp-set-group__title">
          Each run
        </h3>
        <ul class="mp-community-scores" aria-label="Shared scores">
          <For each={props.result.results}>
            {(score) => <li class="mp-community-scores__score">{score}%</li>}
          </For>
        </ul>
      </section>
      <p class="mp-set__caption">{RESULT_NOTE}</p>
    </>
  )
}

export function CommunityResultScreen(): JSX.Element {
  // The result as it was opened, so a block can still say whose it was.
  const opened = untrack(openedResult)
  const blocked = (): boolean =>
    opened !== null && blockedSingerIds().has(opened.userId)
  const result = (): SharedSessionView | null =>
    blocked() ? null : openedResult()

  const heading = (): string => {
    if (blocked()) return 'Result hidden'
    return result()?.name ?? 'Result not found'
  }

  return (
    <div
      class="mp-set mp-community mp-community-result"
      data-testid="shell-shared-result"
      data-singer-board={BOARD}
    >
      {/* The bar already says it is a shared result: the heading is its
          name, and the board's, where a block hands the focus. */}
      <h2
        class="mp-community-result__name"
        data-singer-board-heading={BOARD}
        tabindex="-1"
      >
        {heading()}
      </h2>
      <Show
        when={result()}
        fallback={
          <p class="mp-set__caption" data-testid="community-result-gone">
            {blocked() ? RESULT_BLOCKED : RESULT_GONE}
          </p>
        }
      >
        {(shown) => <ResultBody result={shown()} />}
      </Show>
      <CommunityContact />
    </div>
  )
}

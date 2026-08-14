// ============================================================
// Friend requests — the answer half of the friend graph
// ============================================================
//
// A request is addressed to you but owned by the person who sent it, so it
// appears on no board and in no list of yours until you answer it. This panel
// is the only place it exists on screen, which is why it renders above the
// board rather than inside it.
//
// It says what accepting does, in the sentence next to the button. Accepting
// opens your streak, scores and practice counts to that singer and theirs to
// you — the singer pressing it is making a privacy decision, and a bare
// "Accept" would not tell them so.

import type { Component } from 'solid-js'
import { createSignal, For, Show } from 'solid-js'
import { CheckCircle } from '@/components/icons'
import type { FriendRequest } from '@/db/services/follow-service'
import { IconCloseSimple } from '../hidden-features-icons'
import styles from './FriendRequests.module.css'

export interface FriendRequestsProps {
  requests: FriendRequest[]
  /** Resolve when the graph has been re-read, so the row can stay disabled. */
  onAccept: (userId: string) => Promise<void>
  onDecline: (userId: string) => Promise<void>
}

export const FriendRequests: Component<FriendRequestsProps> = (props) => {
  // Which row is mid-answer. Held per singer rather than as one flag: two
  // requests answered quickly are independent, and a shared flag would freeze
  // the second one behind the first.
  const [busy, setBusy] = createSignal<ReadonlySet<string>>(new Set())

  const isBusy = (userId: string): boolean => busy().has(userId)

  // `disabled` on both buttons is what stops a second answer landing on top
  // of the first — an accept followed by a stray decline would send a remove
  // that quietly undoes it.
  async function answer(
    userId: string,
    action: (userId: string) => Promise<void>,
  ): Promise<void> {
    setBusy((current) => new Set(current).add(userId))
    try {
      await action(userId)
    } catch (err) {
      // The parent reports its own failures — it returns a result rather than
      // throwing. A throw is a bug up there, and letting it escape as an
      // unhandled rejection would leave this row disabled forever.
      console.error('[friends] answering a request failed', err)
    } finally {
      setBusy((current) => {
        const next = new Set(current)
        next.delete(userId)
        return next
      })
    }
  }

  return (
    <Show when={props.requests.length > 0}>
      <section
        class={styles.panel}
        data-testid="friend-requests"
        aria-label="Friend requests"
      >
        <h3 class={styles.title}>
          {props.requests.length === 1
            ? 'One singer wants to be friends'
            : `${props.requests.length} singers want to be friends`}
        </h3>
        <p class={styles.note}>
          Accepting shares your streak and scores with them, and theirs with
          you.
        </p>
        <ul class={styles.list}>
          <For each={props.requests}>
            {(request) => (
              <li class={styles.item}>
                <span class={styles.name}>{request.displayName}</span>
                <span class={styles.actions}>
                  <button
                    type="button"
                    class={styles.accept}
                    disabled={isBusy(request.userId)}
                    aria-label={`Accept ${request.displayName}`}
                    onClick={() => void answer(request.userId, props.onAccept)}
                  >
                    <CheckCircle /> Accept
                  </button>
                  <button
                    type="button"
                    class={styles.button}
                    disabled={isBusy(request.userId)}
                    aria-label={`Decline ${request.displayName}`}
                    onClick={() => void answer(request.userId, props.onDecline)}
                  >
                    <IconCloseSimple /> Decline
                  </button>
                </span>
              </li>
            )}
          </For>
        </ul>
      </section>
    </Show>
  )
}

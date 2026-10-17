// ============================================================
// UnlockChip: the badges a take earned, under the room's result
// ============================================================
//
// The room's half of room-unlocks.ts. Mount it once in the room's head, for
// the room's whole life, beside whatever shows the result: mounting it is
// the claim, so it must not come and go with the result. It draws nothing
// until the result is up and something was earned.
//
// One unlock is a label: its medallion and "New badge: Steady Hold". Two or
// more are a button, "2 new badges", and a tap opens the list under it,
// each with its medallion and name (owner, 17 Oct 2026). The words are
// unlock-copy.ts's, shared with the native shell's pill.
//
// The region is always in the tree so a screen reader hears the chip when
// it fills; its contents come and go.

import type { JSX } from 'solid-js'
import { createEffect, createSignal, For, on, Show } from 'solid-js'
import { ChevronDown } from '@/components/icons'
import { badgeArtSrc } from '@/features/challenges/badge-art'
import type { UnlockItem } from '@/lib/unlock-copy'
import { unlockSummary } from '@/lib/unlock-copy'
import { createRoomUnlocks } from './room-unlocks'
import styles from './UnlockChip.module.css'

export interface UnlockChipProps {
  /** The room shows a take's own result now (not a demo's). */
  atResult: boolean
  testId: string
}

/** A medallion where one is drawn; otherwise a plain gold disc. */
function Medal(props: { item: UnlockItem }): JSX.Element {
  return (
    <Show
      when={badgeArtSrc(props.item.icon)}
      fallback={<span class={styles.disc} aria-hidden="true" />}
    >
      {(src) => (
        <img
          class={styles.art}
          src={src()}
          width="192"
          height="192"
          alt=""
          decoding="async"
        />
      )}
    </Show>
  )
}

export function UnlockChip(props: UnlockChipProps): JSX.Element {
  const unlocks = createRoomUnlocks(() => props.atResult)
  const [open, setOpen] = createSignal(false)
  const items = unlocks.items
  const listId = `${props.testId}-list`

  // A fresh set starts folded.
  createEffect(
    on(
      () => items().length === 0,
      (empty) => {
        if (empty) setOpen(false)
      },
    ),
  )

  return (
    <div
      class={styles.region}
      role="status"
      aria-atomic="true"
      data-testid={props.testId}
    >
      <Show when={items().length > 0}>
        <Show
          when={items().length > 1}
          fallback={
            <span class={styles.chip} data-testid={`${props.testId}-chip`}>
              <Medal item={items()[0]!} />
              <span class={styles.text}>{unlockSummary(items())}</span>
            </span>
          }
        >
          <button
            type="button"
            class={`${styles.chip} ${styles.button}`}
            aria-expanded={open()}
            aria-controls={listId}
            data-testid={`${props.testId}-chip`}
            onClick={() => setOpen((was) => !was)}
          >
            <Medal item={items()[0]!} />
            <span class={styles.text}>{unlockSummary(items())}</span>
            <span
              class={styles.chevron}
              classList={{ [styles.chevronOpen]: open() }}
              aria-hidden="true"
            >
              <ChevronDown size={16} />
            </span>
          </button>
          <Show when={open()}>
            <ul
              id={listId}
              class={styles.list}
              data-testid={`${props.testId}-list`}
            >
              <For each={items()}>
                {(item) => (
                  <li class={styles.row}>
                    <Medal item={item} />
                    <span class={styles.text}>{item.name}</span>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </Show>
      </Show>
    </div>
  )
}

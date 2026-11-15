// ============================================================
// TakeNotice — the voice take's notice, popped out of Merc's bubble
// ============================================================
//
// After a run, the question of keeping its voice take used to be a block in
// the result card, with two full-width buttons over Try Again. It is a
// notice on the stage now, in the one place where the stage speaks: it lies
// over Merc's bubble, with Merc beside it as an iOS banner has its app's icon
// beside it, and it pops rather than pushes, so nothing in the layout moves
// when it comes or goes (StageCoach.tsx places it, take-notice.ts writes it).
//
// The region it appears in is a polite live region that is there for the
// whole visit, so what the notice says is read when it arrives and when it
// changes. Its buttons take Space for themselves (the shell's Space starts a
// run from anywhere else), and focus is never moved to it. Focus that is
// already on it is kept there: the capsule stays focusable while a keep is
// written, and when it goes ("Take kept" has none) the close takes over,
// so a keyboard is not dropped back to the top of the page for pressing Keep.

import type { JSX } from 'solid-js'
import { createEffect, createSignal, onCleanup, Show, untrack } from 'solid-js'
import { IconCheck, IconCross } from '@/components/exercise-icons'
import type { TakeNotice as TakeNoticeModel } from './take-notice'
import styles from './TakeNotice.module.css'

/** The exit, matched by `.leaving` in TakeNotice.module.css. */
export const TAKE_NOTICE_EXIT_MS = 160

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  if (typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export interface TakeNoticeProps {
  /** What the notice says now; null when it has nothing to say. */
  notice: () => TakeNoticeModel | null
  /** The capsule: Keep, or Retry. */
  onPrimary: () => void
  /** The close: discard the take, or dismiss "Take kept". */
  onClose: () => void
}

export function TakeNotice(props: TakeNoticeProps): JSX.Element {
  // What is on screen: the notice, kept through its exit.
  const [shown, setShown] = createSignal<TakeNoticeModel | null>(null)
  const [leaving, setLeaving] = createSignal(false)
  let exit: ReturnType<typeof setTimeout> | undefined
  let capsule: HTMLButtonElement | undefined
  let closer: HTMLButtonElement | undefined

  createEffect(() => {
    const next = props.notice()
    clearTimeout(exit)
    exit = undefined
    if (next !== null) {
      // Read before the capsule is taken away: a removed element has
      // already lost the focus by the time anything can ask.
      const handOver =
        next.primary === null &&
        capsule !== undefined &&
        document.activeElement === capsule
      setShown(next)
      setLeaving(false)
      if (handOver) queueMicrotask(() => closer?.focus())
      return
    }
    if (untrack(shown) === null) return
    if (prefersReducedMotion()) {
      setShown(null)
      setLeaving(false)
      return
    }
    setLeaving(true)
    exit = setTimeout(() => {
      exit = undefined
      setShown(null)
      setLeaving(false)
    }, TAKE_NOTICE_EXIT_MS)
  })
  onCleanup(() => clearTimeout(exit))

  // A notice on its way out takes no more presses.
  const pressPrimary = (): void => {
    if (!leaving() && shown()?.primaryBusy !== true) props.onPrimary()
  }
  const pressClose = (): void => {
    if (!leaving()) props.onClose()
  }

  return (
    <div class={styles.slot} role="status" aria-live="polite">
      <Show when={shown()}>
        {(notice) => (
          <div
            class={styles.notice}
            classList={{ [styles.leaving]: leaving() }}
            data-tone={notice().tone}
            data-kind={notice().kind}
            data-testid="exercise-take-notice"
          >
            <p class={styles.words}>
              <strong class={styles.title}>
                <Show when={notice().kind === 'kept'}>
                  <span class={styles.check} aria-hidden="true">
                    <IconCheck size={14} />
                  </span>
                </Show>
                {notice().title}
              </strong>
              <span class={styles.line}>{notice().line}</span>
            </p>
            <div class={styles.actions}>
              <Show when={notice().primary}>
                {(label) => (
                  <button
                    ref={capsule}
                    type="button"
                    class={styles.keep}
                    data-exercise-native-space="true"
                    // Busy, not disabled: a disabled button drops the focus
                    // it was pressed with.
                    aria-disabled={notice().primaryBusy ? 'true' : undefined}
                    onClick={pressPrimary}
                  >
                    {label()}
                  </button>
                )}
              </Show>
              <Show when={notice().close}>
                {(label) => (
                  <button
                    ref={closer}
                    type="button"
                    class={styles.close}
                    aria-label={label()}
                    title={label()}
                    data-exercise-native-space="true"
                    onClick={pressClose}
                  >
                    <IconCross size={16} />
                  </button>
                )}
              </Show>
            </div>
          </div>
        )}
      </Show>
    </div>
  )
}

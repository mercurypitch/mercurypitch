// ============================================================
// StageNotice — a notice popped out of Merc's bubble
// ============================================================
//
// The drill stage speaks in one place, Merc's bubble, and a notice lies over
// it, with Merc beside it as an iOS banner has its app's icon beside it. It
// pops rather than pushes, so nothing in the layout moves when it comes or
// goes (StageCoach.tsx places it). Two things say one (stage-notice.ts): the
// voice take's question after a run, and, in the web build, the app's own
// notices, achievements among them, which the stage presents in place of
// the toasts.
//
// One notice is up at a time. A new one pops in over the last as that one
// leaves; the same one with new words changes in place, so a button that
// holds the focus keeps it. Where the notice allows (the app's do, the
// take's does not: its close throws the take away), a tap on its words
// dismisses it, and so does an upward swipe, which it follows.
//
// The calm notices speak through a polite live region that is there for the
// whole visit, so what one says is read when it arrives and when it
// changes; an error is an alert. The buttons take Space for themselves (the
// shell's Space starts a run from anywhere else), and focus is never moved
// to a notice. Focus that is already on one is kept there: a capsule stays
// focusable while it is busy, and when it goes ("Take kept" has none) the
// close takes over, so a keyboard is not dropped back to the top of the
// page for pressing Keep.

import type { Accessor, JSX, Setter } from 'solid-js'
import { createEffect, createSignal, For, Index, on, onCleanup, onMount, Show, untrack, } from 'solid-js'
import { IconCheck, IconCross } from '@/components/exercise-icons'
import { NotificationIcon } from '@/components/Notifications'
import type { Notification } from '@/stores/notifications-store'
import type { StageNoticeMark, StageNoticeModel } from './stage-notice'
import { linesThatFit, NOTICE_CONTROL_GAP_PX } from './stage-notice'
import styles from './StageNotice.module.css'

/** The exit, matched by `.leaving` in StageNotice.module.css. */
export const STAGE_NOTICE_EXIT_MS = 160

/** How far up a drag has to travel to throw the notice away. */
export const SWIPE_DISMISS_PX = 24

/** A drag shorter than this is still a tap. */
const TAP_SLOP_PX = 6

/** While a notice is up, the controls under it are measured this often. */
const REMEASURE_MS = 250

/** Everything a tap can reach, for a notice to end above. */
const TAPPABLE =
  'button, a[href], input, select, textarea, summary, [role="button"], ' +
  '[role="link"], [role="tab"], [role="switch"], [role="slider"], ' +
  '[tabindex]:not([tabindex="-1"])'

/**
 * From a notice's top edge to the first control under it that a tap would
 * reach, less a small gap; unbounded where there is none. The notice's
 * own place (`data-notice-place`: Merc's bubble, which it lies over by
 * design) does not count, nor does what stands beside or above the
 * notice's top (the header).
 * Read from the layout, not the painted box, so the pop's scale and a
 * swipe do not move the answer.
 */
function roomBelow(notice: HTMLElement): number {
  const host = notice.offsetParent
  const place = notice.closest('[data-notice-place]')
  if (!(host instanceof HTMLElement) || place === null) return Infinity
  const at = host.getBoundingClientRect()
  const top = at.top + notice.offsetTop
  const left = at.left + notice.offsetLeft
  const right = left + notice.offsetWidth
  let limit = Infinity
  for (const el of document.querySelectorAll<HTMLElement>(TAPPABLE)) {
    if (place.contains(el)) continue
    const r = el.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) continue
    if (r.right <= left || r.left >= right || r.top <= top) continue
    if (r.top >= limit || !reachable(el, r)) continue
    limit = r.top
  }
  return limit - top - NOTICE_CONTROL_GAP_PX
}

/** Whether a tap on a control's centre lands on it (and not on a sheet
 *  over it); a document with no hit-testing (jsdom) counts every one. */
function reachable(el: HTMLElement, r: DOMRect): boolean {
  if (typeof document.elementsFromPoint !== 'function') return true
  const x = r.left + r.width / 2
  const y = r.top + r.height / 2
  if (x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight)
    return true
  const hit = document
    .elementsFromPoint(x, y)
    .find((under) => under.closest('[data-notice-place]') === null)
  return hit === undefined || el.contains(hit)
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  if (typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** One notice on screen, kept through its exit. */
interface Entry {
  readonly model: Accessor<StageNoticeModel>
  readonly setModel: Setter<StageNoticeModel>
  readonly leaving: Accessor<boolean>
  readonly setLeaving: Setter<boolean>
  /** Its first capsule and its close, for handing the focus over. */
  readonly els: { capsule?: HTMLButtonElement; closer?: HTMLButtonElement }
}

export interface StageNoticeProps {
  /** What the bubble shows as a notice now; null when it says its own. */
  notice: () => StageNoticeModel | null
}

export function StageNotice(props: StageNoticeProps): JSX.Element {
  const [entries, setEntries] = createSignal<readonly Entry[]>([])
  const exits = new Map<Entry, ReturnType<typeof setTimeout>>()

  const retire = (entry: Entry): void => {
    const gone = (): void => {
      exits.delete(entry)
      setEntries((list) => list.filter((other) => other !== entry))
    }
    if (prefersReducedMotion()) {
      gone()
      return
    }
    entry.setLeaving(true)
    exits.set(entry, setTimeout(gone, STAGE_NOTICE_EXIT_MS))
  }

  createEffect(() => {
    const next = props.notice()
    const list = untrack(entries)
    const current = list.find((entry) => !untrack(entry.leaving))
    if (next !== null && current !== undefined) {
      const was = untrack(current.model)
      if (was.key === next.key) {
        // Read before the capsule is taken away: a removed element has
        // already lost the focus by the time anything can ask.
        const capsule = current.els.capsule
        const handOver =
          next.actions.length === 0 &&
          capsule !== undefined &&
          document.activeElement === capsule
        current.setModel(() => next)
        if (handOver) queueMicrotask(() => current.els.closer?.focus())
        return
      }
    }
    if (current !== undefined) retire(current)
    if (next === null) return
    // The same notice back before it had gone stays the one on screen,
    // rather than a second copy of it popping in over its own exit.
    const back = list.find(
      (entry) =>
        untrack(entry.leaving) && untrack(entry.model).key === next.key,
    )
    if (back !== undefined) {
      clearTimeout(exits.get(back))
      exits.delete(back)
      back.setModel(() => next)
      back.setLeaving(false)
      return
    }
    const [model, setModel] = createSignal(next)
    const [leaving, setLeaving] = createSignal(false)
    setEntries((all) => [
      ...all,
      { model, setModel, leaving, setLeaving, els: {} },
    ])
  })
  onCleanup(() => {
    for (const exit of exits.values()) clearTimeout(exit)
  })

  const calm = (): readonly Entry[] =>
    entries().filter((entry) => !entry.model().alert)
  const alerts = (): readonly Entry[] =>
    entries().filter((entry) => entry.model().alert)

  return (
    <div class={styles.slot}>
      <div class={styles.region} role="status" aria-live="polite">
        <For each={calm()}>{(entry) => banner(entry)}</For>
      </div>
      <For each={alerts()}>{(entry) => banner(entry)}</For>
    </div>
  )
}

/** The type's mark in a disc of its colour, or a badge's medallion. */
function Mark(props: { mark: StageNoticeMark }): JSX.Element {
  const art = (): string | null =>
    props.mark.kind === 'art' ? props.mark.src : null
  const type = (): Notification['type'] =>
    props.mark.kind === 'type' ? props.mark.type : 'success'
  return (
    <Show
      when={art()}
      fallback={
        <span class={styles.mark} aria-hidden="true">
          <NotificationIcon type={type()} />
        </span>
      }
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

/** One notice on screen, for the whole of its life there: each `For` row
 *  is one entry, so this runs once per notice and owns what it starts. */
function banner(entry: Entry): JSX.Element {
  const model = entry.model
  // The drag of a swipe, up (negative) and a little way down, in px.
  const [drag, setDrag] = createSignal(0)
  const [dragging, setDragging] = createSignal(false)
  const [swiped, setSwiped] = createSignal(false)
  let startY: number | null = null
  let moved = false

  // A notice on its way out takes no more presses.
  const live = (): boolean => !entry.leaving()

  // It ends above the first control under it: where its whole message
  // would reach one, the message keeps as many lines as fit
  // (stage-notice.ts `linesThatFit`). Written to the element itself, so
  // that it can be undone and measured whole within one frame.
  let box: HTMLDivElement | undefined
  let lineEl: HTMLSpanElement | undefined
  const fit = (): void => {
    if (box === undefined || lineEl === undefined || !live()) return
    box.removeAttribute('data-clamped')
    box.style.removeProperty('--notice-lines')
    const lineHeight = parseFloat(window.getComputedStyle(lineEl).lineHeight)
    if (!(lineHeight > 0)) return
    const keep = linesThatFit({
      height: box.offsetHeight,
      room: roomBelow(box),
      lineHeight,
      lines: Math.round(lineEl.offsetHeight / lineHeight),
    })
    if (keep === null) return
    box.setAttribute('data-clamped', '')
    box.style.setProperty('--notice-lines', String(keep))
  }
  onMount(() => {
    fit()
    const timer = setInterval(fit, REMEASURE_MS)
    window.addEventListener('resize', fit)
    onCleanup(() => {
      clearInterval(timer)
      window.removeEventListener('resize', fit)
    })
  })
  createEffect(on(model, fit, { defer: true }))

  const onPointerDown = (event: PointerEvent): void => {
    if (model().dismiss === null || !live()) return
    startY = event.clientY
    moved = false
    const words = event.currentTarget as HTMLElement
    words.setPointerCapture?.(event.pointerId)
  }
  const onPointerMove = (event: PointerEvent): void => {
    if (startY === null) return
    const dy = event.clientY - startY
    if (Math.abs(dy) > TAP_SLOP_PX) {
      moved = true
      setDragging(true)
    }
    // Up it follows the finger; down it gives a little and no more.
    setDrag(dy < 0 ? dy : Math.min(8, dy / 4))
  }
  const onPointerEnd = (): void => {
    if (startY === null) return
    startY = null
    setDragging(false)
    if (drag() <= -SWIPE_DISMISS_PX && live()) {
      setSwiped(true)
      model().dismiss?.()
      return
    }
    setDrag(0)
  }
  const onWordsClick = (): void => {
    if (moved) {
      moved = false
      return
    }
    if (live()) model().dismiss?.()
  }

  return (
    <div
      ref={box}
      class={styles.notice}
      classList={{
        [styles.leaving]: entry.leaving(),
        [styles.dragging]: dragging(),
      }}
      role={model().alert ? 'alert' : undefined}
      data-source={model().source}
      data-tone={model().tone}
      data-kind={model().kind}
      data-capsules={model().actions.length}
      data-swiped={swiped() ? 'true' : undefined}
      data-testid={model().testId}
      style={{ '--notice-drag': `${drag()}px` }}
    >
      <Show when={model().mark}>{(mark) => <Mark mark={mark()} />}</Show>
      <p
        class={styles.words}
        classList={{ [styles.dismissible]: model().dismiss !== null }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClick={onWordsClick}
      >
        <Show when={model().title}>
          {(title) => (
            <strong class={styles.title}>
              <Show when={model().checked}>
                <span class={styles.check} aria-hidden="true">
                  <IconCheck size={14} />
                </span>
              </Show>
              {title()}
            </strong>
          )}
        </Show>
        <Show when={model().line}>
          {(line) => (
            <span ref={lineEl} class={styles.line}>
              <Show when={model().subject}>
                {(subject) => (
                  <strong class={styles.subject}>{subject()} </strong>
                )}
              </Show>
              {line()}
            </span>
          )}
        </Show>
      </p>
      <Show when={model().actions.length > 0}>
        <div class={styles.actions}>
          <Index each={model().actions}>
            {(action, index) => (
              <button
                ref={(el) => {
                  if (index === 0) entry.els.capsule = el
                }}
                type="button"
                class={styles.capsule}
                classList={{ [styles.quiet]: index > 0 }}
                data-exercise-native-space="true"
                // Busy, not disabled: a disabled button drops the focus
                // it was pressed with.
                aria-disabled={action().busy ? 'true' : undefined}
                onClick={() => {
                  if (live() && !action().busy) action().press()
                }}
              >
                {action().label}
              </button>
            )}
          </Index>
        </div>
      </Show>
      <Show when={model().close}>
        {(close) => (
          <button
            ref={(el) => {
              entry.els.closer = el
            }}
            type="button"
            class={styles.close}
            aria-label={close().label}
            title={close().label}
            data-exercise-native-space="true"
            onClick={() => {
              if (live()) close().press()
            }}
          >
            <IconCross size={16} />
          </button>
        )}
      </Show>
    </div>
  )
}

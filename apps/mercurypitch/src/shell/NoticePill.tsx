// ============================================================
// NoticePill — the native app's notices, one at a time, under the status bar
// ============================================================
//
// The web draws its notices as toasts, and on a phone it stacks them at the
// bottom, above the tab bar (Notifications.module.css says why the top and
// the row below the header both failed there). In the native app that strip
// is the dock, and in a premium room it is the room's own controls: two
// badges earned in one take stacked over them (owner, 17 Oct 2026). So the
// native shell draws the same store differently:
//
//   - one notice at a time, the rest queued (the store's `pill` presenter);
//   - centred under the status bar, between the header's controls, and
//     below them where the header has no gap to spare (notice-pill-place.ts);
//   - unlocks from the same moment merged into one pill, with a medallion
//     and the names on a second line;
//   - a tap or an upward swipe dismisses it, and a notice with an action
//     keeps its button at 44 px;
//   - a light haptic when an unlock arrives (NativeShell listens).
//
// Nothing here is new to the callers: `showNotification` is unchanged, and
// the web's `<Notifications />` is simply not mounted in this build.

import type { Component, JSX } from 'solid-js'
import { createEffect, createSignal, Match, on, onCleanup, onMount, Show, Switch, } from 'solid-js'
import { AlertTriangle, CheckCircle, XCircle } from '@/components/icons'
import { badgeArtSrc } from '@/lib/badge-art'
import { unlockNames } from '@/lib/unlock-copy'
import type { Notification } from '@/stores/notifications-store'
import { notifications, removeNotification, unlockShown, } from '@/stores/notifications-store'
import type { Box } from './notice-pill-place'
import { placePill } from './notice-pill-place'

/** How far up a drag has to travel to throw the pill away. */
const SWIPE_DISMISS_PX = 24
/** A drag shorter than this is still a tap. */
const TAP_SLOP_PX = 6
/** The exit, matched by `.mp-notice-pill.is-leaving` in shell.css. */
const EXIT_MS = 180
/** While a pill is up, the screen under it is measured again this often. */
const REMEASURE_MS = 250

/** Everything a tap can reach, for the pill to keep clear of. */
const TAPPABLE =
  'button, a[href], input, select, textarea, summary, [role="button"], ' +
  '[role="link"], [role="tab"], [role="switch"], [role="slider"], ' +
  '[tabindex]:not([tabindex="-1"])'

/**
 * The controls on screen that a tap would reach: each one counts only if it
 * is what a tap on its own centre lands on. A header that has left (its
 * controls drop pointer events), a screen pushed over another, a control
 * under a sheet: none of those is in the way, and none of them is counted.
 */
function tappableBoxes(pill: HTMLElement): Box[] {
  const width = window.innerWidth
  const height = window.innerHeight
  const boxes: Box[] = []
  for (const el of document.querySelectorAll<HTMLElement>(TAPPABLE)) {
    if (pill.contains(el)) continue
    const r = el.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) continue
    if (r.bottom <= 0 || r.top >= height || r.right <= 0 || r.left >= width)
      continue
    const x = Math.min(Math.max(r.left + r.width / 2, 0), width - 1)
    const y = Math.min(Math.max(r.top + r.height / 2, 0), height - 1)
    // A document with no hit-testing (jsdom) counts every visible control.
    if (typeof document.elementsFromPoint === 'function') {
      const hit = document
        .elementsFromPoint(x, y)
        .find((under) => !pill.contains(under))
      if (hit === undefined || !el.contains(hit)) continue
    }
    boxes.push({ left: r.left, top: r.top, right: r.right, bottom: r.bottom })
  }
  return boxes
}

const TypeIcon: Component<{ type: Notification['type'] }> = (props) => (
  <Switch>
    <Match when={props.type === 'success'}>
      <CheckCircle />
    </Match>
    <Match when={props.type === 'warning'}>
      <AlertTriangle />
    </Match>
    <Match when={props.type === 'error'}>
      <XCircle />
    </Match>
    <Match when={props.type === 'info'}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <line x1="12" y1="11" x2="12" y2="16" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    </Match>
  </Switch>
)

/** The pill's leading mark: the first unlock's medallion, or the type's icon. */
const Mark: Component<{ notice: Notification }> = (props) => {
  const art = (): string | undefined =>
    badgeArtSrc(props.notice.unlocks?.[0]?.icon)
  return (
    <Show
      when={art()}
      fallback={
        <span class="mp-notice-pill__icon" aria-hidden="true">
          <TypeIcon type={props.notice.type} />
        </span>
      }
    >
      {(src) => (
        <img
          class="mp-notice-pill__art"
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

export const NoticePill: Component = () => {
  /** What the pill shows: the store's one visible notice, kept while it leaves. */
  const [shown, setShown] = createSignal<Notification | undefined>()
  const [leaving, setLeaving] = createSignal(false)
  const [place, setPlace] = createSignal<{
    top: number
    left: number
    width: number
    docked: 'top' | 'below'
  } | null>(null)
  const [drag, setDrag] = createSignal(0)
  let pill: HTMLDivElement | undefined
  let safe: HTMLDivElement | undefined
  let exitTimer: ReturnType<typeof setTimeout> | undefined

  createEffect(
    on(
      () => notifications()[0],
      (next) => {
        if (exitTimer !== undefined) clearTimeout(exitTimer)
        exitTimer = undefined
        if (next !== undefined) {
          const fresh = next.id !== shown()?.id
          setShown(next)
          setLeaving(false)
          if (fresh) {
            setDrag(0)
            setPlace(null)
            if (next.unlocks !== undefined) unlockShown()
          }
          return
        }
        if (shown() === undefined) return
        setLeaving(true)
        exitTimer = setTimeout(() => {
          exitTimer = undefined
          setShown(undefined)
          setLeaving(false)
          setPlace(null)
        }, EXIT_MS)
      },
    ),
  )

  /** Measure the screen and put the pill where nothing it covers is a control. */
  function measure(): void {
    if (pill === undefined || safe === undefined || shown() === undefined)
      return
    const area = safe.getBoundingClientRect()
    const controls = tappableBoxes(pill)
    const input = {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      safeTop: area.top,
      safeLeft: area.left,
      safeRight: window.innerWidth - area.right,
      safeBottom: window.innerHeight - area.bottom,
      controls,
    }
    // The width decides how the text wraps, and so the height the band is
    // measured with. The tallest height seen is the one placed with, so a
    // place is never chosen for a pill shorter than the one drawn there,
    // and the loop ends: the height can only grow, up to three times.
    let tallest = pill.offsetHeight
    let next = placePill({ ...input, pillHeight: tallest })
    for (let pass = 0; pass < 3; pass += 1) {
      pill.style.width = `${next.width}px`
      if (pill.offsetHeight <= tallest) break
      tallest = pill.offsetHeight
      next = placePill({ ...input, pillHeight: tallest })
    }
    // Written here as well as through the signal below: an unchanged place
    // leaves the signal alone, and the width must not stay at a trial value.
    pill.style.width = `${next.width}px`
    const was = place()
    if (
      was === null ||
      was.top !== next.top ||
      was.left !== next.left ||
      was.width !== next.width
    ) {
      setPlace(next)
    }
  }

  createEffect(
    on(shown, (notice) => {
      if (notice === undefined) return
      requestAnimationFrame(measure)
    }),
  )

  onMount(() => {
    const timer = setInterval(() => {
      if (shown() !== undefined && !leaving()) measure()
    }, REMEASURE_MS)
    window.addEventListener('resize', measure)
    onCleanup(() => {
      clearInterval(timer)
      window.removeEventListener('resize', measure)
      if (exitTimer !== undefined) clearTimeout(exitTimer)
    })
  })

  function dismiss(): void {
    const notice = shown()
    if (notice !== undefined) removeNotification(notice.id)
  }

  // An upward swipe throws it away; anything shorter than the slop is a tap.
  let startY: number | null = null
  let moved = false
  const onPointerDown: JSX.EventHandler<HTMLElement, PointerEvent> = (
    event,
  ) => {
    startY = event.clientY
    moved = false
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }
  const onPointerMove: JSX.EventHandler<HTMLElement, PointerEvent> = (
    event,
  ) => {
    if (startY === null) return
    const dy = event.clientY - startY
    if (Math.abs(dy) > TAP_SLOP_PX) moved = true
    setDrag(Math.min(0, dy))
  }
  const onPointerEnd = (): void => {
    if (startY === null) return
    startY = null
    if (drag() <= -SWIPE_DISMISS_PX) {
      dismiss()
      return
    }
    setDrag(0)
  }

  return (
    <>
      <div class="mp-notice-safe" ref={safe} aria-hidden="true" />
      <div class="mp-notice" role="status" aria-atomic="true">
        <Show when={shown()?.id} keyed>
          {(_id) => {
            const notice = (): Notification => shown()!
            const names = (): string | null =>
              (notice().unlocks?.length ?? 0) > 1
                ? unlockNames(notice().unlocks!)
                : null
            return (
              <div
                ref={pill}
                class={`mp-notice-pill mp-notice-pill--${notice().type}`}
                classList={{
                  'is-placed': place() !== null,
                  'is-leaving': leaving(),
                  'is-dragging': drag() !== 0,
                  'mp-notice-pill--below': place()?.docked === 'below',
                }}
                role={notice().type === 'error' ? 'alert' : undefined}
                style={{
                  top: place() === null ? undefined : `${place()!.top}px`,
                  left: place() === null ? undefined : `${place()!.left}px`,
                  width: place() === null ? undefined : `${place()!.width}px`,
                  '--mp-notice-drag': `${drag()}px`,
                }}
                data-testid="notice-pill"
                data-notice-type={notice().type}
                data-unlock={notice().unlocks === undefined ? undefined : 'on'}
              >
                <button
                  type="button"
                  class="mp-notice-pill__body"
                  data-testid="notice-pill-body"
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerEnd}
                  onPointerCancel={onPointerEnd}
                  onClick={() => {
                    if (moved) {
                      moved = false
                      return
                    }
                    dismiss()
                  }}
                >
                  <Mark notice={notice()} />
                  <span class="mp-notice-pill__words">
                    <span class="mp-notice-pill__text">
                      <Show when={notice().title}>
                        {(title) => (
                          <strong class="mp-notice-pill__title">
                            {title()}
                          </strong>
                        )}
                      </Show>
                      {notice().message}
                    </span>
                    <Show when={names()}>
                      {(list) => (
                        <span
                          class="mp-notice-pill__names"
                          data-testid="notice-pill-names"
                        >
                          {list()}
                        </span>
                      )}
                    </Show>
                  </span>
                </button>
                <Show when={notice().action}>
                  {(action) => (
                    <span class="mp-notice-pill__actions">
                      <button
                        type="button"
                        class="mp-notice-pill__action"
                        data-testid="notice-pill-action"
                        onClick={() => {
                          action().onClick()
                          removeNotification(notice().id)
                        }}
                      >
                        {action().label}
                      </button>
                      <Show when={notice().secondaryAction}>
                        {(second) => (
                          <button
                            type="button"
                            class="mp-notice-pill__action mp-notice-pill__action--quiet"
                            data-testid="notice-pill-secondary"
                            onClick={() => {
                              second().onClick()
                              removeNotification(notice().id)
                            }}
                          >
                            {second().label}
                          </button>
                        )}
                      </Show>
                    </span>
                  )}
                </Show>
              </div>
            )
          }}
        </Show>
      </div>
    </>
  )
}

// ============================================================
// The moment card: the record's chosen moment, and the others a swipe away
// ============================================================
//
// The record chooses one moment and offers up to three others (the web
// page's "Other moments"). Here they are pages of one card: a swipe moves
// between them and the dots say where you are; the page a swipe settles on
// becomes the chosen moment, as a tap on the web's list does, so Share and
// the record's telemetry follow it. The pages keep the order they were
// first shown in (pagerOrder), however the choice reorders the record's.
//
// Only the page in view takes a tap or a screen reader's attention: the
// others are inert until a swipe or a dot brings them in.

import type { JSX } from 'solid-js'
import { createEffect, createMemo, createSignal, For, on, onCleanup, onMount, Show, } from 'solid-js'
import type { ProgressActionView, ProgressMomentOptionView, ProgressMomentView, } from '@/features/progress/ProgressPage'
import { PlayIcon, ShareIcon } from '../icons'
import { inAppAction, linkHref, momentGlyph, pagerOrder, } from './progress-lines'
import { MomentIcon, Tiles } from './progress-parts'

/** How long a pager must be still before the page it shows is chosen. */
const SETTLE_MS = 140

export interface MomentCardProps {
  /** The record's chosen moment, in full. */
  moment: ProgressMomentView
  /** The others on offer: a name and a kind each. */
  alternates: readonly ProgressMomentOptionView[]
  periodLabel: string
  /** Another moment in full, where the page can have it (ProgressScreen). */
  momentFor?: (id: string) => ProgressMomentView | undefined
  onSelect?: (momentId: string) => void
  onShare?: (momentId: string) => void
  onAction?: (action: ProgressActionView) => void
}

interface MomentPageProps {
  view?: ProgressMomentView
  preview?: ProgressMomentOptionView
  periodLabel: string
  titleId: string
  onShare?: (momentId: string) => void
  onAction?: (action: ProgressActionView) => void
}

/** The moment's next step, as the card's one filled button. */
function MomentAction(props: {
  action: ProgressActionView
  onAction?: (action: ProgressActionView) => void
}): JSX.Element {
  const body = (): JSX.Element => (
    <>
      <PlayIcon size={20} />
      {props.action.label}
    </>
  )
  return (
    <Show
      when={linkHref(props.action)}
      fallback={
        <button
          type="button"
          class="mp-prog-button mp-prog-moment__go"
          onClick={() => props.onAction?.(props.action)}
        >
          {body()}
        </button>
      }
    >
      {(href) => (
        <a
          class="mp-prog-button mp-prog-moment__go"
          href={href()}
          onClick={() => props.onAction?.(props.action)}
        >
          {body()}
        </a>
      )}
    </Show>
  )
}

/** One moment: its kind, what happened, the evidence and the next step. */
function MomentPage(props: MomentPageProps): JSX.Element {
  const kind = (): string =>
    props.view?.kindLabel ?? props.preview?.kindLabel ?? ''
  const title = (): string => props.view?.title ?? props.preview?.title ?? ''
  return (
    <>
      <div class="mp-prog-moment__top">
        <span class="mp-prog-chip">
          <MomentIcon glyph={momentGlyph(kind())} />
          {kind()}
        </span>
        <span class="mp-prog-meta">{props.periodLabel}</span>
      </div>
      <h2 class="mp-prog-moment__title" id={props.titleId}>
        {title()}
      </h2>
      <Show when={props.view}>
        {(view) => (
          <>
            <p class="mp-prog-meta mp-prog-moment__context">{view().context}</p>
            <p class="mp-prog-moment__reason">{view().reason}</p>
            <Tiles facts={view().evidence.slice(0, 3)} />
            <p class="mp-prog-moment__basis">{view().confidenceLabel}</p>
            <div class="mp-prog-moment__actions">
              <Show when={inAppAction(view().primaryAction)}>
                {(action) => (
                  <MomentAction action={action()} onAction={props.onAction} />
                )}
              </Show>
              <Show when={view().shareable && props.onShare !== undefined}>
                <button
                  type="button"
                  class="mp-prog-round mp-prog-round--48"
                  aria-label="Share this moment"
                  aria-haspopup="dialog"
                  onClick={() => props.onShare?.(view().id)}
                >
                  <ShareIcon size={22} />
                </button>
              </Show>
            </div>
          </>
        )}
      </Show>
    </>
  )
}

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export function MomentCard(props: MomentCardProps): JSX.Element {
  const order = createMemo<string[]>(
    (previous) =>
      pagerOrder(
        previous,
        props.moment.id,
        props.alternates.map((moment) => moment.id),
      ),
    [],
  )
  const chosenIndex = (): number =>
    Math.max(0, order().indexOf(props.moment.id))
  const [shown, setShown] = createSignal(0)
  let pager: HTMLDivElement | undefined
  let settle: ReturnType<typeof setTimeout> | undefined
  /** The page the pager itself chose last: no need to bring it into view. */
  let ownChoice: string | null = null
  onCleanup(() => clearTimeout(settle))

  const preview = (id: string): ProgressMomentOptionView | undefined =>
    props.alternates.find((moment) => moment.id === id)
  const view = (id: string): ProgressMomentView | undefined =>
    id === props.moment.id ? props.moment : props.momentFor?.(id)
  const titleOf = (id: string): string =>
    view(id)?.title ?? preview(id)?.title ?? ''

  const choose = (index: number): void => {
    const id = order()[index]
    if (id === undefined || id === props.moment.id) return
    ownChoice = id
    props.onSelect?.(id)
  }

  // A moment the record chose by itself (the first, or after a change of
  // record): its page, in view at once.
  createEffect(
    on(chosenIndex, (index) => {
      const id = order()[index]
      if (id !== undefined && id === ownChoice) {
        ownChoice = null
        return
      }
      setShown(index)
      if (pager === undefined || pager.clientWidth === 0) return
      pager.scrollTo?.({ left: index * pager.clientWidth })
    }),
  )

  // The card is as tall as the page in view, not the tallest page: a short
  // moment does not stand in a long one's space. Set as the page changes
  // and whenever a page's height does (fonts, a turn of the phone).
  const fit = (): void => {
    const page = pager?.children[shown()]
    if (pager === undefined || !(page instanceof HTMLElement)) return
    if (page.offsetHeight > 0) pager.style.height = `${page.offsetHeight}px`
  }
  createEffect(on(shown, fit))
  onMount(() => {
    if (pager === undefined || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(fit)
    for (const page of pager.children) observer.observe(page)
    observer.observe(pager)
    onCleanup(() => observer.disconnect())
  })

  const onScroll = (): void => {
    if (pager === undefined || pager.clientWidth === 0) return
    const last = order().length - 1
    const index = Math.min(
      last,
      Math.max(0, Math.round(pager.scrollLeft / pager.clientWidth)),
    )
    setShown(index)
    clearTimeout(settle)
    settle = setTimeout(() => choose(index), SETTLE_MS)
  }

  /** A dot: that page, chosen now and brought into view. */
  const goTo = (index: number): void => {
    setShown(index)
    choose(index)
    if (pager === undefined) return
    pager.scrollTo?.({
      left: index * pager.clientWidth,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    })
  }

  const paged = (): boolean => order().length > 1

  return (
    <section
      class="mp-prog-card mp-prog-moments"
      aria-roledescription={paged() ? 'carousel' : undefined}
      aria-label={paged() ? 'Moments' : undefined}
      aria-labelledby={paged() ? undefined : 'mp-prog-moment-0'}
      data-testid="progress-moments"
    >
      <div
        class="mp-prog-pager"
        ref={pager}
        onScroll={onScroll}
        data-pages={order().length}
      >
        <For each={order()}>
          {(id, index) => (
            <article
              class="mp-prog-moment"
              aria-roledescription={paged() ? 'slide' : undefined}
              aria-labelledby={`mp-prog-moment-${index()}`}
              inert={index() !== shown()}
              data-moment={id}
              data-shown={index() === shown() ? 'on' : undefined}
            >
              <MomentPage
                view={view(id)}
                preview={preview(id)}
                periodLabel={props.periodLabel}
                titleId={`mp-prog-moment-${index()}`}
                onShare={props.onShare}
                onAction={props.onAction}
              />
            </article>
          )}
        </For>
      </div>
      <Show when={paged()}>
        <div class="mp-prog-dots" role="group" aria-label="Choose a moment">
          <For each={order()}>
            {(id, index) => (
              <button
                type="button"
                class="mp-prog-dot"
                aria-label={`Moment ${index() + 1} of ${order().length}: ${titleOf(id)}`}
                aria-current={index() === shown() ? 'true' : undefined}
                onClick={() => goTo(index())}
              >
                <i aria-hidden="true" />
              </button>
            )}
          </For>
        </div>
      </Show>
    </section>
  )
}

// ============================================================
// PremiumBackgroundPicker — compact accessible stage gallery
// ============================================================
//
// Locked cards intentionally render an atmospheric placeholder and never ask
// the protected image endpoint for bytes. Unlocked previews are decoded into
// short-lived object URLs and revoked with the popover lifecycle.

import type { Accessor, Component } from 'solid-js'
import { createEffect, createSignal, For, onCleanup, Show } from 'solid-js'
import { Portal } from 'solid-js/web'
import { CheckSmall, Lock, StageCurtains, X } from '@/components/icons'
import { BackgroundRequestError, loadProtectedBackgroundObjectUrl, } from '@/lib/backgrounds/background-runtime'
import type { BackgroundSurfaceController, RuntimeBackgroundOption, } from '@/lib/backgrounds/background-surface'
import { useScrollLock } from '@/lib/use-scroll-lock'
import { isNarrow } from '@/lib/use-viewport'
import { invalidatePremiumBackgroundAccess } from '@/stores/background-store'
import styles from './PremiumBackgroundPicker.module.css'

interface PremiumBackgroundPickerProps {
  controller: BackgroundSurfaceController
  label?: string
  class?: string
  iconOnly?: boolean
  selectedId?: Accessor<RuntimeBackgroundOption['id']>
  onSelect?: (option: RuntimeBackgroundOption) => boolean | Promise<boolean>
  busy?: Accessor<boolean>
  error?: Accessor<string | null>
}

interface BackgroundArtworkProps {
  option: RuntimeBackgroundOption
  controller: BackgroundSurfaceController
}

/** Holds the counted body-scroll lock for exactly as long as it is mounted —
 *  `useScrollLock` locks for a component's lifetime, so the conditional lock
 *  the phone drawer needs is expressed by mounting this under a <Show>. */
const DrawerScrollLock: Component = () => {
  useScrollLock()
  return null
}

function invalidatesAccess(error: unknown): error is BackgroundRequestError {
  return (
    error instanceof BackgroundRequestError &&
    [401, 403, 404, 410].includes(error.status)
  )
}

function BackgroundArtwork(props: BackgroundArtworkProps) {
  const [url, setUrl] = createSignal<string | null>(null)
  const [failed, setFailed] = createSignal(false)

  createEffect(() => {
    const option = props.option
    const resolved = props.controller.resolved()
    setFailed(false)

    if (option.publicUrl !== null) {
      setUrl(option.publicUrl)
      return
    }
    if (option.access === 'locked' || option.premiumAsset === null) {
      setUrl(null)
      return
    }
    if (
      resolved.id === option.id &&
      resolved.source === 'protected' &&
      resolved.version === option.premiumAsset.activeVersion
    ) {
      setUrl(resolved.url)
      return
    }

    const asset = option.premiumAsset
    const request = new AbortController()
    let ownedUrl: string | null = null
    void loadProtectedBackgroundObjectUrl(asset, {
      variant: 'landscape-2k',
      version: asset.activeVersion,
      signal: request.signal,
    })
      .then((nextUrl) => {
        if (request.signal.aborted) {
          URL.revokeObjectURL(nextUrl)
          return
        }
        ownedUrl = nextUrl
        setUrl(nextUrl)
      })
      .catch((error: unknown) => {
        if (request.signal.aborted) return
        if (invalidatesAccess(error)) {
          invalidatePremiumBackgroundAccess(asset.id, error.status)
        }
        setFailed(true)
        setUrl(null)
      })

    onCleanup(() => {
      request.abort()
      if (ownedUrl !== null) URL.revokeObjectURL(ownedUrl)
    })
  })

  return (
    <span
      class={styles.artwork}
      classList={{
        [styles.artworkLocked]: props.option.access === 'locked',
        [styles.artworkFailed]: failed(),
        [styles[`edition_${props.option.edition}`]]: true,
      }}
      style={{
        '--mp-stage-position': `${props.option.focalPoint.x * 100}% ${props.option.focalPoint.y * 100}%`,
      }}
      aria-hidden="true"
    >
      <Show when={url()} keyed>
        {(src) => <img src={src} alt="" />}
      </Show>
      <Show when={props.option.access === 'locked'}>
        <span class={styles.lockMark}>
          <Lock size={16} />
        </span>
      </Show>
    </span>
  )
}

export function PremiumBackgroundPicker(props: PremiumBackgroundPickerProps) {
  const [open, setOpen] = createSignal(false)
  const [panelPosition, setPanelPosition] = createSignal({ top: 0, left: 0 })
  const [selectionPending, setSelectionPending] = createSignal(false)
  const [selectionError, setSelectionError] = createSignal<string | null>(null)
  let trigger: HTMLButtonElement | undefined
  let panel: HTMLDivElement | undefined

  const close = (restoreFocus = false) => {
    setOpen(false)
    if (restoreFocus) queueMicrotask(() => trigger?.focus())
  }

  const positionPanel = () => {
    if (trigger === undefined || panel === undefined) return
    const triggerRect = trigger.getBoundingClientRect()
    const panelRect = panel.getBoundingClientRect()
    const margin = 12
    const left = Math.min(
      window.innerWidth - panelRect.width - margin,
      Math.max(margin, triggerRect.right - panelRect.width),
    )
    const below = triggerRect.bottom + 8
    const above = triggerRect.top - panelRect.height - 8
    const top =
      below + panelRect.height <= window.innerHeight - margin
        ? below
        : Math.max(margin, above)
    setPanelPosition({ top, left })
  }

  createEffect(() => {
    if (!open()) return
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (
        panel?.contains(target) === true ||
        trigger?.contains(target) === true
      ) {
        return
      }
      close()
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      close(true)
    }
    const handleScroll = (event: Event) => {
      // Closing on page scroll keeps the desktop popover from drifting away
      // from the trigger it is anchored to. Below the mobile breakpoint the
      // panel is a viewport-pinned drawer, so nothing can drift — and this
      // rule was dismissing the drawer on any stray drag inside it, since a
      // one-item gallery has nothing of its own to scroll and the gesture
      // chained to the page.
      if (isNarrow()) return
      const target = event.target
      if (target instanceof Node && panel?.contains(target) === true) return
      close()
    }
    const handleResize = () => positionPanel()
    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', handleResize)
    requestAnimationFrame(() => {
      positionPanel()
      const selected = panel?.querySelector<HTMLElement>(
        '[aria-pressed="true"]',
      )
      selected?.focus()
    })
    onCleanup(() => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', handleResize)
    })
  })

  const busy = () => props.busy?.() === true || selectionPending()
  const visibleError = () =>
    selectionError() ?? props.error?.() ?? props.controller.error()
  const selectedId = () =>
    props.selectedId?.() ?? props.controller.requestedId()

  const handleSelect = async (option: RuntimeBackgroundOption) => {
    if (option.access === 'locked' || busy()) return
    setSelectionError(null)
    setSelectionPending(true)
    try {
      const accepted =
        props.onSelect === undefined
          ? props.controller.select(option.id)
          : await props.onSelect(option)
      if (accepted) close(true)
    } catch {
      setSelectionError('That background could not be selected. Try again.')
    } finally {
      setSelectionPending(false)
    }
  }

  const lockedCount = () =>
    props.controller.options().filter((option) => option.access === 'locked')
      .length

  return (
    <div class={`${styles.root} ${props.class ?? ''}`}>
      <button
        ref={trigger}
        type="button"
        class={styles.trigger}
        classList={{
          [styles.triggerOpen]: open(),
          [styles.triggerIconOnly]: props.iconOnly === true,
        }}
        aria-label={`Choose ${props.controller.surface === 'karaoke' ? 'karaoke stage' : 'jam room'} background`}
        aria-haspopup="dialog"
        aria-expanded={open()}
        onClick={() => setOpen((value) => !value)}
      >
        <StageCurtains size={16} />
        <span classList={{ [styles.visuallyHidden]: props.iconOnly === true }}>
          {props.label ?? 'Stage'}
        </span>
      </button>

      <Show when={open()}>
        <Portal>
          {/* Phones get a real drawer: a scrim behind it so the page cannot
              scroll (or be tapped) underneath, which is what turned an
              accidental drag into a dismissal. The existing outside-
              pointerdown handler closes it. */}
          <Show when={isNarrow()}>
            <div class={styles.scrim} aria-hidden="true" />
            <DrawerScrollLock />
          </Show>
          <div
            ref={panel}
            class={styles.panel}
            role="dialog"
            aria-modal="false"
            aria-label={
              props.controller.surface === 'karaoke'
                ? 'Choose your karaoke stage'
                : 'Choose your jam room'
            }
            aria-busy={busy()}
            style={{
              top: `${panelPosition().top}px`,
              left: `${panelPosition().left}px`,
            }}
          >
            <div class={styles.panelHead}>
              <div>
                <h2>
                  {props.controller.surface === 'karaoke'
                    ? 'Choose your stage'
                    : 'Choose your room'}
                </h2>
                <p>Free scenes and supporter editions, ready when you sing.</p>
              </div>
              <button
                type="button"
                class={styles.close}
                aria-label="Close background picker"
                onClick={() => close(true)}
              >
                <X />
              </button>
            </div>

            <div class={styles.gallery} aria-label="Available backgrounds">
              <For each={props.controller.options()}>
                {(option) => {
                  const selected = () =>
                    selectedId() === option.id && option.access !== 'locked'
                  return (
                    <button
                      type="button"
                      class={styles.card}
                      classList={{
                        [styles.cardSelected]: selected(),
                        [styles.cardLocked]: option.access === 'locked',
                      }}
                      aria-pressed={selected()}
                      aria-disabled={option.access === 'locked'}
                      disabled={busy() && !selected()}
                      onClick={() => void handleSelect(option)}
                    >
                      <BackgroundArtwork
                        option={option}
                        controller={props.controller}
                      />
                      <span class={styles.cardCopy}>
                        <span class={styles.cardTitleRow}>
                          <strong>{option.label}</strong>
                          <Show when={selected()}>
                            <span class={styles.selectedMark}>
                              <CheckSmall size={13} /> Selected
                            </span>
                          </Show>
                        </span>
                        <span class={styles.cardDescription}>
                          {option.description}
                        </span>
                        <span class={styles.accessLabel}>
                          {option.access === 'free'
                            ? 'Included'
                            : option.access === 'unlocked'
                              ? 'Unlocked'
                              : 'Supporter edition'}
                        </span>
                      </span>
                    </button>
                  )
                }}
              </For>
            </div>

            <Show when={props.controller.loading() || busy()}>
              <p class={styles.status} role="status">
                Preparing your stage…
              </p>
            </Show>
            <Show when={visibleError()} keyed>
              {(message) => (
                <p class={styles.status} role="status">
                  {message}
                </p>
              )}
            </Show>
            <Show when={lockedCount() > 0}>
              <div class={styles.supporterFoot}>
                <span>
                  {lockedCount()} supporter{' '}
                  {lockedCount() === 1 ? 'edition' : 'editions'} in this gallery
                </span>
                <a href="/#/settings/credits">Explore supporter perks</a>
              </div>
            </Show>
          </div>
        </Portal>
      </Show>
    </div>
  )
}

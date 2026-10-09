// ============================================================
// Beat 6 — the Map
// ============================================================
//
// What you can actually do here, with your first stop lit. The
// recommended room is hoisted to the front: a recommendation buried
// in reading order is not a recommendation.
//
// This beat is also mounted on its own for replays (#/map), which is
// why it takes its content as props and owns no flow state.

import type { Component } from 'solid-js'
import { createMemo, createSignal, For, Match, onCleanup, Show, Switch, } from 'solid-js'
import { CreditCoin } from '@/components/billing/CreditCoin'
import { Gift } from '@/components/icons'
import { DestinationArtwork } from '@/features/home/DestinationGallery'
import type { ActiveTab } from '@/features/tabs/constants'
import type { MirrorResult } from '@/lib/mirror/metrics'
import { hasPageTour } from '@/stores/app-store'
import { pickFirstStop } from '../first-stop'
import styles from '../onboarding.module.css'
import type { Room, RoomTarget, SideDoor } from '../rooms'
import { ROOMS, SIDE_DOORS } from '../rooms'

/**
 * The launch gift on the Map, as the flow decides it (launch offer plan,
 * section 4.1). `join`: no voiceprint and no account, so the Karaoke card
 * wears the gift and a line offers it. `keep`: a voiceprint and no account,
 * so the way back to the account offer carries the gift. `waiting`: signed
 * in to an account from before the gift was claimed for everyone, which can
 * claim it in one tap.
 */
export interface MapGift {
  kind: 'join' | 'keep' | 'waiting'
  credits: number
}

export interface BeatMapProps {
  /** Null on the short track or when the mic was denied. */
  voiceprint: MirrorResult | null
  /** Replays say "Done"; the first run says "Start singing". */
  replay?: boolean
  onEnter: (target: RoomTarget, roomId: string) => void
  /** Open a room AND start its spotlight tour. */
  onTour: (target: RoomTarget, tab: ActiveTab) => void
  onDone: () => void
  /**
   * Reopen the account offer. Passed only when there is a voiceprint to
   * save and no account holding it — the flow decides, so this beat does
   * not have to know about auth.
   *
   * The Map is where somebody lands after closing the sign-up form,
   * whether they meant to or not, so this is the one screen that has to
   * carry a way back. It is a line of text under the actions rather than
   * a card or a banner: the beat's job is still to send them into a room.
   */
  onKeep?: () => void
  /** The launch gift, or null/absent when there is none to offer. */
  gift?: MapGift | null
  /** The gift line's link: sign up for it, or claim it. */
  onGift?: () => void
}

export const BeatMap: Component<BeatMapProps> = (props) => {
  const stop = createMemo(() => pickFirstStop(props.voiceprint))

  // The recommended room first, everything else in authored order.
  const ordered = createMemo<Room[]>(() => {
    const firstId = stop().room
    const first = ROOMS.filter((room) => room.id === firstId)
    const rest = ROOMS.filter((room) => room.id !== firstId)
    return [...first, ...rest]
  })

  const isFirst = (room: Room): boolean => room.id === stop().room

  /** The gift a visitor with nothing to keep is offered, or false. */
  const joinGift = (): MapGift | false =>
    props.gift?.kind === 'join' ? props.gift : false

  // Touch screens never fire the hover reveal, so scrolling a card into
  // view plays it instead: the art starts at the dimmed resting state and
  // settles forward once the card is actually on screen. One observer for
  // the whole grid; a revealed card unobserves (the state is one-way).
  // Viewport-root intersection honours ancestor clipping, so this works
  // inside the scrollable onboarding modal and on the standalone #/map.
  const [inView, setInView] = createSignal<ReadonlySet<string>>(new Set())
  let observer: IntersectionObserver | undefined
  const observeCard = (el: HTMLElement): void => {
    if (typeof window.matchMedia !== 'function') return
    if (!window.matchMedia('(hover: none)').matches) return
    if (typeof IntersectionObserver === 'undefined') return
    observer ??= new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const id = entry.target.getAttribute('data-room')
          if (id !== null) {
            setInView((prev) => new Set(prev).add(id))
          }
          observer?.unobserve(entry.target)
        }
      },
      { threshold: 0.45 },
    )
    observer.observe(el)
  }
  onCleanup(() => observer?.disconnect())

  return (
    <div class={`${styles.beat} ${styles.beatWide}`} data-beat="map">
      <p class={styles.eyebrow}>Your map</p>
      <h1 class={styles.headline}>Choose your next room</h1>
      <p class={styles.sub}>
        Everything here is free and runs on your own device. Start where we've
        pointed you, or go anywhere you like — nothing is locked.
      </p>

      {/* No `data-tour` hook here on purpose. The Map is not spotlight-
          toured: it lives in a modal overlay the Walkthrough has no way
          to open (it can switch tabs, not open overlays), and touring
          the orientation surface would be circular anyway. It offers
          the ROOMS' tours instead. An unused data-tour attribute would
          just be a selector implying coverage that doesn't exist. */}
      <div class={styles.mapGrid}>
        <For each={ordered()}>
          {(room) => (
            <button
              type="button"
              ref={observeCard}
              class={`${styles.roomCard} ${isFirst(room) ? styles.roomFirst : ''}`}
              classList={{ [styles.roomInView]: inView().has(room.id) }}
              data-room={room.id}
              onClick={() => props.onEnter(room.target, room.id)}
            >
              {/* Cover art, revealed behind the card. On pointer devices
                  it settles in on hover; on touch it sits at a higher
                  resting state instead, because there is no hover to
                  wait for and a tap-to-reveal would cost a second tap to
                  actually enter the room. */}
              <span class={styles.roomArt} aria-hidden="true">
                <DestinationArtwork visual={room.visual} compact />
              </span>
              <span class={styles.roomScrim} aria-hidden="true" />

              <Show when={isFirst(room)}>
                <span class={styles.roomFlag}>Your first stop</span>
              </Show>
              <Show when={room.id === 'karaoke' && joinGift()}>
                {(gift) => (
                  <span class={styles.roomGift}>
                    <span class={styles.roomGiftIcon} aria-hidden="true">
                      <Gift size={12} />
                    </span>
                    {gift().credits} free credits
                  </span>
                )}
              </Show>
              <span class={styles.roomPlate} aria-hidden="true" />
              <span class={styles.roomTitle}>
                {room.title}
                <Show when={isFirst(room) && stop().detail !== null}>
                  {' · '}
                  {stop().detail}
                </Show>
              </span>
              {/* What the room IS, on every card including the
                  recommended one. The reason used to REPLACE this line on
                  the first stop, so the single card we push hardest was
                  the only one that never said what it was — "Your tone
                  wavers when you hold" tells you why you were sent, not
                  where you are being sent. Now it says both. */}
              <span class={styles.roomLine}>{room.line}</span>
              <Show when={isFirst(room)}>
                <span class={styles.roomReason}>{stop().reason}</span>
              </Show>

              {/* A tour is offered only where one exists and can actually
                  spotlight something. Nested inside the card's button, so
                  it stops the click that would otherwise just open the
                  room without the tour. */}
              <Show
                when={room.tourTab !== undefined && hasPageTour(room.tourTab)}
              >
                <span
                  class={styles.roomTour}
                  role="button"
                  tabindex="0"
                  onClick={(e) => {
                    e.stopPropagation()
                    props.onTour(room.target, room.tourTab as ActiveTab)
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter' && e.key !== ' ') return
                    e.preventDefault()
                    e.stopPropagation()
                    props.onTour(room.target, room.tourTab as ActiveTab)
                  }}
                >
                  Take the tour
                </span>
              </Show>
            </button>
          )}
        </For>
      </div>

      <p class={styles.sideLabel}>And also</p>
      <div class={styles.sideDoors}>
        <For each={SIDE_DOORS}>
          {(door: SideDoor) => (
            <button
              type="button"
              class={styles.sideDoor}
              onClick={() => props.onEnter(door.target, door.label)}
            >
              {door.label}
            </button>
          )}
        </For>
      </div>

      <div class={styles.actions}>
        <button
          type="button"
          class={styles.primary}
          onClick={() => props.onDone()}
        >
          {props.replay === true ? 'Done' : 'Start singing'}
        </button>
      </div>

      <Switch>
        <Match when={props.gift?.kind === 'waiting' && props.gift}>
          {(gift) => (
            <p class={styles.mapGift}>
              <CreditCoin size={30} class={styles.mapGiftCoin} />
              <span>
                Your launch gift is waiting: {gift().credits} Karaoke Night
                credits.{' '}
                <button
                  type="button"
                  class={styles.mapGiftLink}
                  onClick={() => props.onGift?.()}
                >
                  Claim them
                </button>
              </span>
            </p>
          )}
        </Match>
        <Match when={joinGift()}>
          {(gift) => (
            <p class={styles.mapGift}>
              <CreditCoin size={30} class={styles.mapGiftCoin} />
              <span>
                Launch gift: {gift().credits} free Karaoke Night credits with a
                free account.{' '}
                <button
                  type="button"
                  class={styles.mapGiftLink}
                  onClick={() => props.onGift?.()}
                >
                  Get my {gift().credits} credits
                </button>
              </span>
            </p>
          )}
        </Match>
        <Match when={props.onKeep !== undefined}>
          <p class={styles.mapKeep}>
            Your voiceprint is saved in this browser only.{' '}
            <Show
              when={props.gift?.kind === 'keep' && props.gift}
              fallback={
                <button
                  type="button"
                  class={styles.mapKeepLink}
                  onClick={() => props.onKeep?.()}
                >
                  Save it to a free account
                </button>
              }
            >
              {(gift) => (
                <button
                  type="button"
                  class={styles.mapKeepLink}
                  onClick={() => props.onGift?.()}
                >
                  Save it and get {gift().credits} free credits
                </button>
              )}
            </Show>
          </p>
        </Match>
      </Switch>
    </div>
  )
}

export default BeatMap

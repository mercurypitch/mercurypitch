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
//
// Every card wears its room's cover, Merc in that room, at rest and in
// full (owner decision V5, 10 Oct 2026). The cards used to show each
// room's own interface drawn small, blurred and dimmed until a pointer
// hovered it, and a phone has no pointer to hover with: on touch the
// art never came forward at all. Nothing here waits on hover now. On a
// phone the cards are rows, a square of the cover beside the words, so
// six rooms fit in a scroll a thumb can manage.
//
// The store chips sit last, under the account line, and smaller than any
// room. The Map is the last screen of every track and comes after the Keep
// beat, so a link out of the app here cannot cost the account offer the way
// one on the twin portrait would. It still must not cost a room: the beat's
// job is sending people into one.
//
// The grid shows only the rooms and doors the person's own menu has. The
// plan's switch can narrow the menu to one instrument, and "See every room"
// then opens this grid: a card for a tab the menu has hidden would open a
// room that nothing else in the app reaches. A room that is a page (Karaoke)
// stands for its tab in the menu; a door with no tab at all (the Voice
// Mirror) is not in the menu, and always shows.

import type { Component } from 'solid-js'
import { createMemo, For, Match, Show, Switch } from 'solid-js'
import { CreditCoin } from '@/components/billing/CreditCoin'
import { GiftIcon } from '@/components/billing/GiftIcon'
import type { StoreId } from '@/components/shared/StoreChips'
import { StoreChips } from '@/components/shared/StoreChips'
import type { ActiveTab } from '@/features/tabs/constants'
import { isTabVisible, TAB_KARAOKE } from '@/features/tabs/constants'
import type { MirrorResult } from '@/lib/mirror/metrics'
import { hasPageTour } from '@/stores/app-store'
import { practiceScope, uiMode } from '@/stores/settings-store'
import { KARAOKE_GIFT_TAG, MAP_GIFT_JOIN_LINK, MAP_KEEP_GIFT_LINK, mapGiftJoin, mapGiftWaiting, } from '../copy'
import { pickFirstStop } from '../first-stop'
import styles from '../onboarding.module.css'
import type { EnteredRoomId, Room, RoomId, RoomTarget, SideDoor, } from '../rooms'
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
  /** What using the gift earns (launch-gift-copy `giftOfferLine`), under
   *  the join and waiting lines; null while the server states no offer. */
  offer?: string | null
}

/**
 * The cover's rendered width, for `sizes`. It mirrors the stylesheet: a
 * 100 px square on a phone (`.roomCover` under 640 px), then the grid's
 * own columns inside the frame's 22 px padding: two up to 845 px, three
 * (minmax 258 px, 14 px gaps) from 846 px, and 324 px once the beat
 * reaches its 1000 px. BeatMap.test.tsx derives the same widths from the
 * stylesheet, so change one and the test says so.
 */
export const ROOM_COVER_SIZES =
  '(max-width: 640px) 100px, (max-width: 845px) calc((100vw - 58px) / 2), (max-width: 1043px) calc((100vw - 72px) / 3), 324px'

export interface BeatMapProps {
  /** Null on the short track or when the mic was denied. */
  voiceprint: MirrorResult | null
  /** Replays say "Done"; the first run says "Start singing". */
  replay?: boolean
  onEnter: (target: RoomTarget, roomId: EnteredRoomId) => void
  /** Open a room AND start its spotlight tour. */
  onTour: (target: RoomTarget, tab: ActiveTab, roomId: RoomId) => void
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
  /** A store chip was clicked; the flow counts it. The link opens anyway. */
  onStoreClick?: (store: StoreId) => void
}

/** The menu tab that stands for a room or a door, or null when none does. */
function menuTab(item: Room | SideDoor): ActiveTab | null {
  if (item.target.kind === 'tab') return item.target.tab
  return item.id === 'karaoke' ? TAB_KARAOKE : null
}

export const BeatMap: Component<BeatMapProps> = (props) => {
  const stop = createMemo(() => pickFirstStop(props.voiceprint))

  /** Is the room or door in the person's menu, as it stands now? */
  const inMenu = (item: Room | SideDoor): boolean => {
    const tab = menuTab(item)
    return tab === null || isTabVisible(tab, practiceScope(), uiMode())
  }

  // The recommended room first, everything else in authored order; a room
  // the menu hides is not here, so it is never the one lit.
  const ordered = createMemo<Room[]>(() => {
    const firstId = stop().room
    const shown = ROOMS.filter(inMenu)
    const first = shown.filter((room) => room.id === firstId)
    const rest = shown.filter((room) => room.id !== firstId)
    return [...first, ...rest]
  })

  const doors = createMemo(() => SIDE_DOORS.filter(inMenu))

  const isFirst = (room: Room): boolean => room.id === stop().room

  /** The gift a visitor with nothing to keep is offered, or false. */
  const joinGift = (): MapGift | false =>
    props.gift?.kind === 'join' ? props.gift : false

  return (
    <div
      class={`${styles.beat} ${styles.beatWide} ${styles.mapBeat}`}
      data-beat="map"
    >
      <p class={styles.eyebrow}>Your map</p>
      <h1 class={styles.headline}>Choose your next room</h1>
      <p class={`${styles.sub} ${styles.mapSub}`}>
        Everything here is free and runs on your own device. Start where we've
        pointed you, or go anywhere you like: nothing is locked.
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
              class={`${styles.roomCard} ${isFirst(room) ? styles.roomFirst : ''}`}
              data-room={room.id}
              onClick={() => props.onEnter(room.target, room.id)}
            >
              {/* The cover, in full from the first frame: no hover, no
                  scroll trigger. Decorative, so it stays out of the
                  accessible name, which is the room's own words. */}
              <span class={styles.roomCover} aria-hidden="true">
                <img
                  class={styles.roomCoverImg}
                  src={room.cover.small}
                  srcset={`${room.cover.small} 560w, ${room.cover.medium} 800w, ${room.cover.src} 1672w`}
                  sizes={ROOM_COVER_SIZES}
                  width="560"
                  height="315"
                  alt=""
                  decoding="async"
                  style={{ 'object-position': room.cover.focus }}
                />
              </span>

              <Show when={room.id === 'karaoke' && joinGift() !== false}>
                <span class={styles.roomGift}>
                  <span class={styles.roomGiftIcon} aria-hidden="true">
                    <GiftIcon size={12} />
                  </span>
                  {KARAOKE_GIFT_TAG}
                </span>
              </Show>

              {/* The words, in one column: under the cover on a wide
                  screen, beside its square on a phone. */}
              <span class={styles.roomBody}>
                {/* The flag rides beside the title rather than on a row of
                    its own: one line less on the first row of cards. */}
                <span class={styles.roomHead}>
                  <span class={styles.roomTitle}>
                    {room.title}
                    <Show when={isFirst(room) && stop().detail !== null}>
                      {' · '}
                      {stop().detail}
                    </Show>
                  </span>
                  <Show when={isFirst(room)}>
                    <span class={styles.roomFlag}>Your first stop</span>
                  </Show>
                </span>
                {/* What the room IS, on every card including the
                    recommended one. The reason used to REPLACE this line
                    on the first stop, so the single card we push hardest
                    was the only one that never said what it was — "Your
                    tone wavers when you hold" tells you why you were
                    sent, not where you are being sent. Now it says both. */}
                <span class={styles.roomLine}>{room.line}</span>
                <Show when={isFirst(room)}>
                  <span class={styles.roomReason}>{stop().reason}</span>
                </Show>

                {/* A tour is offered only where one exists and can
                    actually spotlight something. Nested inside the card's
                    button, so it stops the click that would otherwise
                    just open the room without the tour. */}
                <Show
                  when={room.tourTab !== undefined && hasPageTour(room.tourTab)}
                >
                  <span
                    class={styles.roomTour}
                    role="button"
                    tabindex="0"
                    onClick={(e) => {
                      e.stopPropagation()
                      props.onTour(
                        room.target,
                        room.tourTab as ActiveTab,
                        room.id,
                      )
                    }}
                    // Native, not Solid's delegated key prop: First Light
                    // stops keydown at its root (isolateKeyboard), so a
                    // delegated one, listening at the document, would never
                    // hear it. FirstLight.keys.test.tsx pins the key, and
                    // src/tests/trap-key-handlers.test.ts keeps delegated key
                    // props out of everything First Light renders.
                    on:keydown={(e) => {
                      if (e.key !== 'Enter' && e.key !== ' ') return
                      e.preventDefault()
                      e.stopPropagation()
                      props.onTour(
                        room.target,
                        room.tourTab as ActiveTab,
                        room.id,
                      )
                    }}
                  >
                    Take the tour
                  </span>
                </Show>
              </span>
            </button>
          )}
        </For>
      </div>

      {/* The label leads the row of doors instead of taking a line above
          them; on a phone it still takes its own line. */}
      <div class={styles.sideDoors} data-side-doors>
        <span class={styles.sideDoorsLabel}>And also</span>
        <For each={doors()}>
          {(door: SideDoor) => (
            <button
              type="button"
              class={styles.sideDoor}
              onClick={() => props.onEnter(door.target, door.id)}
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
                {mapGiftWaiting(gift().credits)}{' '}
                <button
                  type="button"
                  class={styles.mapGiftLink}
                  onClick={() => props.onGift?.()}
                >
                  Claim them
                </button>
                <MapGiftOffer line={gift().offer} />
              </span>
            </p>
          )}
        </Match>
        <Match when={joinGift()}>
          {(gift) => (
            <p class={styles.mapGift}>
              <CreditCoin size={30} class={styles.mapGiftCoin} />
              <span>
                {mapGiftJoin(gift().credits)}{' '}
                <button
                  type="button"
                  class={styles.mapGiftLink}
                  onClick={() => props.onGift?.()}
                >
                  {MAP_GIFT_JOIN_LINK}
                </button>
                <MapGiftOffer line={gift().offer} />
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
              <button
                type="button"
                class={styles.mapKeepLink}
                onClick={() => props.onGift?.()}
              >
                {MAP_KEEP_GIFT_LINK}
              </button>
            </Show>
          </p>
        </Match>
      </Switch>

      <StoreChips
        class={styles.mapStores}
        onChipClick={(store) => props.onStoreClick?.(store)}
      />
    </div>
  )
}

/** The offer line under the Map's gift line, while there is one. */
const MapGiftOffer: Component<{ line?: string | null }> = (props) => (
  <Show when={props.line}>
    {(line) => (
      <span class={styles.mapGiftOffer} data-testid="gift-offer-line">
        {line()}
      </span>
    )}
  </Show>
)

export default BeatMap

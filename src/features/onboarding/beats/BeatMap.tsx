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
import { createMemo, For, Show } from 'solid-js'
import type { DestinationVisual } from '@/features/home/DestinationGallery'
import { DestinationArtwork } from '@/features/home/DestinationGallery'
import type { ActiveTab } from '@/features/tabs/constants'
import type { MirrorResult } from '@/lib/mirror/metrics'
import { hasPageTour } from '@/stores/app-store'
import { pickFirstStop } from '../first-stop'
import styles from '../onboarding.module.css'
import type { Room, RoomTarget, SideDoor } from '../rooms'
import { ROOMS, SIDE_DOORS } from '../rooms'

export interface BeatMapProps {
  /** Null on the short track or when the mic was denied. */
  voiceprint: MirrorResult | null
  /** Replays say "Done"; the first run says "Start singing". */
  replay?: boolean
  onEnter: (target: RoomTarget, roomId: string) => void
  /** Open a room AND start its spotlight tour. */
  onTour: (target: RoomTarget, tab: ActiveTab) => void
  onDone: () => void
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
              class={`${styles.roomCard} ${isFirst(room) ? styles.roomFirst : ''}`}
              data-room={room.id}
              onClick={() => props.onEnter(room.target, room.id)}
            >
              {/* The Home gallery's own cover art, revealed behind the
                  card. On pointer devices it settles in on hover; on
                  touch it simply sits at a low resting opacity, because
                  a tap-to-reveal would cost a second tap to actually
                  enter the room. */}
              <span class={styles.roomArt} aria-hidden="true">
                <Show
                  when={room.visual !== undefined}
                  fallback={<span class={styles.roomArtFallback} />}
                >
                  <DestinationArtwork
                    visual={room.visual as DestinationVisual}
                    compact
                  />
                </Show>
              </span>
              <span class={styles.roomScrim} aria-hidden="true" />

              <Show when={isFirst(room)}>
                <span class={styles.roomFlag}>Your first stop</span>
              </Show>
              <span class={styles.roomPlate} aria-hidden="true" />
              <span class={styles.roomTitle}>
                {room.title}
                <Show when={isFirst(room) && stop().detail !== null}>
                  {' · '}
                  {stop().detail}
                </Show>
              </span>
              <Show
                when={isFirst(room)}
                fallback={<span class={styles.roomLine}>{room.line}</span>}
              >
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
    </div>
  )
}

export default BeatMap

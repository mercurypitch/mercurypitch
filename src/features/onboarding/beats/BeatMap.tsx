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
import type { MirrorResult } from '@/lib/mirror/metrics'
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

      <div class={styles.mapGrid} data-tour="onboarding-map">
        <For each={ordered()}>
          {(room) => (
            <button
              type="button"
              class={`${styles.roomCard} ${isFirst(room) ? styles.roomFirst : ''}`}
              data-room={room.id}
              onClick={() => props.onEnter(room.target, room.id)}
            >
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

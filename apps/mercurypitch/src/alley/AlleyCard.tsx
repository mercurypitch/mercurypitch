// ============================================================
// AlleyCard — the card under a picked door, and Enter under that
// ============================================================
//
// The room's name and its line, "Coming soon" above them for a locked door,
// and Enter below them for a door that opens. The panel is always mounted;
// the card inside it comes and goes with the pick. RoomsAlley still holds
// both elements: it measures the panel to place it under the door
// (`panelRef`), and puts focus on the card after a tap (`cardRef`).

import type { JSX } from 'solid-js'
import { Show } from 'solid-js'
import { roomName } from '@/features/rooms/room-names'
import { ALLEY_COPY, DOOR_LINE, doorTitle } from './alley-copy'
import { PANEL_WIDTH } from './alley-geometry'
import type { DoorKey } from './alley-plate'
import { doorSpec, isEnterable } from './alley-plate'

export interface AlleyCardProps {
  panelRef: (element: HTMLDivElement) => void
  cardRef: (element: HTMLDivElement) => void
  /** The picked door, or null: none picked, or Enter already pressed. */
  door: () => DoorKey | null
  onEnter: () => void
}

export function AlleyCard(props: AlleyCardProps): JSX.Element {
  return (
    <div
      ref={props.panelRef}
      class="mp-alley__panel"
      classList={{ 'is-shown': props.door() !== null }}
      style={{ width: `${PANEL_WIDTH}px` }}
      data-testid="alley-panel"
      aria-hidden={props.door() === null}
    >
      <Show when={props.door()}>
        {(key) => (
          <>
            <div
              ref={props.cardRef}
              class="mp-alley__card"
              tabIndex={-1}
              role="group"
              aria-label={doorTitle(key(), roomName(doorSpec(key()).roomId))}
              data-testid="alley-card"
            >
              <Show when={!isEnterable(key())}>
                <div class="mp-alley__eyebrow" data-testid="alley-eyebrow">
                  {ALLEY_COPY.comingSoon}
                </div>
              </Show>
              <div class="mp-alley__name" data-testid="alley-name">
                {doorTitle(key(), roomName(doorSpec(key()).roomId))}
              </div>
              <div class="mp-alley__line" data-testid="alley-line">
                {DOOR_LINE[key()]}
              </div>
            </div>
            <Show when={isEnterable(key())}>
              <button
                type="button"
                class="mp-alley__enter"
                data-testid="alley-enter"
                onClick={() => props.onEnter()}
              >
                {ALLEY_COPY.enter}
              </button>
            </Show>
          </>
        )}
      </Show>
    </div>
  )
}

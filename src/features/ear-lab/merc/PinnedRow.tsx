// ============================================================
// The pinned row under the pads while a run is on: Hear it again, then
// Compare on a miss whose pick the drill can sound, then what the room
// says while nothing is due, or Next once the verdict waits for it.
// Each button is 44 px, outlined; none sounds over a sound.
// ============================================================

import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import { IconPlay } from '@/features/ear-lab/ear-icons'
import type { ReplayRun } from '@/features/ear-lab/replay-policy'
import type { RoomBeat, RoomCompare, StageRoom, } from '@/features/ear-lab/stage-room'
import { IconReplay } from './merc-icons'
import { compareLabel, onceLines } from './merc-lines'
import styles from './room.module.css'

export interface PinnedRowProps {
  room: StageRoom | undefined
  beat: RoomBeat
  run: ReplayRun
  /** Compare, while a miss it can sound is on the stage. */
  compare: RoomCompare | null
}

export function PinnedRow(props: PinnedRowProps): JSX.Element {
  const replayLabel = (): string => {
    const left = props.room?.replay?.left?.() ?? null
    if (left === null || props.beat === 'reveal') return 'Hear it again'
    return `Hear it again · ${left} left`
  }

  /** "Compare: the fifth, then your fourth". */
  const compareName = (offered: RoomCompare): string => {
    const names = offered.names()
    return names === null ? 'Compare' : compareLabel(names)
  }

  const pinnedWords = (): readonly string[] => {
    const own = props.room?.pinned?.() ?? null
    if (own !== null) return [own]
    if (props.beat === 'reveal') return ['Next in a moment']
    if (
      props.run !== 'practice' &&
      (props.beat === 'listen' || props.beat === 'answer')
    ) {
      return onceLines(props.run === 'sealed' ? 'sealed' : 'rated')
    }
    if (props.beat === 'listen') return ['Listening']
    return ['Your call']
  }

  return (
    <div class={styles.bottomRow} data-testid="merc-pinned">
      <Show when={props.room?.replay}>
        {(replay) => (
          <button
            type="button"
            class={styles.again}
            disabled={!replay().allowed()}
            data-testid="merc-replay"
            onClick={() => replay().play()}
          >
            <IconReplay size={18} />
            {replayLabel()}
          </button>
        )}
      </Show>
      <Show when={props.compare}>
        {(offered) => (
          <button
            type="button"
            class={styles.again}
            disabled={!offered().allowed()}
            aria-label={compareName(offered())}
            data-testid="merc-compare"
            onClick={() => offered().play()}
          >
            Compare
          </button>
        )}
      </Show>
      <Show
        when={props.room?.parked() === true}
        fallback={
          <p class={styles.status} data-testid="merc-status">
            <For each={pinnedWords()}>
              {(line, i) => (
                <>
                  {i() > 0 ? <br /> : null}
                  {line}
                </>
              )}
            </For>
          </p>
        }
      >
        <button
          type="button"
          class={styles.next}
          data-testid="merc-next"
          onClick={() => props.room?.next()}
        >
          Next
          <IconPlay size={16} />
        </button>
      </Show>
    </div>
  )
}

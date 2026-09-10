// ============================================================
// The instrument room door
// ============================================================
//
// Shown once, the first time somebody presses the Piano or Guitar tab, because
// each of those now opens two different rooms and the tab cannot guess which
// one was meant. Two cards, a remember tick, and no third way out that leaves
// the question open — pressing Escape or the backdrop keeps 'ask', so the
// door simply asks again next time rather than silently picking for them.
//
// Never rendered on a phone: there the Night room IS the mobile experience and
// the workspace is a desktop surface, so BottomTabBar sends both tabs straight
// to Night without a question worth asking.

import type { JSX } from 'solid-js'
import { createSignal, Show } from 'solid-js'
import { Portal } from 'solid-js/web'
import { Guitar, PianoKeys, PianoWorkspace } from '@/components/icons'
import { MercuryCheckbox } from '@/components/MercuryCheckbox'
import styles from './InstrumentRoomDoor.module.css'
import type { RoomChoice, RoomInstrument } from './room-preference'
import { ROOM_LABEL } from './room-preference'

interface RoomCopy {
  night: { title: string; blurb: string }
  workspace: { title: string; blurb: string }
}

const COPY: Record<RoomInstrument, RoomCopy> = {
  piano: {
    night: {
      title: 'Piano Night',
      blurb: 'The lit room. Play, record a take, and hear it back.',
    },
    workspace: {
      title: 'Piano workspace',
      blurb: 'The full studio: roll, sheet, scales and the exercise bench.',
    },
  },
  guitar: {
    night: {
      title: 'Guitar Night',
      blurb: 'The lit room. Bring a song, or just play and let it listen.',
    },
    workspace: {
      title: 'Guitar workspace',
      blurb: 'The full studio: tabs, catalogue, tuner and the practice tools.',
    },
  },
}

export function InstrumentRoomDoor(props: {
  instrument: RoomInstrument
  onChoose: (choice: Exclude<RoomChoice, 'ask'>, remember: boolean) => void
  onDismiss: () => void
}): JSX.Element {
  // Ticked by default: someone who reads neither the tick nor this comment
  // gets the behaviour they almost certainly want, which is not being asked
  // again. Unticking is the deliberate act, and it is the one the label says.
  const [remember, setRemember] = createSignal(true)
  const copy = (): RoomCopy => COPY[props.instrument]

  const choose = (choice: Exclude<RoomChoice, 'ask'>) => {
    props.onChoose(choice, remember())
  }

  return (
    <Portal>
      <div
        class={styles.scrim}
        onClick={(event) => {
          if (event.target === event.currentTarget) props.onDismiss()
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') props.onDismiss()
        }}
      >
        <section
          class={styles.door}
          role="dialog"
          aria-modal="true"
          aria-labelledby="room-door-title"
          data-testid="instrument-room-door"
          data-instrument={props.instrument}
        >
          <p class={styles.kicker}>{ROOM_LABEL[props.instrument]}</p>
          <h2 class={styles.title} id="room-door-title">
            Two rooms. Which one?
          </h2>

          <div class={styles.choices}>
            <button
              type="button"
              class={styles.choice}
              data-room="night"
              data-testid="room-door-night"
              onClick={() => choose('night')}
            >
              <span class={styles.choiceIcon} aria-hidden="true">
                <Show
                  when={props.instrument === 'guitar'}
                  fallback={<PianoKeys size={26} />}
                >
                  <Guitar />
                </Show>
              </span>
              <strong>{copy().night.title}</strong>
              <small>{copy().night.blurb}</small>
            </button>

            <button
              type="button"
              class={styles.choice}
              data-room="workspace"
              data-testid="room-door-workspace"
              onClick={() => choose('workspace')}
            >
              <span class={styles.choiceIcon} aria-hidden="true">
                <PianoWorkspace size={26} />
              </span>
              <strong>{copy().workspace.title}</strong>
              <small>{copy().workspace.blurb}</small>
            </button>
          </div>

          <div class={styles.remember}>
            <MercuryCheckbox
              checked={remember()}
              onChange={setRemember}
              id="room-door-remember"
            >
              Remember this — the tab goes straight there from now on
            </MercuryCheckbox>
          </div>
          <p class={styles.footnote}>
            Either way, Settings can change it later.
          </p>
        </section>
      </div>
    </Portal>
  )
}

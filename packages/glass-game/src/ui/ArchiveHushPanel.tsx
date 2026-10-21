// Archive protection controls — room progress, written notes, cloche rail and sound-blocking curtains.
import { For, Show } from 'solid-js'
import type { BreakableDefinition } from '../contracts'
import { formatArchiveNote } from '../core/archive-notes'
import type { ArchiveHushSessionSnapshot, createArchiveHushSession, } from './archive-hush-session'
import styles from './ArchiveHushPanel.module.css'

export function ArchiveHushPanel(props: {
  session: ReturnType<typeof createArchiveHushSession>
  state: ArchiveHushSessionSnapshot
  vessels: readonly BreakableDefinition[]
  room: { title: string; description: string; curtainLabel: string }
  roomNumber: number
  totalRooms: number
  inRoom: boolean
  doorOpen: boolean
}) {
  const complete = () => props.state.mode === 'complete'
  const retry = () => props.state.mode === 'retry'
  const configuring = () =>
    props.inRoom && props.state.room.phase === 'preparing'
  const curtainProtects = (id: string) =>
    props.state.room.curtainClosed &&
    props.state.room.curtainVesselIds.includes(id)
  const coverIndex = () =>
    Math.max(
      0,
      props.vessels.findIndex(
        (vessel) => vessel.id === props.state.room.coveredId,
      ),
    )
  return (
    <section
      class={styles.panel}
      data-testid="archive-hush-panel"
      data-mode={props.state.mode}
      data-room={props.state.roomId}
      data-in-room={props.inRoom}
      data-curtain={props.state.room.curtainClosed}
      data-travel={complete() || !props.inRoom}
      data-phase={props.state.room.phase}
      data-shields={props.state.room.protectedIds.length}
      data-cover={coverIndex()}
      aria-label="Protect the archive glass"
    >
      <div class={styles.heading}>
        <div>
          <span class={styles.eyebrow}>
            Room {props.roomNumber} of {props.totalRooms}
          </span>
          <h2 class={styles.title}>{props.room.title}</h2>
        </div>
        <Show when={!complete() && props.inRoom}>
          <strong class={styles.note}>
            {props.state.target === null
              ? 'Find your note'
              : formatArchiveNote(props.state.target)}
          </strong>
        </Show>
      </div>
      <p class={styles.message} role="status">
        {complete()
          ? !props.doorOpen
            ? 'Protection held. Land inside this room to open the door.'
            : props.roomNumber === props.totalRooms
              ? 'The final door is open. Walk through the lit passage to escape.'
              : 'Room protected. Take the side aisle to the open brass door and continue.'
          : !props.inRoom
            ? 'Follow the passage. Listening stays off between rooms.'
            : props.state.room.phase === 'telegraph'
              ? `Chime in ${Math.ceil(props.state.room.telegraphRemainingSeconds)}. Watch your displays.`
              : props.state.message}
      </p>
      <div class={styles.controls}>
        <Show when={!complete() && !retry() && props.inRoom}>
          <div
            class={styles.displays}
            tabIndex={0}
            aria-label="Choose a glass to protect"
          >
            <For each={props.vessels}>
              {(vessel, index) => (
                <button
                  type="button"
                  aria-pressed={props.state.room.aimedId === vessel.id}
                  disabled={!configuring()}
                  onClick={() => props.session.aim(vessel.id)}
                  data-testid={`archive-aim-${index()}`}
                >
                  <span>
                    {vessel.label
                      .replace('Sunlit ', '')
                      .replace('Sheltered ', '')
                      .replace(' Bowl', '')}
                  </span>
                  <small>
                    {props.state.room.coveredId === vessel.id
                      ? 'Covered'
                      : curtainProtects(vessel.id)
                        ? 'Curtain'
                        : props.state.room.protectedIds.includes(vessel.id)
                          ? 'Shielded'
                          : 'Hum to shield'}
                  </small>
                </button>
              )}
            </For>
          </div>
          <div class={styles.rail}>
            <label for="archive-cover-rail">
              Glass cover <span>{props.vessels[coverIndex()]?.label}</span>
            </label>
            <input
              id="archive-cover-rail"
              type="range"
              min="0"
              max={props.vessels.length - 1}
              step="1"
              value={coverIndex()}
              disabled={!configuring()}
              aria-label="Move glass cover"
              aria-valuetext={props.vessels[coverIndex()]?.label}
              onInput={(event) => {
                const vessel = props.vessels[Number(event.currentTarget.value)]
                if (vessel !== undefined) props.session.moveCover(vessel.id)
              }}
            />
          </div>
          <Show when={props.state.room.curtainVesselIds.length > 0}>
            <button
              class={styles.curtain}
              type="button"
              disabled={!configuring()}
              aria-pressed={props.state.room.curtainClosed}
              onClick={() =>
                props.session.setCurtainClosed(!props.state.room.curtainClosed)
              }
            >
              <span>
                {props.state.room.curtainClosed
                  ? 'Open curtain'
                  : 'Close curtain'}
              </span>
              <small>
                {props.state.room.curtainClosed
                  ? 'Sound path blocked'
                  : props.room.curtainLabel}
              </small>
            </button>
          </Show>
          <div
            class={styles.meter}
            role="progressbar"
            aria-label="Hum shield"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(props.state.room.holdProgress * 100)}
          >
            <span
              style={{ width: `${props.state.room.holdProgress * 100}%` }}
            />
          </div>
        </Show>
      </div>
      <div class={styles.actions}>
        <Show
          when={
            props.inRoom &&
            ['off', 'paused', 'error'].includes(props.state.mode)
          }
        >
          <button
            class={styles.primary}
            type="button"
            onClick={() => void props.session.start()}
          >
            {props.state.mode === 'off'
              ? 'Start listening'
              : 'Resume listening'}
          </button>
        </Show>
        <Show when={props.state.mode === 'listening' && configuring()}>
          <button type="button" onClick={() => void props.session.hear()}>
            Hear note
          </button>
          <button type="button" onClick={() => props.session.changeNote()}>
            Change note
          </button>
          <button
            class={styles.primary}
            type="button"
            disabled={props.state.coverMoving}
            onClick={() => props.session.ring()}
          >
            {props.state.coverMoving ? 'Cover moving' : 'Ring the chime'}
          </button>
        </Show>
        <Show
          when={['finding', 'permission', 'reference', 'listening'].includes(
            props.state.mode,
          )}
        >
          <button type="button" onClick={() => props.session.pause()}>
            Stop listening
          </button>
        </Show>
        <Show when={retry() && props.inRoom}>
          <button
            class={styles.primary}
            type="button"
            onClick={() => props.session.reset()}
          >
            Reset this arrangement
          </button>
        </Show>
      </div>
    </section>
  )
}

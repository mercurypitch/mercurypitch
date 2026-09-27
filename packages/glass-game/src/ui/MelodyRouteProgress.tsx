// Melody route progress — five stable station identities stay visible without turning travel into a score screen.

import { For } from 'solid-js'
import type { MelodyLessonDefinition } from '../melody-contracts'
import styles from './MelodyRouteProgress.module.css'

export function MelodyRouteProgress(props: {
  lesson: MelodyLessonDefinition
  completedEncounterIds: readonly string[]
  activeEncounterId: string | null
}) {
  const completed = () =>
    props.lesson.stations.filter((station) =>
      props.completedEncounterIds.includes(station.encounterId),
    ).length
  return (
    <div
      class={styles.route}
      role="progressbar"
      aria-label={`${completed()} of ${props.lesson.stations.length} melody notes learned`}
      aria-valuemin={0}
      aria-valuemax={props.lesson.stations.length}
      aria-valuenow={completed()}
    >
      <For each={props.lesson.stations}>
        {(station, index) => {
          const done = () =>
            props.completedEncounterIds.includes(station.encounterId)
          const active = () => props.activeEncounterId === station.encounterId
          return (
            <span
              class={styles.note}
              classList={{
                [styles.complete]: done(),
                [styles.active]: active(),
              }}
              aria-hidden="true"
              data-station-id={station.encounterId}
            >
              {index() + 1}
            </span>
          )
        }}
      </For>
    </div>
  )
}

// Runner finish rewards show singing grades, route pickups, and the collected finale portrait separately.
import { createMemo, Show } from 'solid-js'
import type { CompiledRunnerCourse } from '../runner/contracts'
import { runnerRewardSummary } from './runner-rewards'
import styles from './RunnerFinishRewards.module.css'
import viewStyles from './SongRunnerView.module.css'

export function RunnerFinishRewards(props: {
  course: CompiledRunnerCourse
  collectedRewardIds: readonly string[]
  runStars: number
  bestStars: number
  maximumStars: number
  assetUrl(id: string): string
}) {
  const rewards = createMemo(() =>
    runnerRewardSummary(props.course, props.collectedRewardIds),
  )
  return (
    <>
      <div class={viewStyles.results}>
        <div>
          <span>This run</span>
          <strong>
            {props.runStars} / {props.maximumStars} stars
          </strong>
        </div>
        <div>
          <span>Your best</span>
          <strong>
            {props.bestStars} / {props.maximumStars} stars
          </strong>
        </div>
        <div>
          <span>Pickups</span>
          <strong>
            {rewards().collectedPickups} / {rewards().availablePickups}
          </strong>
        </div>
      </div>
      <Show when={rewards().portrait} keyed>
        {(portrait) => (
          <figure class={styles.portrait}>
            <img
              src={props.assetUrl(portrait.imageAsset)}
              alt={portrait.description}
              width="192"
              height="192"
            />
            <figcaption>
              <span>Portrait collected</span>
              <strong>{portrait.title}</strong>
              <p>Kept with your course rewards on every replay.</p>
            </figcaption>
          </figure>
        )}
      </Show>
    </>
  )
}

// Singing Current map invitation — a clear, separately unlocked musical course.
import styles from './IslandTrials.module.css'

export function SongRunnerJourneyCard(props: {
  unlocked: boolean
  disabled: boolean
  imageUrl: string
  onEnter: () => void
}) {
  return (
    <section class={styles.trials} aria-label="The Singing Current">
      <article
        class={styles.card}
        data-runner-unlocked={String(props.unlocked)}
      >
        <img class={styles.art} src={props.imageUrl} alt="" loading="lazy" />
        <div class={styles.copy}>
          <span class={styles.island}>A moving melody</span>
          <h3>The Singing Current</h3>
          <p>
            Follow three paths through the clouds. Jump between phrases, then
            sing the glass open.
          </p>
          <button
            type="button"
            class={styles.enter}
            disabled={props.disabled || !props.unlocked}
            onClick={() => {
              if (props.unlocked && !props.disabled) props.onEnter()
            }}
          >
            {props.unlocked
              ? 'Play The Singing Current'
              : 'Finish First Light to unlock'}
          </button>
          <small>
            About 90 seconds. A missed note leaves room for the next.
          </small>
        </div>
      </article>
    </section>
  )
}

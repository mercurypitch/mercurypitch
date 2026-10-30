// Studio playback notice — says so in the workspace when Auto moved playback down a level for this session.
import { createSignal, Show } from 'solid-js'
import styles from '../StudioPage.module.css'
import { usePlaybackQuality } from './usePlaybackQuality'

export function StudioPlaybackNotice(props: { readonly onShow: () => void }) {
  const quality = usePlaybackQuality()
  const [dismissed, setDismissed] = createSignal<string | null>(null)
  const notice = () => {
    const text = quality.state().notice
    return text !== dismissed() ? text : null
  }
  return (
    <Show when={notice()}>
      {(text) => (
        <div class={styles.notice} role="status">
          <p>{text()}</p>
          <button type="button" class={styles.button} onClick={props.onShow}>
            Playback quality
          </button>
          <button
            type="button"
            class={styles.button}
            onClick={() => setDismissed(text())}
          >
            Dismiss
          </button>
        </div>
      )}
    </Show>
  )
}

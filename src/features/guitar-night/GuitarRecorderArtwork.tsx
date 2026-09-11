// Decorative reel motion stays independent of capture, monitoring and their clocks.
import { createSignal, onCleanup, onMount, Show } from 'solid-js'
import styles from './GuitarRecorderArtwork.module.css'
import { MELODY_RECORDER_ART } from './GuitarRecordingGallery'

export const RECORDER_REEL_LOOP = '/guitar-night/melody-recorder-reels-v1.mp4'

function RecorderLoop(props: { onFailure(): void }) {
  let video!: HTMLVideoElement
  let disposed = false
  const fail = () => {
    if (!disposed) props.onFailure()
  }
  const [playing, setPlaying] = createSignal(false)
  onMount(() => {
    video.muted = true
    onCleanup(() => {
      disposed = true
      video.pause()
      video.removeAttribute('src')
      video.load()
    })
    // This never participates in the Record promise. An obsolete play result
    // cannot restart a removed element or mutate the next recording's artwork.
    void video.play().catch(fail)
  })
  return (
    <video
      ref={video}
      class={styles.reels}
      data-playing={playing()}
      src={RECORDER_REEL_LOOP}
      width="384"
      height="384"
      muted
      loop
      playsinline
      preload="none"
      disablepictureinpicture
      tabIndex={-1}
      onPlaying={() => setPlaying(true)}
      onWaiting={() => setPlaying(false)}
      onError={fail}
    />
  )
}

export function GuitarRecorderArtwork(props: { recording: boolean }) {
  let artwork!: HTMLSpanElement
  const [motionAllowed, setMotionAllowed] = createSignal(false)
  const [visible, setVisible] = createSignal(false)
  const [inView, setInView] = createSignal(false)
  const [failed, setFailed] = createSignal(false)

  onMount(() => {
    // Without masking support the movie's opaque canvas must never be shown.
    if (
      typeof CSS === 'undefined' ||
      typeof CSS.supports !== 'function' ||
      !CSS.supports('mask-image', 'url("")')
    )
      return
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updateMotion = () => setMotionAllowed(!preference.matches)
    const updateVisibility = () =>
      setVisible(document.visibilityState === 'visible')
    updateMotion()
    updateVisibility()
    preference.addEventListener('change', updateMotion)
    document.addEventListener('visibilitychange', updateVisibility)
    const observer =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver((entries) => {
            setInView(entries.some((entry) => entry.isIntersecting))
          })
    if (observer === null) setInView(true)
    else observer.observe(artwork)
    onCleanup(() => {
      preference.removeEventListener('change', updateMotion)
      document.removeEventListener('visibilitychange', updateVisibility)
      observer?.disconnect()
    })
  })

  return (
    <span ref={artwork} class={styles.artwork} aria-hidden="true">
      <img src={MELODY_RECORDER_ART} width="128" height="128" alt="" />
      <Show
        when={
          props.recording &&
          motionAllowed() &&
          visible() &&
          inView() &&
          !failed()
        }
      >
        <RecorderLoop onFailure={() => setFailed(true)} />
      </Show>
    </span>
  )
}

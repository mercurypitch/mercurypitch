// ============================================================
// The Karaoke room in the small window: the line, the next, the title
// ============================================================
//
// What the room draws while Android shows it in a picture-in-picture window
// (useKaraokePictureInPicture.ts). The window is a few centimetres across
// and nobody can tap into it, so it holds only what a singer reads from the
// corner of their eye: the line being sung, big; the next one, smaller; the
// song's title, smallest. No header, no bar, no buttons. The window's own
// play and pause are Android's, from the media session.
//
// In a rest, and before the first line, there is no line being sung: the
// line coming takes the big place, dimmed, so the window never goes blank
// mid-song. A song with no lyrics shows its title there.

import type { JSX } from 'solid-js'
import { Show } from 'solid-js'
import type { LyricGlance } from '@/lib/lyric-glance'
import styles from './karaoke-room.module.css'

export interface KaraokeLyricsWindowProps {
  readonly title: string
  readonly glance: LyricGlance
}

export function KaraokeLyricsWindow(
  props: KaraokeLyricsWindowProps,
): JSX.Element {
  const hasLyrics = (): boolean =>
    props.glance.current !== null || props.glance.next !== null
  const waiting = (): boolean =>
    props.glance.current === null && props.glance.next !== null
  const big = (): string =>
    props.glance.current ?? props.glance.next ?? props.title
  const below = (): string | null =>
    props.glance.current === null ? null : props.glance.next

  return (
    <div class={styles.lyricsWindow} data-testid="karaoke-lyrics-window">
      <Show when={hasLyrics()}>
        <p class={styles.windowTitle}>{props.title}</p>
      </Show>
      <p
        class={styles.windowLine}
        classList={{ [styles.windowWaiting]: waiting() }}
        data-testid="karaoke-lyrics-window-line"
      >
        {big()}
      </p>
      <Show when={below()}>
        {(next) => (
          <p class={styles.windowNext} data-testid="karaoke-lyrics-window-next">
            {next()}
          </p>
        )}
      </Show>
    </div>
  )
}

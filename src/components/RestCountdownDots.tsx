import type { Accessor, Component, JSX } from 'solid-js'
import { For } from 'solid-js'
import { computeRestProgress, SECONDS_PER_REST_DOT } from '@/lib/canonical-lrc'

interface RestCountdownDotsProps {
  dotCount: number
  elapsed: Accessor<number>
  gapEnd: number
  gapStart: number
  onSeek?: (time: number) => void
  style?: JSX.CSSProperties
}

export function getRestDotSeekTime(
  gapStart: number,
  gapEnd: number,
  index: number,
): number {
  return Math.min(gapEnd, gapStart + index * SECONDS_PER_REST_DOT)
}

export const RestCountdownDots: Component<RestCountdownDotsProps> = (props) => {
  const progress = () =>
    computeRestProgress(
      props.gapStart,
      props.gapEnd,
      props.dotCount,
      props.elapsed(),
    )

  return (
    <span
      class="sm-lyrics-rest-dots"
      aria-hidden={props.onSeek === undefined ? 'true' : undefined}
      aria-label={props.onSeek === undefined ? undefined : 'Rest countdown'}
      style={props.style}
    >
      <For each={Array.from({ length: props.dotCount })}>
        {(_, index) => {
          const fill = () => {
            const current = progress()
            if (index() < current.filledDots) return 1
            if (index() === current.filledDots) return current.currentDotFrac
            return 0
          }
          const seekTime = () =>
            getRestDotSeekTime(props.gapStart, props.gapEnd, index())

          const onSeek = props.onSeek
          return onSeek === undefined ? (
            <span
              class="sm-lyrics-rest-dot"
              style={{ '--fill': `${Math.round(fill() * 100)}%` }}
            />
          ) : (
            <button
              type="button"
              class="sm-lyrics-rest-dot sm-lyrics-rest-dot--interactive"
              aria-label={`Seek to ${seekTime()} seconds`}
              onClick={(event) => {
                event.stopPropagation()
                onSeek(seekTime())
              }}
              style={{ '--fill': `${Math.round(fill() * 100)}%` }}
            />
          )
        }}
      </For>
    </span>
  )
}

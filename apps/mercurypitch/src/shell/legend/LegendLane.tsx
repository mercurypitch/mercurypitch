// ============================================================
// LegendLane — a take of the Legend, drawn in the room's light
// ============================================================
//
// The line as glass notes passing a now line, one row to a pitch, and the
// voice as a lit ribbon up to the now line. The note under it is lit
// violet, brighter as the voice nears it; a passed note is teal with a
// check when it was lit and red with a cross when it was missed. The
// numbers are legend-lane.ts; this draws them, and measures its own box.
//
// It stands where the web's zen canvas stood: the session under it, and so
// the score, are the web stage's own (legend-take.ts), so a take on the
// phone and a take in a browser mean the same on one board.
//
// The pulse at the voice's tip is CSS, and stops with reduced motion; the
// rest moves only as the take does.

import type { JSX } from 'solid-js'
import { createMemo, createSignal, createUniqueId, Index, onCleanup, onMount, Show, } from 'solid-js'
import type { LaneView, StageBox, StageNote } from './legend-lane'

export interface LegendLaneProps {
  /** The lane for a box this size, now. */
  view: (box: StageBox) => LaneView
  /** What the lane shows, for a screen reader. */
  summary: () => string
}

const NOTE_H = 24

/** A check or a cross on a passed note's corner: never colour alone. */
function Badge(props: { note: () => StageNote }): JSX.Element {
  const cx = (): number => props.note().x + props.note().width - 2
  const cy = (): number => props.note().y - NOTE_H / 2
  return (
    <g class="mp-legend-lane__badge" data-look={props.note().look}>
      <circle cx={cx()} cy={cy()} r="8.5" />
      <Show
        when={props.note().look === 'lit'}
        fallback={
          <path
            d={`M${cx() - 3} ${cy() - 3}l6 6M${cx() + 3} ${cy() - 3}l-6 6`}
          />
        }
      >
        <path d={`M${cx() - 4} ${cy() + 0.4}l2.8 2.8 5-5.4`} />
      </Show>
    </g>
  )
}

export function LegendLane(props: LegendLaneProps): JSX.Element {
  const id = createUniqueId()
  let host: HTMLDivElement | undefined
  const [box, setBox] = createSignal<StageBox>({ width: 390, height: 480 })

  onMount(() => {
    if (host === undefined) return
    const measure = (): void => {
      const rect = host?.getBoundingClientRect()
      if (rect === undefined || rect.width === 0 || rect.height === 0) return
      setBox({ width: Math.round(rect.width), height: Math.round(rect.height) })
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(host)
    onCleanup(() => observer.disconnect())
  })

  // Once a frame, however many bindings read it.
  const view = createMemo((): LaneView => props.view(box()))
  const passed = (): StageNote[] =>
    view().notes.filter((note) => note.look === 'lit' || note.look === 'missed')
  const now = (): StageNote[] =>
    view().notes.filter((note) => note.look === 'now')
  const ahead = (): StageNote[] =>
    view().notes.filter((note) => note.look === 'ahead')

  return (
    <div class="mp-legend-lane" ref={host} data-testid="legend-lane">
      <svg
        width={box().width}
        height={box().height}
        viewBox={`0 0 ${box().width} ${box().height}`}
        role="img"
        aria-label={props.summary()}
      >
        <defs>
          <linearGradient
            id={`${id}-fade`}
            x1="0"
            y1="0"
            x2="76"
            y2="0"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stop-color="#000000" />
            <stop offset="1" stop-color="#ffffff" />
          </linearGradient>
          <mask
            id={`${id}-mask`}
            maskUnits="userSpaceOnUse"
            x="0"
            y="0"
            width={box().width}
            height={box().height}
          >
            <rect
              x="0"
              y="0"
              width={box().width}
              height={box().height}
              fill={`url(#${id}-fade)`}
            />
          </mask>
          <linearGradient
            id={`${id}-voice`}
            x1="0"
            y1="0"
            x2={view().nowX}
            y2="0"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stop-color="#7fdcf5" stop-opacity="0.2" />
            <stop offset="0.45" stop-color="#7fdcf5" stop-opacity="0.7" />
            <stop offset="1" stop-color="#c9f6ff" />
          </linearGradient>
          <linearGradient id={`${id}-lit`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#cbbfff" stop-opacity="0.8" />
            <stop offset="1" stop-color="#7c4dff" stop-opacity="0.6" />
          </linearGradient>
          <linearGradient id={`${id}-teal`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#2ee6c9" stop-opacity="0.5" />
            <stop offset="1" stop-color="#13917f" stop-opacity="0.35" />
          </linearGradient>
          <linearGradient id={`${id}-now`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#ffffff" stop-opacity="0" />
            <stop offset="0.5" stop-color="#ffffff" stop-opacity="0.7" />
            <stop offset="1" stop-color="#ffffff" stop-opacity="0" />
          </linearGradient>
          <radialGradient id={`${id}-tip`} cx="0.38" cy="0.32" r="0.75">
            <stop offset="0" stop-color="#ffffff" />
            <stop offset="0.4" stop-color="#c9f6ff" />
            <stop offset="1" stop-color="#4fc8ea" />
          </radialGradient>
          <radialGradient id={`${id}-tipglow`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stop-color="#7fdcf5" stop-opacity="0.55" />
            <stop offset="1" stop-color="#7fdcf5" stop-opacity="0" />
          </radialGradient>
          <filter
            id={`${id}-blur`}
            x="-50%"
            y="-200%"
            width="200%"
            height="500%"
          >
            <feGaussianBlur stdDeviation="7" />
          </filter>
        </defs>

        <g mask={`url(#${id}-mask)`}>
          <Index each={view().rows}>
            {(row) => (
              <line
                class="mp-legend-lane__row"
                x1="0"
                x2={box().width}
                y1={row().y}
                y2={row().y}
              />
            )}
          </Index>
          <Index each={passed()}>
            {(note) => (
              <rect
                class="mp-legend-lane__note"
                data-look={note().look}
                x={note().x}
                y={note().y - NOTE_H / 2}
                width={note().width}
                height={NOTE_H}
                rx={NOTE_H / 2}
                fill={note().look === 'lit' ? `url(#${id}-teal)` : undefined}
              />
            )}
          </Index>
          <Show when={view().voice !== ''}>
            <path
              class="mp-legend-lane__voice-halo"
              d={view().voice}
              stroke={`url(#${id}-voice)`}
            />
            <path
              class="mp-legend-lane__voice"
              d={view().voice}
              stroke={`url(#${id}-voice)`}
            />
          </Show>
          <Index each={passed()}>{(note) => <Badge note={note} />}</Index>
        </g>

        <Index each={now()}>
          {(note) => (
            <g data-look="now">
              <rect
                x={note().x}
                y={note().y - NOTE_H / 2}
                width={note().width}
                height={NOTE_H}
                rx={NOTE_H / 2}
                fill="#9a87f0"
                opacity={0.25 + 0.4 * note().glow}
                filter={`url(#${id}-blur)`}
              />
              <rect
                class="mp-legend-lane__note"
                data-look="now"
                x={note().x}
                y={note().y - NOTE_H / 2}
                width={note().width}
                height={NOTE_H}
                rx={NOTE_H / 2}
                fill={`url(#${id}-lit)`}
              />
              {/* Its name in the part still to sing, clear of the voice's
                  tip; none once too little is left to hold it. */}
              <Show when={note().x + note().width - view().nowX >= 40}>
                <text
                  class="mp-legend-lane__label"
                  data-look="now"
                  x={(view().nowX + 10 + note().x + note().width) / 2}
                  y={note().y + 4.6}
                  text-anchor="middle"
                >
                  {note().label}
                </text>
              </Show>
            </g>
          )}
        </Index>

        <Index each={ahead()}>
          {(note) => (
            <g data-look="ahead">
              <rect
                class="mp-legend-lane__note"
                data-look="ahead"
                x={note().x}
                y={note().y - NOTE_H / 2}
                width={note().width}
                height={NOTE_H}
                rx={NOTE_H / 2}
              />
              <Show when={note().width >= 30}>
                <text
                  class="mp-legend-lane__label"
                  x={note().x + note().width / 2}
                  y={note().y + 4.6}
                  text-anchor="middle"
                >
                  {note().label}
                </text>
              </Show>
            </g>
          )}
        </Index>

        <rect
          x={view().nowX - 1}
          y="24"
          width="2"
          height={Math.max(0, box().height - 48)}
          rx="1"
          fill={`url(#${id}-now)`}
        />

        <Show when={view().tip}>
          {(tip) => (
            <g>
              <circle
                cx={tip().x}
                cy={tip().y}
                r="22"
                fill={`url(#${id}-tipglow)`}
              />
              <circle
                class="mp-legend-lane__pulse"
                cx={tip().x}
                cy={tip().y}
                r="9"
              />
              <circle
                cx={tip().x}
                cy={tip().y}
                r="7"
                fill={`url(#${id}-tip)`}
              />
            </g>
          )}
        </Show>

        <g class="mp-legend-lane__names">
          <Index each={view().rows}>
            {(row) => (
              <text x="14" y={row().y + 4.6}>
                {row().label}
              </text>
            )}
          </Index>
        </g>
      </svg>
    </div>
  )
}

// Studio strip meter — a lane's level after its fader, drawn beside the fader in the master meter's segments.
//
// The transport reads every lane's peak on the same tick as the master
// meter, so this component runs no loop of its own: it redraws when the
// level it is given changes. It is hidden from screen readers, which hear
// the fader's own value; the numbers are in its title. With no level (the
// song stopped, or the lane not built) it sits at the floor.
import { createMemo, createSignal, onCleanup, onMount, Show } from 'solid-js'
import type { StudioLaneLevel } from '@/lib/studio/playback/transport'
import type { StripHold } from './strip-meter'
import { amplitudeDb, reductionTravel, stepStripHold, stripHoldDb, stripMeterTitle, stripTravel, } from './strip-meter'
import styles from './StudioStripMeter.module.css'

interface Props {
  /** The lane's name, for the title. */
  name: string
  /** Its level while the song plays; undefined while it does not. */
  level: StudioLaneLevel | undefined
}

/** The gap between the fader and the meter, in pixels. */
const FADER_GAP = 6

const reducedMotion =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null

export function StudioStripMeter(props: Props) {
  let meter!: HTMLDivElement
  let hold: StripHold | null = null
  const [box, setBox] = createSignal<{
    top: number
    left: number
    height: number
  } | null>(null)
  const reading = createMemo(() => {
    const level = props.level
    if (!level) {
      hold = null
      return null
    }
    const now = performance.now()
    const db = amplitudeDb(level.peak)
    const reduced = reducedMotion?.matches === true
    hold = stepStripHold(hold, db, now, reduced)
    return {
      db,
      holdDb: stripHoldDb(hold, now, reduced),
      reductionDb: level.reductionDb,
    }
  })
  // Moved, not laid out again: the hold rides a transform over the rail.
  const holdPixels = () =>
    ((box()?.height ?? 0) * stripTravel(reading()?.holdDb ?? -Infinity)) / 100
  const decibels = (db: number) =>
    Number.isFinite(db) ? db.toFixed(1) : '-inf'

  // The strip lays the fader out; the meter follows its box, inside the
  // cap's travel, so it never moves the strip's own controls.
  onMount(() => {
    const strip = meter.parentElement
    const fader = strip?.querySelector<HTMLElement>('[data-studio-fader]')
    if (!strip || !fader || typeof ResizeObserver === 'undefined') return
    const measure = () => {
      const outer = strip.getBoundingClientRect()
      const inner = fader.getBoundingClientRect()
      const cap =
        Number.parseFloat(
          window.getComputedStyle(fader).getPropertyValue('--cap'),
        ) || 0
      setBox({
        top: inner.top - outer.top - strip.clientTop + cap / 2,
        left: inner.right - outer.left - strip.clientLeft + FADER_GAP,
        height: Math.max(0, inner.height - cap),
      })
    }
    const observer = new ResizeObserver(measure)
    observer.observe(strip)
    observer.observe(fader)
    onCleanup(() => observer.disconnect())
  })

  return (
    <div
      ref={meter}
      class={styles.meter}
      aria-hidden="true"
      title={stripMeterTitle(props.name, reading())}
      data-studio-strip-meter
      data-level-db={reading() ? decibels(reading()!.db) : undefined}
      data-reduction-db={reading()?.reductionDb?.toFixed(1)}
      style={
        box()
          ? {
              top: `${box()!.top}px`,
              left: `${box()!.left}px`,
              height: `${box()!.height}px`,
            }
          : { visibility: 'hidden' }
      }
    >
      <div class={styles.rail}>
        <i
          style={{
            'clip-path': `inset(${100 - stripTravel(reading()?.db ?? -Infinity)}% 0 0 0)`,
          }}
        />
        <b
          style={{
            transform: `translateY(${-holdPixels()}px)`,
          }}
        />
      </div>
      <Show when={reading()?.reductionDb != null}>
        <div class={styles.reduction}>
          <i
            style={{
              transform: `scaleY(${reductionTravel(reading()?.reductionDb ?? 0) / 100})`,
            }}
          />
        </div>
      </Show>
    </div>
  )
}

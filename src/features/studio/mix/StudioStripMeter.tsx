// Studio strip meter — a lane's level after its fader, drawn beside the fader on the fader's own dB marks, in the master meter's segments.
//
// The transport reads every lane's peak on the same tick as the master
// meter, so this component runs no loop of its own: it redraws when the
// level it is given changes. It is hidden from screen readers, which hear
// the fader's own value; the numbers are in its title. With no level (the
// song stopped, or the lane not built) it sits at the floor.
//
// It lives inside the fader's drag area: a press on it starts a fader drag
// there, and a pointer resting on it still reads its title. Its 0 dBFS
// stands beside the fader's 0 dB mark and its floor beside the -60 mark, so
// a level reads against the marks printed beside the fader.
import { createMemo, createSignal, onCleanup, onMount, Show } from 'solid-js'
import type { StudioLaneLevel } from '@/lib/studio/playback/transport'
import { STUDIO_FADER_MAX_DB, STUDIO_FADER_MIN_DB, } from '../timeline/StudioTrackControls'
import type { StripHold } from './strip-meter'
import { amplitudeDb, reductionTravel, stepStripHold, stripHoldDb, stripMeterTitle, stripTravel, } from './strip-meter'
import styles from './StudioStripMeter.module.css'

interface Props {
  /** The lane's name, for the title. */
  name: string
  /**
   * Its level while the song plays; undefined while it does not. A level
   * from a new measurement, a seek or a run taking over, starts the peak
   * hold again, as the master meter's does.
   */
  level: StudioLaneLevel | undefined
}

/** The gap between the fader and the meter, in pixels. */
const FADER_GAP = 6
const FADER_RANGE_DB = STUDIO_FADER_MAX_DB - STUDIO_FADER_MIN_DB
/** Where the fader's 0 dB mark sits on its travel, as a share from the top. */
const ZERO_MARK = STUDIO_FADER_MAX_DB / FADER_RANGE_DB
/** The share of the travel from the 0 dB mark down to the floor. */
const FLOOR_SPAN = -STUDIO_FADER_MIN_DB / FADER_RANGE_DB

const reducedMotion =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null

export function StudioStripMeter(props: Props) {
  let meter!: HTMLDivElement
  let hold: StripHold | null = null
  let heldMeasurement: number | undefined
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
    // A seek's first reading starts the hold again from the frame it is
    // heard: the new place's peaks are not the old one's.
    if (level.measurement !== heldMeasurement) {
      heldMeasurement = level.measurement
      hold = null
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

  // The fader's area lays the fader out; the meter follows its box, from
  // the 0 dB mark down the cap's travel, so it never moves the controls.
  onMount(() => {
    const host = meter.parentElement
    const fader = host?.querySelector<HTMLElement>('[data-studio-fader]')
    if (!host || !fader || typeof ResizeObserver === 'undefined') return
    const measure = () => {
      const outer = host.getBoundingClientRect()
      const inner = fader.getBoundingClientRect()
      const cap =
        Number.parseFloat(
          window.getComputedStyle(fader).getPropertyValue('--cap'),
        ) || 0
      const travel = Math.max(0, inner.height - cap)
      setBox({
        top:
          inner.top - outer.top - host.clientTop + cap / 2 + travel * ZERO_MARK,
        left: inner.right - outer.left - host.clientLeft + FADER_GAP,
        height: travel * FLOOR_SPAN,
      })
    }
    const observer = new ResizeObserver(measure)
    observer.observe(host)
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

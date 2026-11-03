// Studio automation test doubles — an AudioParam that keeps its events as Chromium does and reads its value at any time.
import type { FakeNode } from '@/lib/studio-fx/fake-audio-graph.test-fixtures'
import { PlaybackContext, PlaybackParam } from './playback.test-fixtures'

interface TimelineEvent {
  readonly type: 'set' | 'ramp'
  readonly time: number
  readonly value: number
}

/**
 * An AudioParam whose set, ramp and cancel calls keep a timeline as
 * Chromium does: events in time order, a time already gone moved up to
 * the clock, an event of the same kind at the same time replaced, and a
 * cancel taking away everything from its time on. Its value at any time
 * is read off that timeline as the Web Audio spec computes it.
 */
export class TimelineParam extends PlaybackParam {
  timeline: TimelineEvent[] = []
  /** Every write asked for a time the clock had passed, which a browser would have moved. */
  readonly late: { time: number; clock: number }[] = []

  constructor(
    private readonly clock: () => number,
    private readonly initial = 1,
  ) {
    super(initial)
  }

  private insert(type: TimelineEvent['type'], value: number, time: number) {
    const clock = this.clock()
    if (time < clock) this.late.push({ time, clock })
    const at = Math.max(time, clock)
    const same = this.timeline.findIndex(
      (event) => event.time === at && event.type === type,
    )
    if (same >= 0) {
      this.timeline[same] = { type, time: at, value }
      return
    }
    const after = this.timeline.findIndex((event) => event.time > at)
    this.timeline.splice(after < 0 ? this.timeline.length : after, 0, {
      type,
      time: at,
      value,
    })
  }

  override setValueAtTime(value: number, time: number): this {
    this.insert('set', value, time)
    return super.setValueAtTime(value, time)
  }

  override linearRampToValueAtTime(value: number, time: number): this {
    this.insert('ramp', value, time)
    return super.linearRampToValueAtTime(value, time)
  }

  override cancelScheduledValues(time: number): this {
    this.timeline = this.timeline.filter((event) => event.time < time)
    return super.cancelScheduledValues(time)
  }

  /** The value the param plays at `time`. */
  valueAt(time: number): number {
    let before: TimelineEvent | undefined
    for (const event of this.timeline) {
      if (event.time > time) {
        if (event.type === 'ramp' && before)
          return (
            before.value +
            ((event.value - before.value) * (time - before.time)) /
              (event.time - before.time)
          )
        break
      }
      before = event
    }
    return before?.value ?? this.initial
  }

  /** The largest change from one frame of a 48 kHz clock to the next, from `from` to `to`. */
  largestStep(from: number, to: number): number {
    let largest = 0
    let previous = this.valueAt(from)
    for (let frame = 1; frame <= Math.round((to - from) * 48000); frame++) {
      const value = this.valueAt(from + frame / 48000)
      largest = Math.max(largest, Math.abs(value - previous))
      previous = value
    }
    return largest
  }
}

/** A playback context whose every gain keeps a timeline (TimelineParam). */
export class AutomationContext extends PlaybackContext {
  override createGain() {
    const gain = super.createGain()
    Object.defineProperty(gain, 'gain', {
      value: new TimelineParam(() => this.currentTime),
    })
    return gain
  }

  /** The left and right stage gains that feed `merge`, in that order. */
  stagesInto(merge: FakeNode): TimelineParam[] {
    const into = this.ofType<ReturnType<AutomationContext['createGain']>>(
      'gain',
    ).flatMap((gain) =>
      gain.connections
        .filter((connection) => connection.node === merge)
        .map((connection) => ({ gain, side: connection.input })),
    )
    return into
      .sort((a, b) => a.side - b.side)
      .map(({ gain }) => gain.gain as unknown as TimelineParam)
  }
}

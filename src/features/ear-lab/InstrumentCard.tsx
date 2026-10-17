// ============================================================
// InstrumentCard — the engraved plate at the stage's top left.
//
// The bench caption and the drill's paragraph used to sit under the
// play pads, where they read as part of the console. They are about
// the instrument, so they hang on it: icon, name, what it measures,
// and the text clamped to three lines (or the drill's own count, where
// that shows all of it) until More. On a phone the plate folds to one
// row — "About Bassline" — and unfolds over the instrument; which
// drills stay open is remembered per drill.
// ============================================================

import type { JSX } from 'solid-js'
import { createEffect, createSignal, createUniqueId, onCleanup, Show, } from 'solid-js'
import { earInfoOpen, setEarInfoOpen } from '@/stores/ear-lab-store'
import { IconChevron } from './ear-icons'
import { iconForDrill } from './instrument-icons'
import styles from './InstrumentCard.module.css'
import { useCompactStage } from './use-compact-stage'

export interface InstrumentCardProps {
  drillId: string
  name: string
  /** The bench caption: "Resolution · cents". */
  measures?: string
  description: string
  /** Lines of text before More. Three, unless the drill's instrument
   *  starts low enough to leave room under the plate for more; and only
   *  where that many show the whole text, or it is three again. */
  lines?: number
}

/** The clamp's own count, where a drill names none (the stylesheet's). */
const DEFAULT_LINES = 3

export function InstrumentCard(props: InstrumentCardProps): JSX.Element {
  const compact = useCompactStage()
  const open = (): boolean => earInfoOpen(props.drillId)
  const toggle = (): void => setEarInfoOpen(props.drillId, !open())
  const textId = createUniqueId()
  const shown = (): boolean => !compact() || open()

  // How many lines the text needs: its unclamped height (scrollHeight)
  // over its line height, so the clamp it decides cannot feed back into
  // it. Read whenever the text's box changes size (a resize, a rotation,
  // the card unfolding) and once the fonts are in; never from onMount,
  // where Solid has not flushed the DOM yet (MISTAKES.md). Null until
  // then, and where nothing is laid out (tests): the text is assumed to
  // need more than the clamp shows.
  const [textEl, setTextEl] = createSignal<HTMLParagraphElement>()
  const [needed, setNeeded] = createSignal<number | null>(null)
  const measure = (element: HTMLParagraphElement): void => {
    if (element.scrollHeight === 0) return
    const style = window.getComputedStyle(element)
    const lineHeight = parseFloat(style.lineHeight)
    if (!(lineHeight > 0)) return
    const padding =
      (parseFloat(style.paddingTop) || 0) +
      (parseFloat(style.paddingBottom) || 0)
    setNeeded(Math.round((element.scrollHeight - padding) / lineHeight))
  }
  createEffect(() => {
    const element = textEl()
    if (element === undefined) return
    // The count changes the paragraph's own box, so it is read a frame
    // after the observer calls: read inside the callback, the new clamp
    // raises "ResizeObserver loop completed with undelivered
    // notifications". Frames stop where the page is not painting, so a
    // timer races the frame and the first to arrive reads (MISTAKES.md).
    let live = true
    let frame = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    const read = (): void => {
      cancelAnimationFrame(frame)
      clearTimeout(timer)
      frame = 0
      timer = undefined
      measure(element)
    }
    const schedule = (): void => {
      if (!live || frame !== 0 || timer !== undefined) return
      frame = requestAnimationFrame(read)
      timer = setTimeout(read, 50)
    }
    const observer = new ResizeObserver(schedule)
    observer.observe(element)
    // A web font sets the text wider or narrower than the fallback did,
    // and inside the clamp that need not change the box's size.
    if ('fonts' in document) void document.fonts.ready.then(schedule)
    onCleanup(() => {
      live = false
      observer.disconnect()
      cancelAnimationFrame(frame)
      clearTimeout(timer)
    })
  })
  // A drill's own count holds only where it shows the whole text: where
  // it would still cut (a narrower desk), the plate keeps three lines and
  // More rather than hang lower over the instrument for nothing.
  const lines = (): number | undefined => {
    const count = needed()
    return count === null || props.lines === undefined || count <= props.lines
      ? props.lines
      : undefined
  }
  // More wherever the clamp cuts, so a card folded back with Less offers
  // More again.
  const clamps = (): boolean => {
    const count = needed()
    return count === null || count > (lines() ?? DEFAULT_LINES)
  }

  return (
    <aside
      class={styles.card}
      classList={{
        [styles.cardOpen]: open(),
        [styles.cardCompact]: compact(),
      }}
      data-testid="ear-instrument-card"
      data-open={open() ? 'true' : 'false'}
      aria-label={`About ${props.name}`}
    >
      <button
        type="button"
        class={styles.head}
        aria-expanded={open()}
        aria-controls={shown() ? textId : undefined}
        onClick={toggle}
      >
        <span class={styles.glyph} aria-hidden="true">
          {iconForDrill(props.drillId)({ size: 20 })}
        </span>
        <span class={styles.title}>
          <b class={styles.name}>
            {compact() ? `About ${props.name}` : props.name}
          </b>
          <Show when={props.measures !== undefined && !compact()}>
            <small class={styles.measures}>{props.measures}</small>
          </Show>
        </span>
        <IconChevron size={14} class={styles.chevron} />
      </button>
      <Show when={shown()}>
        <Show when={compact() && props.measures !== undefined}>
          <small class={styles.kicker}>{props.measures}</small>
        </Show>
        <p
          id={textId}
          ref={setTextEl}
          class={styles.text}
          classList={{ [styles.textClamped]: !open() && !compact() }}
          style={
            lines() === undefined ? {} : { '--card-lines': String(lines()) }
          }
        >
          {props.description}
        </p>
      </Show>
      <Show when={!compact() && (clamps() || open())}>
        <button
          type="button"
          class={styles.more}
          aria-expanded={open()}
          aria-controls={textId}
          onClick={toggle}
        >
          {open() ? 'Less' : 'More'}
        </button>
      </Show>
    </aside>
  )
}

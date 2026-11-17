// ============================================================
// The launch button in its sheet: pinned to an edge, or out of sight
// ============================================================
//
// On a phone the stage pins Start / Try Again to the sheet's edge
// (ExerciseStage.module.css): at the foot under a result taller than the
// sheet, at the top once a tall setup has scrolled past it. Pinned, it
// lies over whatever scrolls under it, and with nothing behind it the
// words and chips there ran into its edges: "YOUR RUN" under Try Again in
// Sing It in Time's result, the Clef chips in Sight-Singing's (seen on
// the dev site, November 2026).
//
// So the stage marks the sheet's scrim while the button is pinned, and the
// style sheet draws it then: a band the width of the sheet, behind the
// button, into which what scrolls under it fades. At rest there is no
// band. A style sheet cannot yet ask in every browser the app runs in
// whether a sticky box is stuck, so this asks the layout.
//
// Off a phone the button stands in the launch group, beside the setup or
// under it, last in the sheet, and nothing held it in sight: a result
// taller than what the sheet had left pushed it below the fold. At
// 1440 x 900 Try Again was a scroll away after every run of Sing It in
// Time, and on a laptop's shorter window further still (seen on the dev
// site, 17 November 2026). A style sheet cannot ask whether a box is out
// of sight either. So this asks the layout that too, and marks a sheet
// whose launch would be out of sight `data-stacked`; the style sheet then
// lays that sheet out as a phone's, the button pinned and its scrim with
// it. A sheet that shows its launch is never marked, so every setup that
// fits its window is as it was.

/** The gap the style sheet keeps between the pinned button and the sheet's edge, px. */
export const LAUNCH_PIN_OFFSET_PX = 10

/** The sheet's edge the launch button is pinned to; null at rest. */
export type LaunchPin = 'top' | 'bottom' | null

export interface LaunchPinMeasure {
  /** The sheet's visible box inside its border and padding, top and
   *  bottom, in viewport px: a pinned button stops short of the padding. */
  sheetTop: number
  sheetBottom: number
  /** The button's box, top and bottom, in viewport px. */
  buttonTop: number
  buttonBottom: number
  /** How far the sheet has scrolled, px. */
  scrolled: number
  /** How far it can still scroll, px. */
  remaining: number
}

/**
 * Where the button is pinned: to the foot while it stands at the sheet's
 * foot and more lies below, to the top while it stands at the sheet's top
 * and some has scrolled past. Standing at an edge with nothing beyond it is
 * the button at rest.
 */
export function launchPin(
  measure: LaunchPinMeasure,
  offset: number = LAUNCH_PIN_OFFSET_PX,
): LaunchPin {
  const atFoot = measure.sheetBottom - measure.buttonBottom <= offset + 1
  const atTop = measure.buttonTop - measure.sheetTop <= offset + 1
  if (atFoot && measure.remaining > 1) return 'bottom'
  if (atTop && measure.scrolled > 1) return 'top'
  return null
}

export interface LaunchFitMeasure {
  /** The sheet's visible height inside its border and padding, px. */
  sheetHeight: number
  /** The launch's foot below the sheet's inner top, with the sheet
   *  scrolled to its top and laid out as its window's width has it, px. */
  launchBottom: number
}

/**
 * Whether the launch is on screen before any scroll: the whole group, the
 * example's button under Start included, since a sheet that showed half of
 * it would be asking for the scroll all the same.
 */
export function launchFits(measure: LaunchFitMeasure): boolean {
  return measure.launchBottom <= measure.sheetHeight + 1
}

const BUTTON = '.exercise-idle-start'
const GROUP = '.exercise-idle-launch'
const RESULT = '.exercise-result-card'
const SCRIM = '.exercise-launch-scrim'
/** The sheet is laid out as a phone's: its own layout hid the launch. */
const STACKED = 'data-stacked'
/** The sheet is being measured: nothing in it may animate the change. */
const MEASURING = 'data-measuring'
/** Where the style sheet lays a sheet out as a phone's by itself. Keep in
 *  step with the phone block of ExerciseStage.module.css. */
const PHONE_QUERY = '(max-width: 768px)'

const px = (value: string): number => Number.parseFloat(value) || 0

/** The sheet's visible box inside its border and padding, top and bottom. */
function innerEdges(sheet: HTMLElement): { top: number; bottom: number } {
  const box = sheet.getBoundingClientRect()
  const edges = window.getComputedStyle(sheet)
  return {
    top: box.top + px(edges.borderTopWidth) + px(edges.paddingTop),
    bottom: box.bottom - px(edges.borderBottomWidth) - px(edges.paddingBottom),
  }
}

/** Whether the sheet, laid out as it is now, shows its launch. */
function showsLaunch(sheet: HTMLElement): boolean {
  const group = sheet.querySelector<HTMLElement>(GROUP)
  const button = sheet.querySelector<HTMLElement>(BUTTON)
  // The group where it has a box of its own; the button where it has not.
  const groupBox = group?.getBoundingClientRect()
  const box =
    groupBox !== undefined && groupBox.height > 0
      ? groupBox
      : button?.getBoundingClientRect()
  if (box === undefined) return true
  const inner = innerEdges(sheet)
  return launchFits({
    sheetHeight: inner.bottom - inner.top,
    launchBottom: box.bottom - inner.top + sheet.scrollTop,
  })
}

/**
 * Mark the sheet stacked, or not, with nothing in it animating the change:
 * the two layouts differ in sizes that some of its buttons animate.
 * `decide` is asked with the sheet in its own layout.
 */
function layOut(sheet: HTMLElement, decide: () => boolean): void {
  const scrolled = sheet.scrollTop
  sheet.setAttribute(MEASURING, '')
  sheet.removeAttribute(STACKED)
  if (!decide()) sheet.setAttribute(STACKED, '')
  // Read the layout once more, so that the new one is the style's starting
  // point before anything may animate again.
  void sheet.offsetHeight
  sheet.removeAttribute(MEASURING)
  if (sheet.scrollTop !== scrolled) sheet.scrollTop = scrolled
}

/**
 * Keeps the sheet's marks true as it scrolls, changes size or changes what
 * it holds: `data-stacked` on a sheet whose own layout would hide the
 * launch (off a phone; a phone's sheet is stacked by the style sheet), and
 * `data-pinned` (`top` or `bottom`) on its scrim while the button is
 * pinned. The button is pinned only where the style sheet makes it sticky,
 * so in a sheet that shows its launch nothing is ever marked. Returns the
 * stop.
 */
export function watchLaunchPin(sheet: HTMLElement): () => void {
  let frame = 0
  /** The sheet's size has changed since the last look. */
  let resized = true
  /** The column the layout was last decided for, and whether it held a result. */
  let decided: { scrim: HTMLElement; result: boolean } | null = null
  const phone =
    typeof window.matchMedia === 'function'
      ? window.matchMedia(PHONE_QUERY)
      : null

  /** Stack the sheet where its own layout hides the launch. */
  const stack = (scrim: HTMLElement): void => {
    if (phone === null || phone.matches) {
      sheet.removeAttribute(STACKED)
      decided = null
      return
    }
    const result = sheet.querySelector(RESULT) !== null
    const changed =
      resized ||
      decided === null ||
      decided.scrim !== scrim ||
      decided.result !== result
    decided = { scrim, result }
    if (!sheet.hasAttribute(STACKED)) {
      // In its own layout: a look costs nothing, so every change gets one.
      if (!showsLaunch(sheet)) layOut(sheet, () => false)
    } else if (changed) {
      // Stacked: its own layout has to be put back to be asked, so only
      // for a new size, a new column, or a result come or gone.
      layOut(sheet, () => showsLaunch(sheet))
    }
  }

  const read = (): void => {
    frame = 0
    const scrim = sheet.querySelector<HTMLElement>(SCRIM)
    if (scrim === null) {
      // A run is on: the sheet holds no setup and no launch.
      sheet.removeAttribute(STACKED)
      decided = null
      return
    }
    stack(scrim)
    resized = false
    const button = sheet.querySelector<HTMLElement>(BUTTON)
    let pin: LaunchPin = null
    if (
      button !== null &&
      window.getComputedStyle(button).position === 'sticky'
    ) {
      const inner = innerEdges(sheet)
      const buttonBox = button.getBoundingClientRect()
      pin = launchPin({
        sheetTop: inner.top,
        sheetBottom: inner.bottom,
        buttonTop: buttonBox.top,
        buttonBottom: buttonBox.bottom,
        scrolled: sheet.scrollTop,
        remaining: sheet.scrollHeight - sheet.clientHeight - sheet.scrollTop,
      })
    }
    if (pin === null) scrim.removeAttribute('data-pinned')
    else if (scrim.getAttribute('data-pinned') !== pin) {
      scrim.setAttribute('data-pinned', pin)
    }
  }
  const ask = (): void => {
    if (frame === 0) frame = requestAnimationFrame(read)
  }
  const askResized = (): void => {
    resized = true
    ask()
  }

  sheet.addEventListener('scroll', ask, { passive: true })
  window.addEventListener('resize', askResized)
  const sizes =
    typeof ResizeObserver === 'function' ? new ResizeObserver(askResized) : null
  sizes?.observe(sheet)
  // A result arriving, a setup opening a row: the sheet holds something new.
  const changes =
    typeof MutationObserver === 'function' ? new MutationObserver(ask) : null
  changes?.observe(sheet, { childList: true, subtree: true })
  ask()

  return () => {
    if (frame !== 0) cancelAnimationFrame(frame)
    sheet.removeEventListener('scroll', ask)
    window.removeEventListener('resize', askResized)
    sizes?.disconnect()
    changes?.disconnect()
    sheet.removeAttribute(STACKED)
    sheet.removeAttribute(MEASURING)
  }
}

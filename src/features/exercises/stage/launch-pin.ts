// ============================================================
// The pinned launch button: is it pinned, and to which edge
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

const BUTTON = '.exercise-idle-start'
const SCRIM = '.exercise-launch-scrim'

/**
 * Keeps the sheet's scrim marked `data-pinned` (`top` or `bottom`) while
 * its launch button is pinned, as the sheet scrolls, changes size or
 * changes what it holds. The button is pinned only where the style sheet
 * makes it sticky, so on a wide screen nothing is ever marked. Returns the
 * stop.
 */
export function watchLaunchPin(sheet: HTMLElement): () => void {
  let frame = 0
  const read = (): void => {
    frame = 0
    const scrim = sheet.querySelector<HTMLElement>(SCRIM)
    if (scrim === null) return
    const button = sheet.querySelector<HTMLElement>(BUTTON)
    let pin: LaunchPin = null
    if (
      button !== null &&
      window.getComputedStyle(button).position === 'sticky'
    ) {
      const sheetBox = sheet.getBoundingClientRect()
      const buttonBox = button.getBoundingClientRect()
      const edges = window.getComputedStyle(sheet)
      const px = (value: string): number => Number.parseFloat(value) || 0
      pin = launchPin({
        sheetTop:
          sheetBox.top + px(edges.borderTopWidth) + px(edges.paddingTop),
        sheetBottom:
          sheetBox.bottom -
          px(edges.borderBottomWidth) -
          px(edges.paddingBottom),
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

  sheet.addEventListener('scroll', ask, { passive: true })
  window.addEventListener('resize', ask)
  const sizes =
    typeof ResizeObserver === 'function' ? new ResizeObserver(ask) : null
  sizes?.observe(sheet)
  // A result arriving, a setup opening a row: the sheet holds something new.
  const changes =
    typeof MutationObserver === 'function' ? new MutationObserver(ask) : null
  changes?.observe(sheet, { childList: true, subtree: true })
  ask()

  return () => {
    if (frame !== 0) cancelAnimationFrame(frame)
    sheet.removeEventListener('scroll', ask)
    window.removeEventListener('resize', ask)
    sizes?.disconnect()
    changes?.disconnect()
  }
}

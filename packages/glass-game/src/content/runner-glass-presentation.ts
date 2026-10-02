// Runner glass presentation — authored wall bounds and pane-local notation remain independent from lane width.

export interface RunnerGlassNotationArea {
  readonly width: number
  readonly height: number
  readonly centerX?: number
  readonly centerY: number
  readonly z: number
}

/** Each card is one ordered target note in one physical aperture. */
export interface RunnerNoteCardAnchor extends RunnerGlassNotationArea {
  readonly noteIndex: number
  readonly paneIndex: number
}

export interface RunnerGlassPresentation {
  readonly variant: string
  readonly family: string
  readonly envelope: {
    readonly width: number
    readonly height: number
    readonly depth: number
  }
  readonly pane: {
    readonly width: number
    readonly height: number
    readonly depth: number
    readonly shoulderHeight: number
    readonly archRise: number
    readonly frontZ: number
    readonly outline?: readonly { readonly x: number; readonly y: number }[]
    /** Separate panes must not acquire a feedback edge across a solid mullion. */
    readonly outlines?: readonly (readonly {
      readonly x: number
      readonly y: number
    }[])[]
  }
  readonly notation: RunnerGlassNotationArea & {
    readonly noteCards?: readonly RunnerNoteCardAnchor[]
  }
}

export function validateRunnerGlassPresentation(
  value: RunnerGlassPresentation,
): boolean {
  const positive = [
    value.envelope?.width,
    value.envelope?.height,
    value.envelope?.depth,
    value.pane?.width,
    value.pane?.height,
    value.pane?.depth,
    value.notation?.width,
    value.notation?.height,
  ]
  if (
    !value.variant ||
    !value.family ||
    positive.some((n) => !Number.isFinite(n) || n <= 0)
  )
    return false
  if (
    !Number.isFinite(value.pane.frontZ) ||
    !Number.isFinite(value.notation.centerY) ||
    !Number.isFinite(value.notation.z) ||
    !Number.isFinite(value.pane.shoulderHeight) ||
    !Number.isFinite(value.pane.archRise)
  )
    return false
  if (
    value.notation.centerX !== undefined &&
    !Number.isFinite(value.notation.centerX)
  )
    return false
  if (
    value.pane.shoulderHeight < 0 ||
    value.pane.archRise < 0 ||
    value.notation.centerY - value.notation.height / 2 < 0 ||
    value.notation.centerY + value.notation.height / 2 >
      value.envelope.height ||
    Math.abs(value.notation.centerX ?? 0) + value.notation.width / 2 >
      value.envelope.width / 2
  )
    return false
  if (
    value.envelope.width > 6 ||
    value.envelope.height > 5 ||
    value.envelope.depth > 1 ||
    value.pane.width > value.envelope.width ||
    value.pane.height > value.envelope.height ||
    value.notation.width > value.pane.width ||
    value.notation.height > value.pane.height
  )
    return false
  const cards = value.notation.noteCards ?? []
  if (
    cards.length > 4 ||
    new Set(cards.map((card) => card.noteIndex)).size !== cards.length ||
    cards.some(
      (card) =>
        !Number.isInteger(card.noteIndex) ||
        card.noteIndex < 0 ||
        card.noteIndex >= cards.length ||
        !Number.isInteger(card.paneIndex) ||
        card.paneIndex < 0 ||
        card.paneIndex > 1 ||
        !Number.isFinite(card.width) ||
        card.width <= 0 ||
        card.width > value.pane.width ||
        !Number.isFinite(card.height) ||
        card.height <= 0 ||
        card.height > value.pane.height ||
        !Number.isFinite(card.centerX ?? 0) ||
        !Number.isFinite(card.centerY) ||
        !Number.isFinite(card.z) ||
        Math.abs(card.centerX ?? 0) + card.width / 2 >
          value.envelope.width / 2 ||
        card.centerY - card.height / 2 < 0 ||
        card.centerY + card.height / 2 > value.envelope.height,
    )
  )
    return false
  const outlines =
    value.pane.outlines ??
    (value.pane.outline === undefined ? [] : [value.pane.outline])
  return (
    outlines.length <= 2 &&
    outlines.every(
      (outline) =>
        outline.length >= 3 &&
        outline.length <= 128 &&
        outline.every(
          (p) =>
            Number.isFinite(p.x) &&
            Number.isFinite(p.y) &&
            Math.abs(p.x) <= value.envelope.width / 2 &&
            p.y >= 0 &&
            p.y <= value.envelope.height,
        ),
    )
  )
}

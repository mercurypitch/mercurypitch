// Runner target feedback tuning — one typed palette and motion contract for live pitch response.

import { FROST_GOLD_ARCH_PANE } from '../content/frost-gold-arch-profile'
import type { RunnerGlassPresentation } from '../content/runner-glass-presentation'

export interface RunnerTargetFeedbackPresentationConfig {
  readonly geometry: {
    readonly outline?: readonly { readonly x: number; readonly y: number }[]
    readonly outlines?: readonly (readonly {
      readonly x: number
      readonly y: number
    }[])[]
    readonly width: number
    readonly shoulderHeight: number
    readonly archRise: number
    readonly crownSegments: number
    readonly frontOffset: number
    readonly outlineInset: number
    readonly stripWidth: number
    readonly wrongInnerInset: number
    readonly wrongDashLength: number
    readonly wrongGapRatio: number
    readonly directionCenterY: number
    readonly directionCenterX?: number
    readonly directionHeight: number
    readonly directionWidth: number
  }
  readonly palette: {
    readonly accepted: number
    readonly wrong: number
  }
  readonly opacity: {
    readonly accepted: number
    readonly wrong: number
    readonly wrongPulseDepth: number
  }
  readonly timing: {
    readonly maximumFrameSeconds: number
    readonly wrongPulsePeriodSeconds: number
    readonly completionPopSeconds: number
    readonly completionPopScale: number
  }
  readonly vessel: {
    readonly accepted: {
      readonly surfaceStressActive: true
      readonly tremorActive: true
    }
    readonly held: {
      readonly surfaceStressActive: false
      readonly tremorActive: false
    }
  }
}

export const RUNNER_TARGET_FEEDBACK_PRESENTATION = {
  geometry: {
    width: FROST_GOLD_ARCH_PANE.width,
    shoulderHeight: FROST_GOLD_ARCH_PANE.shoulderHeight,
    archRise: FROST_GOLD_ARCH_PANE.archRise,
    crownSegments: 16,
    frontOffset: FROST_GOLD_ARCH_PANE.depth / 2 + 0.024,
    outlineInset: 0.075,
    stripWidth: 0.05,
    wrongInnerInset: 0.105,
    wrongDashLength: 0.12,
    wrongGapRatio: 0.42,
    directionCenterY: 0.42,
    directionHeight: 0.32,
    directionWidth: 0.22,
  },
  palette: {
    accepted: 0x70e8b1,
    wrong: 0xee8394,
  },
  opacity: {
    accepted: 0.94,
    wrong: 0.94,
    wrongPulseDepth: 0.24,
  },
  timing: {
    maximumFrameSeconds: 0.1,
    wrongPulsePeriodSeconds: 0.72,
    completionPopSeconds: 0.1,
    completionPopScale: 0.045,
  },
  vessel: {
    accepted: {
      surfaceStressActive: true,
      tremorActive: true,
    },
    held: {
      surfaceStressActive: false,
      tremorActive: false,
    },
  },
} as const satisfies RunnerTargetFeedbackPresentationConfig

/** Per-family contour keeps accepted/wrong edges on the actual optical pane. */
export function runnerTargetFeedbackForPane(
  pane: RunnerGlassPresentation['pane'],
  notation?: RunnerGlassPresentation['notation'],
): RunnerTargetFeedbackPresentationConfig {
  const outlines =
    pane.outlines ?? (pane.outline === undefined ? [] : [pane.outline])
  const minimumY =
    outlines.length === 0
      ? 0
      : Math.min(...outlines.flatMap((outline) => outline.map((p) => p.y)))
  return {
    ...RUNNER_TARGET_FEEDBACK_PRESENTATION,
    geometry: {
      ...RUNNER_TARGET_FEEDBACK_PRESENTATION.geometry,
      width: pane.width,
      shoulderHeight: pane.shoulderHeight,
      archRise: pane.archRise,
      frontOffset: pane.frontZ + 0.024,
      directionCenterY: minimumY + 0.42,
      directionCenterX: notation?.centerX ?? 0,
      ...(pane.outline === undefined ? {} : { outline: pane.outline }),
      ...(pane.outlines === undefined ? {} : { outlines: pane.outlines }),
    },
  }
}

// Studio comp validation — a saved comp covers its loop take's clip stretch after stretch, each on one of the take's passes.
import { STUDIO_MAX_COMP_SEGMENTS } from './clip-comp'
import type { StudioClip } from './types'
import { arrayValue, frameValue, record, requireValue, } from './validation-values'

/**
 * A loop take's comp (clip-comp.ts): two or more stretches in order, the
 * first from the clip's first source frame, each from where the one before
 * it ends, the last to the clip's end, each on a pass the take has and no
 * two neighbours on the same pass. Nothing is merged or repaired here.
 */
export function validateClipComp(
  clip: StudioClip,
  raw: unknown,
  path: string,
): void {
  const passes = clip.passes
  requireValue(passes !== undefined, path, 'Only a loop take can be comped')
  const parts = arrayValue(raw, path)
  requireValue(
    parts.length >= 2 && parts.length <= STUDIO_MAX_COMP_SEGMENTS,
    path,
    `A comp keeps 2 to ${STUDIO_MAX_COMP_SEGMENTS} stretches`,
  )
  let at = clip.sourceInFrame
  let previous = -1
  parts.forEach((item, index) => {
    const where = `${path}[${index}]`
    const part = record(item, where, [
      'fromSourceFrame',
      'toSourceFrame',
      'pass',
    ])
    const from = frameValue(part.fromSourceFrame, `${where}.fromSourceFrame`)
    const to = frameValue(part.toSourceFrame, `${where}.toSourceFrame`)
    const pass = frameValue(part.pass, `${where}.pass`)
    requireValue(from === at, where, 'The comp leaves a gap or overlaps itself')
    requireValue(to > from, where, 'A stretch must have positive duration')
    requireValue(
      pass < passes.count,
      `${where}.pass`,
      "Pass is not one of the clip's",
    )
    requireValue(
      pass !== previous,
      `${where}.pass`,
      'Neighbouring stretches play the same pass',
    )
    at = to
    previous = pass
  })
  requireValue(
    at === clip.sourceOutFrame,
    path,
    'The comp must end where its clip does',
  )
}

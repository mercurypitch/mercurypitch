// Studio automation validation — a saved line is taken only in time order and inside its control's travel, never repaired.
import type { StudioAutomationParam } from './automation'
import { STUDIO_AUTOMATION_PARAMS, STUDIO_AUTOMATION_RANGE, STUDIO_MAX_AUTOMATION_POINTS, } from './automation'
import { arrayValue, frameValue, numberValue, record, requireValue, } from './validation-values'

/** One line: 1 to the most points a line keeps, frames rising, values inside the control's travel. */
function validateLine(
  raw: unknown,
  param: StudioAutomationParam,
  path: string,
): void {
  const points = arrayValue(raw, path)
  requireValue(
    points.length >= 1 && points.length <= STUDIO_MAX_AUTOMATION_POINTS,
    path,
    `A line keeps 1 to ${STUDIO_MAX_AUTOMATION_POINTS} points`,
  )
  const { min, max } = STUDIO_AUTOMATION_RANGE[param]
  let previous = -1
  for (const [index, item] of points.entries()) {
    const at = `${path}[${index}]`
    const point = record(item, at, ['frame', 'value'])
    const frame = frameValue(point.frame, `${at}.frame`)
    numberValue(point.value, `${at}.value`, min, max)
    requireValue(
      frame > previous,
      `${at}.frame`,
      'Points run in time order, one to a frame',
    )
    previous = frame
  }
}

/** A lane's lines (automation.ts): a volume line, a pan line or both, and nothing else. */
export function validateStudioLaneAutomation(raw: unknown, path: string): void {
  const value = record(raw, path, [], STUDIO_AUTOMATION_PARAMS)
  const lines = STUDIO_AUTOMATION_PARAMS.filter(
    (param) => value[param] !== undefined,
  )
  requireValue(lines.length > 0, path, 'Expected a volume or pan line')
  for (const param of lines)
    validateLine(value[param], param, `${path}.${param}`)
}

// Runner target feedback — preallocated pane-local edges present semantic pitch truth without rescoring it.

import type { BufferGeometry, Material } from 'three'
import { BufferGeometry as Geometry, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, Shape, ShapeGeometry, } from 'three'
import type { RunnerPitchFeedback, RunnerTargetResult, } from '../runner/contracts'
import type { RunnerTargetFeedbackPresentationConfig } from './runner-target-feedback-config'
import { RUNNER_TARGET_FEEDBACK_PRESENTATION } from './runner-target-feedback-config'

interface Point {
  readonly x: number
  readonly y: number
}

export interface RunnerTargetFeedbackUpdate {
  readonly feedback: RunnerPitchFeedback
  readonly outcome: RunnerTargetResult['outcome'] | null
  readonly resultAgeSeconds: number | null
  readonly deltaSeconds: number
  readonly visible: boolean
}

function paneOutline(
  config: RunnerTargetFeedbackPresentationConfig,
  inset: number,
): readonly Point[] {
  const halfWidth = config.geometry.width / 2 - inset
  const baseY = inset
  const shoulderY = config.geometry.shoulderHeight - inset
  const archRise = Math.max(0, config.geometry.archRise - inset)
  const points: Point[] = [
    { x: -halfWidth, y: baseY },
    { x: -halfWidth, y: shoulderY },
  ]
  for (let index = 1; index < config.geometry.crownSegments; index++) {
    const angle = Math.PI - (Math.PI * index) / config.geometry.crownSegments
    points.push({
      x: Math.cos(angle) * halfWidth,
      y: shoulderY + Math.sin(angle) * archRise,
    })
  }
  points.push(
    { x: halfWidth, y: shoulderY },
    { x: halfWidth, y: baseY },
    { x: -halfWidth, y: baseY },
  )
  return points
}

function addStripQuad(
  positions: number[],
  start: Point,
  end: Point,
  width: number,
): void {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.hypot(dx, dy)
  if (length <= Number.EPSILON) return
  const halfWidth = width / 2
  const normalX = (-dy / length) * halfWidth
  const normalY = (dx / length) * halfWidth
  positions.push(
    start.x + normalX,
    start.y + normalY,
    0,
    start.x - normalX,
    start.y - normalY,
    0,
    end.x - normalX,
    end.y - normalY,
    0,
    start.x + normalX,
    start.y + normalY,
    0,
    end.x - normalX,
    end.y - normalY,
    0,
    end.x + normalX,
    end.y + normalY,
    0,
  )
}

function solidStripGeometry(
  config: RunnerTargetFeedbackPresentationConfig,
): BufferGeometry {
  const outline = paneOutline(config, config.geometry.outlineInset)
  const points = outline.slice(0, -1)
  const halfWidth = config.geometry.stripWidth / 2
  const outer: Point[] = []
  const inner: Point[] = []

  for (let index = 0; index < points.length; index++) {
    const previous = points[(index - 1 + points.length) % points.length]!
    const point = points[index]!
    const next = points[(index + 1) % points.length]!
    const previousLength = Math.hypot(
      point.x - previous.x,
      point.y - previous.y,
    )
    const nextLength = Math.hypot(next.x - point.x, next.y - point.y)
    const previousNormal = {
      x: -(point.y - previous.y) / previousLength,
      y: (point.x - previous.x) / previousLength,
    }
    const nextNormal = {
      x: -(next.y - point.y) / nextLength,
      y: (next.x - point.x) / nextLength,
    }
    const miterLength = Math.hypot(
      previousNormal.x + nextNormal.x,
      previousNormal.y + nextNormal.y,
    )
    const miter = {
      x: (previousNormal.x + nextNormal.x) / miterLength,
      y: (previousNormal.y + nextNormal.y) / miterLength,
    }
    const scale =
      halfWidth /
      Math.max(0.25, miter.x * nextNormal.x + miter.y * nextNormal.y)
    outer.push({ x: point.x + miter.x * scale, y: point.y + miter.y * scale })
    inner.push({ x: point.x - miter.x * scale, y: point.y - miter.y * scale })
  }

  const positions: number[] = []
  for (let index = 0; index < points.length; index++) {
    const next = (index + 1) % points.length
    positions.push(
      outer[index]!.x,
      outer[index]!.y,
      0,
      inner[index]!.x,
      inner[index]!.y,
      0,
      inner[next]!.x,
      inner[next]!.y,
      0,
      outer[index]!.x,
      outer[index]!.y,
      0,
      inner[next]!.x,
      inner[next]!.y,
      0,
      outer[next]!.x,
      outer[next]!.y,
      0,
    )
  }
  const geometry = new Geometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  return geometry
}

function addDashedStrip(
  positions: number[],
  start: Point,
  end: Point,
  config: RunnerTargetFeedbackPresentationConfig,
): void {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.hypot(dx, dy)
  const count = Math.max(1, Math.ceil(length / config.geometry.wrongDashLength))
  const visibleRatio = 1 - config.geometry.wrongGapRatio
  for (let index = 0; index < count; index++) {
    const from = index / count
    const to = Math.min(1, (index + visibleRatio) / count)
    addStripQuad(
      positions,
      { x: start.x + dx * from, y: start.y + dy * from },
      { x: start.x + dx * to, y: start.y + dy * to },
      config.geometry.stripWidth,
    )
  }
}

function wrongStripGeometry(
  config: RunnerTargetFeedbackPresentationConfig,
): BufferGeometry {
  const positions: number[] = []
  for (const inset of [
    config.geometry.outlineInset,
    config.geometry.outlineInset + config.geometry.wrongInnerInset,
  ]) {
    const points = paneOutline(config, inset)
    for (let index = 1; index < points.length; index++)
      addDashedStrip(positions, points[index - 1]!, points[index]!, config)
  }
  const geometry = new Geometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  return geometry
}

function directionGeometry(
  config: RunnerTargetFeedbackPresentationConfig,
): ShapeGeometry {
  const halfWidth = config.geometry.directionWidth / 2
  const halfHeight = config.geometry.directionHeight / 2
  const stemHalfWidth = halfWidth * 0.25
  const headBaseY = halfHeight * 0.15
  const shape = new Shape()
  shape.moveTo(-stemHalfWidth, -halfHeight)
  shape.lineTo(stemHalfWidth, -halfHeight)
  shape.lineTo(stemHalfWidth, headBaseY)
  shape.lineTo(halfWidth, headBaseY)
  shape.lineTo(0, halfHeight)
  shape.lineTo(-halfWidth, headBaseY)
  shape.lineTo(-stemHalfWidth, headBaseY)
  shape.closePath()
  return new ShapeGeometry(shape)
}

export function createRunnerTargetFeedback(
  reducedMotion: boolean,
  config: RunnerTargetFeedbackPresentationConfig = RUNNER_TARGET_FEEDBACK_PRESENTATION,
) {
  const root = new Group()
  root.name = 'runner-target-feedback'
  root.position.z = config.geometry.frontOffset
  root.userData.excludeFromCameraCollision = true

  const acceptedMaterial = new MeshBasicMaterial({
    color: config.palette.accepted,
    transparent: true,
    opacity: config.opacity.accepted,
    depthWrite: false,
    toneMapped: false,
  })
  const accepted = new Mesh(solidStripGeometry(config), acceptedMaterial)
  accepted.name = 'runner-target-feedback-accepted'
  accepted.visible = false

  const wrongMaterial = new MeshBasicMaterial({
    color: config.palette.wrong,
    transparent: true,
    opacity: config.opacity.wrong,
    depthWrite: false,
    toneMapped: false,
  })
  const wrong = new Mesh(wrongStripGeometry(config), wrongMaterial)
  wrong.name = 'runner-target-feedback-wrong'
  wrong.visible = false

  const directionMaterial = new MeshBasicMaterial({
    color: config.palette.wrong,
    transparent: true,
    opacity: config.opacity.wrong,
    depthWrite: false,
    toneMapped: false,
  })
  const direction = new Mesh(directionGeometry(config), directionMaterial)
  direction.name = 'runner-target-feedback-direction'
  direction.position.y = config.geometry.directionCenterY
  direction.visible = false
  root.add(accepted, wrong, direction)

  let disposed = false
  let pulseSeconds = 0
  let previousState: RunnerPitchFeedback['state'] = 'neutral'

  function hide(): void {
    accepted.visible = false
    wrong.visible = false
    direction.visible = false
    accepted.scale.setScalar(1)
  }

  return {
    root,
    update(input: RunnerTargetFeedbackUpdate): void {
      if (disposed) return
      hide()
      if (!input.visible || input.outcome === 'miss') {
        previousState = input.feedback.state
        return
      }
      if (input.outcome === 'hit') {
        const age = input.resultAgeSeconds ?? Number.POSITIVE_INFINITY
        if (age < 0 || age >= config.timing.completionPopSeconds) return
        accepted.visible = true
        acceptedMaterial.opacity = config.opacity.accepted
        if (!reducedMotion) {
          const progress = age / config.timing.completionPopSeconds
          accepted.scale.setScalar(
            1 + Math.sin(progress * Math.PI) * config.timing.completionPopScale,
          )
        }
        previousState = 'neutral'
        return
      }
      if (input.feedback.state === 'accepted') {
        accepted.visible = true
        acceptedMaterial.opacity = config.opacity.accepted
      } else if (input.feedback.state === 'wrong') {
        if (previousState !== 'wrong') pulseSeconds = 0
        pulseSeconds += Math.min(
          config.timing.maximumFrameSeconds,
          Math.max(0, input.deltaSeconds),
        )
        const pulse = reducedMotion
          ? 1
          : 1 -
            config.opacity.wrongPulseDepth *
              (0.5 +
                0.5 *
                  Math.sin(
                    (pulseSeconds / config.timing.wrongPulsePeriodSeconds) *
                      Math.PI *
                      2,
                  ))
        wrongMaterial.opacity = config.opacity.wrong * pulse
        directionMaterial.opacity = config.opacity.wrong * pulse
        wrong.visible = true
        direction.visible = true
        direction.rotation.z =
          input.feedback.correction === 'higher' ? 0 : Math.PI
      }
      previousState = input.feedback.state
    },
    dispose(): void {
      if (disposed) return
      disposed = true
      root.removeFromParent()
      const geometries = new Set<BufferGeometry>([
        accepted.geometry,
        wrong.geometry,
        direction.geometry,
      ])
      const materials = new Set<Material>([
        acceptedMaterial,
        wrongMaterial,
        directionMaterial,
      ])
      geometries.forEach((geometry) => geometry.dispose())
      materials.forEach((material) => material.dispose())
      root.clear()
    },
  }
}

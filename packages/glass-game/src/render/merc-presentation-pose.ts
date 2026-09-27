// Merc presentation pose — deterministic post-mixer speech and attentive idle without changing authored clips.

import type { Mesh, Object3D } from 'three'
import { Quaternion, Vector3 } from 'three'

const MAXIMUM_DELTA_SECONDS = 0.25
const MAXIMUM_SPEECH_MORPH = 0.72
const SPEECH_ATTACK_SECONDS = 0.055
const SPEECH_RELEASE_SECONDS = 0.12
const IDLE_ATTACK_SECONDS = 0.7
const IDLE_RELEASE_SECONDS = 0.22
const IDLE_CYCLE_SECONDS = 120
const TWO_PI = Math.PI * 2

const X_AXIS = new Vector3(1, 0, 0)
const Y_AXIS = new Vector3(0, 1, 0)
const Z_AXIS = new Vector3(0, 0, 1)

interface MorphMesh extends Mesh {
  morphTargetDictionary: Record<string, number>
  morphTargetInfluences: number[]
}

export interface MercPresentationPose {
  /** Remove the previous procedural layer before AnimationMixer writes again. */
  restoreMixerPose(): void
  /** Apply one bounded layer after AnimationMixer has evaluated authored clips. */
  applyAfterMixer(
    deltaSeconds: number,
    narrationLevel: number | undefined,
    attentive: boolean,
    reducedMotion: boolean,
  ): void
}

function finiteUnit(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value!))
}

function response(
  current: number,
  target: number,
  deltaSeconds: number,
  timeConstantSeconds: number,
): number {
  if (deltaSeconds <= 0) return current
  return (
    target + (current - target) * Math.exp(-deltaSeconds / timeConstantSeconds)
  )
}

function morphMesh(object: Object3D | undefined): MorphMesh | undefined {
  const candidate = object as Partial<MorphMesh> | undefined
  return candidate?.morphTargetDictionary !== undefined &&
    candidate.morphTargetInfluences !== undefined
    ? (candidate as MorphMesh)
    : undefined
}

/**
 * The mixer remains authoritative. This layer saves its exact result, applies
 * presentation offsets, then restores that saved result before the next mixer
 * step so a long session cannot accumulate bone or morph drift.
 */
export function createMercPresentationPose(
  root: Object3D,
): MercPresentationPose {
  const face = morphMesh(root.getObjectByName('merc_face'))
  const singIndex = face?.morphTargetDictionary.sing
  const head = root.getObjectByName('head')
  const left = root.getObjectByName('hand_l')
  const right = root.getObjectByName('hand_r')
  const authoredHead = new Quaternion()
  const authoredLeft = new Vector3()
  const authoredRight = new Vector3()
  const yaw = new Quaternion()
  const nod = new Quaternion()
  const tilt = new Quaternion()
  const offset = new Quaternion()
  let authoredSing = 0
  let applied = false
  let idleSeconds = 0
  let idleWeight = 0
  let speechMorph = 0

  function restoreMixerPose(): void {
    if (!applied) return
    if (head !== undefined) head.quaternion.copy(authoredHead)
    if (left !== undefined) left.position.copy(authoredLeft)
    if (right !== undefined) right.position.copy(authoredRight)
    if (face !== undefined && singIndex !== undefined)
      face.morphTargetInfluences[singIndex] = authoredSing
    applied = false
  }

  function applyAfterMixer(
    deltaSeconds: number,
    narrationLevel: number | undefined,
    attentive: boolean,
    reducedMotion: boolean,
  ): void {
    const dt = Number.isFinite(deltaSeconds)
      ? Math.max(0, Math.min(MAXIMUM_DELTA_SECONDS, deltaSeconds))
      : 0
    if (dt > 0) {
      const speechTarget = finiteUnit(narrationLevel) * MAXIMUM_SPEECH_MORPH
      speechMorph = response(
        speechMorph,
        speechTarget,
        dt,
        speechTarget > speechMorph
          ? SPEECH_ATTACK_SECONDS
          : SPEECH_RELEASE_SECONDS,
      )
      idleWeight = response(
        idleWeight,
        attentive && !reducedMotion ? 1 : 0,
        dt,
        attentive ? IDLE_ATTACK_SECONDS : IDLE_RELEASE_SECONDS,
      )
      idleSeconds += dt
      if (idleSeconds >= IDLE_CYCLE_SECONDS) idleSeconds -= IDLE_CYCLE_SECONDS
    }

    if (head !== undefined) authoredHead.copy(head.quaternion)
    if (left !== undefined) authoredLeft.copy(left.position)
    if (right !== undefined) authoredRight.copy(right.position)
    if (face !== undefined && singIndex !== undefined) {
      authoredSing = finiteUnit(face.morphTargetInfluences[singIndex])
      face.morphTargetInfluences[singIndex] = Math.max(
        authoredSing,
        speechMorph,
      )
    }

    const gestureWeight = reducedMotion ? 0 : idleWeight
    if (gestureWeight > 1e-5) {
      const headYaw =
        Math.sin((idleSeconds / 8) * TWO_PI) * 0.045 * gestureWeight
      const headNod =
        Math.sin((idleSeconds / 5) * TWO_PI + 0.7) * 0.018 * gestureWeight
      const headTilt =
        Math.sin((idleSeconds / 12) * TWO_PI + 1.4) * 0.024 * gestureWeight
      if (head !== undefined) {
        yaw.setFromAxisAngle(Y_AXIS, headYaw)
        nod.setFromAxisAngle(X_AXIS, headNod)
        tilt.setFromAxisAngle(Z_AXIS, headTilt)
        offset.copy(yaw).multiply(nod).multiply(tilt)
        head.quaternion.multiply(offset)
      }

      const handWave = Math.max(0, Math.sin((idleSeconds / 12) * TWO_PI - 0.8))
      const handLift = handWave * handWave * handWave * handWave
      if (left !== undefined)
        left.position.y += handLift * 0.018 * gestureWeight
      if (right !== undefined)
        right.position.y += handLift * 0.028 * gestureWeight
    }
    applied = true
  }

  return { applyAfterMixer, restoreMixerPose }
}

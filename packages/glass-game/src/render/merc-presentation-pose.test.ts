// Merc presentation-pose tests — speech and attentive idle stay bounded, deterministic, and mixer-safe.

import { Group, Mesh, MeshBasicMaterial, Quaternion, Vector3 } from 'three'
import { expect, it } from 'vitest'
import { createMercPresentationPose } from './merc-presentation-pose'

function fixture() {
  const root = new Group()
  const head = new Group()
  head.name = 'head'
  const left = new Group()
  left.name = 'hand_l'
  left.position.set(0.75, -0.06, 0.04)
  const right = new Group()
  right.name = 'hand_r'
  right.position.set(-0.75, -0.06, 0.04)
  const face = new Mesh(undefined, new MeshBasicMaterial())
  face.name = 'merc_face'
  face.morphTargetDictionary = { blink: 0, wide: 1, sing: 2 }
  face.morphTargetInfluences = [0.22, 0.31, 0.14]
  root.add(head, left, right, face)
  return {
    face,
    head,
    left,
    pose: createMercPresentationPose(root),
    right,
  }
}

function advance(
  subject: ReturnType<typeof fixture>,
  frames: number,
  dt: number,
  narrationLevel: number,
  attentive = true,
  reducedMotion = false,
): void {
  for (let frame = 0; frame < frames; frame++) {
    subject.pose.restoreMixerPose()
    subject.pose.applyAfterMixer(dt, narrationLevel, attentive, reducedMotion)
  }
}

it('smooths a bounded speaking mouth equally at 30 and 60 fps without touching blink or wide', () => {
  const thirty = fixture()
  const sixty = fixture()

  advance(thirty, 30, 1 / 30, 1)
  advance(sixty, 60, 1 / 60, 1)

  expect(thirty.face.morphTargetInfluences![0]).toBe(0.22)
  expect(thirty.face.morphTargetInfluences![1]).toBe(0.31)
  expect(thirty.face.morphTargetInfluences![2]).toBeGreaterThan(0.78)
  expect(thirty.face.morphTargetInfluences![2]).toBeLessThanOrEqual(0.8)
  expect(thirty.face.morphTargetInfluences![2]).toBeCloseTo(
    sixty.face.morphTargetInfluences![2]!,
    7,
  )

  advance(thirty, 15, 1 / 30, 0)
  advance(sixty, 30, 1 / 60, 0)
  expect(thirty.face.morphTargetInfluences![2]).toBeCloseTo(
    sixty.face.morphTargetInfluences![2]!,
    7,
  )
  expect(thirty.face.morphTargetInfluences![2]).toBeCloseTo(0.14, 2)
})

it('lifts ordinary narration energy while reserving the full mouth pose for louder syllables', () => {
  const ordinary = fixture()
  const louder = fixture()
  const firstSyllable = fixture()

  advance(ordinary, 60, 1 / 60, 0.25)
  advance(louder, 60, 1 / 60, 0.5)
  advance(firstSyllable, 2, 1 / 60, 0.5)

  expect(ordinary.face.morphTargetInfluences![2]).toBeGreaterThan(0.245)
  expect(ordinary.face.morphTargetInfluences![2]).toBeLessThanOrEqual(0.25)
  expect(louder.face.morphTargetInfluences![2]).toBeGreaterThan(0.495)
  expect(louder.face.morphTargetInfluences![2]).toBeLessThanOrEqual(0.5)
  expect(firstSyllable.face.morphTargetInfluences![2]).toBeGreaterThan(0.25)
})

it('adds the same long-cadence attentive pose at 30 and 60 fps and restores the authored mixer result', () => {
  const thirty = fixture()
  const sixty = fixture()
  const authoredHead = new Quaternion().setFromAxisAngle(
    new Vector3(0, 0, 1),
    0.08,
  )
  thirty.head.quaternion.copy(authoredHead)
  sixty.head.quaternion.copy(authoredHead)
  const authoredLeftY = thirty.left.position.y
  const authoredRightY = thirty.right.position.y

  advance(thirty, 300, 1 / 30, 0)
  advance(sixty, 600, 1 / 60, 0)

  expect(thirty.head.quaternion.angleTo(authoredHead)).toBeGreaterThan(0.02)
  expect(thirty.head.quaternion.angleTo(sixty.head.quaternion)).toBeLessThan(
    1e-6,
  )
  expect(thirty.left.position.y).toBeCloseTo(sixty.left.position.y, 7)
  expect(thirty.right.position.y).toBeCloseTo(sixty.right.position.y, 7)

  thirty.pose.restoreMixerPose()
  expect(thirty.head.quaternion.angleTo(authoredHead)).toBeLessThan(1e-12)
  expect(thirty.left.position.y).toBe(authoredLeftY)
  expect(thirty.right.position.y).toBe(authoredRightY)
  expect(thirty.face.morphTargetInfluences).toEqual([0.22, 0.31, 0.14])
})

it('freezes the complete procedural pose at zero delta and keeps reduced motion calm', () => {
  const subject = fixture()
  advance(subject, 60, 1 / 60, 0.8)
  const head = subject.head.quaternion.clone()
  const leftY = subject.left.position.y
  const rightY = subject.right.position.y
  const sing = subject.face.morphTargetInfluences![2]!

  advance(subject, 30, 0, 0)
  expect(subject.head.quaternion.angleTo(head)).toBeLessThan(1e-12)
  expect(subject.left.position.y).toBe(leftY)
  expect(subject.right.position.y).toBe(rightY)
  expect(subject.face.morphTargetInfluences![2]).toBe(sing)

  subject.pose.restoreMixerPose()
  subject.pose.applyAfterMixer(1 / 60, 0.8, true, true)
  expect(subject.head.quaternion.angleTo(new Quaternion())).toBeLessThan(1e-12)
  expect(subject.left.position.y).toBe(-0.06)
  expect(subject.right.position.y).toBe(-0.06)
  expect(subject.face.morphTargetInfluences![2]).toBeGreaterThan(0.14)
})

it('ignores malformed energy and never suppresses a stronger authored sing pose', () => {
  const subject = fixture()
  subject.face.morphTargetInfluences![2] = 0.9
  subject.pose.applyAfterMixer(1 / 60, Number.NaN, false, false)
  expect(subject.face.morphTargetInfluences![2]).toBe(0.9)

  subject.pose.restoreMixerPose()
  subject.pose.applyAfterMixer(1 / 60, Number.POSITIVE_INFINITY, false, false)
  expect(subject.face.morphTargetInfluences![2]).toBe(0.9)

  subject.pose.restoreMixerPose()
  subject.pose.applyAfterMixer(1, -4, false, false)
  expect(subject.face.morphTargetInfluences![2]).toBe(0.9)
})

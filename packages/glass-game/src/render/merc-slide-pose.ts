// Merc slide pose — tuck the hands and lean the head while the runner lowers its real body.

import type { Object3D } from 'three'
import { Quaternion, Vector3 } from 'three'

export function createMercSlidePose(root: Object3D) {
  const head = root.getObjectByName('head')
  const hands = ['hand_l', 'hand_r'].map((name) => root.getObjectByName(name))
  const authoredHead = new Quaternion()
  const authoredHands = hands.map(() => new Vector3())
  const lean = new Quaternion()
  const axis = new Vector3(1, 0, 0)
  let applied = false
  return {
    restore() {
      if (!applied) return
      head?.quaternion.copy(authoredHead)
      hands.forEach((hand, index) => hand?.position.copy(authoredHands[index]!))
      applied = false
    },
    apply(progress: number) {
      if (progress <= 0) return
      if (head !== undefined) authoredHead.copy(head.quaternion)
      hands.forEach((hand, index) => {
        if (hand === undefined) return
        authoredHands[index]!.copy(hand.position)
        hand.position.x *= 1 - progress * 0.3
        hand.position.z -= progress * 0.05
      })
      head?.quaternion.multiply(lean.setFromAxisAngle(axis, progress * -0.26))
      applied = true
    },
  }
}

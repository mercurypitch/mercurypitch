// The camera's share of the break.
// ============================================================
//
// A turn about the lens's own axes, applied after the camera has been
// placed for the frame, so the shot keeps its framing and only trembles.
// Every world places its camera afresh each frame -- the chase cameras by
// `lookAt`, the Cabinet from a stored rest -- so nothing accumulates: a
// shake that built on the last frame's would walk the camera off its mark.

import type { Object3D } from 'three'
import type { Shake } from '../runtime/impact'

export const shakeCamera = (camera: Object3D, s: Shake): void => {
  if (s.yaw === 0 && s.pitch === 0 && s.roll === 0) return
  camera.rotateY(s.yaw)
  camera.rotateX(s.pitch)
  camera.rotateZ(s.roll)
}

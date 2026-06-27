// ============================================================
// Camera — orbit/pan/zoom state shared by the renderer and the nav gizmo
// ============================================================
//
// An orbit camera around a target point: yaw (azimuth) + pitch (elevation)
// place the eye on a sphere of `radius` around `target`. The renderer turns
// this into a lookAt matrix; the gizmo reads the basis to draw the axis cross
// and to pan along screen axes.
//
// World: +X right, +Y up, +Z toward the viewer. Defaults reproduce the
// previously-fixed view (eye [0,6,9] looking at [0,1,-12]).

export interface CameraState {
  /** Azimuth around the Y axis (radians). 0 looks along +Z. */
  yaw: number
  /** Elevation above the target's horizontal plane (radians). */
  pitch: number
  /** Eye distance from the target. */
  radius: number
  /** Look-at point in world space. */
  target: readonly [number, number, number]
}

export const DEFAULT_CAMERA: CameraState = {
  yaw: 0,
  pitch: 0.2338,
  // Same angle as the original view, framed so the whole neck (frets 0..max,
  // incl. the fret numbers) sits above the bottom control bar with margin.
  // The low target lifts the neck up out from behind the HUD.
  radius: 19,
  target: [0, -0.4, -12],
}

export const PITCH_MIN = -0.15 // ~ -9°: a hair below level
export const PITCH_MAX = 1.45 // ~ 83°: near top-down, never flips over
export const RADIUS_MIN = 7
export const RADIUS_MAX = 90

export function clampCamera(c: CameraState): CameraState {
  return {
    yaw: c.yaw,
    pitch: Math.min(PITCH_MAX, Math.max(PITCH_MIN, c.pitch)),
    radius: Math.min(RADIUS_MAX, Math.max(RADIUS_MIN, c.radius)),
    target: c.target,
  }
}

type Vec3 = [number, number, number]

export function cameraEye(c: CameraState): Vec3 {
  const cp = Math.cos(c.pitch)
  return [
    c.target[0] + c.radius * cp * Math.sin(c.yaw),
    c.target[1] + c.radius * Math.sin(c.pitch),
    c.target[2] + c.radius * cp * Math.cos(c.yaw),
  ]
}

function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / len, v[1] / len, v[2] / len]
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]
}

/** Camera basis vectors in world space (forward points at the target). */
export function cameraBasis(c: CameraState): {
  forward: Vec3
  right: Vec3
  up: Vec3
} {
  const eye = cameraEye(c)
  const forward = normalize([
    c.target[0] - eye[0],
    c.target[1] - eye[1],
    c.target[2] - eye[2],
  ])
  const right = normalize(cross(forward, [0, 1, 0]))
  const up = cross(right, forward)
  return { forward, right, up }
}

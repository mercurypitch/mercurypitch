// ============================================================
// Museum environment — one owned HDR reflection probe, with a procedural offline fallback.
// ============================================================

import type { Object3D, Scene, Vector3, WebGLRenderer } from 'three'
import { CubeCamera, HalfFloatType, PMREMGenerator, WebGLCubeRenderTarget, } from 'three'
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js'
import { createReflectionTexture } from './materials'

export function createMuseumEnvironment(renderer: WebGLRenderer, scene: Scene) {
  const source = createReflectionTexture()
  const generator = new PMREMGenerator(renderer)
  let target = generator.fromEquirectangular(source)
  generator.dispose()
  source.dispose()
  scene.environment = target.texture
  let disposed = false
  return {
    async load(url: string, unavailable: () => boolean): Promise<void> {
      const hdr = await new HDRLoader().loadAsync(url)
      if (disposed || unavailable()) {
        hdr.dispose()
        return
      }
      const pmrem = new PMREMGenerator(renderer)
      try {
        const next = pmrem.fromEquirectangular(hdr)
        const previous = target
        target = next
        scene.environment = next.texture
        previous.dispose()
      } finally {
        hdr.dispose()
        pmrem.dispose()
      }
    },
    capture(position: Vector3, hidden: Object3D[], size: 128 | 256) {
      if (disposed) return
      const cube = new WebGLCubeRenderTarget(size, { type: HalfFloatType })
      const camera = new CubeCamera(0.08, 160, cube)
      camera.position.copy(position)
      const visibility = hidden.map((object) => object.visible)
      const pmrem = new PMREMGenerator(renderer)
      try {
        hidden.forEach((object) => {
          object.visible = false
        })
        camera.update(renderer, scene)
        const next = pmrem.fromCubemap(cube.texture)
        const previous = target
        target = next
        scene.environment = next.texture
        previous.dispose()
      } finally {
        hidden.forEach((object, index) => {
          object.visible = visibility[index]
        })
        cube.dispose()
        pmrem.dispose()
      }
    },
    dispose() {
      if (disposed) return
      disposed = true
      scene.environment = null
      target.dispose()
    },
  }
}

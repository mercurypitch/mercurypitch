// Runner note cards — one large pitch and authoritative fill per aperture keeps split windows readable on phones.

import { CanvasTexture, Group, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, } from 'three'
import type { RunnerNoteCardAnchor } from '../content/runner-glass-presentation'
import type { CompiledRunnerTarget, RunnerSnapshot } from '../runner/contracts'
import { runnerMidiName } from '../runner/notation'
import { drawRunnerNotationText } from './runner-notation-ink'

export function createRunnerNoteCards(
  anchors: readonly RunnerNoteCardAnchor[],
) {
  const plane = new Group()
  plane.name = 'runner-target-scorecards'
  const cards = anchors.map((anchor) => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 512
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Runner note canvas is unavailable.')
    context.scale(2, 2)
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    const material = new MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    })
    const mesh = new Mesh(
      new PlaneGeometry(anchor.width, anchor.height),
      material,
    )
    mesh.name = `runner-target-note-card-${anchor.noteIndex}`
    mesh.position.set(anchor.centerX ?? 0, anchor.centerY, anchor.z)
    plane.add(mesh)
    return { anchor, context, texture, material, mesh, previous: '' }
  })
  let disposed = false
  return {
    plane,
    update(
      target: CompiledRunnerTarget,
      snapshot: RunnerSnapshot,
      comfortableMidi: number,
      rootOffset: number,
    ) {
      const active =
        snapshot.activeTarget?.id === target.id ? snapshot.activeTarget : null
      for (const card of cards) {
        const note = target.notes[card.anchor.noteIndex]
        if (note === undefined) {
          card.mesh.visible = false
          continue
        }
        card.mesh.visible = true
        const progress = Math.max(
          0,
          Math.min(1, active?.notes[note.index]?.fillProgress ?? 0),
        )
        const current = active?.noteIndex === note.index
        const midi = comfortableMidi + rootOffset + note.endOffsetSemitones
        const label = runnerMidiName(midi).text
        const key = `${label}:${Math.round(progress * 50)}:${current}`
        if (key === card.previous) continue
        card.previous = key
        const c = card.context
        c.clearRect(0, 0, 256, 256)
        // Only the glyphs and charge ring carry a halo; the aperture stays clear.
        c.shadowColor = '#173d41'
        c.shadowBlur = 4
        c.textAlign = 'center'
        c.fillStyle = '#fff3cf'
        c.font = '600 24px sans-serif'
        drawRunnerNotationText(
          c,
          `${note.index + 1} / ${target.notes.length}`,
          128,
          39,
        )
        c.beginPath()
        c.arc(128, 148, 84, 0, Math.PI * 2)
        c.strokeStyle = current ? '#ead08e' : 'rgba(234,208,142,0.65)'
        c.lineWidth = 5
        c.stroke()
        if (progress > 0) {
          c.beginPath()
          c.arc(
            128,
            148,
            84,
            -Math.PI / 2,
            -Math.PI / 2 + Math.PI * 2 * progress,
          )
          c.strokeStyle = '#70e8b1'
          c.lineWidth = 11
          c.stroke()
        }
        c.fillStyle = '#fff3cf'
        c.font = `600 ${label.length > 2 ? 78 : 104}px serif`
        drawRunnerNotationText(c, label, 128, 180)
        card.texture.needsUpdate = true
      }
    },
    dispose() {
      if (disposed) return
      disposed = true
      plane.removeFromParent()
      for (const card of cards) {
        card.mesh.geometry.dispose()
        card.material.dispose()
        card.texture.dispose()
      }
      plane.clear()
    },
  }
}

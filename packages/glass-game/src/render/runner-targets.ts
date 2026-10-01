// Runner glass targets — the existing reviewed frost fracture follows authoritative voice results.
import type { Matrix4, Object3D } from 'three'
import { CanvasTexture, Group, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, } from 'three'
import type { BreakableSnapshot } from '../contracts'
import type { CompiledRunnerCourse, CompiledRunnerTarget, RunnerPitchFeedback, RunnerSnapshot, } from '../runner/contracts'
import { layoutRunnerNotation } from '../runner/notation'
import { getBreakableRenderRecipe } from './catalog'
import { createExhibitGeometryPool } from './exhibit-geometry-pool'
import { createKitInstance } from './kit-instance'
import { createRunnerTargetFeedback } from './runner-target-feedback'
import { RUNNER_TARGET_FEEDBACK_PRESENTATION } from './runner-target-feedback-config'
import type { VesselDefinition } from './vessels'
import { createAuthoredVessel } from './vessels'

const VARIANT = 'frost-gold-arch-breakwall-a'
const NEUTRAL_FEEDBACK: RunnerPitchFeedback = {
  state: 'neutral',
  observedMidi: null,
  comparedTargetMidi: null,
  errorCents: null,
  correction: null,
}

function targetDefinition(target: CompiledRunnerTarget): VesselDefinition {
  return {
    id: target.id,
    position: { x: 0, y: 0, z: 0 },
    anchor: { x: 0, y: 0, z: 1 },
    presentation: { kind: 'barrier', facingYaw: 0 },
    variant: VARIANT,
  }
}

function createScoreCard() {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 512
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Runner notation canvas is unavailable.')
  context.scale(2, 2)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  const material = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  })
  const plane = new Mesh(new PlaneGeometry(1.8, 0.9), material)
  plane.name = 'runner-target-scorecard'
  plane.position.set(0, 1.36, 0.055)
  let previous = ''
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
      const key = JSON.stringify([
        active?.notes.map((note) => Math.round(note.fillProgress * 50)),
        active?.noteIndex,
        comfortableMidi,
      ])
      if (key === previous) return
      previous = key
      const notes = target.notes.map((note) => ({
        index: note.index,
        startBeat: note.startBeat,
        endBeat: note.endBeat,
        startMidi: comfortableMidi + rootOffset + note.startOffsetSemitones,
        endMidi: comfortableMidi + rootOffset + note.endOffsetSemitones,
        connection: note.connection,
        fillProgress: active?.notes[note.index]?.fillProgress ?? 0,
        state: active?.notes[note.index]?.state ?? ('hollow' as const),
      }))
      const layout = layoutRunnerNotation(notes, {
        width: 512,
        height: 256,
        activeNoteIndex: active?.noteIndex,
      })
      context.clearRect(0, 0, 512, 256)
      context.fillStyle = 'rgba(246,244,229,0.95)'
      context.beginPath()
      context.roundRect(0, 0, 512, 256, 22)
      context.fill()
      context.font = 'italic 600 24px serif'
      context.textAlign = 'left'
      context.fillStyle = '#946b31'
      context.fillText('G', 14, layout.staff.lineYs[3])
      if (layout.staff.octaveLabel !== null) {
        context.font = '12px sans-serif'
        context.fillText(
          layout.staff.octaveLabel,
          10,
          layout.staff.lineYs[4] + 22,
        )
      }
      context.lineWidth = 1.5
      context.strokeStyle = '#82948b'
      for (const y of layout.staff.lineYs) {
        context.beginPath()
        context.moveTo(layout.staff.left, y)
        context.lineTo(layout.staff.right, y)
        context.stroke()
      }
      for (const note of layout.notes) {
        context.strokeStyle = '#174a49'
        context.lineWidth = 3
        for (const y of note.ledgerLineYs) {
          context.beginPath()
          context.moveTo(note.x - 12, y)
          context.lineTo(note.x + 12, y)
          context.stroke()
        }
        if (note.startY !== note.endY) {
          context.beginPath()
          context.moveTo(note.startX, note.startY)
          context.bezierCurveTo(
            note.startX + 12,
            note.startY,
            note.endX - 12,
            note.endY,
            note.endX,
            note.endY,
          )
          context.stroke()
        }
        context.save()
        context.beginPath()
        context.ellipse(note.x, note.endY, 9, 6.5, -0.3, 0, Math.PI * 2)
        context.clip()
        context.fillStyle = '#eac269'
        context.fillRect(note.x - 10, note.endY - 8, 20 * note.fillProgress, 16)
        context.restore()
        context.beginPath()
        context.ellipse(note.x, note.endY, 9, 6.5, -0.3, 0, Math.PI * 2)
        context.stroke()
        if (note.stemDirection) {
          const direction = note.stemDirection === 'up' ? -1 : 1
          const stemX = note.x + (direction < 0 ? 8 : -8),
            stemY = note.endY + direction * 26
          context.beginPath()
          context.moveTo(stemX, note.endY)
          context.lineTo(stemX, stemY)
          context.stroke()
          if (note.flagCount) {
            context.beginPath()
            context.moveTo(stemX, stemY)
            context.quadraticCurveTo(
              stemX + 12,
              stemY + direction * 3,
              stemX + 7.5,
              stemY - direction * 11,
            )
            context.stroke()
          }
        }
        if (note.dotted) {
          context.beginPath()
          context.arc(note.x + 15, note.endY, 2.5, 0, Math.PI * 2)
          context.fillStyle = '#174a49'
          context.fill()
        }
        if (note.pitch.accidental) {
          context.fillStyle = '#174a49'
          context.font = '16px serif'
          context.fillText('#', note.x - 17.5, note.endY + 5)
        }
        context.fillStyle = '#174a49'
        context.font = '600 18px sans-serif'
        context.textAlign = 'center'
        context.fillText(note.label, note.x, layout.labelY)
      }
      texture.needsUpdate = true
    },
    dispose() {
      plane.removeFromParent()
      plane.geometry.dispose()
      material.dispose()
      texture.dispose()
    },
  }
}

export function createRunnerTargets(
  course: CompiledRunnerCourse,
  source: Object3D,
  bundle: string,
  comfortableMidi: number,
  reducedMotion: boolean,
) {
  const root = new Group()
  root.name = 'runner-musical-glass'
  const recipe = getBreakableRenderRecipe(VARIANT)
  const pool = createExhibitGeometryPool(source, bundle)
  const items = new Map<
    string,
    {
      vessel: ReturnType<typeof createAuthoredVessel>
      card: ReturnType<typeof createScoreCard>
      feedback: ReturnType<typeof createRunnerTargetFeedback>
      displayCharge: number
    }
  >()
  let disposed = false
  let previousEpoch: RunnerSnapshot['epoch'] | undefined

  function install(target: CompiledRunnerTarget) {
    let assetTransform: Matrix4 | undefined
    const vessel = createAuthoredVessel(
      targetDefinition(target),
      reducedMotion,
      (library) => {
        const lease = pool.acquire(recipe, library)
        assetTransform = lease.transform.clone()
        return lease
      },
      { castShardShadows: false },
    )
    let card: ReturnType<typeof createScoreCard> | undefined
    let feedback: ReturnType<typeof createRunnerTargetFeedback> | undefined
    try {
      if (assetTransform === undefined)
        throw new Error(`Runner target "${target.id}" has no asset transform.`)
      const transform = assetTransform
      source.traverse((node) => {
        if (
          recipe.persistentPrefix !== undefined &&
          node.name.startsWith(recipe.persistentPrefix) &&
          node.parent?.name.startsWith(recipe.persistentPrefix) !== true
        ) {
          const frame = createKitInstance(node, {}, {}, vessel.materialLibrary)
          frame.applyMatrix4(transform)
          vessel.addPersistent(frame)
        }
      })
      card = createScoreCard()
      feedback = createRunnerTargetFeedback(reducedMotion)
      vessel.root.add(card.plane, feedback.root)
      root.add(vessel.root)
      const item = { vessel, card, feedback, displayCharge: 0 }
      items.set(target.id, item)
      return item
    } catch (error) {
      feedback?.dispose()
      card?.dispose()
      vessel.dispose()
      throw error
    }
  }
  return {
    root,
    update(snapshot: RunnerSnapshot, deltaSeconds: number) {
      if (disposed) return
      const epochChanged =
        previousEpoch !== undefined && previousEpoch !== snapshot.epoch
      previousEpoch = snapshot.epoch
      const resident = new Set(snapshot.residentChunkIds)
      for (const [id, item] of items) {
        const target = course.targets.find((target) => target.id === id)!
        if (!resident.has(target.chunkId)) {
          item.feedback.dispose()
          item.card.dispose()
          item.vessel.dispose()
          items.delete(id)
        }
      }
      for (const target of course.targets) {
        if (!resident.has(target.chunkId)) continue
        const item = items.get(target.id) ?? install(target)
        const result = snapshot.resolvedTargets.find(
          (result) => result.targetId === target.id,
        )
        const active =
          snapshot.activeTarget?.id === target.id ? snapshot.activeTarget : null
        const scoreCharge =
          active === null
            ? 0
            : active.notes.reduce((sum, note) => sum + note.fillProgress, 0) /
              active.notes.length
        const hit = result?.outcome === 'hit'
        if (epochChanged) item.displayCharge = 0
        if (hit) item.displayCharge = 1
        else if (active !== null) {
          if (scoreCharge < item.displayCharge) item.displayCharge = scoreCharge
          else if (active.pitchFeedback.state === 'accepted')
            item.displayCharge = scoreCharge
        }
        const charge = hit ? 1 : item.displayCharge
        const state: BreakableSnapshot = {
          id: target.id,
          charge: hit ? 1 : charge,
          phase: hit ? 'complete' : charge > 0 ? 'charging' : 'idle',
          brokenAt: hit ? result.resolvedAtCourseSeconds : null,
        }
        // Phrase end reaches Merc; a miss becomes passable without a false shatter.
        const endBeat = target.notes.at(-1)!.endBeat
        item.vessel.root.position.set(
          course.laneCenters[target.displayLane],
          course.groundFeetY,
          -endBeat * course.metersPerBeat + snapshot.courseDistanceMeters,
        )
        item.vessel.root.visible =
          result?.outcome !== 'miss' &&
          snapshot.courseSeconds >= target.visibleFromCourseSeconds &&
          (!hit || snapshot.courseSeconds - result.resolvedAtCourseSeconds < 2)
        const feedback = active?.pitchFeedback ?? NEUTRAL_FEEDBACK
        item.feedback.update({
          feedback,
          outcome: result?.outcome ?? null,
          resultAgeSeconds:
            result === undefined
              ? null
              : snapshot.courseSeconds - result.resolvedAtCourseSeconds,
          deltaSeconds,
          visible: item.vessel.root.visible,
        })
        item.vessel.update(
          state,
          snapshot.courseSeconds,
          item.vessel.root.visible,
          hit || feedback.state === 'accepted'
            ? RUNNER_TARGET_FEEDBACK_PRESENTATION.vessel.accepted
            : RUNNER_TARGET_FEEDBACK_PRESENTATION.vessel.held,
        )
        item.card.plane.visible = !hit
        if (item.vessel.root.visible && !hit)
          item.card.update(
            target,
            snapshot,
            comfortableMidi,
            course.voice.comfortableRootOffsetSemitones,
          )
      }
    },
    metrics: () => ({ targets: items.size }),
    dispose() {
      if (disposed) return
      disposed = true
      for (const item of items.values()) {
        item.feedback.dispose()
        item.card.dispose()
        item.vessel.dispose()
      }
      items.clear()
      pool.close()
      root.removeFromParent()
    },
  }
}

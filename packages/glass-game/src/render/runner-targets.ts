// Runner glass targets — authored wall families keep floor datums, notation and earned fracture aligned.
import type { Matrix4, Object3D } from 'three'
import { Box3, CanvasTexture, Group, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, } from 'three'
import type { RunnerGlassPresentation } from '../content/runner-glass-presentation'
import type { BreakableSnapshot } from '../contracts'
import type { CompiledRunnerCourse, CompiledRunnerTarget, RunnerPitchFeedback, RunnerSnapshot, } from '../runner/contracts'
import { layoutRunnerNotation, runnerMidiName } from '../runner/notation'
import { runnerSecondsToBeat } from '../runner/tempo'
import { getBreakableRenderRecipe } from './catalog'
import { createExhibitGeometryPool } from './exhibit-geometry-pool'
import { createKitInstance } from './kit-instance'
import type { MaterialFinishBank } from './material-finishes'
import { finishRunnerWallMaterial } from './material-finishes'
import { createRunnerNoteCards } from './runner-note-cards'
import { createRunnerTargetFeedback } from './runner-target-feedback'
import { RUNNER_TARGET_FEEDBACK_PRESENTATION, runnerTargetFeedbackForPane, } from './runner-target-feedback-config'
import type { VesselDefinition } from './vessels'
import { createAuthoredVessel } from './vessels'

const VARIANT = 'frost-gold-arch-breakwall-a'
const TARGET_LANE_INSET_METERS = 0.04
const NEUTRAL_FEEDBACK: RunnerPitchFeedback = {
  state: 'neutral',
  observedMidi: null,
  comparedTargetMidi: null,
  errorCents: null,
  correction: null,
}

function fitTargetToCourse(
  root: Group,
  course: CompiledRunnerCourse,
  presentation?: RunnerGlassPresentation,
  authoredBounds?: Box3,
): void {
  const bounds = authoredBounds ?? new Box3().setFromObject(root)
  if (presentation !== undefined) {
    if (
      bounds.max.x - bounds.min.x > presentation.envelope.width + 0.02 ||
      bounds.max.y - bounds.min.y > presentation.envelope.height + 0.02 ||
      bounds.max.z - bounds.min.z > presentation.envelope.depth + 0.06 ||
      Math.abs(bounds.min.y) > 0.02
    )
      throw new Error(
        'Installed runner wall does not match its authored floor envelope.',
      )
    root.userData.runnerWallHalfWidth = Math.max(
      Math.abs(bounds.min.x),
      Math.abs(bounds.max.x),
    )
    return
  }
  const lateralExtent = Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x))
  const halfLane =
    Math.min(
      course.laneCenters[1] - course.laneCenters[0],
      course.laneCenters[2] - course.laneCenters[1],
    ) / 2
  const inset = Math.min(TARGET_LANE_INSET_METERS, halfLane * 0.1)
  // The reviewed stone frame is wider than the certified glass pane. Measure
  // the installed assembly and fit every lane to the same centred footprint;
  // one uniform root transform keeps the donor, notation and feedback aligned.
  root.scale.setScalar(Math.min(1, (halfLane - inset) / lateralExtent))
}

function targetDefinition(target: CompiledRunnerTarget): VesselDefinition {
  return {
    id: target.id,
    position: { x: 0, y: 0, z: 0 },
    anchor: { x: 0, y: 0, z: 1 },
    presentation: { kind: 'barrier', facingYaw: 0 },
    variant: target.glassPresentation?.variant ?? VARIANT,
  }
}

function createScoreCard(
  presentation?: RunnerGlassPresentation,
  noteCount = 0,
) {
  const noteCards = presentation?.notation.noteCards
  if (noteCards !== undefined && noteCards.length === noteCount)
    return createRunnerNoteCards(noteCards)

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
  const notation = presentation?.notation ?? {
    width: 1.8,
    height: 0.9,
    centerX: 0,
    centerY: 1.36,
    z: 0.055,
  }
  const plane = new Mesh(
    new PlaneGeometry(notation.width, notation.height),
    material,
  )
  plane.name = 'runner-target-scorecard'
  plane.position.set(notation.centerX ?? 0, notation.centerY, notation.z)
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
      if (target.completionPolicy === 'charge' && notes.length === 1) {
        const note = notes[0]!
        const label = runnerMidiName(note.endMidi).text
        context.fillStyle = 'rgba(17,61,65,0.70)'
        context.beginPath()
        context.roundRect(100, 10, 312, 232, 28)
        context.fill()
        context.lineWidth = 5
        context.strokeStyle = 'rgba(234,194,105,0.6)'
        context.beginPath()
        context.arc(256, 104, 64, 0, Math.PI * 2)
        context.stroke()
        context.strokeStyle = '#70e8b1'
        context.lineWidth = 10
        context.beginPath()
        context.arc(
          256,
          104,
          64,
          -Math.PI / 2,
          -Math.PI / 2 + Math.PI * 2 * note.fillProgress,
        )
        context.stroke()
        context.fillStyle = '#fff3cf'
        context.font = '600 52px serif'
        context.textAlign = 'center'
        context.fillText(label, 256, 122)
        context.font = '600 22px sans-serif'
        context.fillText('Short hold', 256, 206)
        texture.needsUpdate = true
        return
      }
      context.fillStyle = 'rgba(17,61,65,0.68)'
      context.beginPath()
      context.roundRect(2, 2, 508, 252, 22)
      context.fill()
      context.lineWidth = 2
      context.strokeStyle = 'rgba(234,194,105,0.85)'
      context.stroke()
      context.font = 'italic 600 24px serif'
      context.textAlign = 'left'
      context.fillStyle = '#eac269'
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
      context.strokeStyle = '#b8cfc5'
      for (const y of layout.staff.lineYs) {
        context.beginPath()
        context.moveTo(layout.staff.left, y)
        context.lineTo(layout.staff.right, y)
        context.stroke()
      }
      for (const note of layout.notes) {
        context.strokeStyle = '#fff3cf'
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
        context.fillStyle = '#70e8b1'
        context.fillRect(note.x - 10, note.endY - 8, 20 * note.fillProgress, 16)
        context.restore()
        context.beginPath()
        context.ellipse(note.x, note.endY, 9, 6.5, -0.3, 0, Math.PI * 2)
        context.stroke()
        if (note.stemDirection && target.completionPolicy !== 'charge') {
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
        if (note.dotted && target.completionPolicy !== 'charge') {
          context.beginPath()
          context.arc(note.x + 15, note.endY, 2.5, 0, Math.PI * 2)
          context.fillStyle = '#fff3cf'
          context.fill()
        }
        if (note.pitch.accidental) {
          context.fillStyle = '#fff3cf'
          context.font = '16px serif'
          context.fillText('#', note.x - 17.5, note.endY + 5)
        }
        context.fillStyle = '#fff3cf'
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
  source:
    | Object3D
    | ReadonlyMap<
        string,
        { readonly source: Object3D; readonly bundle: string }
      >,
  bundle: string,
  comfortableMidi: number,
  reducedMotion: boolean,
  finishes?: MaterialFinishBank,
) {
  const root = new Group()
  root.name = 'runner-musical-glass'
  const pools = new Map<string, ReturnType<typeof createExhibitGeometryPool>>()
  const bank = 'isObject3D' in source ? null : source
  const legacy = bank === null ? (source as Object3D) : null
  const items = new Map<
    string,
    {
      vessel: ReturnType<typeof createAuthoredVessel>
      card: ReturnType<typeof createScoreCard>
      feedback: ReturnType<typeof createRunnerTargetFeedback>
      displayCharge: number
      frames: Object3D[]
      direction: Object3D | undefined
    }
  >()
  let disposed = false
  let previousEpoch: RunnerSnapshot['epoch'] | undefined

  function install(target: CompiledRunnerTarget) {
    const variant = target.glassPresentation?.variant ?? VARIANT
    const recipe = getBreakableRenderRecipe(variant)
    const asset =
      bank?.get(variant) ??
      (legacy === null ? undefined : { source: legacy, bundle })
    if (asset === undefined)
      throw new Error(`Runner wall asset "${variant}" is unavailable.`)
    const sourceScene = asset.source
    const pool =
      pools.get(asset.bundle) ??
      createExhibitGeometryPool(sourceScene, asset.bundle)
    pools.set(asset.bundle, pool)
    let assetTransform: Matrix4 | undefined
    const vessel = createAuthoredVessel(
      targetDefinition(target),
      reducedMotion,
      (library) => {
        const lease = pool.acquire(recipe, library)
        try {
          if (finishes)
            for (const material of lease.materials)
              finishRunnerWallMaterial(
                material,
                finishes,
                lease.geometry.hasAttribute('uv'),
              )
          assetTransform = lease.transform.clone()
          return lease
        } catch (error) {
          // The vessel cannot release a lease that failed before handoff.
          lease.release()
          throw error
        }
      },
      { castShardShadows: false },
    )
    let card: ReturnType<typeof createScoreCard> | undefined
    let feedback: ReturnType<typeof createRunnerTargetFeedback> | undefined
    const frames: Object3D[] = []
    try {
      if (assetTransform === undefined)
        throw new Error(`Runner target "${target.id}" has no asset transform.`)
      const transform = assetTransform
      sourceScene.traverse((node) => {
        if (
          recipe.persistentPrefix !== undefined &&
          node.name.startsWith(recipe.persistentPrefix) &&
          node.parent?.name.startsWith(recipe.persistentPrefix) !== true
        ) {
          const frame = createKitInstance(
            node,
            {},
            {},
            vessel.materialLibrary,
            { shareGeometry: target.glassPresentation !== undefined },
          )
          if (finishes)
            frame.traverse((object) => {
              const mesh = object as Mesh
              if (!mesh.isMesh) return
              for (const material of Array.isArray(mesh.material)
                ? mesh.material
                : [mesh.material])
                finishRunnerWallMaterial(
                  material,
                  finishes,
                  mesh.geometry.hasAttribute('uv'),
                )
            })
          frame.applyMatrix4(transform)
          vessel.addPersistent(frame)
          frames.push(frame)
        }
      })
      card = createScoreCard(target.glassPresentation, target.notes.length)
      feedback = createRunnerTargetFeedback(
        reducedMotion,
        target.glassPresentation === undefined
          ? undefined
          : runnerTargetFeedbackForPane(
              target.glassPresentation.pane,
              target.glassPresentation.notation,
            ),
      )
      vessel.root.add(card.plane, feedback.root)
      const authoredBounds =
        target.glassPresentation === undefined
          ? undefined
          : vessel.getIntactBounds(new Box3())
      if (authoredBounds !== undefined)
        for (const frame of frames)
          authoredBounds.union(new Box3().setFromObject(frame))
      fitTargetToCourse(
        vessel.root,
        course,
        target.glassPresentation,
        authoredBounds,
      )
      root.add(vessel.root)
      const item = {
        vessel,
        card,
        feedback,
        displayCharge: 0,
        frames,
        direction: feedback.root.getObjectByName(
          'runner-target-feedback-direction',
        ),
      }
      items.set(target.id, item)
      return item
    } catch (error) {
      feedback?.dispose()
      card?.dispose()
      if (target.glassPresentation !== undefined)
        for (const frame of frames) frame.removeFromParent()
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
          if (target.glassPresentation !== undefined)
            for (const frame of item.frames) frame.removeFromParent()
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
        // Charge is already accepted evidence. Instantaneous pitch controls
        // tremor/color only; silence must not hide previously earned cracks.
        else if (active !== null) item.displayCharge = scoreCharge
        const charge = hit ? 1 : item.displayCharge
        const state: BreakableSnapshot = {
          id: target.id,
          charge: hit ? 1 : charge,
          phase: hit ? 'complete' : charge > 0 ? 'charging' : 'idle',
          brokenAt: hit ? result.resolvedAtCourseSeconds : null,
        }
        // Contact is authored independently of the response deadline. A miss
        // remains passable without masquerading as an earned shatter.
        const contactBeat = runnerSecondsToBeat(
          course.tempoSegments,
          target.contactCourseSeconds,
        )
        item.vessel.root.position.set(
          target.glassPresentation === undefined
            ? course.laneCenters[target.displayLane]
            : Math.max(
                course.laneCenters[0] -
                  (course.laneCenters[1] - course.laneCenters[0]) / 2 +
                  Number(item.vessel.root.userData.runnerWallHalfWidth) +
                  TARGET_LANE_INSET_METERS,
                Math.min(
                  course.laneCenters[2] +
                    (course.laneCenters[2] - course.laneCenters[1]) / 2 -
                    Number(item.vessel.root.userData.runnerWallHalfWidth) -
                    TARGET_LANE_INSET_METERS,
                  course.laneCenters[target.displayLane],
                ),
              ),
          course.groundFeetY,
          -contactBeat * course.metersPerBeat + snapshot.courseDistanceMeters,
        )
        item.vessel.root.visible =
          result?.outcome !== 'miss' &&
          snapshot.courseSeconds >= target.visibleFromCourseSeconds &&
          (!hit || snapshot.courseSeconds - result.resolvedAtCourseSeconds < 2)
        // Authored full frames include rails and mullions. Retire those before
        // Merc's body reaches the passable musical target; earned shards keep
        // their own short lifecycle. Legacy fixtures retain their old display.
        if (target.glassPresentation !== undefined) {
          const forwardClearance =
            course.movement.bodyRadius +
            target.glassPresentation.envelope.depth / 2 +
            0.08
          const frameVisible = item.vessel.root.position.z < -forwardClearance
          for (const frame of item.frames) frame.visible = frameVisible
        }
        const feedback = active?.pitchFeedback ?? NEUTRAL_FEEDBACK
        const noteCards = target.glassPresentation?.notation.noteCards
        if (
          noteCards?.length === target.notes.length &&
          item.direction !== undefined
        )
          item.direction.position.x =
            noteCards.find(
              (card) => card.noteIndex === (active?.noteIndex ?? 0),
            )?.centerX ?? 0
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
      for (const [id, item] of items) {
        item.feedback.dispose()
        item.card.dispose()
        if (
          course.targets.find((target) => target.id === id)
            ?.glassPresentation !== undefined
        )
          for (const frame of item.frames) frame.removeFromParent()
        item.vessel.dispose()
      }
      items.clear()
      for (const pool of pools.values()) pool.close()
      root.removeFromParent()
    },
  }
}

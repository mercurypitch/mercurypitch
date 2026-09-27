// Crystal interior study — the accepted Promenade contacts with an optional contained light sculpture.
import { compileCloudwayCourseDocument } from '../authoring/compile-cloudway-course.ts'
import type { CrystalInteriorPresentationDefinition } from '../contracts'
import { CLOUDWAY_LABORATORY_COURSE_PROFILES } from './cloudway-laboratory-profiles.ts'
import document from './data/cloudway-crystal-promenade.course.json' with { type: 'json' }

export function crystalInteriorStudySource(
  preset: CrystalInteriorPresentationDefinition['preset'] = 'resonance-veins',
) {
  const source = structuredClone(document)
  const course = source.courses[0]!
  source.courses = [course]
  course.id = `cloudway-crystal-interior-${preset}`
  course.authored = {
    levelId: course.id,
    layoutId: `crystal-interior-${preset}`,
    contentRevision: 1,
  }
  course.title = 'The living crystal'
  course.guidance.subtitle = 'Light beneath the scroll'
  course.guidance.openingNotice = 'Follow the marble to the living crystal.'
  Object.assign(course.presentation, {
    crystalInteriors: [{ platformId: 'scroll-deck', preset, seed: 270926 }],
  })
  return source
}

export function crystalInteriorStudy(
  preset: CrystalInteriorPresentationDefinition['preset'] = 'resonance-veins',
) {
  return compileCloudwayCourseDocument(
    crystalInteriorStudySource(preset),
    CLOUDWAY_LABORATORY_COURSE_PROFILES,
  )[0]!
}

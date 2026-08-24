// ============================================================
// Corky v0.7 delivery manifest tests — paths and byte provenance
// ============================================================

import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CORKY_ONBOARDING_MEDIA_V0_7 } from './cinematic-onboarding-manifest'
import { validateCinematicOnboardingMediaManifest } from './cinematic-onboarding-media'

const EXPECTED_ASSET_SHA256 = Object.freeze({
  '/onboarding/corky-v0.7/audio/review-mix-continuous-746f.m4a':
    'c0e179b01a252e9f2260c55a82db4a419a306e80af1d6361aa35f68044cbe5b8',
  '/onboarding/corky-v0.7/picture/h01-h02-greeting.mp4':
    '392f9188d3148ccb1dcf6c1d1a68e619693c38b834e02fbe65bd2821190d7ad5',
  '/onboarding/corky-v0.7/picture/h03-table-reveal.mp4':
    '846944e1928d71dba29028b4093c035827d935578c97aebd9a15fe333a859b37',
  '/onboarding/corky-v0.7/picture/h04-scroll-arrival.mp4':
    '154041cff458d86799ef4e7d34fc2b58a299c1fd1a6754dbb8206d6b68aa5767',
  '/onboarding/corky-v0.7/picture/h05-sort-sides.mp4':
    'be1c29051804d57002ee52eff9b649b28941ec5a7ae6fe2355c12c8259b08969',
  '/onboarding/corky-v0.7/picture/h06-press-and-play.mp4':
    'ce86d2fb951754ad75adcc1d34f3bd2f03bbbb41e422f2ef666e640c2aac0991',
  '/onboarding/corky-v0.7/picture/h07-stop-and-acknowledge.mp4':
    '91b65a79c00217f5c9da961b2e5e5d54a464fe05bf2592ede4ad8140327d4345',
  '/onboarding/corky-v0.7/stills/h01-h02-greeting-poster.webp':
    'ab899d614098b852efdbddfddd5bc68f11a89bcbd584e1905dc6cae639310266',
  '/onboarding/corky-v0.7/stills/h01-h02-greeting-reduced.webp':
    '2486dead8f14edebbf4330bfd4228c2beb8f9de00f6f4782fad9b14bcfe7ecce',
  '/onboarding/corky-v0.7/stills/h03-table-reveal-poster.webp':
    'f604b1e25a99a8e2ebf183ebb4c85a21323c146c04e15c2b88e881d8f554e145',
  '/onboarding/corky-v0.7/stills/h03-table-reveal-reduced.webp':
    '11799eff0138fe20cf657796ae56a9091bf5fa4f8f07f6b28f60ef714615efb5',
  '/onboarding/corky-v0.7/stills/h04-scroll-arrival-poster.webp':
    'bbb2774d2da50b5761fc4f42339aacae776943da257d9d45bd993be5bd444aae',
  '/onboarding/corky-v0.7/stills/h04-scroll-arrival-reduced.webp':
    'bd40efd712c114b869c8855ae8f4c43f1a42a8b43e743db6f3c19c995ef92a45',
  '/onboarding/corky-v0.7/stills/h05-sort-sides-poster.webp':
    'b4d986886eaa1e75761f66562251f3d620e84d30b7e3ea2aa712f4dbeb2cdec9',
  '/onboarding/corky-v0.7/stills/h05-sort-sides-reduced.webp':
    '796948c879015b060769f7a0086b679ff277ff753871b60514e4c78a61a3bde0',
  '/onboarding/corky-v0.7/stills/h06-press-and-play-poster.webp':
    '806124b28949e0a3c008cadca65a56c6604d1bb4ea3cb8b6d53839e7d7468717',
  '/onboarding/corky-v0.7/stills/h06-press-and-play-reduced.webp':
    'ae2e262962646fd0f058a2dd080a2f20a0cc3d8c3f748ec769f250832245fab7',
  '/onboarding/corky-v0.7/stills/h07-stop-and-acknowledge-poster.webp':
    '62a5048015427ed4aa8eb0c06e62dbe49453a20d2cd87b965302842ac72acd2d',
  '/onboarding/corky-v0.7/stills/h07-stop-and-acknowledge-reduced.webp':
    '121c8fc93ac9a3752e073dcb026efe42c0c191cb7c6cfe94d9ab294b42be29a2',
})

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function resolvePackageRoot(): string {
  const candidates = [process.cwd(), resolve(process.cwd(), 'apps/beside-cue')]
  const root = candidates.find((candidate) =>
    existsSync(
      resolve(
        candidate,
        'src/onboarding/cinematic-onboarding-manifest.test.ts',
      ),
    ),
  )

  if (root === undefined) {
    throw new Error('Could not locate the Beside Cue package root.')
  }
  return root
}

const PACKAGE_ROOT = resolvePackageRoot()

function packagedAssetBytes(path: string): Uint8Array {
  return readFileSync(resolve(PACKAGE_ROOT, `public${path}`))
}

function referencedAssetPaths(): readonly string[] {
  const paths = new Set<string>([CORKY_ONBOARDING_MEDIA_V0_7.audio.src])
  for (const media of Object.values(CORKY_ONBOARDING_MEDIA_V0_7.segments)) {
    paths.add(media.poster)
    paths.add(media.reducedStill)
    if (media.kind === 'automatic') paths.add(media.video)
  }
  return [...paths].sort()
}

describe('Corky v0.7 cinematic onboarding manifest', () => {
  it('is the exact complete v0.3 manifest for the approved revision', () => {
    expect(CORKY_ONBOARDING_MEDIA_V0_7).toMatchObject({
      revision: 'corky-onboarding-v0.7',
      sourceContractVersion: '0.3.0',
      audio: {
        kind: 'continuous_review_mix',
        sourceDurationFrames: 746,
        clockPolicy: 'pause_with_picture',
      },
    })
    expect(
      validateCinematicOnboardingMediaManifest(CORKY_ONBOARDING_MEDIA_V0_7),
    ).toEqual([])
    expect(
      CORKY_ONBOARDING_MEDIA_V0_7.segments.S08_AUTO_TITLE_CLOSE,
    ).toMatchObject({
      poster:
        '/onboarding/corky-v0.7/stills/h07-stop-and-acknowledge-reduced.webp',
      reducedStill:
        '/onboarding/corky-v0.7/stills/h07-stop-and-acknowledge-reduced.webp',
    })
  })

  it('references only the packaged, byte-verified v0.7 app assets', () => {
    expect(referencedAssetPaths()).toEqual(
      Object.keys(EXPECTED_ASSET_SHA256).sort(),
    )

    for (const [path, expectedHash] of Object.entries(EXPECTED_ASSET_SHA256)) {
      expect(sha256(packagedAssetBytes(path)), path).toBe(expectedHash)
    }
  })

  it('pins the source contract to the checked-in v0.3 timeline bytes', () => {
    const timelineBytes = readFileSync(
      resolve(PACKAGE_ROOT, 'src/onboarding/cinematic-onboarding-timeline.ts'),
    )

    expect(CORKY_ONBOARDING_MEDIA_V0_7.sourceContractSha256).toBe(
      sha256(timelineBytes),
    )
  })
})

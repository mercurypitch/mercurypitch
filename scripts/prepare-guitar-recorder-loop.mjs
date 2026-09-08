// Prepare early reel-face motion; the original still owns the casing and silhouette.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import sharp from 'sharp'

const [source, outputDirectory] = process.argv.slice(2)
if (!source || !outputDirectory)
  throw new Error(
    'Usage: node scripts/prepare-guitar-recorder-loop.mjs <approved-omni.mp4> <existing-output-directory>',
  )

// Hand-registered against the approved 384px still, not the edited grey reference.
// Use only the early, three-screw section. The generated closing seconds morph.
const regions = [
  { crop: [354, 144, 276, 216], target: [50, 84, 136, 108], start: 5 },
  { crop: [620, 70, 260, 210], target: [184, 45, 128, 104], start: 3 },
]
const videoPath = resolve(outputDirectory, 'melody-recorder-reels-v1.mp4')
const maskPath = resolve(outputDirectory, 'melody-recorder-reels-mask-v1.png')
for (const path of [videoPath, maskPath])
  if (existsSync(path)) throw new Error(`Refusing to overwrite ${path}`)
const digest = createHash('sha256').update(readFileSync(source)).digest('hex')
const expected =
  '0485535f51f2b4846a56c9384cedea3a0cb10b5d41ccb963c068c001d7223ed5'
if (digest !== expected)
  throw new Error(`Unexpected source checksum: ${digest}`)

const side = 384
const frameCount = 18
const blendFrames = 3
const pixels = side * side
const frames = Buffer.alloc(pixels * 3 * frameCount)
const mask = Buffer.alloc(pixels * 4)
const clamp = (value) => Math.max(0, Math.min(1, value))

for (const region of regions) {
  const [sx, sy, sw, sh] = region.crop
  const [dx, dy, width, height] = region.target
  const decoded = execFileSync(
    'ffmpeg',
    [
      '-v',
      'error',
      '-i',
      resolve(source),
      '-vf',
      `crop=${sw}:${sh}:${sx}:${sy},scale=${width}:${height}:flags=lanczos`,
      '-frames:v',
      '26',
      '-an',
      '-f',
      'rawvideo',
      '-pix_fmt',
      'rgb24',
      'pipe:1',
    ],
    { timeout: 30000, maxBuffer: 8 * 1024 * 1024 },
  )
  const sourceFrameBytes = width * height * 3
  if (decoded.length !== sourceFrameBytes * 26)
    throw new Error('Incomplete source frames.')
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const outer = Math.hypot(
        (x - width / 2) / (width / 2 - 5),
        (y - height / 2) / (height / 2 - 5),
      )
      // A narrow feather blends gold edges without replacing the original rim.
      const alpha = clamp((1 - outer) * 24)
      const destination = (dy + y) * side + dx + x
      mask.set([255, 255, 255, Math.round(alpha * 255)], destination * 4)
      for (let n = 0; n < frameCount; n++) {
        const tail = n + blendFrames
        const blend = clamp(
          (n - (frameCount - blendFrames) + 1) / (blendFrames + 1),
        )
        const head = n - (frameCount - blendFrames)
        for (let channel = 0; channel < 3; channel++) {
          const pixel = (y * width + x) * 3 + channel
          const a = decoded[(region.start + tail) * sourceFrameBytes + pixel]
          const b =
            head < 0
              ? a
              : decoded[(region.start + head) * sourceFrameBytes + pixel]
          frames[(n * pixels + destination) * 3 + channel] = Math.round(
            a * (1 - blend) + b * blend,
          )
        }
      }
    }
}

// No audio stream, alpha codec or per-frame browser canvas required. CSS applies
// the separate alpha mask over the untouched still; only 384px is decoded.
execFileSync(
  'ffmpeg',
  [
    '-v',
    'error',
    '-n',
    '-f',
    'rawvideo',
    '-pixel_format',
    'rgb24',
    '-video_size',
    `${side}x${side}`,
    '-framerate',
    '24',
    '-i',
    'pipe:0',
    '-an',
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '19',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    '-map_metadata',
    '-1',
    videoPath,
  ],
  { input: frames, timeout: 30000 },
)
await sharp(mask, { raw: { width: side, height: side, channels: 4 } })
  .png()
  .toFile(maskPath)
console.log(
  JSON.stringify({
    sourceSha256: digest,
    videoPath,
    maskPath,
    frames: frameCount,
    fps: 24,
    duration: frameCount / 24,
    sourceFrames: 'left 5–25; right 3–23 (zero-based)',
    audio: false,
  }),
)

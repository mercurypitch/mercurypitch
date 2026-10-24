// The glass look bench, hosted.
// ============================================================
//
// The same bench as /glass-bench.html, built into a static page by the
// blender-modeler skill's bench_publish.mjs for review away from a dev server.
// Hosted pages serve neither .glb nor .hdr and may not fetch() other files, so
// each file arrives as a script that stores its bytes in base64
// (window.BENCH_FILES), loaded the first time the bench asks for it. The
// page's own controls choose the shot.

import type { BenchShot } from '@irchiinnuss/glass-game/glass-bench'
import { mountGlassBench } from '@irchiinnuss/glass-game/glass-bench'

interface BenchManifest {
  readonly hdr: string
  readonly heroes: readonly { readonly label: string; readonly url: string }[]
  /** File URL to the script that carries it. */
  readonly files: Readonly<Record<string, string>>
}

declare global {
  interface Window {
    BENCH_FILES?: Record<string, string>
    BENCH_MANIFEST?: BenchManifest
  }
}

// Without createImageBitmap, GLTFLoader decodes embedded textures through
// <img> from blob: URLs, which a hosted page may draw; it may not fetch them.
;(window as { createImageBitmap?: unknown }).createImageBitmap = undefined

const manifest = window.BENCH_MANIFEST as BenchManifest
const canvas = document.getElementById('bench') as HTMLCanvasElement
const status = document.getElementById('status') as HTMLElement
const controls = document.getElementById('controls') as HTMLFormElement

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`${src} did not load`))
    document.head.append(script)
  })
}

async function fetchBytes(url: string): Promise<ArrayBuffer> {
  const source = manifest.files[url]
  if (source === undefined) throw new Error(`${url} is not on this page`)
  if (window.BENCH_FILES?.[url] === undefined) await loadScript(source)
  const text = atob(window.BENCH_FILES?.[url] ?? '')
  const bytes = new Uint8Array(text.length)
  for (let i = 0; i < text.length; i += 1) bytes[i] = text.charCodeAt(i)
  return bytes.buffer
}

function value(name: string): string {
  return (controls.elements.namedItem(name) as HTMLInputElement).value
}

function chosen(): Partial<BenchShot> {
  return {
    hero: value('hero'),
    look: value('look') as BenchShot['look'],
    environment: value('environment') as BenchShot['environment'],
    toneMapping: value('toneMapping') as BenchShot['toneMapping'],
    subject: value('subject') as BenchShot['subject'],
    camera: value('camera') as BenchShot['camera'],
    yaw: Number(value('yaw')),
  }
}

const heroSelect = controls.elements.namedItem('hero') as HTMLSelectElement
for (const hero of manifest.heroes)
  heroSelect.add(new Option(hero.label, hero.url))

try {
  status.textContent = 'Building the studios and loading the vessel…'
  const bench = await mountGlassBench(canvas, {
    hero: manifest.heroes[0]?.url ?? '',
    hdr: manifest.hdr,
    fetchBytes,
    pixelRatio: Math.min(2, window.devicePixelRatio || 1),
  })
  // One render at a time; a change made during a render is drawn after it.
  let rendering = false
  let again = false
  const render = async () => {
    if (rendering) {
      again = true
      return
    }
    rendering = true
    controls.setAttribute('aria-busy', 'true')
    status.textContent = 'Rendering…'
    try {
      do {
        again = false
        await bench.set(chosen())
      } while (again)
      status.textContent = 'Ready'
    } catch (error) {
      status.textContent = `This shot did not render: ${error instanceof Error ? error.message : String(error)}`
    } finally {
      rendering = false
      controls.removeAttribute('aria-busy')
    }
  }
  controls.addEventListener('input', () => void render())
  controls.addEventListener('submit', (event) => event.preventDefault())
  await render()
} catch (error) {
  status.textContent = `The bench did not start: ${error instanceof Error ? error.message : String(error)}`
}

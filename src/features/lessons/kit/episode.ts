// ============================================================
// Lesson episode — the film with its chapters, captions and transcript
// ============================================================
//
// The film is a self-hosted MP4 on R2 in two sizes, 720p at 900 px and
// below and 1080p above, picked when the viewer first presses play (the
// markup's preload="none" keeps a page view from fetching any of it). Until
// its sources are set in films.ts (`film: null`) there is nothing to watch,
// so the section stays off the page with its masthead link, and the
// masthead's numerals close up. The markup ships both hidden, as a film
// with no sources needs, so the page paints that way before this runs;
// once the film has sources this shows them. Captions are a same-origin
// WebVTT track, on by default; the transcript is the same text, one
// paragraph per speaker turn. Once the episode is also on YouTube, the
// section links there ("Watch on YouTube"); it never embeds it.
//
// A film's watch page (kit/watch-pages.ts) runs this too, on the same
// markup less the big play button: there the video carries its sources and
// controls in its markup (`inMarkup`), so a crawler finds the film without
// pressing anything, and this adds the chapters, the transcript and the
// smooth jumps.

import { clamp, lerp, q, qa } from './dom'
import type { FilmSources } from './films'
import { toast } from './toast'

export interface Chapter {
  readonly title: string
  /** Seconds from the start of the film. */
  readonly start: number
}

export interface EpisodeOptions {
  /** The 1080p and 720p MP4s (films.ts), or null while there are none: no Watch section then. */
  readonly film: FilmSources | null
  /** Same-origin WebVTT captions, for the video's track. */
  readonly captions: string
  /** The same captions as text, for the transcript. */
  readonly vtt: string
  readonly chapters: readonly Chapter[]
  /** Hears the running time ("4:57") once the film's own metadata has loaded. */
  readonly onDuration?: (len: string) => void
  /** The episode's YouTube address, once it is there: the section links to it. */
  readonly youtube?: string
  /**
   * The video already carries its sources and controls in the markup (a
   * watch page): nothing is attached on the first play, and there is no
   * big play button.
   */
  readonly inMarkup?: boolean
}

type Speaker = 'blue' | 'orange'

interface Paragraph {
  at: number
  text: string
  who: Speaker | null
  sfx: boolean
}

/** Volume ramp either side of a jump, ms. */
const DIP_MS = 80

/** The masthead's section numerals, in order. */
const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI']

/**
 * Shows the Watch section and its masthead link, or takes both off the
 * page, and numbers the masthead's links that show in order, so it reads
 * "I Lesson, II Explorer" without the film and "I Lesson, II Watch, III
 * Explorer" with it. A mark that is not a numeral (a section sign) keeps
 * its place.
 */
function showWatch(section: HTMLElement, shown: boolean): void {
  section.hidden = !shown
  let k = 0
  for (const a of qa<HTMLAnchorElement>('.mast-nav a')) {
    if (a.getAttribute('href') === `#${section.id}`) a.hidden = !shown
    const mark = a.querySelector('b')
    if (a.hidden || mark === null) continue
    if (!NUMERALS.includes(mark.textContent ?? '')) continue
    mark.textContent = NUMERALS[k++]
  }
}

/** "02:44", as the chapter list and the transcript print a time. */
const clock = (s: number): string =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`

/** "4:57", rounded once so that 59.6 s reads 1:00 and never 0:60. */
function runningTime(seconds: number): string {
  const whole = Math.round(seconds)
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

function cueSeconds(stamp: string): number {
  const p = stamp.split(':').map(Number)
  return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1]
}

/**
 * A caption block as its start time and its text on one line; null for a
 * block that is not a cue (the header, a NOTE) or a cue with no text.
 */
function cueOf(block: string): { at: number; body: string } | null {
  const lines = block.split('\n').filter((l) => l !== '')
  const ti = lines.findIndex((l) => l.includes('-->'))
  if (ti < 0) return null
  const at = cueSeconds(lines[ti].split('-->')[0].trim())
  const body = lines
    .slice(ti + 1)
    .join(' ')
    .trim()
  return body === '' ? null : { at, body }
}

/** "MERC" or "TAVI" (or the older "BLUE" and "ORANGE"), as the speaker of a turn. */
const speakerOf = (label: string): Speaker =>
  label === 'MERC' || label === 'BLUE' ? 'blue' : 'orange'

/**
 * Caption cues to paragraphs: "MERC:" or "TAVI:" starts a turn (captions cut
 * before 24 October 2026 say "BLUE:" and "ORANGE:", and before 17 October
 * "BLUE MERC:" and "ORANGE MERC:"), an unlabelled cue carries on the current
 * one, and a [bracketed] cue is a sound of its own.
 */
function paragraphs(vtt: string): Paragraph[] {
  const out: Paragraph[] = []
  let who: Speaker | null = null
  for (const block of vtt.replace(/\r/g, '').split(/\n\n+/)) {
    const cue = cueOf(block)
    if (cue === null) continue
    const { at, body } = cue
    if (/^\[.*\]$/.test(body)) {
      out.push({ at, text: body.slice(1, -1), who: null, sfx: true })
      continue
    }
    const label = /^(MERC|TAVI|BLUE|ORANGE)(?: MERC)?:\s*/.exec(body)
    if (label !== null) {
      who = speakerOf(label[1])
      out.push({ at, text: body.slice(label[0].length), who, sfx: false })
      continue
    }
    const last = out.at(-1)
    if (last !== undefined && !last.sfx && last.who === who)
      last.text += ` ${body}`
    else out.push({ at, text: body, who, sfx: false })
  }
  return out
}

/**
 * The "Watch on YouTube" link: the page's own `a[data-youtube]` if its
 * markup has one (hidden until now), else a small link after the player.
 */
function linkYouTube(href: string, grid: HTMLElement): void {
  let a = document.querySelector<HTMLAnchorElement>('a[data-youtube]')
  if (a === null) {
    const p = document.createElement('p')
    p.className = 'yt'
    p.innerHTML =
      '<a class="btn sm" data-youtube target="_blank" rel="noopener"><svg class="ico" aria-hidden="true"><use href="#i-out"/></svg>Watch on YouTube</a>'
    grid.after(p)
    a = q<HTMLAnchorElement>('a', p)
  }
  a.href = href
  a.hidden = false
}

export function createEpisode(opts: EpisodeOptions): void {
  showWatch(q('#watch'), opts.film !== null)
  if (opts.film === null) return
  const film: FilmSources = opts.film
  const { chapters } = opts
  const v = q<HTMLVideoElement>('#ep')
  const big = opts.inMarkup === true ? null : q<HTMLButtonElement>('#bigPlay')
  const list = q('#chapters')
  const grid = q('#playerGrid')
  const tx = q('#tx')
  let attached = opts.inMarkup === true
  // a chapter picked before the film has its metadata: applied when it does
  let pending: number | null = null

  const track =
    v.querySelector('track') ??
    v.appendChild(
      Object.assign(document.createElement('track'), {
        kind: 'captions',
        srclang: 'en',
        label: 'English',
        default: true,
      }),
    )
  if (track.getAttribute('src') !== opts.captions) track.src = opts.captions

  function showCaptions(): void {
    for (const t of v.textTracks) {
      if (t.kind === 'captions' || t.kind === 'subtitles') t.mode = 'showing'
    }
  }

  function seek(at: number): void {
    try {
      v.currentTime = at
    } catch {
      // not seekable yet
    }
  }

  // A jump while the film plays dips the element's own volume to silence,
  // seeks, waits for the seek to land and brings the volume back, so the cut
  // does not click. Element volume rather than a Web Audio gain: routing the
  // film through a MediaElementAudioSourceNode is permanent, and silent if
  // the context never runs (.claude/memory/audio-pop-free-playback.md). iOS
  // ignores element volume (read-only there, always 1), so on an iPhone or
  // iPad a jump is still a plain seek.
  let jumpId = 0
  let level: number | null = null // the viewer's volume while a dip is in flight

  /** Moves the volume to `to` over DIP_MS; false if a newer jump took over. */
  function ramp(to: number, id: number): Promise<boolean> {
    return new Promise((resolve) => {
      const from = v.volume
      const t0 = performance.now()
      let done = false
      let fallback = 0
      const finish = (): void => {
        if (done) return
        done = true
        window.clearTimeout(fallback)
        if (id === jumpId) v.volume = to
        resolve(id === jumpId)
      }
      const frame = (now: number): void => {
        if (done) return
        if (id !== jumpId) {
          finish()
          return
        }
        const u = clamp((now - t0) / DIP_MS, 0, 1)
        v.volume = lerp(from, to, u)
        if (u < 1) requestAnimationFrame(frame)
        else finish()
      }
      // a page that is not painting gets no frames: the timer lands the ramp
      fallback = window.setTimeout(finish, DIP_MS + 150)
      requestAnimationFrame(frame)
    })
  }

  function settled(): Promise<void> {
    if (!v.seeking) return Promise.resolve()
    return new Promise((resolve) => {
      const done = (): void => {
        window.clearTimeout(timer)
        v.removeEventListener('seeked', done)
        v.removeEventListener('error', done)
        resolve()
      }
      const timer = window.setTimeout(done, 3000)
      v.addEventListener('seeked', done)
      v.addEventListener('error', done)
    })
  }

  async function jump(at: number): Promise<void> {
    const id = ++jumpId
    const restore = (level ??= v.volume) // a jump mid-dip keeps the first level
    if (!(await ramp(0, id))) return
    seek(at)
    await settled()
    if (id !== jumpId) return
    if (await ramp(restore, id)) level = null
  }

  function attach(): boolean {
    if (attached) return true
    if (v.canPlayType('video/mp4') === '') {
      toast("This browser can't play the film.")
      return false
    }
    v.src = window.matchMedia('(max-width: 900px)').matches ? film.sd : film.hd
    attached = true
    v.controls = true
    if (big !== null) big.hidden = true
    showCaptions()
    return true
  }

  // play() stays inside the tap that asked for it (iOS refuses it later);
  // a seek before the metadata waits for it
  function start(at: number | null): void {
    if (!attach()) return
    if (at !== null) {
      if (v.readyState < 1) pending = at
      else if (!v.paused) {
        void jump(at)
        return
      } else seek(at)
    }
    void v.play().catch(() => undefined)
  }

  function renderChapters(): void {
    list.textContent = ''
    chapters.forEach((c) => {
      const li = document.createElement('li')
      li.innerHTML =
        '<button type="button"><time></time><span></span><span class="eq" aria-hidden="true"><i></i><i></i><i></i></span></button>'
      q('time', li).textContent = clock(c.start)
      q('span', li).textContent = c.title
      q('button', li).addEventListener('click', () => start(c.start))
      list.appendChild(li)
    })
    list.firstElementChild?.classList.add('on')
  }

  function renderTranscript(text: string): void {
    tx.textContent = ''
    for (const p of paragraphs(text)) {
      const el = document.createElement('p')
      if (p.sfx) el.className = 'sfx'
      const tb = document.createElement('button')
      tb.type = 'button'
      tb.className = 't'
      tb.textContent = clock(p.at)
      tb.setAttribute('aria-label', `Play from ${clock(p.at)}`)
      tb.addEventListener('click', () => start(p.at))
      el.appendChild(tb)
      if (!p.sfx && p.who !== null) {
        const w = document.createElement('span')
        w.className = `who ${p.who}`
        w.textContent = p.who === 'blue' ? 'Merc' : 'Tavi'
        el.appendChild(w)
      }
      el.appendChild(document.createTextNode(p.text))
      tx.appendChild(el)
    }
  }

  renderChapters()
  if (opts.vtt.trim() !== '') renderTranscript(opts.vtt)
  if (opts.youtube !== undefined) linkYouTube(opts.youtube, grid)

  big?.addEventListener('click', () => start(null))
  v.addEventListener('loadedmetadata', () => {
    showCaptions()
    if (pending !== null) seek(pending)
    pending = null
    // the film's own running time replaces the one printed in the markup
    if (Number.isFinite(v.duration) && v.duration > 30) {
      const len = runningTime(v.duration)
      qa('.dur').forEach((el) => {
        el.textContent = len
      })
      opts.onDuration?.(len)
    }
  })
  v.addEventListener('play', () => grid.classList.add('playing'))
  v.addEventListener('pause', () => grid.classList.remove('playing'))
  v.addEventListener('timeupdate', () => {
    let k = 0
    chapters.forEach((c, i) => {
      if (v.currentTime + 0.25 >= c.start) k = i
    })
    qa('li', list).forEach((li, i) => li.classList.toggle('on', i === k))
  })
  // a video whose markup loaded its metadata before this ran
  if (opts.inMarkup === true && v.readyState >= 1)
    v.dispatchEvent(new Event('loadedmetadata'))
}

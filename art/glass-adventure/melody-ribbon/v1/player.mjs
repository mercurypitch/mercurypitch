// Audition a melody with audio-clock ribbon playback; no microphone capture or scoring.
import { compile, frequency, melodies, samplePhrase } from './contours.mjs'

const $ = (id) => document.getElementById(id)
const svgNS = 'http://www.w3.org/2000/svg'
let selected = melodies[0]
let contour = compile(selected)
let context
let playing
let generation = 0
let frame = 0
let width = 960
let lastProgress = -1
const inset = () => (width < 600 ? 20 : 60)
const x = (time) => inset() + (time / contour.duration) * (width - inset() * 2)
const y = (pitch) => (width < 600 ? 180 : 237) - pitch * 20
const node = (tag, attrs, text) => {
  const element = document.createElementNS(svgNS, tag)
  for (const [key, value] of Object.entries(attrs))
    element.setAttribute(key, value)
  if (text) element.textContent = text
  return element
}
const path = (phrase, until = phrase.end) => {
  if (until < phrase.start) return ''
  const end = Math.min(phrase.end, until)
  const samples = Math.max(1, Math.ceil((end - phrase.start) * 80))
  return Array.from({ length: samples + 1 }, (_, i) => {
    const time = phrase.start + ((end - phrase.start) * i) / samples
    return `${i ? 'L' : 'M'}${x(time).toFixed(2)},${y(samplePhrase(phrase, time)).toFixed(2)}`
  }).join(' ')
}

function draw(progress = -1) {
  lastProgress = progress
  $('fills').replaceChildren(
    ...contour.phrases.map((phrase) =>
      node('path', { d: path(phrase, progress), class: 'filled' }),
    ),
  )
  $('dots').replaceChildren(
    ...contour.phrases.flatMap((phrase) =>
      phrase.anchors.map((anchor) =>
        node('circle', {
          cx: x(anchor.time),
          cy: y(anchor.pitch),
          r: width < 600 ? 5 : 7,
          class: `anchor${progress >= anchor.completedAt ? ' passed' : ''}`,
        }),
      ),
    ),
  )
  const phrase = contour.phrases.find(
    (part) => progress >= part.start && progress <= part.end,
  )
  $('cursor').toggleAttribute('hidden', !phrase)
  if (phrase) {
    $('cursor').setAttribute('cx', x(progress))
    $('cursor').setAttribute('cy', y(samplePhrase(phrase, progress)))
  }
}

function reset(progress = -1) {
  width = Math.max(280, Math.min(960, $('ribbon').clientWidth))
  $('ribbon').setAttribute('viewBox', `0 0 ${width} ${width < 600 ? 240 : 330}`)
  contour = compile(selected, Number($('pace').value))
  $('melody-title').textContent = selected.title
  $('description').textContent = selected.description
  $('range').textContent = [
    'Whole tone',
    'Major third',
    'Perfect fifth',
    'Perfect fourth',
  ][melodies.indexOf(selected)]
  $('paths').replaceChildren(
    ...contour.phrases.map((phrase) =>
      node('path', { d: path(phrase), class: 'target' }),
    ),
  )
  $('grid').replaceChildren(
    ...[0, 2, 4, 7].map((pitch) =>
      node('line', {
        x1: inset(),
        x2: width - inset(),
        y1: y(pitch),
        y2: y(pitch),
        class: 'staff',
      }),
    ),
  )
  contour.phrases.slice(1).forEach((phrase, index) => {
    const previous = contour.phrases[index]
    $('grid').append(
      node(
        'text',
        {
          x: x((previous.end + phrase.start) / 2),
          y: width < 600 ? 221 : 285,
          class: 'breath',
        },
        'Breathe',
      ),
    )
  })
  for (const button of $('melodies').children) {
    button.setAttribute(
      'aria-checked',
      String(button.dataset.id === selected.id),
    )
    button.tabIndex = button.dataset.id === selected.id ? 0 : -1
  }
  draw(progress)
}

function stop(message = 'Ready to listen') {
  generation++
  cancelAnimationFrame(frame)
  if (playing) {
    const { gain, oscillators } = playing
    gain.gain.cancelScheduledValues(context.currentTime)
    gain.gain.setTargetAtTime(0, context.currentTime, 0.015)
    for (const oscillator of oscillators) {
      try {
        oscillator.stop(context.currentTime + 0.12)
      } catch {
        /* Already ended. */
      }
    }
    playing = undefined
  }
  $('play').textContent = 'Hear melody'
  $('playback-state').textContent = message
}

async function play() {
  if (playing) {
    stop('Stopped')
    return
  }
  const token = ++generation
  try {
    context ??= new AudioContext()
    const resumedContext = context
    await resumedContext.resume()
    if (token !== generation || document.hidden) {
      if (document.hidden && resumedContext.state === 'running')
        await resumedContext.suspend()
      return
    }
    const gain = context.createGain()
    gain.gain.value = 0.18
    gain.connect(context.destination)
    const oscillators = []
    playing = { gain, oscillators }
    const start = context.currentTime + 0.06
    const root = Number($('root').value)
    for (const phrase of contour.phrases) {
      const oscillator = context.createOscillator()
      const envelope = context.createGain()
      const duration = phrase.end - phrase.start
      const samples = Float32Array.from(
        { length: Math.ceil(duration * 120) + 1 },
        (_, i) =>
          frequency(
            root +
              samplePhrase(
                phrase,
                phrase.start + (i / Math.ceil(duration * 120)) * duration,
              ),
          ),
      )
      oscillator.type = 'sine'
      oscillator.frequency.setValueCurveAtTime(
        samples,
        start + phrase.start,
        duration,
      )
      envelope.gain.setValueAtTime(0.0001, start + phrase.start)
      envelope.gain.exponentialRampToValueAtTime(
        1,
        start + phrase.start + 0.035,
      )
      envelope.gain.setTargetAtTime(0.0001, start + phrase.end - 0.1, 0.025)
      oscillator.connect(envelope).connect(gain)
      oscillator.onended = () => {
        oscillator.disconnect()
        envelope.disconnect()
        const index = oscillators.indexOf(oscillator)
        if (index >= 0) oscillators.splice(index, 1)
        if (!oscillators.length) gain.disconnect()
      }
      oscillator.start(start + phrase.start)
      oscillator.stop(start + phrase.end + 0.08)
      oscillators.push(oscillator)
    }
    $('play').textContent = 'Stop'
    $('playback-state').textContent = 'Playing example'
    const tick = () => {
      if (token !== generation) return
      const time = Math.max(0, context.currentTime - start)
      draw(Math.min(contour.duration, time))
      if (time >= contour.duration) {
        stop('Your turn to imagine it')
        return
      }
      const breath = !contour.phrases.some(
        (phrase) => time >= phrase.start && time <= phrase.end,
      )
      const text = breath ? 'Take a breath' : 'Playing example'
      if ($('playback-state').textContent !== text)
        $('playback-state').textContent = text
      frame = requestAnimationFrame(tick)
    }
    tick()
  } catch {
    if (token === generation)
      stop('Audio could not start. Tap Hear melody to retry.')
  }
}

for (const melody of melodies) {
  const button = document.createElement('button')
  button.type = 'button'
  button.setAttribute('role', 'radio')
  button.dataset.id = melody.id
  const title = document.createElement('span')
  title.textContent = melody.title
  const count = document.createElement('small')
  count.textContent = `${melody.notes} notes`
  button.append(title, count)
  button.onclick = () => {
    stop()
    selected = melody
    reset()
  }
  $('melodies').append(button)
}
$('play').onclick = play
$('melodies').addEventListener('keydown', (event) => {
  const keys = [
    'ArrowRight',
    'ArrowDown',
    'ArrowLeft',
    'ArrowUp',
    'Home',
    'End',
  ]
  if (!keys.includes(event.key)) return
  event.preventDefault()
  const current = melodies.indexOf(selected)
  const next =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? melodies.length - 1
        : (current +
            (['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1) +
            melodies.length) %
          melodies.length
  const button = $('melodies').children[next]
  button.focus()
  button.click()
})
for (const id of ['root', 'pace'])
  $(id).onchange = () => {
    stop()
    reset()
  }
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stop('Paused while away')
    const hiddenContext = context
    window.setTimeout(() => {
      if (document.hidden && hiddenContext?.state === 'running')
        void hiddenContext.suspend().catch(() => {
          /* Navigation may already have closed it. */
        })
    }, 160)
  }
})
window.addEventListener('pagehide', () => {
  stop()
  void context?.close()
  context = undefined
})
reset()
new ResizeObserver(() => reset(lastProgress)).observe($('ribbon'))

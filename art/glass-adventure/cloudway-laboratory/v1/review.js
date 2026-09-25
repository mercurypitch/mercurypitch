// Cloudway source review — compare references, Meshy previews and packed Blender proof renders.

const cards = [...document.querySelectorAll('.card')]
const receipts = new Map()
const referenceButton = document.querySelector('#showReferences')
const modelButton = document.querySelector('#showModels')
const status = document.querySelector('#productionStatus')
const blenderButton = document.querySelector('#showBlender')
const clayButton = document.querySelector('#showClay')
const masters = new Set()

function setMode(mode) {
  referenceButton.setAttribute('aria-pressed', String(mode === 'reference'))
  modelButton.setAttribute('aria-pressed', String(mode === 'model'))
  blenderButton.setAttribute('aria-pressed', String(mode === 'blender'))
  clayButton.setAttribute('aria-pressed', String(mode === 'clay'))
  for (const card of cards) {
    const id = card.dataset.assetId
    const receipt = receipts.get(id)
    const archived = receipt?.state === 'archived'
    const model = mode === 'model' && archived
    const master = ['blender', 'clay'].includes(mode) && masters.has(id)
    const sourcePath = master
      ? `source-assets/proofs/blender/${id}/matched-${mode === 'clay' ? 'clay' : 'pbr'}-three-quarter.png`
      : model
        ? `source-assets/meshy/${id}/preview.png`
        : null
    const image = card.querySelector('img')
    const caption = card.querySelector('p')
    image.dataset.mode = sourcePath === null ? 'reference' : mode
    image.src = sourcePath ?? `previews/${id}.webp`
    card.href = sourcePath ?? `references/${id}.png`
    const sourceLabel = master
      ? `Blender ${mode === 'clay' ? 'clay' : 'materials'} source proof`
      : model
        ? 'Meshy source preview'
        : 'modeling reference'
    image.alt = `${card.querySelector('h3').textContent} — ${sourceLabel}`
    caption.textContent = master
      ? 'Dense source preserved · glass and game preparation pending'
      : model
        ? 'Meshy source preview · game preparation pending'
        : ['blender', 'clay'].includes(mode) && archived
          ? 'Reference · packed Blender proof pending'
          : archived
            ? 'Reference · dense source archived'
            : ['failed', 'canceled', 'submission-unconfirmed'].includes(
                  receipt?.state,
                )
              ? 'Reference · production needs review'
              : receipt?.taskId
                ? 'Reference · Meshy production in progress'
                : 'Reference · 3D production pending'
  }
}

for (const card of cards) {
  const id = card.getAttribute('href').split('/').pop().replace('.png', '')
  card.dataset.assetId = id
  card.querySelector('img').addEventListener('error', (event) => {
    const image = event.currentTarget
    if (image.dataset.mode === 'reference') return
    image.dataset.mode = 'reference'
    image.src = `previews/${id}.webp`
    image.alt = `${card.querySelector('h3').textContent} — modeling reference`
    card.href = `references/${id}.png`
    card.querySelector('p').textContent =
      'Reference · mount source storage to see this source proof'
  })
}

referenceButton.addEventListener('click', () => setMode('reference'))
modelButton.addEventListener('click', () => setMode('model'))
blenderButton.addEventListener('click', () => setMode('blender'))
clayButton.addEventListener('click', () => setMode('clay'))
try {
  const response = await fetch('production/master-index.json', {
    cache: 'no-store',
  })
  const index = response.ok ? await response.json() : null
  if (index?.schema === 1 && Array.isArray(index.assets)) {
    for (const card of cards)
      if (index.assets.includes(card.dataset.assetId))
        masters.add(card.dataset.assetId)
  }
} catch {
  // Source inspection remains optional for an offline reference checkout.
}

await Promise.all(
  cards.map(async (card) => {
    const id = card.dataset.assetId
    try {
      const response = await fetch(`meshy/${id}/receipt.json`, {
        cache: 'no-store',
      })
      if (response.ok) receipts.set(id, await response.json())
    } catch {
      // The reference catalogue also works offline without production receipts.
    }
  }),
)
const archived = [...receipts.values()].filter(
  (receipt) => receipt.state === 'archived',
).length
const running = [...receipts.values()].filter(
  (receipt) =>
    receipt.taskId && ['submitted', 'in-progress'].includes(receipt.state),
).length
const attention = [...receipts.values()].filter((receipt) =>
  ['failed', 'canceled', 'submission-unconfirmed'].includes(receipt.state),
).length
status.textContent = `${archived} of 20 dense sources archived; ${running} submitted or in progress.${attention ? ` ${attention} need production review.` : ''} ${masters.size} packed Blender source proofs. Model previews and Blender proofs show source materials, not finished game glass. Reload this page for updated production status.`
modelButton.disabled = archived === 0
blenderButton.disabled = masters.size === 0
clayButton.disabled = masters.size === 0
setMode('reference')

// Cloudway reference review — switches between source art and archived provider previews.

const cards = [...document.querySelectorAll('.card')]
const receipts = new Map()
const referenceButton = document.querySelector('#showReferences')
const modelButton = document.querySelector('#showModels')
const status = document.querySelector('#productionStatus')

function setMode(mode) {
  referenceButton.setAttribute('aria-pressed', String(mode === 'reference'))
  modelButton.setAttribute('aria-pressed', String(mode === 'model'))
  for (const card of cards) {
    const id = card.dataset.assetId
    const receipt = receipts.get(id)
    const archived = receipt?.state === 'archived'
    const model = mode === 'model' && archived
    const image = card.querySelector('img')
    const caption = card.querySelector('p')
    image.dataset.mode = model ? 'model' : 'reference'
    image.src = model
      ? `source-assets/meshy/${id}/preview.png`
      : `previews/${id}.webp`
    card.href = model
      ? `source-assets/meshy/${id}/preview.png`
      : `references/${id}.png`
    image.alt = `${card.querySelector('h3').textContent} — ${model ? 'Meshy source preview' : 'modeling reference'}`
    caption.textContent = model
      ? 'Meshy source preview · game preparation pending'
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
    if (image.dataset.mode !== 'model') return
    image.dataset.mode = 'reference'
    image.src = `previews/${id}.webp`
    image.alt = `${card.querySelector('h3').textContent} — modeling reference`
    card.href = `references/${id}.png`
    card.querySelector('p').textContent =
      'Reference · mount source storage to see the model preview'
  })
}

referenceButton.addEventListener('click', () => setMode('reference'))
modelButton.addEventListener('click', () => setMode('model'))

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
status.textContent = `${archived} of 20 dense sources archived; ${running} submitted or in progress.${attention ? ` ${attention} need production review.` : ''} Model previews show provider materials, not finished game glass. Reload this page for updated production status.`
modelButton.disabled = archived === 0
setMode('reference')

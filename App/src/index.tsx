// ============================================================
// index.tsx — Application mount point
// ============================================================

import { render } from 'solid-js/web'
import '@/styles/app.css'
import { App } from './App'

const root = document.getElementById('root')
if (!root) {
  throw new Error('#root element not found')
}

// Add loaded class once app mounts to prevent FOUC
render(() => <App onMounted={() => { root.classList.add('loaded'); }} />, root)

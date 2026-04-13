// ============================================================
// index.tsx — Application mount point
// ============================================================

import { render } from 'solid-js/web';
import { App } from './App';
import '@/styles/app.css';

const root = document.getElementById('root');
if (!root) {
  throw new Error('#root element not found');
}

render(() => <App />, root);

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PopupApp } from '@/src/presentation/popup/PopupApp';
import './style.css';

const rootElement = document.getElementById('root');

if (rootElement === null) {
  throw new Error('Missing #root');
}

createRoot(rootElement).render(
  <StrictMode>
    <PopupApp />
  </StrictMode>,
);

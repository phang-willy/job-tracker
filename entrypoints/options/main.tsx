import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { OptionsApp } from '@/src/presentation/options/OptionsApp';
import './style.css';

const rootElement = document.getElementById('root');

if (rootElement === null) {
  throw new Error('Missing #root');
}

createRoot(rootElement).render(
  <StrictMode>
    <OptionsApp />
  </StrictMode>,
);

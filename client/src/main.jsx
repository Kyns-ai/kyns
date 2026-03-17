import 'regenerator-runtime/runtime';
import { createRoot } from 'react-dom/client';
import './locales/i18n';
import App from './App';
import './style.css';
import './mobile.css';
import { ApiErrorBoundaryProvider } from './hooks/ApiErrorBoundaryContext';
import 'katex/dist/katex.min.css';
import 'katex/dist/contrib/copy-tex.js';

const reportClientError = (payload) => {
  fetch('/api/client-errors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {});
};

window.onerror = (message, source, lineno, colno, error) => {
  reportClientError({
    message: String(message),
    stack: error?.stack || null,
    source: `${source}:${lineno}:${colno}`,
    url: window.location.href,
    userAgent: navigator.userAgent,
  });
};

window.addEventListener('unhandledrejection', (event) => {
  reportClientError({
    message: `Unhandled Promise: ${event.reason?.message || String(event.reason)}`,
    stack: event.reason?.stack || null,
    source: 'unhandledrejection',
    url: window.location.href,
    userAgent: navigator.userAgent,
  });
});

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <ApiErrorBoundaryProvider>
    <App />
  </ApiErrorBoundaryProvider>,
);

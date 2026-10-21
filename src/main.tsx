import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Geteilter Plan (?plan=…): eigene, schlanke Seite ohne Anmeldung
const SharedPlanView = lazy(() => import('./components/SharedPlanView.tsx'));
const shareToken = new URLSearchParams(window.location.search).get('plan');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {shareToken ? (
      <Suspense fallback={null}>
        <SharedPlanView token={shareToken} />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>
);

// Service Worker – macht die App auf dem Handy installierbar (nicht im Entwicklungsmodus)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // ohne Service Worker läuft die App ganz normal im Browser
    });
  });
}

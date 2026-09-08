
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { registerSW } from 'virtual:pwa-register';

// Register the PWA Workbox service worker for caching and offline support
const updateSW = registerSW({
  onNeedRefresh() {
    console.log('PWA Service Worker: New content available, ready to refresh.');
  },
  onOfflineReady() {
    console.log('PWA Service Worker: Application is ready to work offline.');
  },
  immediate: true
});

const rootElement = document.getElementById('root');

if (rootElement) {
  try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (error) {
    console.error("App render failed:", error);
    rootElement.innerHTML = `<div style="color: red; padding: 20px; font-family: sans-serif;">
      <h2>Critical Loading Error</h2>
      <p>Please check your internet connection or reload the page.</p>
    </div>`;
  }
}

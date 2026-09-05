
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

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

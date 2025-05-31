
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

function mountApp() {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    console.error("Fatal Error: Could not find root element to mount to. Ensure a div with id='root' exists in your index.html.");
    // Display a user-friendly message on the page itself if possible
    document.body.innerHTML = `
      <div style="font-family: sans-serif; padding: 20px; text-align: center; color: #333;">
        <h1>Application Error</h1>
        <p>Could not initialize the application. The required HTML structure is missing.</p>
        <p>Please ensure a <code>&lt;div id="root"&gt;&lt;/div&gt;</code> element exists in the HTML body.</p>
      </div>
    `;
    return; // Stop further execution
  }

  try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (error) {
    console.error("React rendering error:", error);
    rootElement.innerHTML = `
      <div style="font-family: sans-serif; padding: 20px; color: #D8000C; background-color: #FFD2D2; border: 1px solid #D8000C; border-radius: 5px; text-align: left;">
        <h2>Oops! Something went wrong.</h2>
        <p>There was an error trying to render the application. Details have been logged to the console.</p>
        <p>Error: ${error instanceof Error ? error.message : String(error)}</p>
      </div>
    `;
  }
}

if (document.readyState === 'loading') {
  // Document is still loading, wait for DOMContentLoaded
  document.addEventListener('DOMContentLoaded', mountApp);
} else {
  // Document has already loaded
  mountApp();
}

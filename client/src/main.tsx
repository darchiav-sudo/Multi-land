import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { registerServiceWorker } from './lib/registerServiceWorker';
import { logBrowserInfo } from './lib/browser-compatibility';
import { initCapacitor } from './lib/capacitor';

// Log browser details to help with debugging cross-browser issues
logBrowserInfo();

// Initialize Capacitor and apply platform-specific optimizations
initCapacitor().catch(err => console.error('Error initializing Capacitor:', err));

// Register service worker for PWA functionality
if (import.meta.env.PROD) {
  registerServiceWorker()
    .then(() => console.log('Service worker registered successfully'))
    .catch(error => console.error('Service worker registration failed:', error));
} else {
  console.log('Service worker not registered in development mode');
}

// Configure XMLHttpRequest to use longer timeouts by default
(function configureXHR() {
  const originalXhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function() {
    // @ts-ignore
    const result = originalXhrOpen.apply(this, arguments);
    
    // Set a reasonable default timeout (5 minutes)
    this.timeout = 300000;
    
    return result;
  };
})();

createRoot(document.getElementById("root")!).render(<App />);

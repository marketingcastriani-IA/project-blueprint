import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Register Service Worker for push notifications
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      console.log('[SW] Registered:', reg.scope);
      
      // Wait for the SW to be ready and controlling the page
      const ready = await navigator.serviceWorker.ready;
      console.log('[SW] Ready:', ready.active?.state);
      
      // If no controller yet (first install), reload to let SW take control
      if (!navigator.serviceWorker.controller) {
        console.log('[SW] No controller yet — will control on next navigation');
      }
    } catch (err) {
      console.warn('[SW] Registration failed:', err);
    }
  });
}

createRoot(document.getElementById("root")!).render(<App />);

import React, { useEffect } from 'react';
import '../styles/globals.css';

export default function App({ Component, pageProps }) {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js').catch((err) => {
        // Registration failure is non-fatal; the app still works online.
        console.warn('[SW] Registration failed:', err);
      });
    }
  }, []);

  return <Component {...pageProps} />;
}

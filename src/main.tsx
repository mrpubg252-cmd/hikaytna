import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Safe localStorage & sessionStorage polyfill for restricted third-party sandboxed iframe environments
if (typeof window !== 'undefined') {
  const createMockStorage = () => {
    let store: Record<string, string> = {};
    return {
      getItem: (key: string) => store[key] !== undefined ? store[key] : null,
      setItem: (key: string, value: string) => { store[key] = String(value); },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => { store = {}; },
      get length() { return Object.keys(store).length; },
      key: (index: number) => Object.keys(store)[index] || null,
    };
  };

  try {
    const testKey = '__storage_test_ls__';
    window.localStorage.setItem(testKey, 'test');
    window.localStorage.removeItem(testKey);
  } catch (e) {
    console.warn('⚡ [Safeguard] LocalStorage is blocked in this view environment. Directing to memory storage.', e);
    try {
      Object.defineProperty(window, 'localStorage', {
        value: createMockStorage(),
        configurable: true,
        enumerable: true,
        writable: true
      });
    } catch (err) {
      console.error('Failed to override localStorage:', err);
    }
  }

  try {
    const testKey = '__storage_test_ss__';
    window.sessionStorage.setItem(testKey, 'test');
    window.sessionStorage.removeItem(testKey);
  } catch (e) {
    console.warn('⚡ [Safeguard] SessionStorage is blocked in this view environment. Directing to memory storage.', e);
    try {
      Object.defineProperty(window, 'sessionStorage', {
        value: createMockStorage(),
        configurable: true,
        enumerable: true,
        writable: true
      });
    } catch (err) {
      console.error('Failed to override sessionStorage:', err);
    }
  }

  // Intercept uncaught/unhandled runtime exceptions inside locked platform frames
  window.addEventListener('error', (event) => {
    if (event.message?.includes('play()') || event.message?.includes('SpeechRecognition') || event.message?.includes('localStorage')) {
      event.preventDefault();
    }
  }, true);

  window.addEventListener('unhandledrejection', (event) => {
    event.preventDefault();
  }, true);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

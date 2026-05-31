import React, { createContext, useContext, useState, useEffect } from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, CornerUpLeft } from 'lucide-react';

type DisplayMode = 'auto' | 'mobile' | 'ipad' | 'sony' | 'tv';
type DeviceMode = 'tv' | 'mobile' | 'desktop';

interface DeviceAndNavigationContextType {
  displayMode: DisplayMode;
  deviceMode: DeviceMode;
  isTV: boolean;
  isMobile: boolean;
  isDesktop: boolean;
  setDisplayMode: (mode: DisplayMode) => void;
  autoDetectMode: () => void;
}

const DeviceAndNavigationContext = createContext<DeviceAndNavigationContextType | undefined>(undefined);

export const useDevice = () => {
  const context = useContext(DeviceAndNavigationContext);
  if (!context) {
    throw new Error('useDevice must be used within a DeviceAndNavigationProvider');
  }
  return context;
};

export const DeviceAndNavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Read initial layout from local storage
  const [displayMode, setDisplayModeState] = useState<DisplayMode>(() => {
    return (localStorage.getItem('displayMode') as DisplayMode) || 'auto';
  });

  const [deviceMode, setDeviceModeState] = useState<DeviceMode>('desktop');

  const setDisplayMode = (mode: DisplayMode) => {
    setDisplayModeState(mode);
    localStorage.setItem('displayMode', mode);
  };

  const autoDetectMode = () => {
    const ua = navigator.userAgent.toLowerCase();
    
    // Comprehensive TV User-Agent checks
    const tvKeywords = [
      'smarttv', 'smart-tv', 'googletv', 'google-tv', 'appletv', 'apple-tv',
      'hbbtv', 'netcast', 'opera tv', 'tizen', 'webos', 'viera', 'philipstv',
      'sonydtv', 'toshibatv', 'sharp-tv', 'mi-box', 'mibox', 'chromecast',
      'playstation', 'playstation 4', 'playstation 5', 'xbox', 'nintendo switch',
      'firetv', 'firestick', 'dtv', 'roku', 'rokutv', 'aftb', 'afts', 'aftm',
      'tcl', 'sony', 'philips', 'hisense', 'sharp', 'panasonic', 'android tv', 'androidtv', 'crkey', 'cast', 'tv '
    ];
    
    const isTVUA = tvKeywords.some(keyword => ua.includes(keyword));
    const mobileKeywords = ['iphone', 'ipad', 'ipod', 'android', 'blackberry', 'iemobile', 'opera mini', 'mobile'];
    const isMobileUA = mobileKeywords.some(keyword => ua.includes(keyword)) && !isTVUA;

    if (isTVUA) {
      return 'tv';
    } else if (isMobileUA || window.innerWidth <= 768) {
      return 'mobile';
    } else {
      return 'desktop';
    }
  };

  // Determine actual deviceMode and execute display scaling zoom factor overrides
  useEffect(() => {
    const root = window.document.documentElement;
    let zoomValue = '1';
    let resolvedDevice: DeviceMode = 'desktop';

    switch (displayMode) {
      case 'mobile':
        zoomValue = '0.92';
        resolvedDevice = 'mobile';
        break;
      case 'ipad':
        zoomValue = '1.02';
        resolvedDevice = 'desktop';
        break;
      case 'sony':
        zoomValue = '1.14';
        resolvedDevice = 'tv';
        break;
      case 'tv':
        zoomValue = '1.24';
        resolvedDevice = 'tv';
        break;
      default: {
        // Auto mode - Auto-detect and set appropriate zoom automatically
        resolvedDevice = autoDetectMode();
        if (resolvedDevice === 'tv') {
          zoomValue = '1.24';
        } else if (resolvedDevice === 'mobile') {
          zoomValue = '0.92';
        } else {
          zoomValue = '1';
        }
        break;
      }
    }

    root.style.zoom = zoomValue;
    setDeviceModeState(resolvedDevice);
  }, [displayMode]);

  const isTV = deviceMode === 'tv';
  const isMobile = deviceMode === 'mobile';
  const isDesktop = deviceMode === 'desktop';

  // --- Dynamic Auto Tagging of interactive DOM elements for TV Spatial Navigation ---
  useEffect(() => {
    if (!isTV) {
      // Cleanup TV class styles if mode changes to desktop
      document.querySelectorAll('[data-tv-focusable="true"]').forEach(el => {
        el.classList.remove('tv-focused');
      });
      return;
    }

    const autoTagElements = () => {
      // Find all interactive nodes on the current page
      const elementsToTag = document.querySelectorAll(
        'button, a, input:not([type="range"]), textarea, [role="button"], .series-card, .episode-btn, .server-btn, .category-pill, .slider-dot, .chat-nav-card'
      );

      elementsToTag.forEach(el => {
        if (el.getAttribute('aria-hidden') === 'true') return;
        if (el.closest('[aria-hidden="true"]')) return;
        if ((el as any).disabled) return;
        
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return; // Hidden elements

        if (!el.hasAttribute('data-tv-focusable')) {
          el.setAttribute('data-tv-focusable', 'true');
        }
        if (!el.hasAttribute('tabindex')) {
          el.setAttribute('tabindex', '0');
        }
      });
    };

    // Run dynamic tagging immediately and set up an observer to catch lazy-loaded lists or router screen updates
    autoTagElements();
    const interval = setInterval(autoTagElements, 800);

    const observer = new MutationObserver(() => {
      autoTagElements();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      clearInterval(interval);
      observer.disconnect();
    };
  }, [isTV]);

  // --- Spatial Navigation Controller Engine & Auto D-pad Activator ---
  const [tvToastVisible, setTvToastVisible] = useState(false);

  useEffect(() => {
    // Helper functions for geometric remote spatial focus selection
    function getNextElement(current: HTMLElement, direction: string, list: HTMLElement[]): HTMLElement | null {
      const currRect = current.getBoundingClientRect();
      const currCenter = {
        x: currRect.left + currRect.width / 2,
        y: currRect.top + currRect.height / 2
      };

      let candidates: { el: HTMLElement; score: number }[] = [];

      list.forEach(other => {
        if (other === current) return;

        const otherRect = other.getBoundingClientRect();
        const otherCenter = {
          x: otherRect.left + otherRect.width / 2,
          y: otherRect.top + otherRect.height / 2
        };

        let isValid = false;
        let dx = otherCenter.x - currCenter.x;
        let dy = otherCenter.y - currCenter.y;

        // Check if matching target direction physically
        if (direction === 'ArrowRight') {
          if (dx > 5) isValid = true;
        } else if (direction === 'ArrowLeft') {
          if (dx < -5) isValid = true;
        } else if (direction === 'ArrowDown') {
          if (dy > 5) isValid = true;
        } else if (direction === 'ArrowUp') {
          if (dy < -5) isValid = true;
        }

        if (isValid) {
          let distParallel = 0;
          let distOrthogonal = 0;

          if (direction === 'ArrowRight' || direction === 'ArrowLeft') {
            distParallel = Math.abs(dx);
            distOrthogonal = Math.abs(dy);
          } else {
            distParallel = Math.abs(dy);
            distOrthogonal = Math.abs(dx);
          }

          // Penalize horizontal grid alignment less than vertical jump, lock grid columns
          const score = distParallel + (distOrthogonal * 5);
          candidates.push({ el: other, score });
        }
      });

      if (candidates.length === 0) return null;

      candidates.sort((a, b) => a.score - b.score);
      return candidates[0].el;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      const isOK = e.key === 'Enter' || e.key === 'Select' || e.key === 'OK' || e.key === 'Ok' || e.keyCode === 13 || e.keyCode === 23 || e.keyCode === 66;
      const isBack = e.key === 'Backspace' || e.key === 'Escape' || e.key === 'GoBack' || e.key === 'Back' || e.key === 'BrowserBack' || e.keyCode === 27 || e.keyCode === 4 || e.keyCode === 10009 || e.keyCode === 461;
      
      let directionKey = '';
      if (e.key === 'ArrowUp' || e.keyCode === 19) directionKey = 'ArrowUp';
      else if (e.key === 'ArrowDown' || e.keyCode === 20) directionKey = 'ArrowDown';
      else if (e.key === 'ArrowLeft' || e.keyCode === 21) directionKey = 'ArrowLeft';
      else if (e.key === 'ArrowRight' || e.keyCode === 22) directionKey = 'ArrowRight';

      const isArrow = directionKey !== '';

      if (!isOK && !isBack && !isArrow) return;

      const activeEl = document.activeElement as HTMLElement;
      const isInputActive = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);

      // Do not block text editor cursor operations
      if (isInputActive && (directionKey === 'ArrowLeft' || directionKey === 'ArrowRight')) {
        return;
      }

      // 1. AUTO-ACTIVATE TV MODE ON PHYSICAL D-PAD / KEY DIRECTION KEY DOWN
      if (!isTV) {
        if (isArrow) {
          console.log(`[Remote Key Detector] D-pad detected: '${directionKey}'. Promoting interface layout to TV Mode automatically...`);
          e.preventDefault();
          
          // Elevate display resolution to TV instantly
          setDisplayMode('tv');
          
          // Give DOM a split microsecond to construct focusable tags, then focus first element
          setTimeout(() => {
            const initialFocusables = Array.from(document.querySelectorAll('[data-tv-focusable="true"]')) as HTMLElement[];
            if (initialFocusables.length > 0) {
              const activeNode = initialFocusables[0];
              activeNode.focus();
              activeNode.classList.add('tv-focused');
              activeNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 100);
          return;
        }
        return;
      }

      // If a custom video player is active, bypass the global spatial navigation keys (arrows, OK/Enter, and Back)
      // to let CustomPlayer's own focused, stateful remote controller handle it.
      // This prevents double-seeking, simultaneous drawer focus issues, and back-button page exit conflicts on TV remotes.
      const playerContainer = document.getElementById('custom-video-player-container');
      if (playerContainer) {
        return; // CustomPlayer handles everything while active!
      }

      // 2. SPATIAL GEOMETRIC DECODING
      let focusables = Array.from(document.querySelectorAll('[data-tv-focusable="true"]')) as HTMLElement[];

      const visibleFocusables = focusables.filter(el => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none' && style.opacity !== '0';
      });

      if (visibleFocusables.length === 0) return;

      // Ensure some element always gets current focus if none is focused or is out of bounds
      if (!activeEl || activeEl === document.body || !visibleFocusables.includes(activeEl)) {
        visibleFocusables[0].focus();
        visibleFocusables[0].classList.add('tv-focused');
        e.preventDefault();
        return;
      }

      if (isArrow) {
        e.preventDefault();
        const nextEl = getNextElement(activeEl, directionKey, visibleFocusables);
        if (nextEl) {
          visibleFocusables.forEach(el => el.classList.remove('tv-focused'));
          nextEl.focus();
          nextEl.classList.add('tv-focused');

          // Centered scroll animation into viewport screen
          nextEl.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        }
      } else if (isOK) {
        e.preventDefault();
        activeEl.click();
      } else if (isBack) {
        e.preventDefault();
        // TV Native back buttons trigger
        if (window.history.length > 1) {
          window.history.back();
        } else {
          window.location.href = '/';
        }
      }
    };

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target && target.getAttribute?.('data-tv-focusable') === 'true') {
        document.querySelectorAll('[data-tv-focusable="true"]').forEach(el => el.classList.remove('tv-focused'));
        target.classList.add('tv-focused');
      }
    };

    const handleMouseOver = (e: MouseEvent) => {
      if (!isTV) return;
      const target = (e.target as HTMLElement).closest('[data-tv-focusable="true"]') as HTMLElement;
      if (target && target !== document.activeElement) {
        target.focus({ preventScroll: true });
        document.querySelectorAll('[data-tv-focusable="true"]').forEach(el => el.classList.remove('tv-focused'));
        target.classList.add('tv-focused');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('mouseover', handleMouseOver);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('mouseover', handleMouseOver);
    };
  }, [isTV]);

  return (
    <DeviceAndNavigationContext.Provider value={{ displayMode, deviceMode, isTV, isMobile, isDesktop, setDisplayMode, autoDetectMode }}>
      {children}
    </DeviceAndNavigationContext.Provider>
  );
};

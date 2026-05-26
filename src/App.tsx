/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { DeviceAndNavigationProvider, useDevice } from './context/DeviceAndNavigationContext';
import HomeScreen from './screens/HomeScreen';
import WatchScreen from './screens/WatchScreen';
import FavoritesScreen from './screens/FavoritesScreen';
import ProfileScreen from './screens/ProfileScreen';
import ChatScreen from './screens/ChatScreen';
import ShortsScreen from './screens/ShortsScreen';
import AdminScreen from './screens/AdminScreen';

function AppLayout() {
  const { deviceMode, isTV } = useDevice();
  const [showTvBadge, setShowTvBadge] = React.useState(true);

  React.useEffect(() => {
    if (deviceMode === 'tv') {
      document.body.classList.add('tv-mode-active');
      setShowTvBadge(true);
      const timer = setTimeout(() => {
        setShowTvBadge(false);
      }, 5000);
      return () => clearTimeout(timer);
    } else {
      document.body.classList.remove('tv-mode-active');
      setShowTvBadge(false);
    }
  }, [deviceMode]);

  return (
    <>
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/watch" element={<WatchScreen />} />
        <Route path="/favorites" element={<FavoritesScreen />} />
        <Route path="/profile" element={<ProfileScreen />} />
        <Route path="/chat" element={<ChatScreen />} />
        <Route path="/shorts" element={<ShortsScreen />} />
        <Route path="/admin" element={<AdminScreen />} />
      </Routes>

      {isTV && showTvBadge && (
        <div className="fixed top-4 left-4 z-[9999] bg-gradient-to-r from-red-600 to-red-800 text-white px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-black shadow-[0_0_20px_rgba(229,9,20,0.6)] border border-white/10 flex items-center gap-2 select-none animate-bounce">
          <span className="w-2 h-2 rounded-full bg-yellow-400 animate-ping" />
          <span>وضع التلفزيون نشط 📺 (استخدم أزرار الريموت)</span>
        </div>
      )}
    </>
  );
}

export default function App() {

  React.useEffect(() => {
    // Check for referral code in url parameter directly from window.location
    const params = new URLSearchParams(window.location.search);
    const refCode = params.get('ref');
    
    if (refCode) {
      // Check if this browser already completed a referral to exclude self-referrals or re-entries
      const alreadyReferred = localStorage.getItem('referred_registered');
      if (alreadyReferred) {
        console.log("User has already completed a referral.");
      } else {
        // Wait for real-person telemetry signatures before counting referrals
        const handleHumanActivity = () => {
          window.removeEventListener('scroll', handleHumanActivity);
          window.removeEventListener('click', handleHumanActivity);
          window.removeEventListener('touchstart', handleHumanActivity);
          window.removeEventListener('mousemove', handleHumanActivity);
          window.removeEventListener('keydown', handleHumanActivity);

          console.log("⚡ [Telemetry Verification] Human actions detected. Registering referral for:", refCode);

          fetch('/api/v1/referral/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ referrerId: refCode })
          })
          .then(res => res.json())
          .then(data => {
            if (data.status) {
              localStorage.setItem('referred_registered', 'true');
              console.log("Successfully credited referral node!");
            }
          })
          .catch(err => {
            console.warn("Failed sending verified telemetry request", err);
          });
        };

        window.addEventListener('scroll', handleHumanActivity, { passive: true });
        window.addEventListener('click', handleHumanActivity);
        window.addEventListener('touchstart', handleHumanActivity, { passive: true });
        window.addEventListener('mousemove', handleHumanActivity, { passive: true });
        window.addEventListener('keydown', handleHumanActivity);
      }
    }

    // Block Right Click Context Menu
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    // Block common developer shortcuts (F12, Ctrl/Cmd + Shift + I/J/C, and Ctrl/Cmd + U)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F12') {
        e.preventDefault();
        return;
      }
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;
      if (isCmdOrCtrl && e.shiftKey && (e.key === 'i' || e.key === 'I' || e.key === 'j' || e.key === 'J' || e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        return;
      }
      if (isCmdOrCtrl && (e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
        return;
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Ad script removed for stability
  React.useEffect(() => {
    return () => {};
  }, []);

  return (
    <AuthProvider>
      <DeviceAndNavigationProvider>
        <BrowserRouter>
          <AppLayout />
        </BrowserRouter>
      </DeviceAndNavigationProvider>
    </AuthProvider>
  );
}

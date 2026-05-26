/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import HomeScreen from './screens/HomeScreen';
import WatchScreen from './screens/WatchScreen';
import FavoritesScreen from './screens/FavoritesScreen';
import ProfileScreen from './screens/ProfileScreen';
import ChatScreen from './screens/ChatScreen';
import ShortsScreen from './screens/ShortsScreen';

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

  // Dynamically load the global HilltopAds monetization ad script 
  React.useEffect(() => {
    if (import.meta.env.DEV || localStorage.getItem('ads_removed_forever') === 'true') {
      console.log("⚡ [Dev/Gold Member] Global commercial trackers and overlays disabled.");
      return;
    }

    try {
      const script = document.createElement('script');
      script.async = true;
      script.referrerPolicy = 'no-referrer-when-downgrade';
      script.src = "//untimely-hello.com/b.XpV-sSdCGRlU0/YDWfcq/geDm/9guoZNUqlfkEP/TecDwvNAjVk/xOMbTWcRtDN/zlAI2GOrTgEVy/MrQj";
      document.head.appendChild(script);
      
      return () => {
        try {
          document.head.removeChild(script);
        } catch {}
      };
    } catch (err) {
      console.warn("Global tracking dynamic load error", err);
    }
  }, []);

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/watch" element={<WatchScreen />} />
          <Route path="/favorites" element={<FavoritesScreen />} />
          <Route path="/profile" element={<ProfileScreen />} />
          <Route path="/chat" element={<ChatScreen />} />
          <Route path="/shorts" element={<ShortsScreen />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

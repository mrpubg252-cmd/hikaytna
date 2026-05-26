/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ClerkProvider } from '@clerk/clerk-react';
import { arSA } from '@clerk/localizations';
import { AuthProvider } from './context/AuthContext';
import HomeScreen from './screens/HomeScreen';
import WatchScreen from './screens/WatchScreen';
import FavoritesScreen from './screens/FavoritesScreen';
import ProfileScreen from './screens/ProfileScreen';
import ChatScreen from './screens/ChatScreen';

const rawKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const PUBLISHABLE_KEY = (rawKey && rawKey.startsWith('pk_')) 
  ? rawKey 
  : 'pk_test_Zmlyc3QtYnJlYW0tMzAuY2xlcmsuYWNjb3VudHMuZGV2JA';

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Publishable Key");
}

export default function App() {
  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/" localization={arSA}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomeScreen />} />
            <Route path="/watch" element={<WatchScreen />} />
            <Route path="/favorites" element={<FavoritesScreen />} />
            <Route path="/profile" element={<ProfileScreen />} />
            <Route path="/chat" element={<ChatScreen />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ClerkProvider>
  );
}

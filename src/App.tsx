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

export default function App() {
  return (
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
  );
}

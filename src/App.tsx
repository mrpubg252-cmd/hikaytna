/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import BottomNav from "./components/BottomNav";
import Home from "./pages/Home";
import SeriesDetail from "./pages/SeriesDetail";
import MyList from "./pages/MyList";
import Profile from "./pages/Profile";
import Player from "./pages/Player";

function AppContent() {
  const location = useLocation();
  const isPlaying = location.pathname.includes("/play");

  return (
    <div className={`min-h-screen bg-[#050505] font-sans selection:bg-red-600/30 selection:text-red-500 ${isPlaying ? '' : 'pb-20 lg:pb-0'}`}>
      {!isPlaying && <Navbar />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/series/:id" element={<SeriesDetail />} />
        <Route path="/series/:id/play" element={<Player />} />
        <Route path="/my-list" element={<MyList />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
      {!isPlaying && <BottomNav />}
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}


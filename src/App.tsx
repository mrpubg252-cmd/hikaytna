import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import SeriesDetails from './pages/SeriesDetails';
import Watch from './pages/Watch';
import Search from './pages/Search';

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col font-sans">
        <Header />
        <main className="flex-grow pt-16">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/series/:slug" element={<SeriesDetails />} />
            <Route path="/watch/:slug" element={<Watch />} />
            <Route path="/search" element={<Search />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

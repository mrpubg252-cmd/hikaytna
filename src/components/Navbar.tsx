import { Link, useLocation } from "react-router-dom";
import { Search, Bell } from "lucide-react";
import { cn } from "../lib/utils";

export default function Navbar() {
  const location = useLocation();

  return (
    <nav className="fixed top-0 w-full z-50 px-4 md:px-8 py-5 flex items-center justify-between bg-gradient-to-b from-black/90 via-black/50 to-transparent">
      <div className="flex items-center gap-16">
        <Link to="/" className="flex flex-col items-center group">
          <span className="text-2xl font-black tracking-widest text-red-600 leading-none">
            HIKAYTNA
          </span>
          <span className="text-sm font-bold text-white tracking-widest leading-none mt-1">
            حكايتنا
          </span>
        </Link>
        <div className="hidden md:flex items-center gap-8 text-lg font-bold">
          <Link
            to="/"
            className={cn(
              "transition-colors pb-2 border-b-2",
              location.pathname === "/"
                ? "text-white border-red-600"
                : "text-gray-400 border-transparent hover:text-white"
            )}
          >
            الرئيسية
          </Link>
          <Link
            to="/my-list"
            className={cn(
              "transition-colors pb-2 border-b-2",
              location.pathname === "/my-list"
                ? "text-white border-red-600"
                : "text-gray-400 border-transparent hover:text-white"
            )}
          >
            قائمتي
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <button className="text-gray-300 hover:text-white transition-colors">
          <Search className="w-6 h-6" />
        </button>
        <button className="text-gray-300 hover:text-white transition-colors relative">
          <Bell className="w-6 h-6" />
          <span className="absolute top-0 right-0 w-2 h-2 bg-red-600 rounded-full border border-black"></span>
        </button>
        <Link to="/profile" className="w-10 h-10 rounded-full overflow-hidden border-2 border-transparent hover:border-gray-500 cursor-pointer transition-all">
          <img
            src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100&auto=format&fit=crop"
            alt="User"
            className="w-full h-full object-cover"
          />
        </Link>
      </div>
    </nav>
  );
}

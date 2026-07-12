import { Home, User, Bookmark } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "../lib/utils";

export default function BottomNav() {
  const location = useLocation();

  const navItems = [
    { icon: User, label: "حسابي", path: "/profile" },
    { icon: Bookmark, label: "قائمتي", path: "/my-list" },
    { icon: Home, label: "الرئيسية", path: "/" },
  ];

  return (
    <div className="md:hidden fixed bottom-0 w-full bg-[#050505] border-t border-zinc-800/80 px-8 py-3 z-50 flex items-center justify-between shadow-2xl">
      {navItems.map((item) => {
        const isActive = location.pathname === item.path;
        const Icon = item.icon;
        
        return (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              "flex flex-col items-center gap-1.5 transition-colors relative",
              isActive ? "text-red-600" : "text-gray-400 hover:text-gray-200"
            )}
          >
            <div className="relative">
              <Icon className={cn("w-6 h-6", isActive && "fill-current")} />
            </div>
            <span className={cn("text-xs font-bold", isActive ? "text-red-600" : "text-gray-400")}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

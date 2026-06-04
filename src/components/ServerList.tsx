import React from 'react';
import { Server } from 'lucide-react';
import { cn } from '../lib/utils';

interface ServerListProps {
  servers: { name: string; url: string }[];
  activeUrl: string;
  onSelect: (url: string) => void;
}

export default function ServerList({ servers, activeUrl, onSelect }: ServerListProps) {
  return (
    <div className="flex flex-wrap gap-3 px-4 py-4">
      {servers.map((srv, idx) => (
        <button
          key={idx}
          onClick={() => onSelect(srv.url)}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all border",
            activeUrl === srv.url
              ? "bg-primary/20 border-primary text-primary"
              : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white"
          )}
        >
          <Server className="w-4 h-4" />
          {srv.name}
        </button>
      ))}
    </div>
  );
}

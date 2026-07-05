import React from 'react';

interface Episode {
  epNum: number;
  epSlug: string;
  title: string;
}

interface ServerItem {
  name: string;
  url: string;
  directUrl?: string;
}

interface CustomPlayerProps {
  videoUrl: string;
  activeServerUrl: string;
  seriesId: string;
  seriesImage: string;
  episodeIndex: number;
  episodes: Episode[];
  servers: ServerItem[];
  onSelectEpisode: (episode: Episode, index: number) => void;
  onSelectServer: (url: string) => void;
  isMaximized: boolean;
  onToggleMaximize: () => void;
  seriesTitle?: string;
  seriesCategory?: string;
}

export default function CustomPlayer({
  videoUrl,
  activeServerUrl,
  isMaximized,
}: CustomPlayerProps) {
  const iframeSrc = activeServerUrl || videoUrl;

  return (
    <div 
      className={`relative w-full bg-black overflow-hidden shadow-2xl transition-all duration-300 ring-1 ring-white/5 select-none ${
        isMaximized ? 'fixed inset-0 z-[120] h-screen w-screen aspect-auto' : 'aspect-video rounded-xl md:rounded-2xl'
      }`}
    >
      {iframeSrc ? (
        <iframe
          src={iframeSrc}
          className="w-full h-full border-none absolute inset-0"
          allowFullScreen
          title="Streaming Server"
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col gap-3 items-center justify-center bg-[#07070a]">
          <span className="text-sm font-semibold text-zinc-400">جاري الاتصال بخادم البث...</span>
        </div>
      )}
    </div>
  );
}

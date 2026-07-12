export interface Episode {
  id: string;
  title: string;
  subtitle: string;
  duration: string;
  thumbnail: string;
  url?: string;
}

export interface Season {
  id: string;
  title: string;
  episodes: Episode[];
}

export interface Series {
  id: string;
  title: string;
  description: string;
  coverImage: string;
  heroImage: string;
  category: string;
  rating: string;
  year: string;
  imdb?: string;
  ageRating?: string;
  seasonsCount?: number;
  isNew?: boolean;
  seasons?: Season[];
  progress?: number;
  currentEpisode?: string;
}

export const seriesData: Series[] = [
  {
    id: "serie-yeralti",
    title: "تحت الارض",
    description: "ينتقم شاب لعائلته بقتل من قتلهم، لكن هذا الانتقام يقوده مباشرة إلى السجن حيث يجد نفسه وسط واحدة من أخطر عصابات الجريمة المنظمة في تركيا. بعد ثلاث سنوات من السجن، يخرج ليواجه أقسى امتحان في حياته.",
    coverImage: "https://3iskk.xyz/wp-content/uploads/2026/06/yeralti-2.jpg",
    heroImage: "https://3iskk.xyz/wp-content/uploads/2026/06/yeralti-3.jpg",
    category: "دراما، أكشن",
    rating: "8.5",
    year: "2026",
    imdb: "8.5",
    ageRating: "+18",
    seasonsCount: 1,
    isNew: true,
    seasons: [
      {
        id: "s1",
        title: "الموسم 1",
        episodes: Array.from({length: 16}).map((_, i) => ({
          id: `e${16 - i}`,
          title: `الحلقة ${16 - i}`,
          subtitle: "تحت الارض",
          duration: "2:20:00",
          thumbnail: "https://3iskk.xyz/wp-content/uploads/2026/06/yeralti-2.jpg",
          url: `https://3iskk.xyz/watch/episodes/serie-yeralti-season-1-episode-${16 - i}/see/`
        }))
      }
    ]
  },
  {
    id: "serie-daha-17",
    title: "في السابعة عشر",
    description: "تدور أحداث المسلسل حول حياة مجموعة من المراهقين وتحدياتهم في سن السابعة عشر.",
    coverImage: "https://3iskk.xyz/wp-content/uploads/2026/05/daha-17-dizi.jpg",
    heroImage: "https://3iskk.xyz/wp-content/uploads/2026/05/daha-17-dizi.jpg",
    category: "دراما شبابية",
    rating: "8.0",
    year: "2026",
    seasonsCount: 1,
    isNew: true,
    seasons: [
      {
        id: "s1",
        title: "الموسم 1",
        episodes: Array.from({length: 6}).map((_, i) => ({
          id: `e${6 - i}`,
          title: `الحلقة ${6 - i}`,
          subtitle: "في السابعة عشر",
          duration: "2:00:00",
          thumbnail: "https://3iskk.xyz/wp-content/uploads/2026/05/daha-17-dizi.jpg",
          url: `https://3iskk.xyz/watch/episodes/serie-daha-17-season-1-episode-${6 - i}/see/`
        }))
      }
    ]
  },
  {
    id: "serie-doganin-kanunu",
    title: "قانون الطبيعة",
    description: "صراع من أجل البقاء في بيئة قاسية حيث القوي يأكل الضعيف.",
    coverImage: "https://3iskk.xyz/wp-content/uploads/2026/05/Doganin-Kanunu-long.jpg",
    heroImage: "https://3iskk.xyz/wp-content/uploads/2026/05/Doganin-Kanunu-long.jpg",
    category: "دراما، إثارة",
    rating: "7.5",
    year: "2026",
    seasonsCount: 1,
    seasons: [
      {
        id: "s1",
        title: "الموسم 1",
        episodes: Array.from({length: 5}).map((_, i) => ({
          id: `e${5 - i}`,
          title: `الحلقة ${5 - i}`,
          subtitle: "قانون الطبيعة",
          duration: "2:00:00",
          thumbnail: "https://3iskk.xyz/wp-content/uploads/2026/05/Doganin-Kanunu-long.jpg",
          url: `https://3iskk.xyz/watch/episodes/serie-doganin-kanunu-season-1-episode-${5 - i}/see/`
        }))
      }
    ]
  },
  {
    id: "serie-ask-yarasi",
    title: "الورود",
    description: "قصة حب معقدة تتشابك فيها الأقدار.",
    coverImage: "https://3iskk.xyz/wp-content/uploads/2026/05/t5uM9N0Hz8d5uDuI1dlX3Ce8bWX.jpg",
    heroImage: "https://3iskk.xyz/wp-content/uploads/2026/05/t5uM9N0Hz8d5uDuI1dlX3Ce8bWX.jpg",
    category: "رومانسي، دراما",
    rating: "8.2",
    year: "2026",
    seasonsCount: 1,
    seasons: [
      {
        id: "s1",
        title: "الموسم 1",
        episodes: Array.from({length: 29}).map((_, i) => ({
          id: `e${29 - i}`,
          title: `الحلقة ${29 - i}`,
          subtitle: "الورود",
          duration: "2:00:00",
          thumbnail: "https://3iskk.xyz/wp-content/uploads/2026/05/t5uM9N0Hz8d5uDuI1dlX3Ce8bWX.jpg",
          url: `https://3iskk.xyz/watch/episodes/serie-ask-yarasi-season-1-episode-${29 - i}/see/`
        }))
      }
    ]
  },
  {
    id: "serie-alti-ustu-istanbul",
    title: "اسطنبول راسا على عقب",
    description: "تتغير حياة مجموعة من الأشخاص في اسطنبول بشكل جذري.",
    coverImage: "https://3iskk.xyz/wp-content/uploads/2026/06/alti-ustu-istanbul-1.jpg",
    heroImage: "https://3iskk.xyz/wp-content/uploads/2026/06/alti-ustu-istanbul-1.jpg",
    category: "دراما",
    rating: "7.8",
    year: "2026",
    seasonsCount: 1,
    seasons: [
      {
        id: "s1",
        title: "الموسم 1",
        episodes: Array.from({length: 4}).map((_, i) => ({
          id: `e${4 - i}`,
          title: `الحلقة ${4 - i}`,
          subtitle: "اسطنبول راسا على عقب",
          duration: "2:00:00",
          thumbnail: "https://3iskk.xyz/wp-content/uploads/2026/06/alti-ustu-istanbul-1.jpg",
          url: `https://3iskk.xyz/watch/episodes/serie-alti-ustu-istanbul-season-1-episode-${4 - i}/see/`
        }))
      }
    ]
  },
  {
    id: "serie-muhtemel-ask",
    title: "حب محتمل",
    description: "صدفة تجمع بين شخصين لتغير مجرى حياتهما.",
    coverImage: "https://3iskk.xyz/wp-content/uploads/2026/06/nADkA2WuxReLKgkTcfTkAkGcgDS.jpg",
    heroImage: "https://3iskk.xyz/wp-content/uploads/2026/06/nADkA2WuxReLKgkTcfTkAkGcgDS.jpg",
    category: "رومانسي",
    rating: "8.1",
    year: "2026",
    seasonsCount: 1,
    seasons: [
      {
        id: "s1",
        title: "الموسم 1",
        episodes: Array.from({length: 4}).map((_, i) => ({
          id: `e${4 - i}`,
          title: `الحلقة ${4 - i}`,
          subtitle: "حب محتمل",
          duration: "2:00:00",
          thumbnail: "https://3iskk.xyz/wp-content/uploads/2026/06/nADkA2WuxReLKgkTcfTkAkGcgDS.jpg",
          url: `https://3iskk.xyz/watch/episodes/serie-muhtemel-ask-season-1-episode-${4 - i}/see/`
        }))
      }
    ]
  }
];

export const categories = [
  { id: "all", title: "الكل" },
  { id: "drama", title: "دراما" },
  { id: "action", title: "أكشن" },
  { id: "romance", title: "رومانسي" },
  { id: "comedy", title: "كوميدي" }
];

export interface Episode {
  title: string;
  slug: string;
  img: string;
  episodeNum: string;
}

export interface Series {
  title: string;
  slug: string;
  img: string;
  description?: string;
  backdrop?: string;
  seasons?: { num: string; title: string }[];
  episodes?: { epNum: string; epSlug: string }[];
}

export interface Featured {
  title: string;
  slug: string;
  img: string;
}

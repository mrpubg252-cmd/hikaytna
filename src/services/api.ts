import { decryptValue, encryptValue } from "../lib/security";
import { getApiUrl } from "../lib/apiConfig";

export function getProxiedImageUrl(url: string | undefined): string {
  if (!url) return "";
  if (url.startsWith("/") || url.startsWith("data:") || url.includes("image.tmdb.org")) return url;
  
  // Only proxy if it's a 3isk or external potentially protected image
  if (url.includes("3iskk.xyz") || url.includes("wp-content") || url.includes("uploads")) {
    const encrypted = encodeURIComponent(encryptValue(url));
    return getApiUrl(`/api/v1/image-proxy?url=${encrypted}`);
  }
  
  return url;
}

// res-safe fetch logic
import { fetchAllFromFirebase, db } from "./firebase";
import { ref, onValue } from "firebase/database";
import { hasNewEpisode, getEpisodeUpdatedAt } from "../lib/episodeHistory";
import { collection, onSnapshot } from "firebase/firestore";
import { db as firestoreDb } from "../lib/firebase";

// Dynamic Admin Category Pins & Slider Selections Map (Pruned to resolve black screen)
export let categoryPins: Record<string, any> = {};
let serverPins: Record<string, any> = {};

// Cache sorting results to prevent re-processing identical lists on every render (Major Performance Fix!)
const sortCache = new Map<string, any[]>();

// Dynamic Admin Slider Selections Map
export let sliderSelections: Record<string, any> = {};
let serverSliderSelections: Record<string, any> = {};

export interface ApiCategory {
  name: string;
  url: string;
  pages?: string[];
}

let categoriesCache: ApiCategory[] | null = null;
const CAT_CACHE_KEY = "serene_categories_cache";

export async function syncSliderSelections() {}
export async function syncCategoryPins() {}

const API_BASE = "/api/v1";

export function applyPrioritySort(seriesList: any[]): any[] {
  if (!seriesList || seriesList.length === 0) return [];
  const cacheKey = `${seriesList.length}-${seriesList.slice(0, 5).map(s => s.id).join('|')}-${Object.keys(categoryPins).length}`;
  if (sortCache.has(cacheKey)) return sortCache.get(cacheKey)!;

  const excludedTitles = ["حلم أشرف ج1 مترجم", "المدينة البعيدة ج1 مترجم", "حلم اشرف ج1", "المدينة البعيدة ج1", "في نوم"];
  const mapped = seriesList
    .filter(s => s && s.title && !excludedTitles.some(title => s.title.includes(title)))
    .map(s => {
      const pinData = categoryPins[s.id];
      const isPinned = pinData && pinData.pinned === true || s.id === "movie_titanic_999";
      const hasNew = hasNewEpisode(s);
      const updatedAt = getEpisodeUpdatedAt(s) || 0;
      return { ...s, _isPinned: isPinned, _pinnedAt: isPinned ? (s.id === "movie_titanic_999" ? Date.now() + 1000000 : (pinData?.pinnedAt || 0)) : 0, _hasNew: hasNew, _updatedAt: updatedAt, _rank: s.rank !== undefined ? s.rank : 9999 };
    });

  mapped.sort((a, b) => {
    if (a._isPinned && !b._isPinned) return -1;
    if (!a._isPinned && b._isPinned) return 1;
    if (a._isPinned && b._isPinned) return b._pinnedAt - a._pinnedAt;
    if (a._hasNew && !b._hasNew) return -1;
    if (!a._hasNew && b._hasNew) return 1;
    if (a._hasNew && b._hasNew) {
      if (a._rank !== b._rank) return a._rank - b._rank;
      return b._updatedAt - a._updatedAt;
    }
    if (a.isPriority && !b.isPriority) return -1;
    if (!a.isPriority && b.isPriority) return 1;
    if (a.rating !== b.rating) return (b.rating || 0) - (a.rating || 0);
    return a._rank - b._rank;
  });

  sortCache.set(cacheKey, mapped);
  if (sortCache.size > 20) sortCache.delete(sortCache.keys().next().value);
  return mapped;
}

export function normalizeArabic(str: string): string {
  if (!str) return "";
  return str.toLowerCase().trim().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/ـ/g, "").replace(/\s+/g, " ");
}

async function resilientFetch(url: string, options: RequestInit = {}, retries = 1) {
  for (let i = 0; i <= retries; i++) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(id);
      if (!response.ok) throw new Error("Fetch failed");
      return response;
    } catch (err) {
      clearTimeout(id);
      if (i === retries) throw err;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  throw new Error("Fetch failed");
}

export async function fetchCategories(): Promise<ApiCategory[]> {
  try {
    const res = await resilientFetch(getApiUrl(API_BASE + "/categories"));
    const data = await res.json();
    if (data.status && data.data) {
      const mergedMap = new Map<string, ApiCategory>();
      data.data.forEach((cat: any) => {
        const baseName = cat.name.replace(/\s+صفحة\s+\d+/gi, '').replace(/\s+page\s+\d+/gi, '').trim();
        if (!mergedMap.has(baseName)) {
          mergedMap.set(baseName, { name: baseName, url: cat.url, pages: cat.pages || [cat.url] });
        } else {
          const ex = mergedMap.get(baseName)!;
          const incomingPages = cat.pages || [cat.url];
          incomingPages.forEach((p: string) => {
            if (!ex.pages?.includes(p)) ex.pages?.push(p);
          });
        }
      });
      categoriesCache = Array.from(mergedMap.values());
    }
  } catch (error) { console.error("Categories fetch failed", error); }
  return categoriesCache || [];
}

export async function fetchCategoryPageFromAPI(categoryName: string, pageIndex: number, signal?: AbortSignal): Promise<any[]> {
  const all = await fetchCategories();
  if (all.length === 0) return [];
  const normQ = normalizeArabic(categoryName);
  let matching = all.filter(c => {
    const normC = normalizeArabic(c.name);
    if (normQ === "تركي" && normC.includes("تركي")) return true;
    if (normQ === "عربي" && normC.includes("عربي")) return true;
    if (normQ === "خليجي" && normC.includes("خليجي")) return true;
    if (normQ === "اجنبي" && normC.includes("اجنبي")) return true;
    if (normQ === "افلام" && (normC.includes("افلام") || normC.includes("فيلم"))) return true;
    if ((normQ === "اسيوي" || normQ.includes("اسيوي وكوري")) && (normC.includes("كوري") || normC.includes("اسيوي") || normC.includes("korean"))) return true;
    return normC.includes(normQ) || normQ.includes(normC);
  });
  if (matching.length === 0) matching = all.filter(c => c.name.includes(categoryName));
  if (matching.length === 0) return [];

  const promises = matching.map(async cat => {
    let url = (cat.pages && cat.pages[pageIndex]) ? cat.pages[pageIndex] : (pageIndex === 0 ? cat.url : "");
    if (!url && cat.url?.endsWith(".html")) url = cat.url.replace(/\.html$/, `/${pageIndex * 50}.html`);
    if (!url) return [];
    const resList = await fetchSeriesByCategory(url, signal);
    return resList.map(s => ({ ...s, category: cat.name }));
  });

  const settle = await Promise.allSettled(promises);
  const combined: any[] = [];
  settle.forEach(r => { if (r.status === "fulfilled") combined.push(...r.value); });
  const seen = new Set();
  const unique = combined.filter(s => {
    const key = (s.title || "").toLowerCase().replace(/ـ/g, "").replace(/\s+/g, "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return applyPrioritySort(unique);
}

export async function fetchSeriesByCategory(categoryUrl: string, signal?: AbortSignal) {
  try {
    const res = await resilientFetch(getApiUrl(API_BASE + "/series?url=" + encodeURIComponent(categoryUrl)), { signal });
    const data = await res.json();
    if (data.status && data.data) {
      return data.data.map((s: any) => ({
        id: (s.url || s.title || "").replace(/[^a-zA-Z0-9]/g, "_"),
        title: s.title || "",
        image: s.image || "",
        url: s.url || "",
        episodes_count: s.episodes || "0",
        rank: 999
      }));
    }
  } catch (error) { console.error("Series fetch error", error); }
  return [];
}

export async function fetchEpisodesFromAPI(seriesUrl: string, signal?: AbortSignal) {
  try {
    const res = await resilientFetch(getApiUrl(API_BASE + "/episodes?url=" + encodeURIComponent(seriesUrl)), { signal });
    const data = await res.json();
    if (data.status && data.data && data.data.length > 0) {
      return data.data.map((ep: any) => {
        const raw = ep.url || "";
        const dec = decryptValue(raw) || raw;
        return { title: ep.name || "1", url: dec, link1: dec, link2: "", link3: "" };
      });
    }
  } catch (error) { console.error("Episodes error", error); }
  if (seriesUrl && (seriesUrl.includes("/watch/") || seriesUrl.includes(".html"))) {
    return [{ title: "مباشر", url: seriesUrl, link1: seriesUrl, link2: "", link3: "" }];
  }
  return [];
}

export async function fetchPlayUrlFromAPI(episodeUrl: string, signal?: AbortSignal) {
  try {
    const res = await resilientFetch(getApiUrl(API_BASE + "/play?url=" + encodeURIComponent(episodeUrl)), { signal });
    const data = await res.json();
    if (data.status && data.player_url) {
      if (data.player_url.startsWith('/api/v1/')) {
        return data.player_url;
      }
      return decryptValue(data.player_url);
    }
  } catch (error) { console.error("Play error", error); }
  return null;
}

export async function fetchPlayDetailsFromAPI(episodeUrl: string, signal?: AbortSignal) {
  try {
    const res = await resilientFetch(getApiUrl(API_BASE + "/play?url=" + encodeURIComponent(episodeUrl)), { signal });
    const data = await res.json();
    if (data.status) {
      let resolvedUrl = data.player_url || "";
      if (resolvedUrl && !resolvedUrl.startsWith('/api/v1/')) {
        resolvedUrl = decryptValue(resolvedUrl);
      }
      return {
        player_url: resolvedUrl,
        servers: data.servers || []
      };
    }
  } catch (error) { console.error("Play details error", error); }
  return null;
}

export async function fetchAllFromAPI(isBackground = false) {
  const allCats = await fetchCategories();
  if (allCats.length === 0) return [];
  const allMap = new Map<string, any>();
  const chunk = allCats.slice(0, 20);

  // Flatten all page URLs we want to fetch across all categories
  const pageUrls: { url: string; catName: string }[] = [];
  chunk.forEach(c => {
    // Limit to first 15 pages for "جميع المسلسلات", 6 pages for others to keep it fast yet highly comprehensive
    const maxPages = c.name.includes("جميع المسلسلات") ? 15 : 6;
    const pagesToFetch = (c.pages || [c.url]).slice(0, maxPages);
    pagesToFetch.forEach(p => {
      pageUrls.push({ url: p, catName: c.name });
    });
  });

  // Fetch page series in batches of 5 to protect server resources
  const batchSize = 5;
  for (let i = 0; i < pageUrls.length; i += batchSize) {
    const batch = pageUrls.slice(i, i + batchSize);
    const results = await Promise.allSettled(batch.map(item => fetchSeriesByCategory(item.url)));
    results.forEach((r, idx) => {
      if (r.status === "fulfilled") {
        r.value.forEach((s: any, iRank: number) => {
          if (!allMap.has(s.title)) {
            allMap.set(s.title, { ...s, category: batch[idx].catName, rank: iRank });
          }
        });
      }
    });
  }

  const firebaseData = await fetchAllFromFirebase();
  const merged = [...Array.from(allMap.values()), ...firebaseData];
  return applyPrioritySort(merged);
}

const TMDB_API_KEY = '5afaeea7216a76d8c0600ecf217f6427';
const TMDB_BASE = 'https://api.themoviedb.org/3/';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';
const TMDB_LANG = 'ar-SA';
const tmdbCache = new Map<string, any>();

export interface TMDBSimplifiedEpisode {
  episodeNumber: number;
  absoluteEpisodeNumber?: number;
  stillUrl: string;
  runtime: number; // in minutes
}

const tmdbEpisodesCache = new Map<string, TMDBSimplifiedEpisode[]>();

export async function fetchEpisodesDetailsFromTMDB(title: string, signal?: AbortSignal): Promise<TMDBSimplifiedEpisode[]> {
  if (!title) return [];
  const cacheKey = title.trim();
  if (tmdbEpisodesCache.has(cacheKey)) return tmdbEpisodesCache.get(cacheKey)!;

  try {
    // Determine season number
    const normalized = title.toLowerCase();
    let targetSeason = 1;
    if (normalized.includes("الموسم الثاني") || normalized.includes("الموسم 2") || normalized.includes("الجزء الثاني") || normalized.includes("جزء 2") || normalized.includes("ج2")) {
      targetSeason = 2;
    } else if (normalized.includes("الموسم الثالث") || normalized.includes("الموسم 3") || normalized.includes("الجزء الثالث") || normalized.includes("جزء 3") || normalized.includes("ج3")) {
      targetSeason = 3;
    } else if (normalized.includes("الموسم الرابع") || normalized.includes("الموسم 4") || normalized.includes("الجزء الرابع") || normalized.includes("جزء 4") || normalized.includes("ج4")) {
      targetSeason = 4;
    } else if (normalized.includes("الموسم الخامس") || normalized.includes("الموسم 5") || normalized.includes("الجزء الخامس") || normalized.includes("جزء 5") || normalized.includes("ج5")) {
      targetSeason = 5;
    } else if (normalized.includes("الموسم السادس") || normalized.includes("الموسم 6") || normalized.includes("الجزء السادس") || normalized.includes("جزء 6") || normalized.includes("ج6")) {
      targetSeason = 6;
    } else {
      const seasonMatch = normalized.match(/الموسم\s*(\d+)/i) || normalized.match(/season\s*(\d+)/i);
      if (seasonMatch) {
        targetSeason = parseInt(seasonMatch[1], 10);
      }
    }

    // Clean title for search
    const clean = title
      .replace(/(مسلسل|فيلم|مترجم|مدبلج)/gi, '')
      .replace(/(الموسم|الجزء|جزء)\s*(الاول|الأول|الثاني|الثالث|الرابع|الخامس|السادس|\d+)/gi, '')
      .replace(/(ج\s*\d+)/gi, '')
      .replace(/[-_:\s]+/g, ' ')
      .trim();

    // 1. Search for TV show
    const searchUrl = `${TMDB_BASE}search/tv?api_key=${TMDB_API_KEY}&language=${TMDB_LANG}&query=${encodeURIComponent(clean)}`;
    const searchRes = await fetch(getApiUrl(`/api/v1/tmdb/proxy?url=${encodeURIComponent(searchUrl)}`), { signal });
    const searchData = await searchRes.json();
    
    if (searchData.results && searchData.results.length > 0) {
      const tvShow = searchData.results[0];
      const tvId = tvShow.id;

      // 2. Fetch full show details to get seasons
      const showDetailsUrl = `${TMDB_BASE}tv/${tvId}?api_key=${TMDB_API_KEY}&language=${TMDB_LANG}`;
      const showDetailsRes = await fetch(getApiUrl(`/api/v1/tmdb/proxy?url=${encodeURIComponent(showDetailsUrl)}`), { signal });
      const showDetailsData = await showDetailsRes.json();
      
      const seasons = showDetailsData.seasons || [];
      
      // Calculate absolute episode counts of seasons prior to the target season
      let priorEpisodesCount = 0;
      for (const s of seasons) {
        if (s.season_number > 0 && s.season_number < targetSeason) {
          priorEpisodesCount += s.episode_count || 0;
        }
      }

      // 3. Fetch Season episodes
      const seasonUrl = `${TMDB_BASE}tv/${tvId}/season/${targetSeason}?api_key=${TMDB_API_KEY}&language=${TMDB_LANG}`;
      const seasonRes = await fetch(getApiUrl(`/api/v1/tmdb/proxy?url=${encodeURIComponent(seasonUrl)}`), { signal });
      const seasonData = await seasonRes.json();
      
      if (seasonData.episodes && Array.isArray(seasonData.episodes)) {
        const simplified: TMDBSimplifiedEpisode[] = seasonData.episodes.map((ep: any) => ({
          episodeNumber: ep.episode_number,
          absoluteEpisodeNumber: priorEpisodesCount + ep.episode_number,
          stillUrl: ep.still_path ? `${TMDB_IMAGE_BASE}${ep.still_path}` : "",
          runtime: ep.runtime || tvShow.episode_run_time?.[0] || 45
        }));
        
        tmdbEpisodesCache.set(cacheKey, simplified);
        return simplified;
      }
    } else {
      // Try searching as movie
      const movieUrl = `${TMDB_BASE}search/movie?api_key=${TMDB_API_KEY}&language=${TMDB_LANG}&query=${encodeURIComponent(clean)}`;
      const movieRes = await fetch(getApiUrl(`/api/v1/tmdb/proxy?url=${encodeURIComponent(movieUrl)}`), { signal });
      const movieData = await movieRes.json();
      if (movieData.results && movieData.results.length > 0) {
        const movie = movieData.results[0];
        const simplified: TMDBSimplifiedEpisode[] = [{
          episodeNumber: 1,
          absoluteEpisodeNumber: 1,
          stillUrl: movie.backdrop_path ? `${TMDB_IMAGE_BASE}${movie.backdrop_path}` : (movie.poster_path ? `${TMDB_IMAGE_BASE}${movie.poster_path}` : ""),
          runtime: movie.runtime || 100
        }];
        tmdbEpisodesCache.set(cacheKey, simplified);
        return simplified;
      }
    }
  } catch (e) {
    console.warn("fetchEpisodesDetailsFromTMDB failed", e);
  }
  return [];
}

export async function fetchSeriesDetailsFromTMDB(title: string, signal?: AbortSignal) {
  if (!title) return null;
  const clean = title.replace(/(مسلسل|فيلم)/gi, '').trim();
  if (tmdbCache.has(clean)) return tmdbCache.get(clean);
  try {
    const url = `${TMDB_BASE}search/multi?api_key=${TMDB_API_KEY}&language=${TMDB_LANG}&query=${encodeURIComponent(clean)}&include_adult=false`;
    const res = await fetch(getApiUrl(`/api/v1/tmdb/proxy?url=${encodeURIComponent(url)}`), { signal });
    const data = await res.json();
    if (data.results?.length > 0) {
      const match = data.results[0];
      const details = {
        description: match.overview || "",
        backdrop: match.backdrop_path ? `${TMDB_IMAGE_BASE}${match.backdrop_path}` : "",
        rating: match.vote_average || 0,
        year: (match.release_date || match.first_air_date || "").split('-')[0] || "",
        cast: [], crew: []
      };
      tmdbCache.set(clean, details);
      return details;
    }
  } catch (e) { console.warn("TMDB failed"); }
  return null;
}

export async function fetchPersonCreditsFromTMDB(personId: number, signal?: AbortSignal) {
  return [];
}

export interface EmbedMetadata {
  thumbnail: string;
  duration: number;
  durationFormatted: string;
}

const embedMetaCache = new Map<string, EmbedMetadata>();

export async function fetchEmbedMetadata(embedUrl: string, signal?: AbortSignal): Promise<EmbedMetadata | null> {
  if (!embedUrl) return null;
  if (embedMetaCache.has(embedUrl)) {
    return embedMetaCache.get(embedUrl)!;
  }

  try {
    const res = await fetch(getApiUrl(`/api/v1/extract-embed-meta?url=${encodeURIComponent(embedUrl)}`), { signal });
    const data = await res.json();
    if (data && data.status) {
      const meta = {
        thumbnail: data.thumbnail || "",
        duration: data.duration || 0,
        durationFormatted: data.durationFormatted || ""
      };
      embedMetaCache.set(embedUrl, meta);
      return meta;
    }
  } catch (err) {
    console.warn("Failed fetching embed metadata:", err);
  }
  return null;
}


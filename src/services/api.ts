// res-safe fetch logic
import { fetchAllFromFirebase, db } from "./firebase";
import { ref, onValue } from "firebase/database";
import { decryptValue } from "../lib/security";
import { hasNewEpisode, getEpisodeUpdatedAt } from "../lib/episodeHistory";
import { getApiUrl } from "../lib/apiConfig";
import { collection, onSnapshot } from "firebase/firestore";
import { db as firestoreDb } from "../lib/firebase";

// Dynamic Admin Category Pins Map
export let categoryPins: Record<string, any> = {};
let serverPins: Record<string, any> = {};

// Cache sorting results to prevent re-processing identical lists on every render (Major Performance Fix!)
const sortCache = new Map<string, any[]>();

// Dynamic Admin Slider Selections Map
export let sliderSelections: Record<string, any> = {};
let serverSliderSelections: Record<string, any> = {};

// Register Firestore Real-time Listeners
try {
  onSnapshot(collection(firestoreDb, "category_pins"), (snapshot) => {
    const pins: Record<string, any> = {};
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data) {
        pins[doc.id] = data;
      }
    });
    // Firestore acts as the ultimate master source of truth, taking priority
    categoryPins = { ...serverPins, ...categoryPins, ...pins };
    sortCache.clear();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('category-pins-updated'));
    }
  }, (err) => {
    console.warn("Firestore category_pins listener deferred:", err);
  });
} catch (e) {
  console.warn("Could not register Firestore category_pins listener on startup:", e);
}

try {
  onSnapshot(collection(firestoreDb, "slider_selections"), (snapshot) => {
    const selections: Record<string, any> = {};
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data) {
        selections[doc.id] = data;
      }
    });
    // Firestore takes top priority for slider selections
    sliderSelections = { ...serverSliderSelections, ...sliderSelections, ...selections };
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('slider-selections-updated'));
    }
  }, (err) => {
    console.warn("Firestore slider_selections listener deferred:", err);
  });
} catch (e) {
  console.warn("Could not register Firestore slider_selections list tracker on startup:", e);
}

export interface ApiCategory {
  name: string;
  url: string;
  pages?: string[];
}

let categoriesCache: ApiCategory[] | null = null;
const CAT_CACHE_KEY = "serene_categories_cache";

// Resilient API sync for slider selections
export async function syncSliderSelections() {
  try {
    const res = await fetch(getApiUrl("/api/v1/slider-selections"));
    const data = await res.json();
    if (data && typeof data === 'object') {
      serverSliderSelections = data;
      sliderSelections = { ...sliderSelections, ...data };
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('slider-selections-updated'));
      }
    }
  } catch (err) {
    console.warn("Server-side slider selections fetch deferred:", err);
  }
}

// Initial sync
syncSliderSelections();

// Realtime Database subscription listener
try {
  const sliderRef = ref(db, 'slider_selections');
  onValue(sliderRef, (snapshot) => {
    const val = snapshot.val();
    if (val && typeof val === 'object') {
      sliderSelections = { ...serverSliderSelections, ...val };
    } else {
      sliderSelections = { ...serverSliderSelections };
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('slider-selections-updated'));
    }
  }, { onlyOnce: false });
} catch (e) {
  console.warn("Firebase Realtime Database slider selections registration deferred.", e);
}

// Resilient API sync for category pins
export async function syncCategoryPins() {
  try {
    const res = await fetch(getApiUrl("/api/v1/pins"));
    const data = await res.json();
    if (data && typeof data === 'object') {
      serverPins = data;
      categoryPins = { ...categoryPins, ...data };
      sortCache.clear();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('category-pins-updated'));
      }
    }
  } catch (err) {
    console.warn("Server-side pins fetch deferred:", err);
  }
}

syncCategoryPins();

try {
  const pinsRef = ref(db, 'category_pins');
  onValue(pinsRef, (snapshot) => {
    const val = snapshot.val();
    const newPins = (val && typeof val === 'object') ? { ...serverPins, ...val } : { ...serverPins };
    if (JSON.stringify(newPins) !== JSON.stringify(categoryPins)) {
      categoryPins = newPins;
      sortCache.clear();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('category-pins-updated'));
      }
    }
  });
} catch (e) {
  console.warn("Firebase Realtime Database pins registration deferred.", e);
}

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
      const isPinned = pinData && pinData.pinned === true;
      const hasNew = hasNewEpisode(s);
      const updatedAt = getEpisodeUpdatedAt(s) || 0;
      return { ...s, _isPinned: isPinned, _pinnedAt: isPinned ? (pinData.pinnedAt || 0) : 0, _hasNew: hasNew, _updatedAt: updatedAt, _rank: s.rank !== undefined ? s.rank : 9999 };
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
          mergedMap.set(baseName, { name: baseName, url: cat.url, pages: [cat.url] });
        } else {
          const ex = mergedMap.get(baseName)!;
          if (!ex.pages?.includes(cat.url)) ex.pages?.push(cat.url);
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
      return data.data
        .filter((s: any) => !(s.url || "").includes("fifa-2026.html") && !(s.url || "").includes("world-cup-2026"))
        .map((s: any) => ({
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
      const decrypted = decryptValue(data.player_url);
      if (decrypted && (decrypted.includes('.mp4') || decrypted.includes('.m3u8') || decrypted.includes('.webm') || decrypted.includes('.ogg'))) {
        return getApiUrl(`/api/v1/stream-proxy/${encodeURIComponent(data.player_url)}`);
      }
      return decrypted;
    }
  } catch (error) { console.error("Play error", error); }
  return null;
}

export async function fetchAllFromAPI(isBackground = false) {
  const allCats = await fetchCategories();
  if (allCats.length === 0) return [];
  const allMap = new Map<string, any>();
  const chunk = allCats.slice(0, 20);
  const results = await Promise.allSettled(chunk.map(c => fetchSeriesByCategory(c.url)));
  results.forEach((r, idx) => {
    if (r.status === "fulfilled") {
      r.value.forEach((s: any, i: number) => {
        if (!allMap.has(s.title)) allMap.set(s.title, { ...s, category: chunk[idx].name, rank: i });
      });
    }
  });

  const firebaseData = await fetchAllFromFirebase();
  const merged = [...Array.from(allMap.values()), ...firebaseData];
  return applyPrioritySort(merged);
}

const TMDB_API_KEY = '5afaeea7216a76d8c0600ecf217f6427';
const TMDB_BASE = 'https://api.themoviedb.org/3/';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';
const TMDB_LANG = 'ar-SA';
const tmdbCache = new Map<string, any>();

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

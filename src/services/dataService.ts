import { fetchAllFromAPI, applyPrioritySort } from "./api";
import { fetchAllFromFirebase, Series, db, firestore } from "./firebase";
import { collection, getDocs, orderBy, query as firestoreQuery } from 'firebase/firestore';
import { fetchCategoryPageFromAPI } from "./api";
import { getApiUrl } from "../lib/apiConfig";
import { ref, onValue } from "firebase/database";

function isSimilarTitle(a: string, b: string) {
  if (!a || !b) return false;
  const cleanA = a.toLowerCase().trim().replace(/^ال/g, "");
  const cleanB = b.toLowerCase().trim().replace(/^ال/g, "");

  if (cleanA === cleanB) return true;
  if (cleanA.includes(cleanB) || cleanB.includes(cleanA)) return true;

  return false;
}

function fixImageUrl(url: string, title: string = "") {
  let finalUrl = url;

  // Specific fix for requested series posters
  if (title) {
    const normTitle = title.toLowerCase();
    if (normTitle.includes("في سابعة عشر") || normTitle.includes("في السابعة عشر")) {
      finalUrl = "https://3iskk.xyz/wp-content/uploads/2026/05/daha-17-dizi.jpg";
    } else if (normTitle.includes("هذا بحر سوف يفيض") || normTitle.includes("هذا البحر سوف يفيض")) {
      finalUrl = "https://3iskk.xyz/wp-content/uploads/2025/10/uHIOTJXN9nNTc51WyunL43Fvge3.jpg";
    } else if (
      normTitle.includes("knight of the seven kingdoms") ||
      normTitle.includes("seven kingdoms") ||
      normTitle.includes("الممالك السبع") ||
      normTitle.includes("ممالك السبع") ||
      normTitle.includes("الممالك السبعة") ||
      normTitle.includes("ممالك السبعة") ||
      normTitle.includes("فارس الممالك السبع")
    ) {
      finalUrl = "https://upload.wikimedia.org/wikipedia/en/c/cc/A_Knight_of_the_Seven_Kingdoms_%28TV_series%29_first_look.jpg";
    }
  }

  if (!finalUrl || finalUrl === url) {
    const defaultPlaceholder = "https://images.unsplash.com/photo-1542204172-3c1f81edf4a1?q=80&w=400&auto=format&fit=crop";
    if (!finalUrl) return defaultPlaceholder;

    const badWords = ["default_image", "system_logo", "thumbnail.jpg", "logo.png"];
    for (let word of badWords) {
      if (finalUrl.includes(word)) return defaultPlaceholder;
    }
  }

  // Pass through proxy for all external images to ensure reliability
  if (
    finalUrl.startsWith("http") &&
    !finalUrl.includes("ibb.co") &&
    !finalUrl.includes("/api/v1/image-proxy") &&
    !finalUrl.includes("unsplash.com") // Unsplash usually works fine without proxy
  ) {
    return getApiUrl(`/api/v1/image-proxy?url=${encodeURIComponent(finalUrl)}`);
  }

  return finalUrl;
}

// Client-side simple in-memory cache with localStorage sync for instant loading!
let cachedSeriesList: Series[] | null = null;
let lastFetchTime = 0;
const CACHE_DURATION_MS = 4 * 60 * 60 * 1000; // Fresh for 4 hours
const LOCAL_STORAGE_KEY = "serene_series_cache";

// Initial load from localStorage
if (typeof window !== "undefined") {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      cachedSeriesList = parsed.data;
      lastFetchTime = parsed.timestamp;
    }
  } catch (e) {
    console.warn("Failed to load cache from localStorage", e);
  }
}

let isFetchingInBackground = false;

async function doFetchAndMerge(isBackground = false): Promise<Series[]> {
  let apiData: Series[] = [];
  let firebaseData: Series[] = [];

  const [apiResult, firebaseResult] = await Promise.allSettled([
    fetchAllFromAPI(isBackground),
    fetchAllFromFirebase(),
  ]);

  if (apiResult.status === "fulfilled" && apiResult.value) {
    apiData = apiResult.value;
  }

  if (firebaseResult.status === "fulfilled" && firebaseResult.value) {
    firebaseData = firebaseResult.value;
  }

  const mergedMap = new Map<string, Series>();

  const getNormalizedTitle = (title: string): string => {
    if (!title) return "";
    return title
      .toLowerCase()
      .trim()
      .replace(/^(المسلسل التركي|المسلسل الكوري|المسلسل المكسيكي|المسلسل الاسيوي|المسلسل|الفيلم|البرنامج|مسلسل|برنامج|فيلم)\s+/g, "")
      .replace(/^ال/g, "")
      .replace(/ـ/g, "")
      .replace(/\s+/g, "");
  };

  // Merge API and Firebase
  apiData.forEach((s) => {
    const key = getNormalizedTitle(s.title);
    if (key) mergedMap.set(key, s);
  });

  firebaseData.forEach((s) => {
    if (!s) return;
    const key = getNormalizedTitle(s.title);
    const existing = key ? mergedMap.get(key) : null;
    if (existing) {
      mergedMap.set(key, {
        ...existing,
        ...s,
        id: s.id || existing.id,
        title: s.title || existing.title,
        image: s.image || existing.image,
        category: s.category || existing.category,
        episodes: s.episodes || existing.episodes
      });
    } else if (key) {
      mergedMap.set(key, s);
    }
  });

  const merged = Array.from(mergedMap.values());
  const sorted = applyPrioritySort(merged);

  cachedSeriesList = sorted.map(s => ({
    ...s,
    image: fixImageUrl(s.image, s.title)
  }));
  lastFetchTime = Date.now();

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({
        data: cachedSeriesList,
        timestamp: lastFetchTime
      }));
    } catch (e) {}
  }

  return cachedSeriesList;
}

function triggerBackgroundFetch() {
  if (isFetchingInBackground) return;
  isFetchingInBackground = true;

  doFetchAndMerge(true)
    .then((freshData) => {
      isFetchingInBackground = false;
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("series-data-updated", { detail: freshData }),
        );
      }
    })
    .catch((err) => {
      isFetchingInBackground = false;
      console.error("Background silent series refresh failed:", err);
    });
}

export function clearCache() {
  cachedSeriesList = null;
  lastFetchTime = 0;
  if (typeof window !== "undefined") {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent("series-cache-cleared"));
  }
}

export async function fetchAllSeries(forceRefresh = false): Promise<Series[]> {
  if (!forceRefresh && cachedSeriesList && cachedSeriesList.length > 0 && Date.now() - lastFetchTime < CACHE_DURATION_MS) {
    return cachedSeriesList;
  }
  return doFetchAndMerge();
}

// Subscribe to real-time updates from Firebase Series for metadata overlays (like Trailers added by Admin!)
if (typeof window !== "undefined") {
  try {
    const seriesRef = ref(db, 'series');
    onValue(seriesRef, (snapshot) => {
      const fbData = snapshot.val();
      if (!fbData) return;
      
      let dirty = false;
      if (cachedSeriesList) {
        Object.keys(fbData).forEach(key => {
          const val = fbData[key];
          if (val && val.trailer) {
            // Check if we need to update cache
            const targetIdx = cachedSeriesList!.findIndex(s => s.id === key);
            if (targetIdx !== -1 && cachedSeriesList![targetIdx].trailer !== val.trailer) {
              cachedSeriesList![targetIdx] = { ...cachedSeriesList![targetIdx], trailer: val.trailer };
              dirty = true;
            }
          }
        });
        
        if (dirty) {
           try {
             localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({
               data: cachedSeriesList,
               timestamp: lastFetchTime
             }));
           } catch (e) {}
           window.dispatchEvent(new CustomEvent("series-data-updated", { detail: cachedSeriesList }));
        }
      }
    });
  } catch (err) {}

  // 1b. Subscribe to global updates timestamp to invalidate client-side cache across all tabs immediately
  try {
    const updateRef = ref(db, 'last_series_update');
    onValue(updateRef, (snapshot) => {
      const val = snapshot.val();
      if (typeof val === "number" && val > lastFetchTime) {
        clearCache();
        triggerBackgroundFetch();
      }
    });
  } catch (err) {
    console.warn("Could not subscribe to global last_series_update timestamp:", err);
  }
}

export function getAllCachedSeries(): Series[] {
  return cachedSeriesList || [];
}

export function updateCachedSeriesTrailer(seriesId: string, trailerUrl: string) {
  if (cachedSeriesList) {
    cachedSeriesList = cachedSeriesList.map(s => {
      if (s.id === seriesId) {
        return { ...s, trailer: trailerUrl };
      }
      return s;
    });
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({
        data: cachedSeriesList,
        timestamp: lastFetchTime
      }));
    } catch (e) {}
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("series-data-updated", { detail: cachedSeriesList }));
    }
  }
}

export function getCachedSeriesByCategory(categoryName: string): Series[] {
  if (!cachedSeriesList || cachedSeriesList.length === 0) return [];
  if (categoryName === "الكل") return cachedSeriesList;
  
  const target = normalizeArabic(categoryName);
  
  return cachedSeriesList.filter(s => {
    const sCat = s.category || "";
    if (!sCat) return false;
    if (sCat === categoryName) return true;
    return normalizeArabic(sCat).includes(target);
  });
}

function normalizeArabic(str: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ـ/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchCategoryPage(
  categoryName: string,
  pageIndex: number,
  signal?: AbortSignal
): Promise<Series[]> {
  // Special case for 'All' category
  if (categoryName === "الكل") {
    const all = await fetchAllSeries(false);
    const start = pageIndex * 50;
    return all.slice(start, start + 50);
  }

  try {
    const rawList = await fetchCategoryPageFromAPI(categoryName, pageIndex, signal);
    const formatted = rawList.map(s => ({
      ...s,
      image: fixImageUrl(s.image, s.title)
    }));

    // Update RAM cache
    if (!cachedSeriesList) {
      cachedSeriesList = formatted;
    } else {
      const existingIds = new Map(cachedSeriesList.map((s, i) => [s.id, i]));
      formatted.forEach(s => {
        if (existingIds.has(s.id)) {
          cachedSeriesList![existingIds.get(s.id)!] = s;
        } else {
          cachedSeriesList!.push(s);
        }
      });
    }

    return formatted;
  } catch (error) {
    console.error("fetchCategoryPage error:", error);
    return [];
  }
}

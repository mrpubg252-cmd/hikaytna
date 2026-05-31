import { fetchAllFromAPI, applyPrioritySort } from "./api";
import { fetchAllFromFirebase, Series } from "./firebase";
import { fetchCategoryPageFromAPI } from "./api";

function isSimilarTitle(a: string, b: string) {
  if (!a || !b) return false;
  const cleanA = a.toLowerCase().trim().replace(/^ال/g, "");
  const cleanB = b.toLowerCase().trim().replace(/^ال/g, "");

  if (cleanA === cleanB) return true;
  if (cleanA.includes(cleanB) || cleanB.includes(cleanA)) return true;

  return false;
}

function fixImageUrl(url: string) {
  if (!url)
    return "https://i.ibb.co/0wvJfBH/file-00000000c1e4720a9aba88f120b35bd1.png";

  const badWords = [
    "default_image",
    "system_logo",
    "thumbnail.jpg",
    "logo.png",
  ];
  for (let word of badWords) {
    if (url.includes(word)) {
      return "https://i.ibb.co/0wvJfBH/file-00000000c1e4720a9aba88f120b35bd1.png";
    }
  }

  // Handle image proxying on API / Third-party images to bypass CORS or referer anti-hotlinking blockages!
  if (
    url.startsWith("http") &&
    !url.includes("ibb.co") &&
    !url.includes("/api/v1/image-proxy")
  ) {
    return `/api/v1/image-proxy?url=${encodeURIComponent(url)}`;
  }

  return url;
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

  // Combine sources... (rest of the logic remains same)
  const mergedMap = new Map<string, Series>();

  const getNormalizedTitle = (title: string): string => {
    if (!title) return "";
    return title
      .toLowerCase()
      .trim()
      .replace(/^(مسلسل|برنامج|فيلم)\s+/g, "")
      .replace(/^ال/g, "")
      .replace(/ـ/g, "")
      .replace(/\s+/g, "");
  };

  apiData.forEach((s) => {
    const norm = getNormalizedTitle(s.title);
    if (norm) mergedMap.set(norm, s);
    else mergedMap.set(s.id, s);
  });

  firebaseData.forEach((s) => {
    if (!s) return;
    const norm = getNormalizedTitle(s.title);
    if (norm) {
      const existing = mergedMap.get(norm);
      if (existing) {
        mergedMap.set(norm, {
          ...existing,
          ...s,
          id: s.id || existing.id || norm,
          image: s.image && s.image.trim() !== "" ? s.image : existing.image,
          category: s.category && s.category.trim() !== "" ? s.category : existing.category,
          episodes: s.episodes && s.episodes.length > 0 ? s.episodes : existing.episodes,
          trailer: s.trailer && s.trailer.trim() !== "" ? s.trailer : existing.trailer,
        });
      } else {
        mergedMap.set(norm, { ...s, id: s.id || norm });
      }
    } else if (s.id) {
      mergedMap.set(s.id, s);
    }
  });

  let allData = Array.from(mergedMap.values());
  allData = allData.map((s) => ({ ...s, image: fixImageUrl(s.image) }));

  // Apply centralized priority sort and exclusions
  allData = applyPrioritySort(allData);

  cachedSeriesList = allData;
  lastFetchTime = Date.now();

  // Persist to localStorage
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({
        data: allData,
        timestamp: lastFetchTime
      }));
    } catch (e) {
      console.warn("Failed to save cache to localStorage", e);
    }
  }

  return allData;
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

export async function fetchAllSeries(forceRefresh = false): Promise<Series[]> {
  const now = Date.now();

  // If forceRefresh is false, we have a cache, and it's younger than CACHE_DURATION_MS, return immediately
  if (
    !forceRefresh &&
    cachedSeriesList &&
    now - lastFetchTime < CACHE_DURATION_MS
  ) {
    return cachedSeriesList;
  }

  // If we have a cache but it's older than CACHE_DURATION_MS, we could refresh, but for now just return it
  if (!forceRefresh && cachedSeriesList) {
    return cachedSeriesList;
  }

  // No cache or force refresh: blocking fetch first fast page
  const fastInitialData = await doFetchAndMerge(false);
  
  // Trigger a full background fetch silently to populate the remaining 10 pages per category
  triggerBackgroundFetch();
  
  return fastInitialData;
}

export function getAllCachedSeries(): Series[] {
  return cachedSeriesList || [];
}

export function getCachedSeriesByCategory(categoryName: string): Series[] {
  if (!cachedSeriesList || cachedSeriesList.length === 0) return [];
  if (categoryName === "الكل") return cachedSeriesList;
  
  const target = normalizeArabic(categoryName);
  
  // Use a simple startsWith or includes check on pre-normalized strings if possible, 
  // but for now just optimize the inner loop.
  return cachedSeriesList.filter(s => {
    const sCat = s.category || "";
    if (!sCat) return false;
    // Fast path: exact match
    if (sCat === categoryName) return true;
    // Normalized check
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
    // Return a 'page' slice for All to keep logic consistent
    const start = pageIndex * 50;
    return all.slice(start, start + 50);
  }

  const rawApiData = await fetchCategoryPageFromAPI(categoryName, pageIndex, signal);

  if (rawApiData.length === 0) return [];

  // Format the returned data using the same fixImageUrl
  const processedSeries = rawApiData.map((s) => ({
    ...s,
    image: fixImageUrl(s.image),
  }));

  // Apply centralized priority sort and exclusions for this page
  const newSeries = applyPrioritySort(processedSeries);

  // Merge into our RAM cache to avoid losing it if they switch tabs and come back
  if (!cachedSeriesList) {
    cachedSeriesList = newSeries;
  } else {
    // Add only new ones
    const existingIds = new Set(cachedSeriesList.map((s) => s.id));
    const toAdd = newSeries.filter((s) => !existingIds.has(s.id));
    cachedSeriesList = [...cachedSeriesList, ...toAdd];
  }

  // We can return just the newly fetched block, or all cached!
  // It's usually better to just return the new block for infinite scroll appending
  return newSeries;
}

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

  // Combine sources... (rest of the logic remains same)
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

  apiData.forEach((s) => {
    const norm = getNormalizedTitle(s.title);
    if (norm) mergedMap.set(norm, s);
    else mergedMap.set(s.id, s);
  });

  firebaseData.forEach((s) => {
    if (!s) return;
    const norm = getNormalizedTitle(s.title);
    
    let existingKey = null;
    if (norm && mergedMap.has(norm)) {
      existingKey = norm;
    } else if (s.id && mergedMap.has(s.id)) {
      existingKey = s.id;
    } else if (s.id) {
      for (const [k, v] of mergedMap.entries()) {
        if (v.id === s.id) {
          existingKey = k;
          break;
        }
      }
    }

    const existing = existingKey ? mergedMap.get(existingKey) : null;

    if (existing) {
      mergedMap.set(existingKey!, {
        ...existing,
        ...s,
        id: s.id || existing.id,
        title: s.title && s.title.trim() !== "" ? s.title : existing.title,
        image: s.image && s.image.trim() !== "" ? s.image : existing.image,
        category: s.category && s.category.trim() !== "" ? s.category : existing.category,
        episodes: s.episodes && s.episodes.length > 0 ? s.episodes : existing.episodes,
        trailer: s.trailer && s.trailer.trim() !== "" ? s.trailer : existing.trailer,
      });
    } else {
      if (s.title && s.title.trim() !== "") {
        mergedMap.set(norm || s.id, { ...s, id: s.id || norm });
      }
    }
  });

  let allData = Array.from(mergedMap.values());

  // Inject "Titanic" movie manually if not present
  const titanicExists = allData.some(s => s.id === "movie_titanic_999");
  if (!titanicExists) {
    allData.unshift({
      id: "movie_titanic_999",
      title: "تايتانك (Titanic)",
      image: "https://j.top4top.io/p_3822gpygf1.jpg",
      category: "أفلام",
      rating: 9.8,
      isPriority: true,
      trailer: "/api/v1/titanic-player",
      episodes: [
        { title: "الفيلم كامل", url: "/api/v1/titanic-player", link1: "/api/v1/titanic-player", link2: "", link3: "" }
      ]
    });
  }

  // Inject "Breaking Bad" manually
  const bbExists = allData.some(s => s.id === "tv_breaking_bad_999");
  if (!bbExists) {
    allData.unshift({
      id: "tv_breaking_bad_999",
      title: "Breaking Bad",
      image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ6Cn9C6QxDKqzTTAOSkIcuILr3ANfSsQvIMco_pEtsjGAp_rHizjS0-eBloO_rHOUGlTmBMHBKV8rvBx4rqRWQTzv0ndVhAZwVS67aPLu65w&s=10",
      category: "أجنبي",
      rating: 9.5,
      isPriority: true,
      trailer: "https://streamimdb.ru/embed/tv/tt0903747",
      episodes: [
        { title: "المسلسل كامل", url: "https://streamimdb.ru/embed/tv/tt0903747", link1: "https://streamimdb.ru/embed/tv/tt0903747", link2: "", link3: "" }
      ]
    });
  }

  // Fetch custom series from Firestore if possible
  try {
    const q = firestoreQuery(collection(firestore, "custom_series"), orderBy("createdAt", "desc"));
    const customSnap = await getDocs(q);
    customSnap.forEach((docSnap) => {
      const data = docSnap.data() as Series;
      const finalData = { ...data, id: data.id || docSnap.id };
      // Check if already in allData by ID
      const index = allData.findIndex(s => s.id === finalData.id);
      if (index !== -1) {
        allData[index] = finalData;
      } else {
        allData.unshift(finalData);
      }
    });
  } catch (err) {
    console.error("Error fetching custom series from Firestore:", err);
  }

  allData = allData.map((s) => ({ ...s, image: fixImageUrl(s.image, s.title) }));

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

  // Ensure background synchronization is triggered if cache was cleared
  if (isBackground) {
    // Already forced or background
  } else {
    triggerBackgroundFetch();
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

export function clearCache() {
  cachedSeriesList = null;
  lastFetchTime = 0;
  if (typeof window !== "undefined") {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent("series-cache-cleared"));
  }
}

export async function fetchAllSeries(forceRefresh = false): Promise<Series[]> {
  const now = Date.now();

  // Ensure Titanic and Breaking Bad are present in the cache even before refreshing
  if (cachedSeriesList) {
    const titanicExists = cachedSeriesList.some(s => s.id === "movie_titanic_999");
    if (!titanicExists) {
      cachedSeriesList.unshift({
        id: "movie_titanic_999",
        title: "تايتانك (Titanic)",
        image: "https://m.media-amazon.com/images/M/MV5BMDdmZGU3NDQtY2E5My00ZTliLWIzOTUtMTY4ZGI1YjdiNjk3XkEyXkFqcGdeQXVyNTA4NzY1MzY@._V1_QL75_UX380_CR0,0,380,562_.jpg",
        category: "أفلام",
        rating: 9.8,
        isPriority: true,
        trailer: "",
        episodes: [
          { title: "الفيلم كامل", url: "/api/v1/titanic-player", link1: "/api/v1/titanic-player", link2: "", link3: "" }
        ]
      });
    }
    const bbExists = cachedSeriesList.some(s => s.id === "tv_breaking_bad_999");
    if (!bbExists) {
      cachedSeriesList.unshift({
        id: "tv_breaking_bad_999",
        title: "Breaking Bad",
        image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ6Cn9C6QxDKqzTTAOSkIcuILr3ANfSsQvIMco_pEtsjGAp_rHizjS0-eBloO_rHOUGlTmBMHBKV8rvBx4rqRWQTzv0ndVhAZwVS67aPLu65w&s=10",
        category: "أجنبي",
        rating: 9.5,
        isPriority: true,
        trailer: "",
        episodes: [
          { title: "المسلسل كامل", url: "https://streamimdb.ru/embed/tv/tt0903747", link1: "https://streamimdb.ru/embed/tv/tt0903747", link2: "", link3: "" }
        ]
      });
    }
  }

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

  const [rawApiData, firebaseData] = await Promise.all([
    fetchCategoryPageFromAPI(categoryName, pageIndex, signal),
    fetchAllFromFirebase()
  ]);

  if (rawApiData.length === 0) return [];

  // Extract firebase overlays to a quick map
  const fbOverrides = new Map<string, any>();
  firebaseData.forEach(s => {
    if (s.id) fbOverrides.set(s.id, s);
    // Try to map by normalized title as well
    if (s.title) {
       const norm = s.title.toLowerCase().trim().replace(/^(المسلسل التركي|المسلسل الكوري|المسلسل المكسيكي|المسلسل الاسيوي|المسلسل|الفيلم|البرنامج|مسلسل|برنامج|فيلم)\s+/g, "").replace(/^ال/g, "").replace(/ـ/g, "").replace(/\s+/g, "");
       if (norm) fbOverrides.set(norm, s);
    }
  });

  // Format the returned data using the same fixImageUrl
  const processedSeries = rawApiData.map((s) => {
    const norm = s.title ? s.title.toLowerCase().trim().replace(/^(المسلسل التركي|المسلسل الكوري|المسلسل المكسيكي|المسلسل الاسيوي|المسلسل|الفيلم|البرنامج|مسلسل|برنامج|فيلم)\s+/g, "").replace(/^ال/g, "").replace(/ـ/g, "").replace(/\s+/g, "") : '';
    const override = fbOverrides.get(s.id) || (norm ? fbOverrides.get(norm) : null);
    
    return {
      ...s,
      id: override?.id || s.id,
      trailer: override?.trailer || s.trailer,
      image: fixImageUrl(override?.image || s.image, s.title),
    };
  });

  // Apply centralized priority sort and exclusions for this page
  let newSeries = applyPrioritySort(processedSeries);

  // Manual Injection for specific high-value content (Titanic)
  const titanicExists = newSeries.some(s => s.title && s.title.includes("تايتانك"));
  const catNorm = normalizeArabic(categoryName);
  const isTargetCat = catNorm.includes("افلام") || catNorm === "الكل";
  
  if (!titanicExists && isTargetCat) {
    newSeries.unshift({
      id: "movie_titanic_999",
      title: "تايتانك (Titanic)",
      image: "https://j.top4top.io/p_3822gpygf1.jpg",
      category: "أفلام",
      rating: 9.8,
      isPriority: true,
      trailer: "/api/v1/titanic-player",
      episodes: [
        { title: "الفيلم كامل", url: "/api/v1/titanic-player", link1: "/api/v1/titanic-player", link2: "", link3: "" }
      ]
    });
  }

  // Merge into our RAM cache to avoid losing it if they switch tabs and come back
  if (!cachedSeriesList) {
    cachedSeriesList = newSeries;
  } else {
    // Merge deeply into cache (overlaying existing IDs to ensure trailer updates propagate locally)
    const existingIds = new Map(cachedSeriesList.map((s, i) => [s.id, i]));
    newSeries.forEach(s => {
      if (existingIds.has(s.id)) {
        cachedSeriesList![existingIds.get(s.id)!] = s;
      } else {
        cachedSeriesList!.push(s);
      }
    });
  }

  return newSeries;
}

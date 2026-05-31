import { fetchAllFromFirebase } from "./firebase";
import { decryptValue } from "../lib/security";

const API_BASE = "/api/v1";

// Resilient Fetch with Timeout and Retry
async function resilientFetch(url: string, options: RequestInit = {}, retries = 1) {
  const timeout = 30000; // Increased to 30s to allow server-side retries to complete
  for (let i = 0; i <= retries; i++) {
    const controller = new AbortController();
    const id = setTimeout(() => {
        try {
            controller.abort(); 
        } catch(e) {}
    }, timeout);
    
    const onAbort = () => {
        try {
            controller.abort(options.signal?.reason || "User aborted");
        } catch(e) {}
    };

    if (options.signal) {
      if (options.signal.aborted) {
        clearTimeout(id);
        const err = new Error("Fetch aborted");
        err.name = "AbortError";
        throw err;
      }
      options.signal.addEventListener('abort', onAbort);
    }

    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(id);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return response;
    } catch (err: any) {
      clearTimeout(id);
      
      // Check if it was a user abort
      if (options.signal?.aborted) {
        const abortErr = new Error("Fetch aborted");
        abortErr.name = "AbortError";
        throw abortErr;
      }

      // If it's a timeout (AbortError but not user signal)
      if (err.name === 'AbortError') {
          if (i < retries) continue;
          throw new Error("Request timed out");
      }

      if (i === retries) throw err;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    } finally {
      if (options.signal) {
        options.signal.removeEventListener('abort', onAbort);
      }
    }
  }
  throw new Error("Fetch failed after retries");
}

export interface ApiCategory {
  name: string;
  url: string;
  pages?: string[];
}

let categoriesCache: ApiCategory[] | null = null;
const CAT_CACHE_KEY = "serene_categories_cache";

// Load categories from localStorage on init
if (typeof window !== "undefined") {
  try {
    const stored = localStorage.getItem(CAT_CACHE_KEY);
    if (stored) categoriesCache = JSON.parse(stored);
  } catch (e) {
    console.warn("Failed to load categories from localStorage", e);
  }
}

export async function fetchCategories(): Promise<ApiCategory[]> {
  if (categoriesCache && categoriesCache.length > 0) return categoriesCache;
  try {
    const res = await resilientFetch(API_BASE + "/categories");
    const data = await res.json();
    if (data.status && data.data) {
      categoriesCache = data.data;
      // Persist to localStorage
      try {
        localStorage.setItem(CAT_CACHE_KEY, JSON.stringify(data.data));
      } catch (e) {
        console.warn("Failed to save categories to localStorage", e);
      }
      return data.data;
    }
  } catch (error) {
    console.error("API Categories Error:", error);
    // Don't throw, just return what we have (even if empty) to avoid crashing UI
    return categoriesCache || [];
  }
  return categoriesCache || [];
}

function normalizeArabic(str: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .trim()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ـ/g, "")
    .replace(/\s+/g, " ");
}

export function applyPrioritySort(seriesList: any[]): any[] {
  const priorityOrder = [
    "حلم أشرف ج2 مترجم",
    "حلم اشرف ج2 مترجم",
    "تحت الأرض",
    "تحت الارض",
    "أنت من أحببت مدبلج",
    "انت من احببت مدبلج",
    "أنت من أحب",
    "أنت من احب",
    "انت من احب",
    "انت من احبت",
    "هذا بحر سوف يفيض مترجم",
    "هذا بحر سوف يفيض",
    "المدينة البعيدة ج2 مترجم",
    "المدينه البعيده ج2 مترجم",
    "ورود وذنوب مترجم",
    "ورود وذنوب",
    "في الظل",
    "في ظل السادس",
    "في ظل السيادة"
  ];

  const list = [...seriesList];
  const priorityItems: any[] = [];

  const excludedTitles = [
    "حلم أشرف ج1 مترجم",
    "المدينة البعيدة ج1 مترجم",
    "حلم اشرف ج1",
    "المدينة البعيدة ج1"
  ];

  const filteredList = list.filter(s => !excludedTitles.some(title => (s.title || "").includes(title)));

  // Improved normalization for more robust matching
  const normalizeTitleForMatch = (t: string) => {
    return (t || "")
      .toLowerCase()
      .replace(/[أإآ]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/ى/g, "ي")
      .replace(/ـ/g, "")
      .replace(/\s+/g, "")
      .trim();
  };

  const normPriorityOrder = priorityOrder.map(title => normalizeTitleForMatch(title));

  // Try to find each priority title in order
  normPriorityOrder.forEach((normTitle, orderIdx) => {
    const foundIdx = filteredList.findIndex(s => {
      const sNorm = normalizeTitleForMatch(s.title);
      return sNorm.includes(normTitle) || normTitle.includes(sNorm);
    });

    if (foundIdx !== -1) {
      // Check if we already picked this item (via a different variant)
      const series = filteredList[foundIdx];
      const isAlreadyPicked = priorityItems.some(p => p.title === series.title);
      
      if (!isAlreadyPicked) {
        priorityItems.push({ ...series, isPriority: true });
        filteredList.splice(foundIdx, 1);
      }
    }
  });

  return [...priorityItems, ...filteredList];
}

export async function fetchCategoryPageFromAPI(
  categoryName: string,
  pageIndex: number,
  signal?: AbortSignal
): Promise<any[]> {
  const allCategories = await fetchCategories();
  if (allCategories.length === 0) return [];

  const normQ = normalizeArabic(categoryName);

  // Find ALL matching categories instead of just one
  let matchingCats = allCategories.filter((c) => {
    const normC = normalizeArabic(c.name);

    if (normQ === "تركي" && normC.includes("تركي")) return true;
    if (normQ === "عربي" && normC.includes("عربي")) return true;
    if (normQ === "خليجي" && normC.includes("خليجي")) return true;
    if (
      (normQ === "انمي" || normQ === "انيمي") &&
      (normC.includes("انمي") ||
        normC.includes("انيمي") ||
        normC.includes("انيميشن"))
    )
      return true;
    if (normQ === "اجنبي" && normC.includes("اجنبي")) return true;
    if (normQ === "افلام" && (normC.includes("افلام") || normC.includes("فيلم"))) return true;
    if (
      (normQ === "اسيوي" || normQ.includes("اسيوي وكوري")) &&
      (normC.includes("كوري") ||
        normC.includes("اسيوي") ||
        normC.includes("اسيوية") ||
        normC.includes("korean") ||
        normC.includes("asia") ||
        normC.includes("korea"))
    )
      return true;

    return normC.includes(normQ) || normQ.includes(normC);
  });

  if (matchingCats.length === 0) {
    matchingCats = allCategories.filter(
      (c) => c.name.includes(categoryName) || categoryName.includes(c.name),
    );
  }

  if (matchingCats.length === 0) return [];

  // Fetch from ALL matching categories for this page index
  const pagePromises = matchingCats.map(async (cat) => {
    let urlToFetch = "";
    if (cat.pages && cat.pages[pageIndex]) {
      urlToFetch = cat.pages[pageIndex];
    } else if (pageIndex === 0) {
      urlToFetch = cat.url;
    }

    if (!urlToFetch) return [];

    const rawSeries = await fetchSeriesByCategory(urlToFetch, signal);
    return rawSeries.map((s: any) => ({
      ...s,
      category: cat.name,
    }));
  });

  const results = await Promise.allSettled(pagePromises);
  const combined: any[] = [];
  results.forEach((res) => {
    if (res.status === "fulfilled") {
      combined.push(...res.value);
    }
  });

  // Unique by title or ID
  const seen = new Set();
  const uniqueSeries = combined.filter(s => {
    const key = (s.title || s.id || "").toLowerCase().trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Apply Priority Sort even for categories
  return applyPrioritySort(uniqueSeries);
}

export async function fetchSeriesByCategory(categoryUrl: string, signal?: AbortSignal) {
  try {
    const res = await resilientFetch(
      API_BASE + "/series?url=" + encodeURIComponent(categoryUrl),
      { signal }
    );
    const data = await res.json();
    if (data.status && data.data) {
      return data.data.map((s: any) => ({
        id: (s.url || s.title || "").replace(/[^a-zA-Z0-9]/g, "_"),
        title: s.title || "",
        image: s.image || "",
        url: s.url || "",
        episodes_count: s.episodes || "0",
        category: "",
        rating: 0,
        views: 0,
        episodes: [],
        trailer: "",
      }));
    }
  } catch (error: any) {
    if (error.name === 'AbortError') return [];
    console.error("API Series Error:", error);
  }
  return [];
}

function getConsolidatedCategories(originalName: string): string[] {
  const cats: string[] = [];
  const name = originalName.toLowerCase();

  // Basic categorization logic
  if (name.includes("رمضان")) {
    cats.push("رمضان");
    if (name.includes("خليجي")) cats.push("خليجي");
    if (name.includes("عربي")) cats.push("عربي");
  } else {
    // Check for general genres
    if (name.includes("تركي")) cats.push("تركي");
    if (name.includes("عربي") || name.includes("arabic")) cats.push("عربي");
    if (name.includes("خليجي") || name.includes("kleeji")) cats.push("خليجي");
    if (name.includes("اجنبي") || name.includes("أجنبي") || name.includes("foreign")) cats.push("أجنبي");
    if (name.includes("انمي") || name.includes("أنمي") || name.includes("anime")) cats.push("أنمي");
    if (name.includes("فارسي") || name.includes("persian")) cats.push("فارسي");
    
    // Group all Asian/Korean together
    if (
      name.includes("كور") || 
      name.includes("اسي") || 
      name.includes("آسيوي") || 
      name.includes("korean") || 
      name.includes("asia") ||
      name.includes("korea")
    ) {
      cats.push("آسيوي وكوري");
    }

    if (name.includes("افلام") || name.includes("أفلام") || name.includes("movies")) {
      cats.push("أفلام");
    }
  }

  // Fallback to original name if nothing else found
  if (cats.length === 0) {
    cats.push(originalName);
  }

  // Ensure unique categories
  return Array.from(new Set(cats));
}

export async function fetchAllFromAPI(isBackground = false) {
  const allCategories = await fetchCategories();

  if (allCategories.length === 0) return [];

  const promises: Promise<any>[] = [];
  const categoryNamesForPromises: string[] = [];

  allCategories.forEach((cat) => {
    let urlsToFetch: string[] = [];

    if (!isBackground) {
      // FAST INITIAL LOAD: Only load the first page of each category
      urlsToFetch = [cat.url];
    } else {
      // BACKGROUND LOAD: Load up to 30 pages per category for full library access
      urlsToFetch = cat.pages ? cat.pages.slice(0, 30) : [cat.url];
    }

    urlsToFetch.forEach((url) => {
      promises.push(fetchSeriesByCategory(url));
      categoryNamesForPromises.push(cat.name);
    });
  });

  const results = await Promise.allSettled(promises);

  const allSeriesMap = new Map<string, any>();

  results.forEach((result, promiseIndex) => {
    if (result.status !== "fulfilled") return;
    const series = result.value;

    const originalCatName = categoryNamesForPromises[promiseIndex];
    const cats = getConsolidatedCategories(originalCatName);

    const seriesToProcess = series;

    seriesToProcess.forEach((s: any, index: number) => {
      const key = s.title;
      const existing = allSeriesMap.get(key);

      if (existing) {
        cats.forEach((cat) => {
          if (existing.category && !existing.category.includes(cat)) {
            existing.category = existing.category + ", " + cat;
          } else if (!existing.category) {
            existing.category = cat;
          }
        });
        if (index < existing.rank) {
          existing.rank = index;
        }
      } else {
        allSeriesMap.set(key, {
          ...s,
          category: cats.join(", "),
          rank: index,
        });
      }
    });
  });

  // 2. نجيب Firebase
  const firebaseData = await fetchAllFromFirebase();

  const excludedTitles = [
    "حلم أشرف ج1 مترجم",
    "المدينة البعيدة ج1 مترجم",
    "حلم اشرف ج1",
    "المدينة البعيدة ج1"
  ];

  // تصفية المسلسلات المستبعدة من API
  let apiSeries = Array.from(allSeriesMap.values()).filter(
    (s) => !excludedTitles.some(title => (s.title || "").includes(title))
  );

  // دالة توحيد العناوين لمنع التكرار (نفس المستخدمة في داتا سيرفيس)
  const getNormalizedTitle = (title: string): string => {
    if (!title) return "";
    return title
      .toLowerCase()
      .trim()
      .replace(/^(مسلسل|برنامج|فيلم)\s+/g, "") // remove common prefixes
      .replace(/^ال/g, "") // remove "ال" prefix
      .replace(/ـ/g, "") // remove tatweel
      .replace(/\s+/g, ""); // strip all whitespace
  };

  // عناوين API بعد التوحيد
  const apiTitlesNorm = apiSeries.map((s) => getNormalizedTitle(s.title));

  // نضيف مسلسلات Firebase المو موجودة في API لمنع التكرار وتصفية المستبعدة
  const newFromFB = firebaseData
    .filter((fb) => {
      const fbTitleNorm = getNormalizedTitle(fb.title);
      const isExcluded = excludedTitles.some(title => (fb.title || "").includes(title));
      return !isExcluded && !apiTitlesNorm.some((apiTitle) => apiTitle === fbTitleNorm);
    })
    .map((fb) => ({
      ...fb,
      isNew: true,
    }));

  const allMerged = [...apiSeries, ...newFromFB];
  return applyPrioritySort(allMerged);
}

export async function fetchEpisodesFromAPI(seriesUrl: string, signal?: AbortSignal) {
  try {
    const res = await resilientFetch(
      API_BASE + "/episodes?url=" + encodeURIComponent(seriesUrl),
      { signal }
    );
    const data = await res.json();
    if (data.status && data.data) {
      return data.data.map((ep: any) => {
        const rawUrl = ep.url || "";
        const decryptedUrl = decryptValue(rawUrl) || rawUrl;
        return {
          title: ep.name || "1",
          url: decryptedUrl,
          link1: decryptedUrl,
          link2: "",
          link3: "",
        };
      });
    }
  } catch (error: any) {
    if (error.name === 'AbortError') return [];
    console.error("API Episodes Error:", error);
  }
  return [];
}

export async function fetchPlayUrlFromAPI(episodeUrl: string, signal?: AbortSignal) {
  try {
    const res = await resilientFetch(
      API_BASE + "/play?url=" + encodeURIComponent(episodeUrl),
      { signal }
    );
    const data = await res.json();
    if (data.status && data.player_url) {
      return decryptValue(data.player_url);
    }
  } catch (error: any) {
    if (error.name === 'AbortError') return null;
    console.error("API Play URL Error:", error);
  }
  return null;
}

const TMDB_API_KEY = '5afaeea7216a76d8c0600ecf217f6427';
const TMDB_BASE = 'https://api.themoviedb.org/3/';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';
const TMDB_LANG = 'ar-SA';

const tmdbCache = new Map<string, any>();

export async function fetchSeriesDetailsFromTMDB(title: string, signal?: AbortSignal): Promise<{ description: string; backdrop: string; rating: number; year: string; cast: any[]; crew: any[] } | null> {
  if (!title) return null;
  
  const cleanTitle = title
    .replace(/(مسلسل|فيلم|برنامج|مترجم|مدبلج|ج\d+|الموسم\s*\d+|الحلقة\s*\d+|حلق\d+|حصريا|كاملا|كامل|بجودة|عالية|اون\s*لاين|HD|WEB-DL|بجودة\s*عالية|مشاهدة|تحميل)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (tmdbCache.has(cleanTitle)) return tmdbCache.get(cleanTitle);

  try {
    let searchQuery = cleanTitle;
    if (searchQuery.includes("طاش مطاش")) {
      searchQuery = searchQuery.replace("طاش مطاش", "طاش ما طاش");
    } else if (searchQuery.includes("طاش") && !searchQuery.includes("ما طاش") && !searchQuery.includes("مطاش")) {
      searchQuery = searchQuery.replace("طاش", "طاش ما طاش");
    }

    const searchUrl = `${TMDB_BASE}search/multi?api_key=${TMDB_API_KEY}&language=${TMDB_LANG}&query=${encodeURIComponent(searchQuery)}&include_adult=false`;
    const res = await fetch(searchUrl, { signal });
    const data = await res.json();

    if (data.results && data.results.length > 0) {
      // Filter out persons and invalid media types
      const validResults = data.results.filter((res: any) => res.media_type === 'tv' || res.media_type === 'movie');
      
      if (validResults.length === 0) return null;

      // Smart Normalize Helper
      const advNormalize = (str: string) => {
        return normalizeArabic(str)
          .replace(/\b(ماطاش|ما\s+طاش)\b/gi, "مطاش")
          .replace(/^(مسلسل|برنامج|فيلم)\s+/g, "")
          .trim();
      };

      const normalizedQuery = advNormalize(cleanTitle);
      const normalizedQueryNoSpace = normalizedQuery.replace(/\s+/g, '');
      
      const bestMatch = validResults.find((res: any) => {
        const resTitle = advNormalize(res.title || res.name || "");
        const resOrigTitle = advNormalize(res.original_title || res.original_name || "");
        return resTitle === normalizedQuery || resOrigTitle === normalizedQuery;
      }) || validResults.find((res: any) => {
        const resTitleNoSpace = advNormalize(res.title || res.name || "").replace(/\s+/g, '');
        const resOrigTitleNoSpace = advNormalize(res.original_title || res.original_name || "").replace(/\s+/g, '');
        return resTitleNoSpace === normalizedQueryNoSpace || resOrigTitleNoSpace === normalizedQueryNoSpace;
      }) || validResults.find((res: any) => {
        const resTitle = advNormalize(res.title || res.name || "");
        const queryWords = normalizedQuery.split(' ').filter(w => w.length > 1);
        const resWords = resTitle.split(' ').filter(w => w.length > 1);
        return queryWords.length > 1 && queryWords.every(word => resWords.includes(word));
      });

      if (!bestMatch) {
        return null;
      }

      const result = bestMatch;
      const mediaType = result.media_type || (result.first_air_date ? 'tv' : 'movie');
      
      // Fetch Credits (Cast)
      const creditsUrl = `${TMDB_BASE}${mediaType}/${result.id}/credits?api_key=${TMDB_API_KEY}&language=${TMDB_LANG}`;
      const creditsRes = await fetch(creditsUrl, { signal });
      const creditsData = await creditsRes.json();

      const details = {
        description: result.overview || "لا يوجد وصف متوفر لهذا العمل حالياً.",
        backdrop: result.backdrop_path ? `${TMDB_IMAGE_BASE}${result.backdrop_path}` : "",
        rating: result.vote_average || 0,
        year: (result.release_date || result.first_air_date || "").split('-')[0] || "",
        cast: (creditsData.cast || []).slice(0, 10).map((person: any) => ({
          id: person.id,
          name: person.name,
          character: person.character,
          profile_path: person.profile_path ? `${TMDB_IMAGE_BASE}${person.profile_path}` : null
        })),
        crew: (creditsData.crew || []).filter((p: any) => ['Director', 'Executive Producer', 'Writer', 'Producer', 'Director of Photography'].includes(p.job)).slice(0, 5).map((person: any) => ({
          id: person.id,
          name: person.name,
          job: person.job
        }))
      };
      
      tmdbCache.set(cleanTitle, details);
      return details;
    }
  } catch (err: any) {
    if (err.name === 'AbortError') return null;
    console.error("TMDB Fetch Error:", err);
  }
  return null;
}

export async function fetchPersonCreditsFromTMDB(personId: number, signal?: AbortSignal): Promise<any[]> {
  try {
    const creditsUrl = `${TMDB_BASE}person/${personId}/combined_credits?api_key=${TMDB_API_KEY}&language=${TMDB_LANG}`;
    const res = await fetch(creditsUrl, { signal });
    const data = await res.json();
    return data.cast || [];
  } catch (err) {
    console.error("TMDB Person Credits Error:", err);
    return [];
  }
}

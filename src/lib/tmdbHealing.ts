import { getApiUrl } from "./apiConfig";

const TMDB_API_KEY = "5afaeea7216a76d8c0600ecf217f6427";
const TMDB_BASE = "https://api.themoviedb.org/3/";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";
const TMDB_LANG = "ar-SA";

// Local cache to persist healed TMDB images between page loads and sessions for instant rendering without API delays
const CACHE_KEY = "serene_tmdb_healed_posters_v3";
let memoryPosterCache: Record<string, string> = {};

// Load cache on bootstrap
if (typeof window !== "undefined") {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      memoryPosterCache = JSON.parse(raw);
    }
  } catch (e) {
    console.warn("Failed to read TMDB healing cache from localStorage:", e);
  }
}

// Manual translation overrides dictionary to handle edge cases like Turkish/foreign shows
const MANUAL_OVERRIDES: Record<string, string> = {
  "من التالي": "Kimler Geldi Kimler Geçti",
  "من التالي؟": "Kimler Geldi Kimler Geçti",
  "طائر الرفراف": "Yalı Çapkını",
  "طائر الرفراف مدبلج": "Yalı Çapkını",
  "طاير الرفراف": "Yalı Çapkını",
  "فريد": "Yalı Çapkını",
  "فخرية": "سستر فخرية"
};

/**
 * Clears terms like "مسلسل", "فيلم", "كامل", "مترجم", "موسم", "ج1" 
 * so search queries lookup TMDB beautifully and accurately!
 */
export function cleanTitleForTMDB(title: string): string {
  if (!title) return "";
  let clean = title;

  // Strip Arabic Tashkeel / Diacritics (Fatha, Damma, Kasra, Sukun, Shaddah, Tanween)
  // This avoids diacritics causing strict indexing failures on TMDB searches
  clean = clean.replace(/[\u064B-\u0652]/g, "");

  // Remove brackets and its content
  clean = clean.replace(/\[.*?\]|\(.*?\)/g, "");

  // Replace delimiters with spaces
  clean = clean.replace(/[\\-|:|_|\+|\\/|\\|]/g, " ");

  // Remove common prefix or suffix descriptors
  const regexes = [
    /المسلسل التركي/gi, 
    /المسلسل الكوري/gi, 
    /المسلسل المكسيكي/gi, 
    /المسلسل الاسيوي/gi,
    /مسلسل/gi, 
    /فيلم/gi, 
    /برنامج/gi, 
    /كامل/gi, 
    /مترجم/gi, 
    /مدبلج/gi, 
    /حصريا/gi, 
    /حصري/gi,
    /مسرحية/gi,
    /مسرحيات/gi,
    /تصوير سينما/gi,
    /تصوير منزلي/gi,
    /تصوير/gi,
    /سينما/gi,
    /نسخة/gi,
    /نسخه/gi,
    /بجودة عالية/gi,
    /بجودة/gi,
    /عالية/gi,
    /اون لاين/gi,
    /اونلاين/gi,
    /مشاهدة/gi,
    /تحميل/gi,
    /الموسم الأول والثاني والثالث/gi,
    /الموسم الأول والثاني/gi,
    /الموسم الثالث/gi,
    /الموسم الثاني/gi,
    /الموسم الأول/gi,
    /الموسم\s+\d+/gi,
    /موسم\s+\d+/gi,
    /جزء\s+\d+/gi,
    /الجزء\s+\d+/gi,
    /ج\s*\d+/gi,
  ];

  for (const rx of regexes) {
    clean = clean.replace(rx, " ");
  }

  // Clean double/triple spaces and trim
  clean = clean.replace(/\s+/g, " ").trim();
  return clean;
}

/**
 * Robust Hamza variation generator.
 * Words starting with "ا" (Alif) usually cause TMDB indexing misses if indexed with "أ" or "إ" or vice versa.
 * This generates all possible standard permutations of Alif-Hamzas.
 */
function getHamzaVariants(title: string): string[] {
  if (!title) return [];
  const words = title.split(/\s+/);
  const variants = [title];

  // Replace starting Alifs with 'أ'
  const withA = words.map(w => w.startsWith("ا") ? "أ" + w.slice(1) : w).join(" ");
  variants.push(withA);

  // Replace starting Alifs with 'إ'
  const withI = words.map(w => w.startsWith("ا") ? "إ" + w.slice(1) : w).join(" ");
  variants.push(withI);

  // Normalize all starting hamzas to plain Alif
  const withPlain = words.map(w => {
    if (w.startsWith("أ") || w.startsWith("إ") || w.startsWith("آ")) {
      return "ا" + w.slice(1);
    }
    return w;
  }).join(" ");
  variants.push(withPlain);

  return Array.from(new Set(variants));
}

/**
 * Generates high-quality candidate titles to search sequentially on TMDB.
 * Splits by key delimiters like hyphen, colon, pipe to isolate main show / series names.
 */
export function getTMDBQueryCandidates(title: string): string[] {
  if (!title) return [];
  const baseCandidates: string[] = [];

  // Check manual translation overrides first to intercept complex edge-cases
  for (const [key, val] of Object.entries(MANUAL_OVERRIDES)) {
    if (title.toLowerCase().includes(key) || cleanTitleForTMDB(title).includes(key)) {
      baseCandidates.push(val);
    }
  }

  // 1. First, search the whole clean string
  const fullClean = cleanTitleForTMDB(title);
  if (fullClean && fullClean.length >= 2) {
    baseCandidates.push(fullClean);
  }

  // 2. Split by standard title delimiters/dividers in the original title
  const parts = title.split(/[\\-|:|\\|]/);
  if (parts.length > 1) {
    for (const part of parts) {
      const partClean = cleanTitleForTMDB(part);
      // Ensure the part is long enough to query and not identical to fullClean
      if (partClean && partClean.length >= 2 && partClean !== fullClean) {
        baseCandidates.push(partClean);
      }
    }
  }

  // 3. Strip trailing numbers to find root shows (e.g. "المداح 2" -> "المداح")
  const numVariants: string[] = [];
  for (const cand of baseCandidates) {
    numVariants.push(cand);
    // strip trailing english or arabic numbers
    const stripped = cand.replace(/\s+[\d\u0660-\u0669]+$/, "").trim();
    if (stripped && stripped !== cand && stripped.length >= 2) {
      numVariants.push(stripped);
    }
  }

  // 4. Generate Hamza variation queries for each root candidate string
  const finalCandidates: string[] = [];
  for (const cand of numVariants) {
    const hVars = getHamzaVariants(cand);
    finalCandidates.push(...hVars);
  }

  // Keep manual definitions as high priority, and remove duplicates in order
  return Array.from(new Set(finalCandidates));
}

/**
 * Helper to determine how well a TMDB search result matches the specified category's region/language.
 */
function getCategoryMatchScore(item: any, category?: string): number {
  if (!category) return 0;
  const cat = category.toLowerCase();
  
  const isTurkishCat = cat.includes("تركي") || cat.includes("تركية") || cat.includes("turk");
  const isKoreanCat = cat.includes("كوري") || cat.includes("كورية") || cat.includes("korean") || cat.includes("k-drama");
  const isAsianCat = cat.includes("اسيوي") || cat.includes("آسيوي") || cat.includes("اسيوية") || cat.includes("آسيوية") || cat.includes("asian");
  const isArabicCat = cat.includes("عربي") || cat.includes("خليجي") || cat.includes("رمضان") || cat.includes("كويتي") || cat.includes("سوري") || cat.includes("مصري") || cat.includes("لبناني");
  const isAnimeCat = cat.includes("انمي") || cat.includes("أنمي") || cat.includes("anime");
  const isForeignCat = cat.includes("اجنبي") || cat.includes("أجنبي") || cat.includes("اجنبية") || cat.includes("أجنبية") || cat.includes("english") || cat.includes("foreign");

  const lang = (item.original_language || "").toLowerCase();
  const countries = (item.origin_country || []).map((c: string) => c.toUpperCase());

  if (isTurkishCat) {
    if (lang === "tr" || countries.includes("TR")) return 1000;
  }
  if (isKoreanCat) {
    if (lang === "ko" || countries.includes("KR")) return 1000;
  }
  if (isAsianCat) {
    if (["ko", "ja", "zh", "th", "id"].includes(lang) || countries.some((c: string) => ["KR", "JP", "CN", "TH", "ID"].includes(c))) return 1000;
  }
  if (isArabicCat) {
    const arabCountries = ["EG", "SA", "KW", "SY", "LB", "JO", "AE", "QA", "DZ", "MA", "TN", "SD", "IQ", "YE", "OM", "BH"];
    if (lang === "ar" || countries.some((c: string) => arabCountries.includes(c))) return 1000;
  }
  if (isAnimeCat) {
    if (lang === "ja" || countries.includes("JP") || (item.genre_ids && item.genre_ids.includes(16))) return 1000;
  }
  if (isForeignCat) {
    const nonForeignLangs = ["ar", "tr", "ko"];
    if (!nonForeignLangs.includes(lang)) return 1000;
  }
  
  return 0;
}

/**
 * Detects if a series title and category translates to a show that should be exempted from TMDB healing
 * in order to let it render its original real scraped/harvested picture.
 */
export function isExcludedFromTMDB(title: string, category?: string): boolean {
  if (!title) return false;
  
  const clean = cleanTitleForTMDB(title).toLowerCase();
  const lowerTitle = title.toLowerCase();
  
  // Specific list of series titles we want to retain their true/original hand-picked covers
  const excludedKeywords = [
    "اسمعني",
    "الحارس",
    "النائم",
    "النائمه",
    "في الظل",
    "الظل"
  ];
  
  const hasKeyword = excludedKeywords.some(keyword => {
    return clean.includes(keyword) || lowerTitle.includes(keyword);
  });
  
  if (hasKeyword) {
    if (category) {
      const cat = category.toLowerCase();
      const isTurkishCat = cat.includes("تركي") || cat.includes("تركية") || cat.includes("turk");
      if (isTurkishCat) {
        return true;
      }
    } else {
      return true;
    }
  }
  
  return false;
}

/**
 * Centralized, resilient, and instant TMDB lookup.
 * Tries candidates sequentially for maximum success.
 * Returns healed image poster path, or null if no match could be found on TMDB.
 */
export async function getTMDBPoster(title: string, category?: string): Promise<string | null> {
  if (!title) return null;
  
  if (isExcludedFromTMDB(title, category)) {
    return null;
  }
  
  const cleanTitle = title.trim().toLowerCase();
  const cacheKey = category ? `${cleanTitle}::${category.trim().toLowerCase()}` : cleanTitle;
  
  // Return instantly from memory cache if already healed
  if (memoryPosterCache[cacheKey]) {
    return memoryPosterCache[cacheKey];
  }

  // Generate sequence of candidates to try on TMDB search
  const candidates = getTMDBQueryCandidates(title);
  if (candidates.length === 0) return null;

  // Try each candidate sequentially
  for (const query of candidates) {
    try {
      const searchUrl = `${TMDB_BASE}search/multi?api_key=${TMDB_API_KEY}&language=${TMDB_LANG}&query=${encodeURIComponent(query)}&include_adult=false`;
      const proxyUrl = getApiUrl(`/api/v1/tmdb/proxy?url=${encodeURIComponent(searchUrl)}`);

      const res = await fetch(proxyUrl);
      if (!res.ok) continue; // Try next candidate if proxy errors out

      const data = await res.json();
      if (data.results && data.results.length > 0) {
        // Find results, sort and prioritize matches starting with category matching, then popularity
        const sortedResults = [...data.results].sort((a, b) => {
          const scoreA = getCategoryMatchScore(a, category);
          const scoreB = getCategoryMatchScore(b, category);
          
          if (scoreA !== scoreB) {
            return scoreB - scoreA; // prioritize matching original category country
          }
          
          const aPop = a.popularity || 0;
          const bPop = b.popularity || 0;
          return bPop - aPop;
        });

        for (const item of sortedResults) {
          if (item.poster_path) {
            const imageUrl = `${TMDB_IMAGE_BASE}${item.poster_path}`;
            // Safe cache updates
            memoryPosterCache[cacheKey] = imageUrl;
            if (typeof window !== "undefined") {
              try {
                localStorage.setItem(CACHE_KEY, JSON.stringify(memoryPosterCache));
              } catch (e) {
                console.warn("Could not save updated heal cache to localStorage:", e);
              }
            }
            return imageUrl;
          } else if (item.backdrop_path) {
            const imageUrl = `${TMDB_IMAGE_BASE}${item.backdrop_path}`;
            memoryPosterCache[cacheKey] = imageUrl;
            if (typeof window !== "undefined") {
              try {
                localStorage.setItem(CACHE_KEY, JSON.stringify(memoryPosterCache));
              } catch (e) {
                console.warn("Could not save updated heal cache to os:", e);
              }
            }
            return imageUrl;
          }
        }
      }
    } catch (err: any) {
      console.warn(`TMDB candidate query failed for: "${query}" (Original: "${title}"):`, err.message);
    }
  }

  return null;
}

/**
 * Helper to check memory cache synchronously (instant check during rendering to prevent jumpiness)
 */
export function getTMDBPosterSync(title: string, category?: string): string | null {
  if (!title) return null;
  
  if (isExcludedFromTMDB(title, category)) {
    return null;
  }
  
  const cleanTitle = title.trim().toLowerCase();
  
  if (category) {
    const keyWithCat = `${cleanTitle}::${category.trim().toLowerCase()}`;
    if (memoryPosterCache[keyWithCat]) {
      return memoryPosterCache[keyWithCat];
    }
  }
  
  return memoryPosterCache[cleanTitle] || null;
}

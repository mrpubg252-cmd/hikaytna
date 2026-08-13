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

// Direct poster overrides for specific series requested by user
const DIRECT_SERIES_POSTERS: Record<string, string> = {
  "في سابعة عشر": "https://3iskk.xyz/wp-content/uploads/2026/05/daha-17-dizi.jpg",
  "في السابعة عشر": "https://3iskk.xyz/wp-content/uploads/2026/05/daha-17-dizi.jpg",
  "في سابعة عشرة": "https://3iskk.xyz/wp-content/uploads/2026/05/daha-17-dizi.jpg",
  "في السابعة عشرة": "https://3iskk.xyz/wp-content/uploads/2026/05/daha-17-dizi.jpg",
  "هذا بحر سوف يفيض": "https://3iskk.xyz/wp-content/uploads/2025/10/uHIOTJXN9nNTc51WyunL43Fvge3.jpg",
  "هذا البحر سوف يفيض": "https://3iskk.xyz/wp-content/uploads/2025/10/uHIOTJXN9nNTc51WyunL43Fvge3.jpg",
};

function getDirectSeriesPoster(title: string): string | null {
  if (!title) return null;
  const clean = title.replace(/[«»"'"]/g, '').trim().toLowerCase();
  for (const key in DIRECT_SERIES_POSTERS) {
    const keyClean = key.replace(/[«»"'"]/g, '').trim().toLowerCase();
    if (clean === keyClean || (clean.length > 3 && (clean.includes(keyClean) || keyClean.includes(clean)))) {
      return DIRECT_SERIES_POSTERS[key];
    }
  }
  return null;
}

// Manual translation overrides dictionary to handle edge cases like Turkish/foreign/Arabic shows
const MANUAL_OVERRIDES: Record<string, string> = {
  // Overrides for specific top series requested by user
  "في سابعة عشر": "Daha 17",
  "في السابعة عشر": "Daha 17",
  "حلم اشرف": "Eşref Rüya",
  "حلم أشرف": "Eşref Rüya",
  // Turkish popular series
  "طائر الرفراف": "Yalı Çapkını",
  "طائر الرفراف مدبلج": "Yalı Çapkını",
  "طاير الرفراف": "Yalı Çapkını",
  "فريد": "Yalı Çapkını",
  "من التالي": "Kimler Geldi Kimler Geçti",
  "من التالي؟": "Kimler Geldi Kimler Geçti",
  "المؤسس عثمان": "Kuruluş Osman",
  "قيامة عثمان": "Kuruluş Osman",
  "المؤسس": "Kuruluş Osman",
  "قيامة ارطغرل": "Diriliş Ertuğrul",
  "قيامة أرتغرل": "Diriliş Ertuğrul",
  "ارطغرل": "Diriliş Ertuğrul",
  "أنت اطرق بابي": "Sen Çal Kapımı",
  "انت اطرق بابي": "Sen Çal Kapımı",
  "زهرة الثالوث": "Hercai",
  "زهرة الثلاثاء": "Hercai",
  "شراب التوت": "Kızılcık Şerbeti",
  "البراعم الحمراء": "Kızıl Goncalar",
  "القضاء": "Yargı",
  "إخوتي": "Kardeşlerim",
  "اخوتي": "Kardeşlerim",
  "الأخوة": "Kardeşlerim",
  "الأمانة": "Emanet",
  "الامانة": "Emanet",
  "حب للايجار": "Kiralık Aşk",
  "حب للأيجار": "Kiralık Aşk",
  "الطبيب المعجزة": "Mucize Doktor",
  "الحفرة": "Çukur",
  "مرعشلي": "Maraşlı",
  "رامو": "Ramo",
  "تشكيلات": "Teşkilat",
  "المنظمة": "Teşkilat",
  "المُنظّمة": "Teşkilat",
  "حكايتنا": "Bizim Hikaye",
  "حكايتنا مدبلج": "Bizim Hikaye",
  "صلاح الدين": "Kudüs Fatihi Selahaddin Eyyubi",
  "صلاح الدين الأيوبي": "Kudüs Fatihi Selahaddin Eyyubi",
  "اسمعني": "Duy Beni",
  "ابنة السفير": "Sefirin Kızı",

  // Arabic popular series
  "عمر افندي": "عمر أفندي",
  "عمر أفندي": "عمر أفندي",
  "البيت بيتي": "البيت بيتي",
  "العميل": "العميل",
  "كريستال": "كريستال",
  "الثمن": "الثمن",
  "ستليتو": "ستليتو",
  "لعبة حب": "لعبة حب",
  "شباب البومب": "شباب البومب",
  "الزند": "الزند: ذئب العاصي",
  "ذئب العاصي": "الزند: ذئب العاصي",
  "المداح": "المداح",
  "المداح أسطورة العودة": "المداح",
  "جعفر العمدة": "جعفر العمدة",
  "نعمة الأفوكاتو": "نعمة الأفوكاتو",
  "نعمة الافوكاتو": "نعمة الأفوكاتو",
  "أشغال شاقة": "أشغال شاقة",
  "اشغال شاقة": "أشغال شاقة",
  "العربجي": "العربجي",
  "مربى العز": "مربى العز",
  "فخرية": "سستر فخرية",

  // Korean popular series
  "لعبة الحبار": "Squid Game",
  "كلنا اموات": "All of Us Are Dead",
  "كلنا أموات": "All of Us Are Dead",
  "هبوط اضطراري للحب": "Crash Landing on You",
  "هبوط اضطراري": "Crash Landing on You",
  "الفتيان قبل الزهور": "Boys Over Flowers"
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

  // Exclude "A Knight of the Seven Kingdoms" and its Arabic variations from TMDB poster healing entirely
  if (
    lowerTitle.includes("knight of the seven kingdoms") ||
    lowerTitle.includes("seven kingdoms") ||
    lowerTitle.includes("الممالك السبع") ||
    lowerTitle.includes("ممالك السبع") ||
    lowerTitle.includes("الممالك السبعة") ||
    lowerTitle.includes("ممالك السبعة") ||
    clean.includes("knight of the seven kingdoms") ||
    clean.includes("seven kingdoms") ||
    clean.includes("الممالك السبع") ||
    clean.includes("ممالك السبع")
  ) {
    return true;
  }
  
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
 * Calculates a title similarity score between a TMDB result and the target search query
 */
function getTitleMatchScore(item: any, targetQuery: string): number {
  if (!targetQuery) return 0;
  const queryNorm = cleanTitleForTMDB(targetQuery).toLowerCase();
  if (!queryNorm) return 0;
  
  const name = (item.name || item.title || "").toLowerCase();
  const origName = (item.original_name || item.original_title || "").toLowerCase();
  const nameClean = cleanTitleForTMDB(name).toLowerCase();
  const origNameClean = cleanTitleForTMDB(origName).toLowerCase();

  // Exact match
  if (nameClean === queryNorm || origNameClean === queryNorm) return 5000;
  // Contains match
  if ((nameClean && (nameClean.includes(queryNorm) || queryNorm.includes(nameClean))) ||
      (origNameClean && (origNameClean.includes(queryNorm) || queryNorm.includes(origNameClean)))) {
    return 2500;
  }
  
  return 0;
}

/**
 * Centralized, resilient, and instant TMDB lookup.
 * Tries candidate queries sequentially with search/tv prioritization for series.
 * Returns healed image poster path, or null if no match could be found on TMDB.
 */
export async function getTMDBPoster(title: string, category?: string): Promise<string | null> {
  return null;
}

/**
 * Helper to check memory cache synchronously (instant check during rendering to prevent jumpiness)
 */
export function getTMDBPosterSync(title: string, category?: string): string | null {
  return null;
}

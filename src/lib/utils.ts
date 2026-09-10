import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Normalizes Arabic text for better search matching.
 * Handles common variations like Alef, Taa Marbuta, and removals of diacritics.
 */
export function normalizeArabic(text: string): string {
  if (!text) return "";
  
  let normalized = text.trim().toLowerCase();

  // Strip prefixes like 'مسلسل', 'فيلم', 'انمي' along with any dot, space, symbols, or even when glued directly
  const prefixRegex = /^(مسلسل|مسلسلات|فيلم|افلام|أفلام|برنامج|انمي|أنمي|كرتون|حلقات|حلقة|عرض|موسم)([\s.\-_:]*)/;
  normalized = normalized.replace(prefixRegex, '');

  // Remove diacritics (Harakat)
  normalized = normalized.replace(/[\u064B-\u065F]/g, "");
  
  // Normalize Alef variations to bare Alef
  normalized = normalized.replace(/[أإآ]/g, "ا");
  
  // Normalize Taa Marbuta to Heh
  normalized = normalized.replace(/ة/g, "ه");
  
  // Normalize Yeh to Alef Maksura/Yeh
  normalized = normalized.replace(/ى/g, "ي");

  // Remove common prefixes like 'Al-' (ال التعريف) for more flexible search
  // But only if it's at the start or after a space
  normalized = normalized.replace(/(?:^|\s)ال/g, " ");
  
  // Remove special characters but KEEP numbers and letters
  normalized = normalized.replace(/[^\u0621-\u064Aa-z0-9\s]/g, "");
  
  // Condense extra spaces and strip entirely to make matches spaceless
  normalized = normalized.replace(/\s+/g, "");
  
  return normalized;
}

/**
 * Advanced Arabic Search Relevance Scorer.
 * Returns a score from 0 to 100,000+.
 * Higher score = higher relevance to what the user actually searched.
 */
export function calculateSearchRelevance(target: string, query: string, category?: string): number {
  if (!target || !query) return 0;

  const rawTarget = target.trim().toLowerCase();
  const rawQuery = query.trim().toLowerCase();

  // Basic normalized string helper
  const normBasic = (str: string) => {
    return str.toLowerCase()
      .replace(/^(المسلسل التركي|المسلسل الكوري|المسلسل المكسيكي|المسلسل الاسيوي|المسلسل|الفيلم|البرنامج|مسلسل|برنامج|فيلم|انمي|أنمي)\s+/gi, "")
      .replace(/\s*(مترجم|مترجمة|مدبلج|مدبلجة|قصة عشق|كاملة?|جودة عالية|hd|الموسم\s*\d+|الجزء\s*\d+|ج\s*\d+)\s*$/gi, "")
      .replace(/[أإآٱ]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/ى/g, "ي")
      .replace(/[\u064B-\u065F]/g, "") // Diacritics
      .replace(/[^\u0621-\u064Aa-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  };

  const basicTarget = normBasic(rawTarget);
  const basicQuery = normBasic(rawQuery);

  const cleanTarget = normalizeArabic(rawTarget);
  const cleanQuery = normalizeArabic(rawQuery);

  if (!basicQuery && !cleanQuery) return 0;

  // 1. EXACT FULL MATCH (Top Tier: 100,000+)
  if (basicTarget === basicQuery) {
    return 100000;
  }
  if (cleanTarget === cleanQuery && cleanTarget.length > 0) {
    return 95000;
  }

  // 2. STARTS WITH EXACT QUERY (Second Tier: 60,000 - 85,000)
  if (basicTarget.startsWith(basicQuery) && basicQuery.length >= 2) {
    const lengthPenalty = Math.min((basicTarget.length - basicQuery.length) * 50, 20000);
    return 85000 - lengthPenalty;
  }
  if (cleanTarget.startsWith(cleanQuery) && cleanQuery.length >= 2) {
    const lengthPenalty = Math.min((cleanTarget.length - cleanQuery.length) * 50, 20000);
    return 75000 - lengthPenalty;
  }

  // 3. CONTAINS FULL CONSECUTIVE PHRASE (Third Tier: 35,000 - 55,000)
  if (basicTarget.includes(basicQuery) && basicQuery.length >= 2) {
    const idx = basicTarget.indexOf(basicQuery);
    const posPenalty = idx * 100;
    const lengthPenalty = (basicTarget.length - basicQuery.length) * 30;
    return Math.max(35000, 55000 - posPenalty - lengthPenalty);
  }
  if (cleanTarget.includes(cleanQuery) && cleanQuery.length >= 2) {
    return 40000;
  }

  // 4. WORD-BY-WORD PRECISION & COVERAGE (Fourth Tier: 5,000 - 30,000)
  const targetWords = basicTarget.split(/\s+/).filter(w => w.length > 0);
  const queryWords = basicQuery.split(/\s+/).filter(w => w.length > 0);

  if (queryWords.length > 0 && targetWords.length > 0) {
    let matchedQueryWordsCount = 0;
    let exactWordBonus = 0;
    let firstWordMatchBonus = 0;

    queryWords.forEach((qWord, qIdx) => {
      let wordMatched = false;
      targetWords.forEach((tWord, tIdx) => {
        if (tWord === qWord) {
          wordMatched = true;
          exactWordBonus += 4000;
          if (tIdx === 0 && qIdx === 0) firstWordMatchBonus += 5000;
        } else if (tWord.startsWith(qWord) && qWord.length >= 2) {
          wordMatched = true;
          exactWordBonus += 2000;
        } else if (tWord.includes(qWord) && qWord.length >= 3) {
          wordMatched = true;
          exactWordBonus += 1000;
        }
      });
      if (wordMatched) matchedQueryWordsCount++;
    });

    const matchRatio = matchedQueryWordsCount / queryWords.length;

    // If ALL words in user query matched target words!
    if (matchRatio === 1) {
      const targetCoverage = queryWords.length / Math.max(targetWords.length, 1);
      const coverageBonus = targetCoverage * 8000;
      return 20000 + exactWordBonus + firstWordMatchBonus + coverageBonus;
    }

    if (matchRatio >= 0.5) {
      return (10000 * matchRatio) + exactWordBonus + firstWordMatchBonus;
    }

    if (matchedQueryWordsCount > 0) {
      return (3000 * matchRatio) + exactWordBonus;
    }
  }

  // 5. FUZZY / TYPO MATCHING (Fifth Tier: 200 - 1,500)
  if (fuzzyMatchArabic(target, query)) {
    return 800;
  }

  return 0;
}

/**
 * Checks if a target string matches a query string using fuzzy logic specifically for Arabic.
 */
export function fuzzyMatchArabic(target: string, query: string): boolean {
  if (!target || !query) return false;
  
  const rawTarget = target.trim().toLowerCase();
  const rawQuery = query.trim().toLowerCase();
  
  // Layer 1: Raw case-insensitive exact check
  if (rawTarget.includes(rawQuery) || rawQuery.includes(rawTarget)) return true;

  // Layer 2: Basic normalization check (characters-swap only, keep "ال" and spaces)
  const normBasic = (str: string) => {
    return str.toLowerCase()
      .replace(/[أإآ]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/ى/g, "ي")
      .replace(/[\u064B-\u065F]/g, "") // Diacritics
      .replace(/\s+/g, " ")
      .trim();
  };
  const basicTarget = normBasic(rawTarget);
  const basicQuery = normBasic(rawQuery);
  if (basicTarget.includes(basicQuery) || basicQuery.includes(basicTarget)) return true;
  
  // Layer 3: Advanced prefix-stripping normalization
  const normTarget = normalizeArabic(target);
  const normQuery = normalizeArabic(query);
  
  if (normTarget && normQuery) {
    if (normTarget.includes(normQuery) || normQuery.includes(normTarget)) return true;
  }
  
  // Layer 4: Word-based checking for query intersection
  const targetWords = target.split(/\s+/).map(w => normalizeArabic(w)).filter(w => w.length >= 2);
  const queryWords = query.split(/\s+/).map(w => normalizeArabic(w)).filter(w => w.length >= 2);

  for (const qWord of queryWords) {
    for (const tWord of targetWords) {
      if (tWord === qWord) return true;
      if (tWord.includes(qWord) && qWord.length >= 2) return true;
    }
  }

  // Layer 5: Levenshtein distance for typos on fully normalized text
  if (!normTarget || !normQuery) return false;
  
  // Skip expensive check for very long strings to prevent hanging
  if (normTarget.length > 60 || normQuery.length > 60) {
    return false;
  }

  const longer = normTarget.length >= normQuery.length ? normTarget : normQuery;
  const shorter = normTarget.length < normQuery.length ? normTarget : normQuery;
  
  const editDistance = getEditDistance(longer, shorter);
  const threshold = longer.length <= 4 ? 0.85 : 0.65;
  const similarity = (longer.length - editDistance) / longer.length;
  
  return similarity >= threshold;
}

/**
 * Levenshtein distance algorithm to find the minimum number of single-character edits.
 */
function getEditDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

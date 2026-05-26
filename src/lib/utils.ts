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
  
  // Condense extra spaces
  normalized = normalized.replace(/\s+/g, "");
  
  return normalized;
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

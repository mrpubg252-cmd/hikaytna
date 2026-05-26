import { fetchAllFromAPI } from './api';
import { fetchAllFromFirebase, Series } from './firebase';

function isSimilarTitle(a: string, b: string) {
  if (!a || !b) return false;
  const cleanA = a.toLowerCase().trim().replace(/^ال/g, '');
  const cleanB = b.toLowerCase().trim().replace(/^ال/g, '');
  
  if (cleanA === cleanB) return true;
  if (cleanA.includes(cleanB) || cleanB.includes(cleanA)) return true;
  
  return false;
}

function fixImageUrl(url: string) {
  if (!url) return 'https://i.ibb.co/0wvJfBH/file-00000000c1e4720a9aba88f120b35bd1.png';
  
  const badWords = ['default_image', 'system_logo', 'thumbnail.jpg', 'logo.png'];
  for (let word of badWords) {
    if (url.includes(word)) {
      return 'https://i.ibb.co/0wvJfBH/file-00000000c1e4720a9aba88f120b35bd1.png';
    }
  }

  // Handle image proxying on API / Third-party images to bypass CORS or referer anti-hotlinking blockages!
  if (url.startsWith('http') && !url.includes('ibb.co') && !url.includes('/api/v1/image-proxy')) {
    return `/api/v1/image-proxy?url=${encodeURIComponent(url)}`;
  }

  return url;
}

// Client-side simple in-memory cache for instant transitions!
let cachedSeriesList: Series[] | null = null;
let lastFetchTime = 0;
const CACHE_DURATION_MS = 20 * 60 * 1000; // Cache for 20 minutes instead of 1 minute!

export async function fetchAllSeries(forceRefresh = false): Promise<Series[]> {
  const now = Date.now();
  if (!forceRefresh && cachedSeriesList && (now - lastFetchTime < CACHE_DURATION_MS)) {
    return cachedSeriesList;
  }

  let apiData: Series[] = [];
  let firebaseData: Series[] = [];
  
  try {
    const data = await fetchAllFromAPI();
    if (data && data.length > 0) {
      apiData = data;
    }
  } catch (e) {
    console.warn('API fetch failed');
  }
  
  try {
    const data = await fetchAllFromFirebase();
    if (data && data.length > 0) {
      firebaseData = data;
    }
  } catch (e) {
    console.warn('Firebase fetch failed');
  }

  // Combine both sources without duplicates, prioritizing Firebase versions for customized details
  const mergedMap = new Map<string, Series>();
  
  const getNormalizedTitle = (title: string): string => {
    if (!title) return '';
    return title.toLowerCase().trim()
      .replace(/^ال/g, '') // remove "ال" prefix
      .replace(/\s+/g, ''); // strip all whitespace
  };

  // Add API series first
  apiData.forEach(s => {
    const norm = getNormalizedTitle(s.title);
    if (norm) {
      mergedMap.set(norm, s);
    } else {
      mergedMap.set(s.id, s);
    }
  });

  // Overwrite or Add with Firebase series (user custom entries have final priority)
  firebaseData.forEach(s => {
    const norm = getNormalizedTitle(s.title);
    if (norm) {
      const existing = mergedMap.get(norm);
      if (existing) {
        mergedMap.set(norm, {
          ...existing,
          ...s,
          id: s.id || existing.id || norm,
          // Guard against overwriting a valid API image, category, episodes or trailer with blank values!
          image: s.image && s.image.trim() !== '' ? s.image : existing.image,
          category: s.category && s.category.trim() !== '' ? s.category : existing.category,
          episodes: s.episodes && s.episodes.length > 0 ? s.episodes : existing.episodes,
          trailer: s.trailer && s.trailer.trim() !== '' ? s.trailer : existing.trailer,
        });
      } else {
        mergedMap.set(norm, { ...s, id: s.id || norm });
      }
    } else {
      mergedMap.set(s.id, s);
    }
  });

  let allData = Array.from(mergedMap.values());
  allData = allData.map(s => ({ ...s, image: fixImageUrl(s.image) }));
  
  allData.sort((a, b) => {
    // 1. Priority series based on user request
    const priorityTitles = [
      'تحت الارض',
      'حلم اشرف',
      'انت من احببت',
      'هذا بحر سوف يفيض',
      'ورود وذنوب',
      'مدينه بعديه'
    ];
    
    const isPriorityA = priorityTitles.some(t => (a.title || '').includes(t));
    const isPriorityB = priorityTitles.some(t => (b.title || '').includes(t));
    
    // Within the same category, these should always be first
    if (a.category === b.category) {
      if (isPriorityA && !isPriorityB) return -1;
      if (!isPriorityA && isPriorityB) return 1;
    }
    
    // Global secondary priority: Guest specified 'حلم اشرف' for global top
    if ((a.title || '').includes('حلم اشرف')) return -1;
    if ((b.title || '').includes('حلم اشرف')) return 1;
    
    // 2. New episode / New series priority
    // Series with the most episodes or marked as isNew could be considered "active"
    if (a.isNew && !b.isNew) return -1;
    if (!a.isNew && b.isNew) return 1;
    
    // More episodes often means more recent activity in many streaming DB structures
    const aEps = a.episodes?.length || 0;
    const bEps = b.episodes?.length || 0;
    if (aEps !== bEps) return bEps - aEps;
    
    // 3. Category preference (Turkish)
    const aTurkish = a.category?.includes('تركي');
    const bTurkish = b.category?.includes('تركي');
    if (aTurkish && !bTurkish) return -1;
    if (!aTurkish && bTurkish) return 1;
    
    return (b.rating || 0) - (a.rating || 0);
  });
  
  cachedSeriesList = allData;
  lastFetchTime = Date.now();
  return allData;
}

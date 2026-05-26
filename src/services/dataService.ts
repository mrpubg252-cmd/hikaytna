import { fetchAllFromAPI } from './api';
import { fetchAllFromFirebase, Series } from './firebase';

function isSimilarTitle(a: string, b: string) {
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
  return url;
}

export async function fetchAllSeries(): Promise<Series[]> {
  let allData: Series[] = [];
  
  try {
    const apiData = await fetchAllFromAPI();
    if (apiData && apiData.length > 0) {
      allData = apiData.map(s => ({ ...s, image: fixImageUrl(s.image) }));
    }
  } catch (e) {
    console.warn('API fetch failed');
  }
  
  if (allData.length === 0) {
    try {
      const firebaseData = await fetchAllFromFirebase();
      allData = firebaseData.map(s => ({ ...s, image: fixImageUrl(s.image) }));
    } catch (e) {
      console.warn('Firebase fetch failed');
    }
  }
  
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
    
    const isPriorityA = priorityTitles.some(t => a.title.includes(t));
    const isPriorityB = priorityTitles.some(t => b.title.includes(t));
    
    // Within the same category, these should always be first
    if (a.category === b.category) {
      if (isPriorityA && !isPriorityB) return -1;
      if (!isPriorityA && isPriorityB) return 1;
    }
    
    // Global secondary priority: Guest specified 'حلم اشرف' for global top
    if (a.title.includes('حلم اشرف')) return -1;
    if (b.title.includes('حلم اشرف')) return 1;
    
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
  
  return allData;
}

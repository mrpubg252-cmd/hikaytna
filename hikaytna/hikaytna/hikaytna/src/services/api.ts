import { fetchAllFromFirebase } from './firebase';
import { decryptValue } from '../lib/security';

const API_BASE = '/api/v1';

export interface ApiCategory {
  name: string;
  url: string;
}

export async function fetchCategories(): Promise<ApiCategory[]> {
  try {
    const res = await fetch(API_BASE + '/categories');
    const data = await res.json();
    if (data.status && data.data) {
      return data.data;
    }
  } catch (error) {
    console.error('API Categories Error:', error);
  }
  return [];
}

export async function fetchSeriesByCategory(categoryUrl: string) {
  try {
    const res = await fetch(API_BASE + '/series?url=' + encodeURIComponent(categoryUrl));
    const data = await res.json();
    if (data.status && data.data) {
      return data.data.map((s: any) => ({
        id: (s.url || s.title || '').replace(/[^a-zA-Z0-9]/g, '_'),
        title: s.title || '',
        image: s.image || '',
        url: s.url || '',
        episodes_count: s.episodes || '0',
        category: '',
        rating: 0,
        views: 0,
        episodes: [],
        trailer: ''
      }));
    }
  } catch (error) {
    console.error('API Series Error:', error);
  }
  return [];
}

function getConsolidatedCategories(originalName: string): string[] {
  const cats: string[] = [];
  const name = originalName.toLowerCase();

  if (name.includes('رمضان')) {
    cats.push('رمضان');
    if (name.includes('خليجي')) {
      cats.push('خليجي');
    }
    if (name.includes('عربي')) {
      cats.push('عربي');
    }
  } else {
    if (name.includes('افلام') || name.includes('أفلام')) {
      cats.push('أفلام');
      if (name.includes('كورية') || name.includes('كور')) {
        cats.push('آسيوي وكوري');
      }
      if (name.includes('اجنبية') || name.includes('أجنبية')) {
        cats.push('أجنبي');
      }
    } else {
      if (name.includes('اجنبية') || name.includes('أجنبية') || name.includes('foreign')) {
        cats.push('أجنبي');
      } else if (name.includes('كور') || name.includes('اسي') || name.includes('كوري') || name.includes('آسيوي')) {
        cats.push('آسيوي وكوري');
      } else if (name.includes('انمي') || name.includes('أنمي')) {
        cats.push('أنمي');
      } else if (name.includes('تركي')) {
        cats.push('تركي');
      } else if (name.includes('خليجي')) {
        cats.push('خليجي');
      } else if (name.includes('عربي')) {
        cats.push('عربي');
      } else if (name.includes('فارسي')) {
        cats.push('فارسي');
      }
    }
  }

  if (cats.length === 0) {
    cats.push(originalName);
  }

  return cats;
}

export async function fetchAllFromAPI() {
  const allCategories = await fetchCategories();
  
  if (allCategories.length === 0) return [];
  
  const promises = allCategories.map(cat => fetchSeriesByCategory(cat.url));
  const results = await Promise.all(promises);
  
  const allSeriesMap = new Map<string, any>();
  
  results.forEach((series, catIndex) => {
    const originalCatName = allCategories[catIndex].name;
    const cats = getConsolidatedCategories(originalCatName);
    
    series.forEach((s: any, index: number) => {
      const key = s.title;
      const existing = allSeriesMap.get(key);
      
      if (existing) {
        cats.forEach(cat => {
          if (existing.category && !existing.category.includes(cat)) {
            existing.category = existing.category + ', ' + cat;
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
          category: cats.join(', '),
          rank: index
        });
      }
    });
  });

  // 2. نجيب Firebase
  const firebaseData = await fetchAllFromFirebase();
  
  // إزالة "حلم اشرف" من API لضمان استخدام نسخة Firebase
  let apiSeries = Array.from(allSeriesMap.values()).filter(s => !s.title.includes('حلم اشرف'));

  // عناوين API الحالية (للحروف الصغيرة، بدون "ال")
  const apiTitles = apiSeries.map(s => 
    s.title.toLowerCase().trim().replace(/^ال/, '')
  );

  // نضيف مسلسلات Firebase المو موجودة في API (مطابقة تامة فقط لتقليل الفلترة الزائدة)
  const newFromFB = firebaseData.filter(fb => {
    const fbTitle = fb.title.toLowerCase().trim().replace(/^ال/, '');
    // تأكد إن العنوان غير مطابق تماماً لأي من عناوين الـ API
    return !apiTitles.some(apiTitle => apiTitle === fbTitle);
  }).map(fb => ({
    ...fb,
    isNew: true
  }));

  // تحديد "حلم اشرف" من Firebase لإعطائه الأولوية
  const prioritySeries = newFromFB.filter(fb => fb.title.includes('حلم اشرف')).map(fb => ({
    ...fb,
    isPriority: true,
    isNew: true
  }));
  
  const otherSeries = [
    ...apiSeries, 
    ...newFromFB.filter(fb => !fb.title.includes('حلم اشرف'))
  ];

  // دمج API + Firebase مع أولوية لـ "حلم اشرف"
  return [...prioritySeries, ...otherSeries];
}

export async function fetchEpisodesFromAPI(seriesUrl: string) {
  try {
    const res = await fetch(API_BASE + '/episodes?url=' + encodeURIComponent(seriesUrl));
    const data = await res.json();
    if (data.status && data.data) {
      return data.data.map((ep: any) => ({
        title: ep.name || '1',
        url: ep.url || '',
        link1: ep.url || '',
        link2: '',
        link3: ''
      }));
    }
  } catch (error) {
    console.error('API Episodes Error:', error);
  }
  return [];
}

export async function fetchPlayUrlFromAPI(episodeUrl: string) {
  try {
    const res = await fetch(API_BASE + '/play?url=' + encodeURIComponent(episodeUrl));
    const data = await res.json();
    if (data.status && data.player_url) {
      return decryptValue(data.player_url);
    }
  } catch (error) {
    console.error('API Play URL Error:', error);
  }
  return null;
}

export interface TrackingRecord {
  lastCount: number;
  updatedAt: number;
  lastNewDetectedAt?: number;
}

export function getEpisodeCount(series: any): number {
  if (series.episodes && Array.isArray(series.episodes)) {
    return series.episodes.length;
  }
  const num = parseInt(series.episodes_count || series.episodes || '0', 10);
  return isNaN(num) ? 0 : num;
}

let memoryMap: Record<string, TrackingRecord> | null = null;
const STORAGE_KEY = 'series_episode_history_v1';

function getMemoryMap(): Record<string, TrackingRecord> {
  if (memoryMap) return memoryMap;
  const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
  if (stored) {
    try {
      memoryMap = JSON.parse(stored);
    } catch (e) {
      memoryMap = {};
    }
  } else {
    memoryMap = {};
  }
  return memoryMap || {};
}

let saveTimeout: any = null;
function saveMap(map: Record<string, TrackingRecord>) {
  memoryMap = map;
  if (typeof window !== "undefined") {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    }, 500);
  }
}

export function initializeEpisodeTracking(seriesList: any[]) {
  const map = { ...getMemoryMap() };
  const isFirstTime = Object.keys(map).length === 0;

  if (isFirstTime) {
    // ... logic remains same but uses map and saveMap
    seriesList.forEach(s => {
      map[s.id] = {
        lastCount: getEpisodeCount(s),
        updatedAt: 0,
        lastNewDetectedAt: 0
      };
    });

    const categoryGroups: Record<string, any[]> = {};
    seriesList.forEach(s => {
      const cats = (s.category || '').split(',').map((c: string) => c.trim()).filter(Boolean);
      cats.forEach((cat: string) => {
        if (!categoryGroups[cat]) categoryGroups[cat] = [];
        categoryGroups[cat].push(s);
      });
    });

    let seedTime = Date.now() - 3600 * 1000 * 5;
    Object.keys(categoryGroups).forEach(catName => {
      const group = categoryGroups[catName];
      if (group.length > 0) {
        const eligible = group.filter(s => getEpisodeCount(s) > 1);
        if (eligible.length > 0) {
          const s1 = eligible[0];
          map[s1.id] = {
            lastCount: Math.max(1, getEpisodeCount(s1) - 1),
            updatedAt: seedTime,
            lastNewDetectedAt: seedTime
          };
          seedTime += 600 * 1000;
        }
      }
    });
  } else {
    let changed = false;
    seriesList.forEach(s => {
      const currentCount = getEpisodeCount(s);
      const existing = map[s.id];
      if (!existing) {
        map[s.id] = {
          lastCount: currentCount,
          updatedAt: 0,
          lastNewDetectedAt: Date.now()
        };
        changed = true;
      } else if (currentCount > existing.lastCount) {
        existing.updatedAt = Date.now();
        existing.lastNewDetectedAt = Date.now();
        existing.lastCount = currentCount; // compare against this new peak in future
        changed = true;
      } else if (currentCount < existing.lastCount) {
        existing.lastCount = currentCount;
        existing.updatedAt = 0;
        changed = true;
      }
    });
    if (!changed) return;
  }

  saveMap(map);
}

export function hasNewEpisode(series: any): boolean {
  const map = getMemoryMap();
  const track = map[series.id];
  if (!track) return false;
  
  // 1. If actively marked with an updatedAt within the last 24 hours, count as new
  if (track.updatedAt && track.updatedAt > 0) {
    const elapsed = Date.now() - track.updatedAt;
    if (elapsed < 24 * 60 * 60 * 1000) {
      return true;
    }
  }

  // 2. Or if current count has somehow increased beyond tracked count (extra safety fallback)
  const countHasIncreased = getEpisodeCount(series) > track.lastCount;
  if (countHasIncreased) {
    return true;
  }
  
  return false;
}

export function getEpisodeUpdatedAt(series: any): number {
  const map = getMemoryMap();
  return map[series.id]?.updatedAt || 0;
}

export function getLastNewDetectedAt(series: any): number {
  const map = getMemoryMap();
  return map[series.id]?.lastNewDetectedAt || 0;
}

export function markSeriesAsRead(series: any) {
  const map = { ...getMemoryMap() };
  const currentCount = getEpisodeCount(series);
  const existing = map[series.id];
  map[series.id] = {
    lastCount: currentCount,
    updatedAt: 0,
    lastNewDetectedAt: existing?.lastNewDetectedAt || Date.now()
  };
  saveMap(map);
}

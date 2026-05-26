export interface TrackingRecord {
  lastCount: number;
  updatedAt: number;
}

export function getEpisodeCount(series: any): number {
  if (series.episodes && Array.isArray(series.episodes)) {
    return series.episodes.length;
  }
  const num = parseInt(series.episodes_count || series.episodes || '0', 10);
  return isNaN(num) ? 0 : num;
}

export function initializeEpisodeTracking(seriesList: any[]) {
  const STORAGE_KEY = 'series_episode_history_v1';
  const stored = localStorage.getItem(STORAGE_KEY);
  let map: Record<string, TrackingRecord> = {};
  
  if (stored) {
    try {
      map = JSON.parse(stored);
    } catch (e) {
      map = {};
    }
  }

  const isFirstTime = !stored || Object.keys(map).length === 0;

  if (isFirstTime) {
    // First, map all series to map as baseline
    seriesList.forEach(s => {
      map[s.id] = {
        lastCount: getEpisodeCount(s),
        updatedAt: 0
      };
    });

    // Seed some series dynamically to have "New Episode" flag so the feature is instantly visible and testable!
    const categoryGroups: Record<string, any[]> = {};
    seriesList.forEach(s => {
      const cats = (s.category || '').split(',').map((c: string) => c.trim()).filter(Boolean);
      cats.forEach((cat: string) => {
        if (!categoryGroups[cat]) categoryGroups[cat] = [];
        categoryGroups[cat].push(s);
      });
    });

    let seedTime = Date.now() - 3600 * 1000 * 5; // Start 5 hours ago
    
    Object.keys(categoryGroups).forEach(catName => {
      const group = categoryGroups[catName];
      if (group.length > 0) {
        const eligible = group.filter(s => getEpisodeCount(s) > 1);
        if (eligible.length > 0) {
          const s1 = eligible[0];
          map[s1.id] = {
            lastCount: Math.max(1, getEpisodeCount(s1) - 1),
            updatedAt: seedTime
          };
          seedTime += 600 * 1000; // increment timestamp
        }
        if (eligible.length > 1) {
          const s2 = eligible[1];
          map[s2.id] = {
            lastCount: Math.max(1, getEpisodeCount(s2) - 1),
            updatedAt: seedTime
          };
          seedTime += 600 * 1000;
        }
      }
    });
  } else {
    // Regular update flow
    let changed = false;
    seriesList.forEach(s => {
      const currentCount = getEpisodeCount(s);
      const existing = map[s.id];
      
      if (!existing) {
        map[s.id] = {
          lastCount: currentCount,
          updatedAt: 0
        };
        changed = true;
      } else {
        if (currentCount > existing.lastCount) {
          // Keep the existing.lastCount as is, but make sure we have a valid non-zero updatedAt
          if (!existing.updatedAt) {
            existing.updatedAt = Date.now();
            changed = true;
          }
        } else if (currentCount < existing.lastCount) {
          existing.lastCount = currentCount;
          existing.updatedAt = 0;
          changed = true;
        }
      }
    });
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function hasNewEpisode(series: any): boolean {
  const STORAGE_KEY = 'series_episode_history_v1';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return false;
  try {
    const map = JSON.parse(stored);
    const track = map[series.id];
    if (!track) return false;
    
    const countHasIncreased = getEpisodeCount(series) > track.lastCount;
    if (!countHasIncreased) return false;

    // Disappear after 24 hours (24 * 60 * 60 * 1000 = 86400000 ms)
    if (track.updatedAt) {
      const elapsed = Date.now() - track.updatedAt;
      if (elapsed > 24 * 60 * 60 * 1000) {
        return false;
      }
    }
    
    return true;
  } catch (e) {
    return false;
  }
}

export function getEpisodeUpdatedAt(series: any): number {
  const STORAGE_KEY = 'series_episode_history_v1';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return 0;
  try {
    const map = JSON.parse(stored);
    return map[series.id]?.updatedAt || 0;
  } catch (e) {
    return 0;
  }
}

export function markSeriesAsRead(series: any) {
  const STORAGE_KEY = 'series_episode_history_v1';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return;
  try {
    const map = JSON.parse(stored);
    const currentCount = getEpisodeCount(series);
    map[series.id] = {
      lastCount: currentCount,
      updatedAt: 0
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch (e) {
    // Ignore
  }
}

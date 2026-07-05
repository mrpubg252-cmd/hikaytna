/**
 * Service to manage watch progress and watched status using localStorage
 */

const STORAGE_KEYS = {
  PROGRESS: 'mo_play_progress', // { [seriesId_episodeIdx]: seconds }
  WATCHED: 'mo_play_watched',    // { [seriesId]: [episodeIndices] }
};

export interface WatchProgress {
  [key: string]: number;
}

export interface WatchedEpisodes {
  [seriesId: string]: number[];
}

export const progressService = {
  saveProgress: (seriesId: string, episodeIndex: number, seconds: number) => {
    const progress = progressService.getAllProgress();
    const key = `${seriesId}_${episodeIndex}`;
    progress[key] = seconds;
    localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(progress));
    
    // If we've watched more than 90% (heuristic), mark as watched
    // Note: We don't have duration here, so we just mark as watched if we save progress
    progressService.markAsWatched(seriesId, episodeIndex);
  },

  getProgress: (seriesId: string, episodeIndex: number): number => {
    const progress = progressService.getAllProgress();
    return progress[`${seriesId}_${episodeIndex}`] || 0;
  },

  getAllProgress: (): WatchProgress => {
    const data = localStorage.getItem(STORAGE_KEYS.PROGRESS);
    return data ? JSON.parse(data) : {};
  },

  markAsWatched: (seriesId: string, episodeIndex: number) => {
    const watched = progressService.getAllWatched();
    if (!watched[seriesId]) {
      watched[seriesId] = [];
    }
    if (!watched[seriesId].includes(episodeIndex)) {
      watched[seriesId].push(episodeIndex);
      localStorage.setItem(STORAGE_KEYS.WATCHED, JSON.stringify(watched));
    }
  },

  isWatched: (seriesId: string, episodeIndex: number): boolean => {
    const watched = progressService.getAllWatched();
    return watched[seriesId]?.includes(episodeIndex) || false;
  },

  getAllWatched: (): WatchedEpisodes => {
    const data = localStorage.getItem(STORAGE_KEYS.WATCHED);
    return data ? JSON.parse(data) : {};
  }
};

/**
 * Service to manage downloading and local storage of video episodes
 * using browser IndexedDB for fully offline client-side playback.
 */

const DB_NAME = 'HekayatOfflineDB';
const STORE_NAME = 'episodes';
const DB_VERSION = 1;

export interface OfflineEpisode {
  id: string; // Unique key: `${seriesId}_${episodeIndex}`
  seriesId: string;
  seriesTitle: string;
  seriesImage: string;
  episodeIndex: number;
  episodeTitle: string;
  blob: Blob;
  mimeType: string;
  downloadedAt: number;
}

class OfflineService {
  private db: IDBDatabase | null = null;

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB database'));
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
    });
  }

  /**
   * Check if an episode is cached offline
   */
  public async isEpisodeDownloaded(seriesId: string, episodeIndex: number): Promise<boolean> {
    try {
      const db = await this.getDB();
      const id = `${seriesId}_${episodeIndex}`;
      return new Promise((resolve) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.openCursor(id);

        request.onsuccess = (e) => {
          const cursor = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
          resolve(!!cursor);
        };
        request.onerror = () => {
          resolve(false);
        };
      });
    } catch {
      return false;
    }
  }

  /**
   * Retrieves a Blob representing the offline video of an episode
   */
  public async getOfflineEpisodeBlob(seriesId: string, episodeIndex: number): Promise<{ blob: Blob, mimeType: string } | null> {
    try {
      const db = await this.getDB();
      const id = `${seriesId}_${episodeIndex}`;
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onsuccess = () => {
          const result = request.result as OfflineEpisode | undefined;
          if (result && result.blob) {
            resolve({ blob: result.blob, mimeType: result.mimeType || 'video/mp4' });
          } else {
            resolve(null);
          }
        };

        request.onerror = () => {
          reject(new Error('Failed to retrieve offline episode'));
        };
      });
    } catch {
      return null;
    }
  }

  /**
   * Saves an episode into local IndexedDB storage with progress updates
   */
  public async downloadEpisode(
    seriesId: string,
    seriesTitle: string,
    seriesImage: string,
    episodeIndex: number,
    episodeTitle: string,
    videoUrl: string,
    onProgress: (percent: number) => void
  ): Promise<void> {
    const db = await this.getDB();
    const id = `${seriesId}_${episodeIndex}`;

    // Standard HTTP download stream with fully resolved absolute path to avoid browser resolve issues
    const absoluteVideoUrl = videoUrl.startsWith('http') 
      ? videoUrl 
      : `${window.location.origin}${videoUrl.startsWith('/') ? '' : '/'}${videoUrl}`;

    const response = await fetch(absoluteVideoUrl);
    if (!response.ok) {
      throw new Error(`Failed to download video. Status: ${response.status}`);
    }

    let contentType = response.headers.get('content-type') || 'video/mp4';
    // Force disguised files (like .jpg videos) to use a video mime type so HTML5 player accepts it!
    if (contentType.includes('image/') || contentType.includes('application/octet-stream') || contentType.includes('text/plain')) {
      contentType = 'video/mp4';
    }
    const contentLengthStr = response.headers.get('content-length');
    const totalBytes = contentLengthStr ? parseInt(contentLengthStr, 10) : 0;

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Could not get reader stream from video request');
    }

    let loadedBytes = 0;
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      if (value) {
        chunks.push(value);
        loadedBytes += value.length;
        if (totalBytes > 0) {
          const percent = Math.round((loadedBytes / totalBytes) * 100);
          onProgress(percent);
        } else {
          // Unspecified content length progress fallback
          onProgress(Math.min(99, Math.round(loadedBytes / (30 * 1024 * 1024) * 100))); // assume ~30MB target
        }
      }
    }

    onProgress(100);

    const compiledBlob = new Blob(chunks, { type: contentType });

    const offlineData: OfflineEpisode = {
      id,
      seriesId,
      seriesTitle,
      seriesImage,
      episodeIndex,
      episodeTitle,
      blob: compiledBlob,
      mimeType: contentType,
      downloadedAt: Date.now()
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(offlineData);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error('Failed to put item into IndexedDB store'));
      };
    });
  }

  /**
   * Delete downloaded episode
   */
  public async deleteOfflineEpisode(seriesId: string, episodeIndex: number): Promise<void> {
    const db = await this.getDB();
    const id = `${seriesId}_${episodeIndex}`;

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error('Failed to delete offline episode'));
      };
    });
  }

  /**
   * Get all offline episodes stored
   */
  public async getAllOfflineEpisodes(): Promise<Omit<OfflineEpisode, 'blob'>[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const result = request.result as OfflineEpisode[];
        // Map everything excluding blobbing to save heap memory on lookup lists
        const list = result.map(({ id, seriesId, seriesTitle, seriesImage, episodeIndex, episodeTitle, downloadedAt, mimeType }) => ({
          id,
          seriesId,
          seriesTitle,
          seriesImage,
          episodeIndex,
          episodeTitle,
          downloadedAt,
          mimeType
        }));
        resolve(list);
      };

      request.onerror = () => {
        reject(new Error('Failed to get offline episodes list'));
      };
    });
  }
}

export const offlineService = new OfflineService();

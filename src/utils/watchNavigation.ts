import { Series } from '../services/firebase';

/**
 * Checks if the user is currently premium (ad-free) through any of the active channels
 */
export function isUserPremium(): boolean {
  if (typeof window === 'undefined') return false;
  
  try {
    const isForever = localStorage.getItem('ads_removed_forever') === 'true';
    if (isForever) return true;

    const adUntil = localStorage.getItem('ad_free_until');
    if (!adUntil) return false;

    const adUntilNum = parseInt(adUntil, 10);
    return !isNaN(adUntilNum) && adUntilNum > Date.now();
  } catch (err) {
    return false;
  }
}

/**
 * Executes a clean, 0ms latency navigation to either the Ads page or directly to the Watch screen.
 * This prevents the user from being stuck on intermediate loading spinners.
 * 
 * @param navigate The react-router-dom navigate function
 * @param item The Series item the user wants to watch
 * @param episodeIndex Optional specific episode index to start watching
 */
export function navigateToWatchOrAds(
  navigate: (path: string, options?: any) => void,
  item: Series,
  episodeIndex?: number
) {
  if (!item) return;

  const titleOrId = item.title || item.id;
  const encodedTitleOrId = encodeURIComponent(titleOrId.trim());
  const watchPath = episodeIndex !== undefined 
    ? `/watch/${encodedTitleOrId}/${episodeIndex}`
    : `/watch/${encodedTitleOrId}`;

  // If the user is premium, go straight to the watch screen.
  if (isUserPremium()) {
    navigate(watchPath, { state: { series: item } });
  } else {
    // If they aren't premium, bypass the watch screen initial loading and redirect IMMEDIATELY to the ads page.
    // FIRST: We MUST explicitly save the series to sessionStorage so that when the ads page redirects back, WatchScreen can pick it up instantly!
    try {
      sessionStorage.setItem('backup_watching_series', JSON.stringify(item));
    } catch (e) {
      console.warn("Storage failed", e);
    }

    const targetRedirect = `${window.location.origin}${watchPath}?unlocked=true`;
    
    // Direct link to the ads engine.
    window.location.href = `/gateway?id=${encodeURIComponent(item.id)}&redirect=${encodeURIComponent(targetRedirect)}`;
  }
}

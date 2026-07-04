import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Opens the premium ad-skip landing page in a new window/tab,
 * which redirects to the target streaming content after the 6-second countdown.
 * Highly robust on iOS Safari and Chrome.
 */
export function triggerAdFlow(targetUrl: string, navigate?: (url: string) => void) {
  if (typeof window !== "undefined") {
    const hasAdCleared = sessionStorage.getItem('ad_shown_this_session') === 'true';
    if (hasAdCleared) {
      if (navigate) {
        navigate(targetUrl);
      } else {
        window.location.href = targetUrl;
      }
    } else {
      sessionStorage.setItem('ad_shown_this_session', 'true');
      window.open(`/ad?redirectUrl=${encodeURIComponent(targetUrl)}`, '_blank');
    }
  }
}


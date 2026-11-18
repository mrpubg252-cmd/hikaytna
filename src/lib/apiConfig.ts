/**
 * Dynamic API URL resolver to support seamless proxying on standard hostings.
 * If the application is hosted on an external static domain (e.g. Hostinger, Vercel),
 * this automatically redirects API requests to our primary cloud server.
 */
export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  
  if (typeof window === 'undefined') {
    return cleanPath;
  }

  const hostname = window.location.hostname;
  const isLocalOrSandbox = 
    hostname === 'localhost' || 
    hostname === '127.0.0.1' || 
    hostname.includes('run.app') || 
    hostname.includes('webcontainer-api');

  // If we are on our own production domain (e.g. Hostinger, Vercel), 
  // we MUST try to use the relative path first because the user might have set up the backend there correctly!
  // We only fallback to the AI Studio preview server if it's likely a sandbox environment or if we are forced.
  if (!isLocalOrSandbox) {
    // Check if the current domain should handle its own API (standard for full-stack uploads)
    return cleanPath;
  }

  return cleanPath;
}

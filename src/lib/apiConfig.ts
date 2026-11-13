/**
 * Dynamic API URL & Router resolver supporting both full-stack servers
 * (AI Studio, Cloud Run, Railway, localhost) and static GitHub Pages (*.github.io).
 */

const DEFAULT_CLOUD_API_BASE =
  "https://ais-pre-vk6e5p4kfi7kryedyi6gcl-432073001158.europe-west2.run.app";

let runtimeApiBaseOverride: string | null = null;

export function isGitHubPages(): boolean {
  if (typeof window === "undefined") return false;
  const { hostname, protocol } = window.location;
  return (
    hostname.endsWith(".github.io") ||
    hostname === "github.io" ||
    protocol === "file:"
  );
}

export function setRuntimeApiBase(url: string | null | undefined): void {
  if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
    runtimeApiBaseOverride = url.replace(/\/+$/, "");
  } else {
    runtimeApiBaseOverride = null;
  }
}

export function getExternalApiBase(): string {
  if (runtimeApiBaseOverride) return runtimeApiBaseOverride;

  if (typeof window !== "undefined") {
    try {
      const saved = window.localStorage.getItem("hekayatna_api_base");
      if (saved && (saved.startsWith("http://") || saved.startsWith("https://"))) {
        return saved.replace(/\/+$/, "");
      }
    } catch {}
  }

  const envBase = (import.meta as any).env?.VITE_API_BASE_URL;
  if (envBase && typeof envBase === "string" && envBase.startsWith("http")) {
    return envBase.replace(/\/+$/, "");
  }

  return DEFAULT_CLOUD_API_BASE;
}

export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  if (typeof window === "undefined") {
    return cleanPath;
  }

  if (isGitHubPages()) {
    return `${getExternalApiBase()}${cleanPath}`;
  }

  return cleanPath;
}

export function getAppRouteUrl(routePath: string): string {
  const cleanRoute = routePath.startsWith("/") ? routePath : `/${routePath}`;

  if (typeof window === "undefined") {
    return cleanRoute;
  }

  if (isGitHubPages()) {
    const basePath = window.location.pathname || "/";
    return `${window.location.origin}${basePath}#${cleanRoute}`;
  }

  return `${window.location.origin}${cleanRoute}`;
}

export function navigateAppUrl(routePath: string): void {
  const cleanRoute = routePath.startsWith("/") ? routePath : `/${routePath}`;
  if (typeof window === "undefined") return;

  if (isGitHubPages()) {
    window.location.hash = `#${cleanRoute}`;
  } else {
    window.location.href = cleanRoute;
  }
}

export function getGatewayUrl(id: string | undefined, redirectUrl: string): string {
  const query = new URLSearchParams();
  if (id) query.set("id", id);
  query.set("redirect", redirectUrl);

  if (isGitHubPages()) {
    const basePath = window.location.pathname || "/";
    return `${window.location.origin}${basePath}#/gateway?${query.toString()}`;
  }

  return `/gateway?${query.toString()}`;
}

export function getRouteSearchParams(): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams();
  const merged = new URLSearchParams(window.location.search);
  const hash = window.location.hash || "";
  const qIndex = hash.indexOf("?");
  if (qIndex !== -1) {
    const hashParams = new URLSearchParams(hash.slice(qIndex + 1));
    hashParams.forEach((val, key) => {
      if (!merged.has(key)) merged.set(key, val);
    });
  }
  return merged;
}

export function removeRouteSearchParam(key: string): void {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete(key);

    if (url.hash) {
      const qIndex = url.hash.indexOf("?");
      if (qIndex !== -1) {
        const hashPath = url.hash.slice(0, qIndex);
        const hashParams = new URLSearchParams(url.hash.slice(qIndex + 1));
        hashParams.delete(key);
        const qs = hashParams.toString();
        url.hash = qs ? `${hashPath}?${qs}` : hashPath;
      }
    }

    window.history.replaceState({}, "", url.pathname + url.search + url.hash);
  } catch {}
}

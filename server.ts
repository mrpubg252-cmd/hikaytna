import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { Readable } from "node:stream";

const DOMAINS_TO_PROXY = [
  "miravd.com", 
  "miravid.club", 
  "mwdy.cc", 
  "mwdy.club",
  "mwdy.org",
  "mwdy.live",
  "mwdy.info",
  "grzcdn.com", 
  "llvpn.com", 
  "3iskk.xyz", 
  "3isk.video", 
  "3skk.xyz", 
  "3iskk.co"
];

const CLIENT_INJECT_SCRIPT = `
<script>
  (function() {
    // 1. Intercept network requests (fetch / XHR) to route them through our secure server proxy
    const DOMAINS_TO_PROXY = ${JSON.stringify(DOMAINS_TO_PROXY)};

    function shouldProxy(urlStr) {
      if (!urlStr) return false;
      try {
        const url = new URL(urlStr, window.location.href);
        const host = url.hostname.toLowerCase();
        return DOMAINS_TO_PROXY.some(d => host === d || host.endsWith("." + d));
      } catch(e) {
        return false;
      }
    }

    function getProxyUrl(urlStr) {
      try {
        const url = new URL(urlStr, window.location.href);
        const proto = url.protocol.replace(":", "");
        const host = url.hostname;
        const pathAndQuery = url.pathname + url.search + url.hash;
        return "/api/proxy-resource/" + proto + "/" + host + pathAndQuery;
      } catch(e) {
        return urlStr;
      }
    }

    // Intercept XMLHttpRequest
    const OriginalXHR = window.XMLHttpRequest;
    window.XMLHttpRequest = function() {
      const xhr = new OriginalXHR();
      const originalOpen = xhr.open;
      xhr.open = function(method, url, ...args) {
        if (typeof url === 'string' && shouldProxy(url)) {
          url = getProxyUrl(url);
        }
        return originalOpen.call(this, method, url, ...args);
      };
      return xhr;
    };
    window.XMLHttpRequest.prototype = OriginalXHR.prototype;
    Object.assign(window.XMLHttpRequest, OriginalXHR);

    // Intercept Fetch
    const originalFetch = window.fetch;
    window.fetch = async function(input, init) {
      if (typeof input === 'string' && shouldProxy(input)) {
        input = getProxyUrl(input);
      } else if (input && typeof input === 'object' && 'url' in input && typeof input.url === 'string' && shouldProxy(input.url)) {
        const newUrl = getProxyUrl(input.url);
        Object.defineProperty(input, 'url', { value: newUrl, writable: false });
      }
      return originalFetch.call(this, input, init);
    };

    // 2. Clear out intrusive ad overlays & ADB alerts
    function cleanUp() {
      try {
        const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT, null, false);
        const nodesToHide = [];
        let node;
        while (node = walker.nextNode()) {
          const textVal = node.nodeValue || "";
          if (textVal.includes("Disable ADB") || textVal.includes("ADBlock") || textVal.includes("Upgrade you account") || textVal.includes("watch videos with no limits")) {
            let parent = node.parentElement;
            if (parent) {
              let container = parent;
              if (container.parentElement && container.parentElement.id !== 'vplayer' && !container.parentElement.innerHTML.includes('vplayer')) {
                 container = container.parentElement;
              }
              nodesToHide.push(container);
            }
          }
        }
        nodesToHide.forEach(el => {
          if (el && el.style) {
            el.style.setProperty('display', 'none', 'important');
          }
        });

        const adbd = document.getElementById("adbd");
        if (adbd && adbd.style) adbd.style.setProperty('display', 'none', 'important');
        const playLimit = document.getElementById("play_limit_box");
        if (playLimit && playLimit.style) playLimit.style.setProperty('display', 'none', 'important');
      } catch (e) {
        console.error("Adblock cleanup error:", e);
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', cleanUp);
    } else {
      cleanUp();
    }
    window.addEventListener('load', cleanUp);
    setInterval(cleanUp, 500);
  })();
</script>
`;

function resolveM3U8RelativeUrls(text: string, baseUrl: string): string {
  const lines = text.split("\n");
  const resolvedLines = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return line;

    // If it's a URI line (doesn't start with #)
    if (!trimmed.startsWith("#")) {
      if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://") && !trimmed.startsWith("//")) {
        try {
          return new URL(trimmed, baseUrl).href;
        } catch (e) {
          return line;
        }
      }
    } else {
      // Handle tags like URI="..." or URI=...
      return line.replace(/URI=(["'])(.*?)\1/g, (match, quote, relUrl) => {
        if (!relUrl.startsWith("http://") && !relUrl.startsWith("https://") && !relUrl.startsWith("//")) {
          try {
            const absUrl = new URL(relUrl, baseUrl).href;
            return `URI=${quote}${absUrl}${quote}`;
          } catch (e) {
            return match;
          }
        }
        return match;
      }).replace(/URI=([^"'\s,]+)/g, (match, relUrl) => {
        if (!relUrl.startsWith("http://") && !relUrl.startsWith("https://") && !relUrl.startsWith("//")) {
          try {
            const absUrl = new URL(relUrl, baseUrl).href;
            return `URI=${absUrl}`;
          } catch (e) {
            return match;
          }
        }
        return match;
      });
    }
    return line;
  });
  return resolvedLines.join("\n");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // API Route for Gemini Chat Doctor (Grammar Correction)
  app.post("/api/correct", async (req, res) => {
    try {
      const { text } = req.body;
      if (!text) return res.status(400).json({ error: "Text is required" });

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `أنت "دكتور المسلسلات"، طبيب لغوي متخصص في تصحيح الأخطاء الإملائية والنحوية للغة العربية في دردشات المسلسلات. قم بتصحيح النص التالي بحيث يكون دقيقاً وسليماً لغوياً. أعد النص المصحح فقط بدون أي مقدمات أو إضافات أو اقتباسات: "${text}"`;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: prompt,
      });

      res.json({ corrected: response.text?.trim() });
    } catch (error) {
      console.error("Gemini API Error:", error);
      res.status(500).json({ error: "Failed to correct text" });
    }
  });

  // API Route to extract clean video player embeds from 3iskk
  app.get("/api/get-episode-embed", async (req, res) => {
    try {
      const watchUrl = req.query.url as string;
      if (!watchUrl) return res.status(400).json({ error: "URL is required" });

      const mainUrl = watchUrl.replace(/\/see\/?$/, '/');
      const response = await fetch(mainUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
        }
      });
      const html1 = await response.text();
      
      const postidMatch = html1.match(/postid-(\d+)/) || html1.match(/comment_post_ID['\"]?\s+value=['\"]?(\d+)/);
      if (!postidMatch) {
        return res.json({ 
          success: false, 
          message: "Failed to extract post ID",
          servers: [{ name: "سيرفر رئيسي", url: watchUrl }]
        });
      }
      
      const postId = postidMatch[1];
      const servers = [];
      
      for (let serverNum = 1; serverNum <= 3; serverNum++) {
        servers.push({
          name: `سيرفر ${serverNum}`,
          url: `https://3iskk.xyz/embed/${serverNum}/${postId}/2/`
        });
      }

      res.json({ success: true, servers });
    } catch (error) {
      console.error("Scraper API Error:", error);
      res.status(500).json({ error: "Failed to scrape embed URLs" });
    }
  });
  
  // API Route to proxy embed player HTML with a forged Referer and rewrite all absolute URLs
  app.get("/api/proxy-embed", async (req, res) => {
    try {
      const embedUrl = req.query.url as string;
      if (!embedUrl) return res.status(400).send("URL is required");

      const refererParam = req.query.referer as string;
      const targetUrlObj = new URL(embedUrl);
      const targetOrigin = targetUrlObj.origin;

      let refererToUse = refererParam;
      const lowerEmbedUrl = embedUrl.toLowerCase();
      
      const is3iskTarget = DOMAINS_TO_PROXY.some(d => lowerEmbedUrl.includes(d));

      if (is3iskTarget) {
        if (!refererToUse || !refererToUse.includes("3iskk.xyz")) {
          refererToUse = "https://3iskk.xyz/";
        }
      } else {
        if (!refererToUse) {
          refererToUse = targetOrigin + "/";
        }
      }

      const response = await fetch(embedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
          'Referer': refererToUse
        }
      });

      if (!response.ok) {
        return res.status(response.status).send(`Failed to fetch from host: ${response.statusText}`);
      }

      let html = await response.text();

      // 1. Rewrite any absolute secure/insecure links to miravd, mwdy, grzcdn, etc. through our server proxy using a dynamic subdomain matcher
      const domainRegex = /(https?:)?\/\/([a-zA-Z0-9-._]+)\//gi;
      html = html.replace(domainRegex, (match, protocol, domain) => {
        const lowerDomain = domain.toLowerCase();
        const shouldProxy = DOMAINS_TO_PROXY.some(d => lowerDomain === d || lowerDomain.endsWith("." + d));
        if (shouldProxy) {
          return `/api/proxy-resource/https/${lowerDomain}/`;
        }
        return match;
      });

      // 2. Set a base tag so relative assets in iframe load through our proxy
      const hostClean = targetUrlObj.hostname;
      const baseTag = `<base href="/api/proxy-resource/https/${hostClean}/">`;
      if (html.includes("<head>")) {
        html = html.replace("<head>", `<head>${baseTag}${CLIENT_INJECT_SCRIPT}`);
      } else if (html.includes("<HEAD>")) {
        html = html.replace("<HEAD>", `<HEAD>${baseTag}${CLIENT_INJECT_SCRIPT}`);
      } else {
        html = baseTag + CLIENT_INJECT_SCRIPT + html;
      }

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(html);
    } catch (error) {
      console.error("Proxy Embed Error:", error);
      res.status(500).send("Internal Server Error");
    }
  });

  // API Route to proxy any subresource (JS, CSS, HLS stream keys, TS segments, video files) with Referer and Origin spoofing
  app.all("/api/proxy-resource/:proto/:host/*", async (req, res) => {
    try {
      const { proto, host } = req.params;
      const prefix = `/api/proxy-resource/${proto}/${host}`;
      
      let cleanPath = "";
      if (req.url.includes(prefix)) {
        cleanPath = req.url.substring(req.url.indexOf(prefix) + prefix.length);
      } else {
        cleanPath = req.params[0] ? `/${req.params[0]}` : "/";
        if (req.url.includes("?")) {
          cleanPath += req.url.substring(req.url.indexOf("?"));
        }
      }

      if (!cleanPath.startsWith("/")) {
        cleanPath = "/" + cleanPath;
      }

      const targetUrl = `${proto}://${host}${cleanPath}`;

      const lowerHost = host.toLowerCase();
      let referer = `${proto}://${host}/`;
      let origin = `${proto}://${host}`;

      const isDomainToProxy = DOMAINS_TO_PROXY.some(d => lowerHost === d || lowerHost.endsWith("." + d));

      // 1. Determine dynamic Referer and Origin based on how the browser requested it
      const clientReferer = req.headers.referer;
      let hasDynamicReferer = false;

      if (clientReferer) {
        try {
          const clientRefererUrl = new URL(clientReferer);
          // Case 1: Browser requested this within a proxy-embed iframe
          if (clientRefererUrl.pathname.includes("/api/proxy-embed")) {
            const originalEmbedUrl = clientRefererUrl.searchParams.get("url");
            if (originalEmbedUrl) {
              referer = originalEmbedUrl;
              const origUrlObj = new URL(originalEmbedUrl);
              origin = origUrlObj.origin;
              hasDynamicReferer = true;
            }
          }
          // Case 2: Browser requested this within a previously proxied resource (e.g. miravd loading JS/CSS/M3U8/TS)
          else if (clientRefererUrl.pathname.includes("/api/proxy-resource")) {
            const parts = clientRefererUrl.pathname.split("/api/proxy-resource/");
            if (parts.length > 1) {
              const resourcePath = parts[1];
              const pathParts = resourcePath.split("/");
              if (pathParts.length >= 2) {
                const refProto = pathParts[0];
                const refHost = pathParts[1];
                const refCleanPath = "/" + pathParts.slice(2).join("/");
                const refSearch = clientRefererUrl.search || "";
                referer = `${refProto}://${refHost}${refCleanPath}${refSearch}`;
                origin = `${refProto}://${refHost}`;
                hasDynamicReferer = true;
              }
            }
          }
        } catch (err) {
          console.error("Error parsing client referer:", err);
        }
      }

      // 2. Fallback to default spoofing if no dynamic Referer could be parsed
      if (!hasDynamicReferer) {
        if (isDomainToProxy) {
          referer = 'https://3iskk.xyz/';
          origin = 'https://3iskk.xyz';
        } else {
          referer = `${proto}://${host}/`;
          origin = `${proto}://${host}`;
        }
      }

      const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        'Referer': referer,
        'Origin': origin
      };

      // Forward client's headers if they exist (especially Range for video buffers)
      const headersToForward = ["range", "accept", "accept-language", "cookie", "content-type"];
      for (const h of headersToForward) {
        if (req.headers[h]) {
          headers[h] = req.headers[h] as string;
        }
      }

      // Forward request body for POST/PUT/PATCH requests
      let body: any = undefined;
      if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
        if (req.body) {
          if (typeof req.body === "string" || Buffer.isBuffer(req.body)) {
            body = req.body;
          } else if (Object.keys(req.body).length > 0) {
            const contentType = req.headers["content-type"] || "";
            if (contentType.includes("application/json")) {
              body = JSON.stringify(req.body);
            } else {
              const params = new URLSearchParams();
              for (const [key, val] of Object.entries(req.body)) {
                params.append(key, String(val));
              }
              body = params.toString();
            }
          }
        }
      }

      const response = await fetch(targetUrl, {
        method: req.method,
        headers,
        body
      });

      // Set target status code (crucial for 206 Partial Content video buffering!)
      res.status(response.status);

      // Copy response headers
      const headersToCopy = [
        "content-type",
        "content-length",
        "content-range",
        "accept-ranges",
        "cache-control",
        "etag"
      ];
      for (const h of headersToCopy) {
        const val = response.headers.get(h);
        if (val) {
          res.setHeader(h, val);
        }
      }

      // Set broad CORS headers to completely avoid cross-origin blocks
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE");
      res.setHeader("Access-Control-Allow-Headers", "*");

      const resContentType = response.headers.get("content-type") || "";
      const isM3U8 = cleanPath.toLowerCase().includes(".m3u8") || resContentType.includes("mpegurl") || resContentType.includes("apple.mpegurl");

      // For binary files (images, audio, video TS segments, stream keys, etc.)
      const isBinary = !isM3U8 && (
        resContentType.includes("image") || 
        resContentType.includes("video") || 
        resContentType.includes("octet-stream") ||
        cleanPath.toLowerCase().includes(".key") ||
        cleanPath.toLowerCase().includes(".ts")
      );

      if (isBinary) {
        if (response.body) {
          Readable.fromWeb(response.body as any).pipe(res);
        } else {
          res.end();
        }
      } else {
        let text = await response.text();

        if (isM3U8) {
          text = resolveM3U8RelativeUrls(text, targetUrl);
        }

        // Rewrite relative and absolute urls inside HTML/JS/M3U8 responses to redirect them back to our secure proxy
        if (resContentType.includes("text/html") || resContentType.includes("javascript") || isM3U8 || cleanPath.endsWith(".js") || cleanPath.endsWith(".css")) {
          const domainRegex = /(https?:)?\/\/([a-zA-Z0-9-._]+)\//gi;
          text = text.replace(domainRegex, (match, protocol, domain) => {
            const lowerDomain = domain.toLowerCase();
            const shouldProxy = DOMAINS_TO_PROXY.some(d => lowerDomain === d || lowerDomain.endsWith("." + d));
            if (shouldProxy) {
              return `/api/proxy-resource/https/${lowerDomain}/`;
            }
            return match;
          });

          // Inject base tag & CLIENT_INJECT_SCRIPT inside HTML responses
          if (resContentType.includes("text/html")) {
            const baseTag = `<base href="/api/proxy-resource/${proto}/${host}/">`;
            if (text.includes("<head>")) {
              text = text.replace("<head>", `<head>${baseTag}${CLIENT_INJECT_SCRIPT}`);
            } else if (text.includes("<HEAD>")) {
              text = text.replace("<HEAD>", `<HEAD>${baseTag}${CLIENT_INJECT_SCRIPT}`);
            } else {
              text = baseTag + CLIENT_INJECT_SCRIPT + text;
            }
          }
        }

        res.send(text);
      }
    } catch (error) {
      console.error("Proxy Resource Error:", error);
      res.status(500).send("Internal Server Error");
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // For Express 4
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

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
        try {
          const embedUrl = `https://3iskk.xyz/embed/${serverNum}/${postId}/2/`;
          const embedRes = await fetch(embedUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
              'Referer': mainUrl
            }
          });
          const embedHtml = await embedRes.text();
          const finalUrlMatch = embedHtml.match(/https?:\/\/[^\s\"'>]+embed[^\s\"'>]+/i);
          if (finalUrlMatch) {
            servers.push({
              name: `سيرفر ${serverNum}`,
              url: finalUrlMatch[0]
            });
          }
        } catch (err) {
          console.error(`Error scraping server ${serverNum}:`, err);
        }
      }

      if (servers.length === 0) {
        return res.json({
          success: false,
          servers: [{ name: "سيرفر رئيسي", url: watchUrl }]
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

      const targetUrlObj = new URL(embedUrl);
      const origin = targetUrlObj.origin;

      const response = await fetch(embedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
          'Referer': 'https://3iskk.xyz/'
        }
      });

      if (!response.ok) {
        return res.status(response.status).send(`Failed to fetch from host: ${response.statusText}`);
      }

      let html = await response.text();

      // 1. Rewrite any absolute secure/insecure links to miravd, mwdy, grzcdn, etc. through our server proxy
      const domainsToProxy = ["miravd.com", "cdn.miravd.com", "miravid.club", "mwdy.cc", "arthur.grzcdn.com", "alexa.grzcdn.com", "llvpn.com"];
      for (const d of domainsToProxy) {
        html = html.replaceAll(`https://${d}/`, `/api/proxy-resource/https/${d}/`);
        html = html.replaceAll(`http://${d}/`, `/api/proxy-resource/http/${d}/`);
        html = html.replaceAll(`//${d}/`, `/api/proxy-resource/https/${d}/`);
      }

      // 2. Set a base tag so relative assets in iframe load through our proxy
      const hostClean = targetUrlObj.hostname;
      const baseTag = `<base href="/api/proxy-resource/https/${hostClean}/">`;
      if (html.includes("<head>")) {
        html = html.replace("<head>", `<head>${baseTag}`);
      } else if (html.includes("<HEAD>")) {
        html = html.replace("<HEAD>", `<HEAD>${baseTag}`);
      } else {
        html = baseTag + html;
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

      const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        'Referer': 'https://3iskk.xyz/',
        'Origin': 'https://3iskk.xyz'
      };

      // Forward request headers if present
      if (req.headers["content-type"]) {
        headers["content-type"] = req.headers["content-type"];
      }
      if (req.headers["cookie"]) {
        headers["cookie"] = req.headers["cookie"] as string;
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

      // Forward response content-type
      const resContentType = response.headers.get("content-type");
      if (resContentType) {
        res.setHeader("Content-Type", resContentType);
      }

      // Set broad CORS headers to completely avoid cross-origin blocks
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE");
      res.setHeader("Access-Control-Allow-Headers", "*");

      // For binary files (images, audio, video TS segments, stream keys, etc.)
      const isBinary = resContentType && (
        resContentType.includes("image") || 
        resContentType.includes("video") || 
        resContentType.includes("octet-stream") ||
        cleanPath.endsWith(".key") ||
        cleanPath.endsWith(".ts")
      );

      if (isBinary) {
        const arrayBuffer = await response.arrayBuffer();
        res.status(response.status).send(Buffer.from(arrayBuffer));
      } else {
        let text = await response.text();

        // Rewrite relative and absolute urls inside HTML/JS responses to redirect them back to our secure proxy
        if (resContentType && (resContentType.includes("text/html") || resContentType.includes("javascript") || resContentType.includes("application/x-mpegURL") || cleanPath.endsWith(".m3u8"))) {
          const domainsToProxy = ["miravd.com", "cdn.miravd.com", "miravid.club", "mwdy.cc", "arthur.grzcdn.com", "alexa.grzcdn.com", "llvpn.com"];
          for (const d of domainsToProxy) {
            text = text.replaceAll(`https://${d}/`, `/api/proxy-resource/https/${d}/`);
            text = text.replaceAll(`http://${d}/`, `/api/proxy-resource/http/${d}/`);
            text = text.replaceAll(`//${d}/`, `/api/proxy-resource/https/${d}/`);
          }
        }

        res.status(response.status).send(text);
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

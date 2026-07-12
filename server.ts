import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

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
  
  // API Route to proxy embed player HTML with a forged Referer to bypass anti-embedding
  app.get("/api/proxy-embed", async (req, res) => {
    try {
      const embedUrl = req.query.url as string;
      if (!embedUrl) return res.status(400).send("URL is required");

      const targetUrl = new URL(embedUrl);
      const origin = targetUrl.origin;

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

      // Inject base href inside head so all relative assets (js, css, images, hls) load relative to the player host
      const baseTag = `<base href="${origin}/">`;
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

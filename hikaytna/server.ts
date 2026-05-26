import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import OpenAI from "openai";
import fs from "fs";

// SIMPLE XOR ENCRYPTION FOR WIRE DATA
const SECRET_SALT = "SERIES_APP_2024";

function encryptValue(text: string): string {
  if (!text) return "";
  const key = SECRET_SALT;
  let result = Buffer.alloc(text.length);
  for (let i = 0; i < text.length; i++) {
    result[i] = text.charCodeAt(i) ^ key.charCodeAt(i % key.length);
  }
  return result.toString("base64");
}

function decryptValue(encoded: string): string {
  if (!encoded) return "";
  try {
    const buf = Buffer.from(encoded, "base64");
    const key = SECRET_SALT;
    let result = "";
    for (let i = 0; i < buf.length; i++) {
      result += String.fromCharCode(buf[i] ^ key.charCodeAt(i % key.length));
    }
    return result;
  } catch (e) {
    return encoded;
  }
}

// ============ DeepSeek Speed Configuration ============
const BASE_URL = "https://aiapiv2.pekpik.com/v1";
const MODEL = "deepseek-chat";
const GITHUB_KEYS_URL = "https://raw.githubusercontent.com/alistaitsacle/free-llm-api-keys/main/README.md";

// Start with bootstrap keys as fallback
let API_KEYS: string[] = [
  "sk-nM0nCjJSui0VOGjTTKZShevoZkywpvUVfXzrNoiZB5ZUGIJT",
  "sk-M0rtthOXpqxnioe9zXwQcpE73DJaCBzq1ECJQrkwN0TuXam8"
];
let currentIdx = 0;
const WORKING_KEY_CACHE = new Map<number, number>();

// Fetch keys with same regex as provided site
async function fetchKeys() {
  try {
    console.log("⚡ جاري سحب مفاتيح جديدة من المصدر...");
    const res = await axios.get(GITHUB_KEYS_URL, { 
      headers: { 'Cache-Control': 'no-cache' },
      timeout: 5000 
    });
    const text = res.data;
    const keys: string[] = [];
    
    // Pattern match standard deepseek keys
    const regex = /(sk-[a-zA-Z0-9]{44,50})/g;
    let m;
    while ((m = regex.exec(text)) !== null) {
      if (!keys.includes(m[1])) keys.push(m[1]);
    }
    
    if (keys.length > 0) {
      // Append new keys to our bootstrap keys (avoiding duplicates)
      const uniqueNewKeys = keys.filter(k => !API_KEYS.includes(k));
      API_KEYS = [...API_KEYS, ...uniqueNewKeys];
      console.log(`⚡ حكيم: تم سحب ${keys.length} مفتاح (إجمالي المتاح: ${API_KEYS.length})`);
      return true;
    }
    console.warn("⚠️ حكيم: لم يتم العثور على مفاتيح جديدة في الملف.");
    return false;
  } catch (e: any) {
    console.error("❌ حكيم: خطأ في سحب المفاتيح من GitHub:", e.message);
    return false;
  }
}

// Ultra-fast API caller with optimized speed settings
async function callDeepSeek(msg: string, systemPrompt: string, history: any[], keyIdx: number) {
  if (keyIdx >= API_KEYS.length) return { ok: false, error: "No key found at index" };
  const key = API_KEYS[keyIdx];
  
  try {
    const messages = [
      { role: "system", content: systemPrompt || "أجب بإيجاز وسرعة فائقة. لا تقدم مقدمات. ادخل في صلب الموضوع فوراً." },
      ...history.map((m: any) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.text
      })),
      { role: "user", content: msg }
    ];

    const res = await axios.post(`${BASE_URL}/chat/completions`, {
      model: MODEL,
      messages,
      temperature: 0.5, // Lower temperature for more stable and faster response
      max_tokens: 500,  // Fast generation limit
      stream: false
    }, {
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`,
        "Connection": "keep-alive"
      },
      timeout: 7000 // Ultra-fast fail (7s) to rotate keys rapidly
    });

    const reply = res.data.choices?.[0]?.message?.content;
    if (!reply) throw new Error("استلمت رداً فارغاً");
    
    WORKING_KEY_CACHE.set(keyIdx, Date.now());
    return { ok: true, reply };
  } catch (e: any) {
    const errorMsg = e.response?.data?.error?.message || e.message;
    WORKING_KEY_CACHE.delete(keyIdx);
    return { ok: false, error: errorMsg };
  }
}

// Refined Rotation Engine
async function smartChat(msg: string, systemPrompt: string, history: any[]) {
  // If we have very few keys, try fetching anyway
  if (API_KEYS.length < 5) await fetchKeys();

  // 1. Try cached working keys first (most reliable)
  for (const [idx, ts] of WORKING_KEY_CACHE) {
    if (Date.now() - ts < 600000 && idx < API_KEYS.length) {
      const r = await callDeepSeek(msg, systemPrompt, history, idx);
      if (r.ok) { currentIdx = idx; return r; }
    }
  }

  // 2. Sequential rotation logic
  const totalKeys = API_KEYS.length;
  for (let i = 0; i < totalKeys; i++) {
    const idx = (currentIdx + i) % totalKeys;
    const r = await callDeepSeek(msg, systemPrompt, history, idx);
    if (r.ok) { 
      currentIdx = idx; 
      return r; 
    }
  }

  // 3. Fallback: Force refresh keys and try one last time
  console.log("🔄 حكيم: نفدت جميع الخيارات، جاري محاولة تحديث القائمة مرة أخيرة...");
  const refreshed = await fetchKeys();
  if (refreshed && API_KEYS.length > totalKeys) {
    // Only try the *newly added* keys to save time
    for (let i = totalKeys; i < API_KEYS.length; i++) {
      const r = await callDeepSeek(msg, systemPrompt, history, i);
      if (r.ok) { currentIdx = i; return r; }
    }
  }

  return { ok: false, reply: "يا عسسل! حالياً فيه ضغط خرافي على \"حكيم\"، جرّب مرة ثانية بعد ثواني وبكون معك وماراح أخيب ظنك! 🍿🚀" };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Prevent generic CORS "Failed to fetch" blocks in complex iframe previews
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, Content-Length, X-Requested-With");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  let API_BASE = process.env.EXTERNAL_API_BASE || 'https://series.albesriali03.workers.dev/';
  if (!API_BASE.startsWith('http://') && !API_BASE.startsWith('https://')) {
    API_BASE = 'https://series.albesriali03.workers.dev/';
  }

  // ============== In-Memory Caching System ==============
  const apiCache = new Map<string, { data: any; expiresAt: number }>();

  function getCachedData(key: string): any | null {
    const cached = apiCache.get(key);
    if (cached) {
      if (Date.now() < cached.expiresAt) {
        return cached.data;
      }
      apiCache.delete(key);
    }
    return null;
  }

  function setCachedData(key: string, data: any, durationMs: number) {
    if (apiCache.size > 800) {
      const firstKey = apiCache.keys().next().value;
      if (firstKey) apiCache.delete(firstKey);
    }
    apiCache.set(key, {
      data,
      expiresAt: Date.now() + durationMs
    });
  }
  // =======================================================

  // API Proxy Routes
  // 1. Categories
  app.get("/api/v1/categories", async (req, res) => {
    const cacheKey = "categories";
    const cached = getCachedData(cacheKey);
    if (cached) {
      return res.json(cached);
    }
    try {
      const response = await axios.get(`${API_BASE}?action=categories`);
      if (response.data && response.data.status) {
        setCachedData(cacheKey, response.data, 6 * 60 * 60 * 1000); // Cache for 6 hours
      }
      res.json(response.data);
    } catch (error: any) {
      console.error("DEBUG CATEGORIES ERROR:", error.message, error.stack);
      res.status(500).json({ status: false, message: "Server Error", error: error.message });
    }
  });

  // 2. Series by Category
  app.get("/api/v1/series", async (req, res) => {
    try {
      const { url } = req.query;
      if (!url) return res.status(400).json({ status: false });
      
      const realUrl = url as string;
      const cacheKey = `series:${realUrl}`;
      const cached = getCachedData(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      const response = await axios.get(`${API_BASE}?action=series&url=${encodeURIComponent(realUrl)}`);
      if (response.data && response.data.status) {
        setCachedData(cacheKey, response.data, 4 * 60 * 60 * 1000); // Cache for 4 hours
      }
      res.json(response.data);
    } catch (error) {
      res.status(500).json({ status: false });
    }
  });

  // 3. Episodes
  app.get("/api/v1/episodes", async (req, res) => {
    try {
      const { url } = req.query;
      if (!url) return res.status(400).json({ status: false });
      
      const realUrl = url as string;
      const cacheKey = `episodes:${realUrl}`;
      const cached = getCachedData(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      const response = await axios.get(`${API_BASE}?action=episodes&url=${encodeURIComponent(realUrl)}`);
      if (response.data && response.data.data) {
        response.data.data = response.data.data.map((ep: any) => ({
          ...ep,
          url: encryptValue(ep.url)
        }));
      }
      if (response.data && response.data.status) {
        setCachedData(cacheKey, response.data, 2 * 60 * 60 * 1000); // Cache for 2 hours
      }
      res.json(response.data);
    } catch (error) {
      res.status(500).json({ status: false });
    }
  });

  // 4. Play URL
  app.get("/api/v1/play", async (req, res) => {
    try {
      const { url } = req.query;
      if (!url) return res.status(400).json({ status: false });
      
      const realUrl = decryptValue(url as string) || (url as string);
      const cacheKey = `play:${realUrl}`;
      const cached = getCachedData(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      const response = await axios.get(`${API_BASE}?action=play&url=${encodeURIComponent(realUrl)}`);
      if (response.data && response.data.player_url) {
        response.data.player_url = encryptValue(response.data.player_url);
      }
      if (response.data && response.data.status) {
        setCachedData(cacheKey, response.data, 1 * 60 * 60 * 1000); // Cache for 1 hour
      }
      res.json(response.data);
    } catch (error) {
      res.status(500).json({ status: false });
    }
  });

  // 4.1. Image Proxy to bypass hotlink and domain protections on API images
  app.get("/api/v1/image-proxy", async (req, res) => {
    try {
      const { url } = req.query;
      if (!url) return res.status(400).send("Missing URL parameter");
      
      const targetUrl = decodeURIComponent(url as string);
      if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        return res.status(400).send("Invalid target URL");
      }

      // Extract the original host of the image to set as Referer if needed
      const hostVal = new URL(targetUrl).origin;

      const response = await axios({
        method: 'get',
        url: targetUrl,
        responseType: 'stream',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
          'Referer': hostVal + '/', // Dynamically use the origin of the target image as the Referer
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
        },
        timeout: 8000
      });

      const contentType = response.headers['content-type'];
      if (typeof contentType === 'string') {
        res.setHeader('Content-Type', contentType);
      }
      
      // Highly-scalable browser & CDN cache control (24 hours)
      res.setHeader('Cache-Control', 'public, max-age=86400');
      
      response.data.pipe(res);
    } catch (error: any) {
      console.warn("Image proxy error for URL:", req.query.url, error.message);
      res.status(500).send("Failed to load image resource");
    }
  });

  // 4.5. Secured Iframe Player Proxy (Hides URLs from Network Tab)
  app.get("/api/v1/secured-player/:encryptedUrl", (req, res) => {
    try {
      const encrypted = req.params.encryptedUrl;
      const url = decryptValue(encrypted);
      if (!url) return res.status(400).send("Invalid stream source.");
      
      // Serve a barebones HTML page that loads the third-party iframe
      // This completely hides the real URL from the parent app's Network tab!
      res.send(`
        <!DOCTYPE html>
        <html style="width:100%; height:100%; margin:0; padding:0; overflow:hidden; background:black;">
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
            <meta name="referrer" content="no-referrer">
            <title>Secured Player</title>
            <style>
              body { margin: 0; padding: 0; background: #000; overflow: hidden; width: 100vw; height: 100vh; }
              iframe { width: 100%; height: 100%; border: none; outline: none; }
            </style>
        </head>
        <body oncontextmenu="return false;">
            <iframe src="${url}" allowfullscreen allow="autoplay; encrypted-media; picture-in-picture"></iframe>
        </body>
        </html>
      `);
    } catch {
      res.status(400).send("Player error");
    }
  });

  // 4.6. Secure Stream Proxy (Absolute Protection against sniffers)
  app.get("/api/v1/stream-proxy/:encryptedUrl", (req, res) => {
    try {
      // Basic protection against hotlinking proxy URL
      const reqReferer = req.headers.referer || req.headers.origin || '';
      const reqHost = req.headers.host || '';
      if (reqReferer && !reqReferer.includes(reqHost)) {
         return res.status(403).send("Streaming not allowed from this origin");
      }

      const encrypted = req.params.encryptedUrl;
      const url = decryptValue(decodeURIComponent(encrypted));
      if (!url || !url.startsWith("http")) return res.status(400).send("Invalid stream source.");

      const parsedUrl = new URL(url);
      const client = parsedUrl.protocol === 'https:' ? require('https') : require('http');
      
      const options: any = {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
          'Referer': parsedUrl.origin,
          'Origin': parsedUrl.origin
        }
      };
      
      if (req.headers.range) {
        options.headers.range = req.headers.range;
      }

      const proxyReq = client.get(url, options, (proxyRes: any) => {
        const contentType = proxyRes.headers['content-type'] || '';
        const isM3u8 = url.includes('.m3u8') || contentType.includes('mpegurl');
        
        if (isM3u8) {
           let body = '';
           proxyRes.on('data', (chunk: Buffer) => body += chunk.toString('utf-8'));
           proxyRes.on('end', () => {
              const lines = body.split('\n');
              const rewritten = lines.map(line => {
                 let s = line.trim();
                 if (!s || s.startsWith('#')) return line; // comments / tags
                 try {
                     let chunkUrl = s;
                     // Resolve relative paths securely
                     if (!chunkUrl.startsWith('http')) {
                        chunkUrl = new URL(chunkUrl, url).toString();
                     }
                     const enc = encodeURIComponent(encryptValue(chunkUrl));
                     return `/api/v1/stream-proxy/${enc}`;
                 } catch {
                     return line;
                 }
              }).join('\n');
              
              res.status(proxyRes.statusCode || 200);
              res.setHeader('Content-Type', contentType || 'application/vnd.apple.mpegurl');
              // Ensure we don't send original content length since we rewrote payload
              if (proxyRes.headers['cache-control']) res.setHeader('Cache-Control', proxyRes.headers['cache-control']);
              res.send(rewritten);
           });
        } else {
           res.status(proxyRes.statusCode || 200);
           Object.keys(proxyRes.headers).forEach(key => {
             const keyLower = key.toLowerCase();
             // Important: Forward headers, skip things that break pipe
             if (keyLower !== 'host' && keyLower !== 'connection') {
                res.setHeader(key, proxyRes.headers[key] as string);
             }
           });
           proxyRes.pipe(res);
        }
      });

      proxyReq.on('error', (e: any) => {
        if (!res.headersSent) res.status(500).send("Stream proxy failed");
      });
      req.on('close', () => {
         proxyReq.destroy(); // Cancel real request if client disconnects early
      });
    } catch (e) {
      if (!res.headersSent) res.status(500).send("Stream proxy error");
    }
  });

  // 4.7. Absolute VAST XML Resolver to Bypass CORS and secure earnings
  app.get("/api/v1/resolve-vast", async (req, res) => {
    try {
      const { url } = req.query;
      if (!url) return res.status(400).json({ error: "Missing URL parameter" });

      const targetUrl = url as string;
      console.log("⚡ [VAST Resolver] Resolving:", targetUrl);

      const response = await axios.get(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
          'Accept': 'text/xml,application/xml,application/xhtml+xml,text/html;q=0.9,*/*;q=0.8'
        },
        timeout: 10000
      });

      const xmlText = response.data;
      if (typeof xmlText !== 'string') {
        return res.json({ status: false, message: "Response is not a string", originalUrl: targetUrl });
      }

      // Check if it's actually XML/VAST
      const cleanText = xmlText.trim();
      const isXml = cleanText.startsWith('<') || cleanText.includes('<VAST');
      if (!isXml) {
        return res.json({ 
          status: false, 
          message: "Response is not VAST XML", 
          clickThrough: targetUrl, 
          impressionUrls: [], 
          trackingUrls: [] 
        });
      }

      // 1. Extract ClickThrough
      const clickThroughRegex = /<ClickThrough>([\s\S]*?)<\/ClickThrough>/i;
      const clickThroughMatch = xmlText.match(clickThroughRegex);
      let clickThrough = clickThroughMatch ? clickThroughMatch[1].trim() : targetUrl;

      // Clean CDATA wrapping if any
      if (clickThrough.includes('<![CDATA[')) {
        const cdataMatch = clickThrough.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
        if (cdataMatch) {
          clickThrough = cdataMatch[1].trim();
        }
      }

      // 2. Extract Impression URLs
      const impressionUrls: string[] = [];
      const impressionRegex = /<Impression>([\s\S]*?)<\/Impression>/gi;
      let match;
      while ((match = impressionRegex.exec(xmlText)) !== null) {
        let impUrl = match[1].trim();
        if (impUrl.includes('<![CDATA[')) {
          const cdataM = impUrl.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
          if (cdataM) {
            impUrl = cdataM[1].trim();
          }
        }
        if (impUrl && !impressionUrls.includes(impUrl)) {
          impressionUrls.push(impUrl);
        }
      }

      // 3. Extract Tracking URLs
      const trackingUrls: string[] = [];
      const trackingRegex = /<Tracking[^>]*>([\s\S]*?)<\/Tracking>/gi;
      while ((match = trackingRegex.exec(xmlText)) !== null) {
        let trackUrl = match[1].trim();
        if (trackUrl.includes('<![CDATA[')) {
          const cdataM = trackUrl.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
          if (cdataM) {
            trackUrl = cdataM[1].trim();
          }
        }
        if (trackUrl && !trackingUrls.includes(trackUrl)) {
          trackingUrls.push(trackUrl);
        }
      }

      // 4. Extract MediaFiles if present
      const mediaFiles: string[] = [];
      const mediaFileRegex = /<MediaFile[^>]*>([\s\S]*?)<\/MediaFile>/gi;
      while ((match = mediaFileRegex.exec(xmlText)) !== null) {
        let mediaUrl = match[1].trim();
        if (mediaUrl.includes('<![CDATA[')) {
          const cdataM = mediaUrl.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
          if (cdataM) {
            mediaUrl = cdataM[1].trim();
          }
        }
        if (mediaUrl && !mediaFiles.includes(mediaUrl)) {
          mediaFiles.push(mediaUrl);
        }
      }

      return res.json({
        status: true,
        clickThrough: clickThrough || targetUrl,
        impressionUrls,
        trackingUrls,
        mediaFiles,
        originalUrl: targetUrl
      });
    } catch (e: any) {
      console.error("❌ [VAST Resolver Error]:", e.message);
      return res.json({
        status: false,
        message: e.message,
        clickThrough: req.query.url as string || "https://tiny-ambition.com",
        impressionUrls: [],
        trackingUrls: []
      });
    }
  });

  // ============ Professional Real-User Referral tracking system ============
  const REFERRALS_FILE = path.join(process.cwd(), "referrals_db.json");

  // Helper to load referrals database
  function loadReferrals() {
    try {
      if (fs.existsSync(REFERRALS_FILE)) {
        const data = fs.readFileSync(REFERRALS_FILE, "utf-8");
        const parsed = JSON.parse(data);
        parsed.visitedIPs = parsed.visitedIPs || [];
        parsed.referrers = parsed.referrers || {};
        parsed.users = parsed.users || {};
        return parsed;
      }
    } catch (e) {
      console.error("Error reading referrals file:", e);
    }
    return { visitedIPs: [], referrers: {}, users: {} };
  }

  // Helper to save referrals database
  function saveReferrals(data: any) {
    try {
      data.visitedIPs = data.visitedIPs || [];
      data.referrers = data.referrers || {};
      data.users = data.users || {};
      fs.writeFileSync(REFERRALS_FILE, JSON.stringify(data, null, 2), "utf-8");
    } catch (e) {
      console.error("Error writing referrals file:", e);
    }
  }

  // Endpoint to register referrer mapping to username
  app.post("/api/v1/referral/register-user", (req, res) => {
    try {
      const { referrerId, username } = req.body;
      if (!referrerId || !username) {
        return res.status(400).json({ status: false, message: "Missing params" });
      }
      const db = loadReferrals();
      db.users[referrerId.trim()] = username.trim();
      saveReferrals(db);
      return res.json({ status: true, message: "Referrer profile mapped successfully." });
    } catch (e) {
      console.error("Error in register-user:", e);
      return res.status(500).json({ status: false });
    }
  });

  // Endpoint to lookup referrer username
  app.get("/api/v1/referral/lookup", (req, res) => {
    try {
      const { id } = req.query;
      if (!id || typeof id !== "string") {
        return res.status(400).json({ status: false, message: "Missing id" });
      }
      const db = loadReferrals();
      const username = db.users[id.trim()] || null;
      return res.json({ status: true, username });
    } catch (e) {
      console.error("Error in lookup:", e);
      return res.status(500).json({ status: false });
    }
  });

  // Endpoint to record a valid real-person referral click
  app.post("/api/v1/referral/register", (req, res) => {
    try {
      const { referrerId } = req.body;
      if (!referrerId || typeof referrerId !== "string" || !referrerId.trim()) {
        return res.status(400).json({ status: false, message: "كود الإحالة مفقود" });
      }

      // 1. User Agent Bot detection to guarantee only real people
      const userAgent = req.headers["user-agent"] || "";
      const isBot = /bot|spider|crawl|lighthouse|chrome-lighthouse|googlebot|yahoo|bing|baidu|msnbot/i.test(userAgent);
      if (isBot) {
        return res.status(400).json({ status: false, message: "غير مسموح بحركات المرور الوهمية أو الروبوتات." });
      }

      // 2. Real Client IP extraction
      let clientIp = (req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || "").split(",")[0].trim();
      
      const db = loadReferrals();

      if (!Array.isArray(db.visitedIPs)) {
        db.visitedIPs = [];
      }
      if (!db.referrers) {
        db.referrers = {};
      }

      // Check if this visitor's IP has already clicked a referral before to avoid spamming
      const isLocalhost = clientIp === "127.0.0.1" || clientIp === "::1" || clientIp === "::ffff:127.0.0.1" || !clientIp;
      
      if (!isLocalhost && db.visitedIPs.includes(clientIp)) {
        console.log(`[Referral Denied] Duplicate IP ${clientIp} for ${referrerId}`);
        return res.json({ 
          status: false, 
          message: "عذراً! تم احتساب إحالتك من هذا الجهاز مسبقاً لمنع التلاعب بالنظام.", 
          points: db.referrers[referrerId.trim()] || 0 
        });
      }

      // Save visited IP to prevent self-fraud/multiple entries from same user
      if (!isLocalhost) {
        db.visitedIPs.push(clientIp);
      }

      // Increment points
      const cleanedRefId = referrerId.trim();
      const currentPoints = db.referrers[cleanedRefId] || 0;
      const newPoints = currentPoints + 1;
      db.referrers[cleanedRefId] = newPoints;

      saveReferrals(db);

      console.log(`[Referral Approved] IP: ${clientIp} rewarded +1 to ${cleanedRefId}. Points is now: ${newPoints}`);
      return res.json({ 
        status: true, 
        message: "تهانينا! تم التحقق من الزيارة كشخص حقيقي واحتساب نقطة جديدة للحساب.", 
        points: newPoints 
      });

    } catch (err) {
      console.error("Error registering referral:", err);
      res.status(500).json({ status: false, message: "Internal server error" });
    }
  });

  // Endpoint to obtain point totals for a given referrer ID
  app.get("/api/v1/referral/points", (req, res) => {
    try {
      const { id } = req.query;
      if (!id || typeof id !== "string") {
        return res.status(400).json({ status: false, message: "معرف المستخدم مفقود" });
      }
      
      const db = loadReferrals();
      const cleanedId = id.trim();
      const points = db.referrers?.[cleanedId] || 0;
      
      return res.json({ status: true, points });
    } catch (err) {
      console.error("Error reading points:", err);
      res.status(500).json({ status: false, message: "Internal server error" });
    }
  });

  // 5. Smart AI Assistant Chat with protection
  app.post("/api/v1/ai/chat", async (req, res) => {
    // Simple basic rate limiting per IP (very loose)
    const clientIp = (req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || "").split(",")[0].trim();
    const now = Date.now();
    
    // Check for spammers in a dedicated small cache
    const lastRequest = apiCache.get(`ratelimit:${clientIp}`)?.expiresAt || 0;
    if (now < lastRequest) {
      return res.status(429).json({ status: false, error: "تم تجاوز حد الطلبات السريعة. خذ نفساً عميقاً وجرب مجدداً! 🌬️" });
    }
    // Set 2s cooldown
    apiCache.set(`ratelimit:${clientIp}`, { data: true, expiresAt: now + 2000 });

    try {
      const { message, history = [], seriesList = [] } = req.body;
      if (!message) return res.status(400).json({ status: false, error: "المحتوى فارغ" });

      // Prepare context about available series
      const seriesContext = seriesList.length > 0
        ? `المسلسلات والأفلام المتوفرة لدينا حالياً على منصة "حكايتنا" هي:\n` + 
          seriesList.map((s: any, idx: number) => `${idx + 1}. الاسم: "${s.title}"، التصنيف أو القسم: "${s.category || 'غير محدد'}"، المعرف (ID) الخاص به للتنقل المباشر: "${s.id}"`).join('\n')
        : "لا توجد مسلسلات متوفرة حالياً بالمنصة.";

      const systemInstruction = `أنت "حكيم" (Hakeem)، ومساعد الذكاء الاصطناعي وخبير الدراما ومستشار المشاهد العربي على منصة "حكايتنا" لمشاهدة المسلسلات والأفلام (التركية، العربية، الآسيوية، الكرتون وغيرها).
أنت لست مجرد بوت تقليدي، بل تتحدث وتتفاعل كإنسان حقيقي وعاشق مخلص ومتابع للمسلسلات! تسولف وتدردش مع المتابعين كأنك صديق مقرب يشاركهم شغف المشاهدة في نفس الغرفة وتعرف كل تفاصيل الأبطال واللقطات الشيّقة.

القواعد والمشاعر الذهبية للرد الفوري:
1. تحدث بتلقائية كاملة وشغف وحماس شديد مثل البشر وصديق مخلص (لا تتحدث برسمية جافة أبداً!).
2. إذا نسي المستخدم اسم أي مسلسل أو كرتون أو فيلم، وبدأ يصف لك تفاصيل عنه (مثل: "مسلسل عن واحد فقير واكتشف أنه ولد غني من عائلة غنية وانخطف وهو صغير" أو "بطل اسمه يمان وانخطف من عائلته" أو "مسلسل تركي فيه عائلتان متصارعتان" أو أي وصف عشوائي):
   - حلل الوصف بذكاء وبصيرة خارقة لتعرف فوراً ما هو المسلسل المقصود بناءً على القصة أو أسماء الأبطال أو التفاصيل التي ذكرها المتابع.
   - إذا كان هذا المسلسل متوفراً لدينا في المنصة (عبر مطابقة القصة مع قائمتنا المرفقة، مثلاً "المتوحش" لقصة يمان المخطوف، أو "طائر الرفراف" لعائلة كورهان، إلخ):
     * أبهره فوراً بذكائك الفائق وقل له بحماس شديد: "يا سلام عليك! هذا وربي مسلسل {اسم المسلسل}! القصة تشد الأنفاس وأحداثها أسطورية..."
     * ضع له فوراً رابط الانتقال السحري المباشر لمشاهدته بالتطبيق كالتالي: [شاهد مسلسل {اسم المسلسل} من هنا](navigate:{id})
   - إذا كان المسلسل المقصود مشهوراً جداً عالمياً ولكنه ليس في قائمتنا المرفقة حالياً:
     * قل له اسم المسلسل الحقيقي وتفاصيله وقصته بسعادة لتثبت له أنك تفهمه وتعرف كل شيء.
     * اقترح عليه بأناقة مسلسلات مشابهة له تماماً ومتوفرة في قائمتنا، وشجعه على مشاهدتها بدلاً من ذلك مع وضع رابط الانتقال السحري لها.
3. تفاعل بقوة مع الكلمات والرموز العاطفية والمواقف واللقطات (مثال: إذا كتب المستخدم "حماس" أو "أسطوري" رد بحماس فائق: "يا ربااااه! الحلقة ذي نار وربي تشد الأعصاب من أول دقيقة! 🔥😱" وإذا عبّر عن حزن "😭💔" قل: "وربي اللقطة ذي تصيح وتقطع القلب، دمعت عيوني معهم! 😭💔" وإذا كتب "بطل" قل: "يستاااهل اللقب وربي أدائه أسطوري ويفوز! 👑😍").
4. استخدم باقة واسعة من الإيموجيات المعبّرة بالردود لتبدو شخصاً حقيقياً يدردش بحيوية (مثل: 🔥, 😂, 😍, 😭, 💔, 😱, 🙌, 👑).
5. استخدم لغة ممتعة، خفيفة وبسيطة وسهلة، وودية جداً تشعر المستخدم بالألفة الكاملة والأخوّة.
6. عندما يسألك عن قصة مسلسل أو أبطاله، أو تلمح فرصة، شجعه على مشاهدته فوراً بالتطبيق بوضع رابط الانتقال السحري المباشر كالتالي:
   [شاهد مسلسل {اسم المسلسل} من هنا](navigate:{id})
   مثل: [شاهد مسلسل المتوحش من هنا](navigate:al_mutawahish).
7. إذا طلب الانتقال أو التشغيل، اخبره بأناقة: "سأنتقل معك الآن فوراً! 🚀💨" وعليك تضمين صيغة الانتقال (navigate:{id}) في متن أو نهاية الرد.
8. لا ترشح أبداً أي مسلسل خارج قائمتنا الحالية للتشغيل الفوري، ومطابقة ذكية للمسميات العامية.

إليك قائمة المسلسلات المتوفرة على منصة حكايتنا لتطابقها بذكاء مع أوصاف وتفاصيل المستخدمين:
${seriesContext}`;

      const result = await smartChat(message, systemInstruction, history);

      res.json({
        status: true,
        text: result.reply || "عذراً، لم أستطع توليد رد في الوقت الحالي."
      });
    } catch (error: any) {
      console.error("AI Chat Route Error:", error);
      res.status(500).json({ status: false, error: error.message || "حدث خطأ بالاتصال بالذكاء الاصطناعي" });
    }
  });

  // Firebase Config with obfuscation
  app.get("/api/v1/config/firebase", (req, res) => {
    const config = {
      apiKey: process.env.FIREBASE_API_KEY || "AIzaSyAnYkOnP2XWfaKrXXvTO3Euq7s-pl9QGKg",
      authDomain: process.env.FIREBASE_AUTH_DOMAIN || "chat-516a8.firebaseapp.com",
      databaseURL: process.env.FIREBASE_DATABASE_URL || "https://chat-516a8-default-rtdb.firebaseio.com",
      projectId: process.env.FIREBASE_PROJECT_ID || "chat-516a8",
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "chat-516a8.firebasestorage.app",
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "276393305302",
      appId: process.env.FIREBASE_APP_ID || "1:276393305302:web:12f90a55d7c13a4c57d577"
    };

    // Encrypt each value
    const securedConfig = Object.fromEntries(
      Object.entries(config).map(([key, val]) => [key, encryptValue(val)])
    );

    res.json({ status: true, data: securedConfig });
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    fetchKeys(); // Warm up keys on start
  });
}

startServer();

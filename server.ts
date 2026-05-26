import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import OpenAI from "openai";

// SIMPLE XOR ENCRYPTION FOR WIRE DATA
const SECRET_SALT = "SERIES_APP_2024";

function encryptValue(text: string): string {
  if (!text) return "";
  const key = SECRET_SALT;
  let result = "";
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return Buffer.from(result).toString("base64");
}

function decryptValue(encoded: string): string {
  if (!encoded) return "";
  try {
    const text = Buffer.from(encoded, "base64").toString("utf-8");
    const key = SECRET_SALT;
    let result = "";
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return result;
  } catch (e) {
    return encoded; // Fallback to raw string if fail
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

  const API_BASE = process.env.EXTERNAL_API_BASE || 'https://series.albesriali03.workers.dev/';

  // API Proxy Routes
  // 1. Categories
  app.get("/api/v1/categories", async (req, res) => {
    try {
      const response = await axios.get(`${API_BASE}?action=categories`);
      // Obfuscate URLs before sending to client
      if (response.data && response.data.data) {
        response.data.data = response.data.data.map((cat: any) => ({
          ...cat,
          url: encryptValue(cat.url)
        }));
      }
      res.json(response.data);
    } catch (error) {
      res.status(500).json({ status: false, message: "Server Error" });
    }
  });

  // 2. Series by Category
  app.get("/api/v1/series", async (req, res) => {
    try {
      const { url } = req.query;
      if (!url) return res.status(400).json({ status: false });
      
      const realUrl = decryptValue(url as string) || (url as string);
      const response = await axios.get(`${API_BASE}?action=series&url=${encodeURIComponent(realUrl)}`);
      if (response.data && response.data.data) {
        response.data.data = response.data.data.map((s: any) => ({
          ...s,
          url: encryptValue(s.url),
          image: s.image ? encryptValue(s.image) : ""
        }));
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
      
      const realUrl = decryptValue(url as string) || (url as string);
      const response = await axios.get(`${API_BASE}?action=episodes&url=${encodeURIComponent(realUrl)}`);
      if (response.data && response.data.data) {
        response.data.data = response.data.data.map((ep: any) => ({
          ...ep,
          url: encryptValue(ep.url)
        }));
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
      const response = await axios.get(`${API_BASE}?action=play&url=${encodeURIComponent(realUrl)}`);
      if (response.data && response.data.player_url) {
        response.data.player_url = encryptValue(response.data.player_url);
      }
      res.json(response.data);
    } catch (error) {
      res.status(500).json({ status: false });
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

  // 5. Smart AI Assistant Chat
  app.post("/api/v1/ai/chat", async (req, res) => {
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

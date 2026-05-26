import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import { GoogleGenAI } from "@google/genai";

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

let aiClient: any = null;
function getGeminiClient() {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY || "AIzaSyDMQT1hDRV-urhbuPntHUtaFIrTlXaHhJI";
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
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
      
      const response = await axios.get(`${API_BASE}?action=series&url=${encodeURIComponent(url as string)}`);
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
      
      const response = await axios.get(`${API_BASE}?action=episodes&url=${encodeURIComponent(url as string)}`);
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
      
      const response = await axios.get(`${API_BASE}?action=play&url=${encodeURIComponent(url as string)}`);
      if (response.data && response.data.player_url) {
        response.data.player_url = encryptValue(response.data.player_url);
      }
      res.json(response.data);
    } catch (error) {
      res.status(500).json({ status: false });
    }
  });

  // 5. Smart AI Assistant Chat
  app.post("/api/v1/ai/chat", async (req, res) => {
    try {
      const { message, history = [], seriesList = [] } = req.body;
      if (!message) return res.status(400).json({ status: false, error: "المحتوى فارغ" });

      const ai = getGeminiClient();
      const actualKey = process.env.GEMINI_API_KEY || "AIzaSyDMQT1hDRV-urhbuPntHUtaFIrTlXaHhJI";
      if (!actualKey) {
        return res.json({ 
          status: true, 
          text: "مرحباً! يبدو أن مفتاح الذكاء الاصطناعي لم يتم تهيئته بشكل كامل في التطبيق بعد." 
        });
      }

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

      // Format previous client history to Gemini content structure
      const contents = history.map((msg: any) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
      }));

      // Append the latest user message
      contents.push({
        role: 'user',
        parts: [{ text: message }]
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents,
        config: {
          systemInstruction,
          temperature: 0.7,
        }
      });

      res.json({
        status: true,
        text: response.text || "عذراً، لم أستطع توليد رد في الوقت الحالي."
      });
    } catch (error: any) {
      console.error("Gemini Chat Route Error:", error);
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
  });
}

startServer();

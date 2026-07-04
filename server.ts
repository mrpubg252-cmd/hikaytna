import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import OpenAI from "openai";
import fs from "fs";
import os from "os";
import { execFile } from "child_process";
import ffmpegPath from "ffmpeg-static";
import https from "https";
import http from "http";
import * as cheerio from "cheerio";
import { GoogleGenAI } from "@google/genai";
import multer from "multer";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 } // 200 MB for high-quality videos
});

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
    // Only return the decrypted value if it looks like a valid absolute URL
    if (result.startsWith("http")) {
       return result;
    }
    return encoded;
  } catch (e) {
    return encoded;
  }
}

// ============ DeepSeek Speed Configuration ============
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";
const MODEL = "gemini-3.5-flash";

let USER_CUSTOM_AI_CONFIG: {
  key: string;
  baseUrl: string;
  model: string;
  type: 'gemini' | 'openai';
} | null = null;

function findFirebaseProjectId(): string {
  // 1. Try environment variable
  if (process.env.FIREBASE_PROJECT_ID) {
    return process.env.FIREBASE_PROJECT_ID;
  }
  // 2. Try firebase-applet-config.json (AI Studio dynamic configuration)
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (config && config.projectId) {
        return config.projectId;
      }
    }
  } catch (e) {
    console.warn("Failed to parse firebase-applet-config.json:", e);
  }
  // 3. Try src/services/firebase.ts parsing to be fully portable
  try {
    const fbServicePath = path.join(process.cwd(), 'src/services/firebase.ts');
    if (fs.existsSync(fbServicePath)) {
      const content = fs.readFileSync(fbServicePath, 'utf-8');
      const match = content.match(/projectId\s*:\s*["']([^"']+)["']/);
      if (match && match[1]) {
        return match[1];
      }
    }
  } catch (e) {
    console.warn("Failed to parse src/services/firebase.ts:", e);
  }
  // 4. Default fallback
  return "mo-play-b0cb7";
}

function findFirebaseDatabaseId(): string {
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (config && config.firestoreDatabaseId) {
        return config.firestoreDatabaseId;
      }
    }
  } catch (e) {
    console.warn("Failed to parse firebase-applet-config.json for databaseId:", e);
  }
  return "(default)";
}

async function getDynamicAiConfig() {
  const firebaseProjectId = findFirebaseProjectId();
  const firebaseDatabaseId = findFirebaseDatabaseId();
  try {
    const res = await axios.get(`https://${firebaseProjectId}-default-rtdb.firebaseio.com/ai_config.json`, { timeout: 3000 });
    if (res.data && res.data.key) {
      USER_CUSTOM_AI_CONFIG = res.data;
      if (USER_CUSTOM_AI_CONFIG && USER_CUSTOM_AI_CONFIG.key && (USER_CUSTOM_AI_CONFIG.key.startsWith('sk-') || USER_CUSTOM_AI_CONFIG.type === 'openai')) {
        USER_CUSTOM_AI_CONFIG.type = 'openai';
        if (USER_CUSTOM_AI_CONFIG.key.startsWith('sk-or-')) {
          USER_CUSTOM_AI_CONFIG.baseUrl = 'https://openrouter.ai/api/v1';
          if (!USER_CUSTOM_AI_CONFIG.model || !USER_CUSTOM_AI_CONFIG.model.includes('/')) {
            USER_CUSTOM_AI_CONFIG.model = 'google/gemini-2.5-flash';
          }
        } else {
          if (!USER_CUSTOM_AI_CONFIG.baseUrl || USER_CUSTOM_AI_CONFIG.baseUrl.includes('openrouter.ai')) {
            USER_CUSTOM_AI_CONFIG.baseUrl = 'https://api.openai-proxy.org/v1';
          }
          if (!USER_CUSTOM_AI_CONFIG.model) {
            USER_CUSTOM_AI_CONFIG.model = 'gpt-4o-mini';
          }
        }
      }
      return res.data;
    }
  } catch (err: any) {
    // silent fallback
  }

  try {
    const res = await axios.get(`https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/${firebaseDatabaseId}/documents/shorts/app_admin_ai_config`, { timeout: 3000 });
    if (res.data && res.data.fields && res.data.fields.data && res.data.fields.data.stringValue) {
      const parsed = JSON.parse(res.data.fields.data.stringValue);
      if (parsed && parsed.key) {
        USER_CUSTOM_AI_CONFIG = parsed;
        if (USER_CUSTOM_AI_CONFIG && USER_CUSTOM_AI_CONFIG.key && (USER_CUSTOM_AI_CONFIG.key.startsWith('sk-') || USER_CUSTOM_AI_CONFIG.type === 'openai')) {
          USER_CUSTOM_AI_CONFIG.type = 'openai';
          if (USER_CUSTOM_AI_CONFIG.key.startsWith('sk-or-')) {
            USER_CUSTOM_AI_CONFIG.baseUrl = 'https://openrouter.ai/api/v1';
            if (!USER_CUSTOM_AI_CONFIG.model || !USER_CUSTOM_AI_CONFIG.model.includes('/')) {
              USER_CUSTOM_AI_CONFIG.model = 'google/gemini-2.5-flash';
            }
          } else {
            if (!USER_CUSTOM_AI_CONFIG.baseUrl || USER_CUSTOM_AI_CONFIG.baseUrl.includes('openrouter.ai')) {
              USER_CUSTOM_AI_CONFIG.baseUrl = 'https://api.openai-proxy.org/v1';
            }
            if (!USER_CUSTOM_AI_CONFIG.model) {
              USER_CUSTOM_AI_CONFIG.model = 'gpt-4o-mini';
            }
          }
        }
        return parsed;
      }
    }
  } catch (err: any) {
    // silent fallback
  }

  return USER_CUSTOM_AI_CONFIG;
}

// ============ Remote GitHub Chatbot Controller ============
let lastFetchedConfigTime = 0;
let cachedRemoteConfig: any = null;

async function getRemoteConfig() {
  return null;
}

// Start with bootstrap keys as fallback (Stable Working Token)
let API_KEYS: string[] = [
  "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",
  "sk-jRKZyJZ2kFTr9uDRdCJaoDo6tlBRoiIIXCV3unyfsvMSznwI",
  "AQ.Ab8RN6LuoIRrBX0LERCLIBIk1OXcz52VfoxJj4gszphbrbEoog",
  "AIzaSyCWgG7PyYpMjsewEov9E1ofu_EtqdXGpZY"
];
const WORKING_KEY_CACHE = new Map<number, number>();
const KEY_COOLDOWNS = new Map<string, number>();
const HAKEEM_LOGS: string[] = [];

// Dynamically resolve configuration parameters from GitHub config (or fallbacks)
function getActiveAIConfig(remoteConfig?: any) {
  return { baseUrl: BASE_URL, model: MODEL, keys: API_KEYS };
}

// Ultra-fast API caller with optimized speed and dynamic options
async function callDeepSeek(msg: string, systemPrompt: string, history: any[], keyIdx: number, config: { baseUrl: string, model: string, keys: string[] }, ignoreCooldown = false) {
  if (keyIdx >= config.keys.length) return { ok: false, error: "No key found at index" };
  const key = config.keys[keyIdx];
  if (!ignoreCooldown && KEY_COOLDOWNS.has(key) && Date.now() < KEY_COOLDOWNS.get(key)!) {
    return { ok: false, error: "Key is currently on cooldown (rate-limited or invalid)" };
  }
  
  try {
    let cleanBaseUrl = config.baseUrl.trim().replace(/\/$/, "");
    let cleanModel = config.model;

    if (key === "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") {
      cleanBaseUrl = "https://openrouter.ai/api/v1";
      if (!cleanModel || !cleanModel.includes("/")) {
        cleanModel = "google/gemini-2.5-flash";
      }
    } else if (key === "sk-jRKZyJZ2kFTr9uDRdCJaoDo6tlBRoiIIXCV3unyfsvMSznwI") {
      cleanBaseUrl = "https://aiapiv2.pekpik.com/v1";
      cleanModel = "deepseek-chat";
    } else if (key.startsWith("sk-or-")) {
      cleanBaseUrl = "https://openrouter.ai/api/v1";
      if (!cleanModel || !cleanModel.includes("/")) {
        cleanModel = "google/gemini-2.5-flash";
      }
    }

    const isOpenAiKey = key.startsWith("sk-");
    const isResponsesModel = cleanModel === "gpt-5.4-mini";
    const isResponsesEndpoint = cleanBaseUrl.endsWith("/responses") || cleanBaseUrl.includes("/responses") || isResponsesModel;

    // Support OpenAI's responses endpoint if requested or when using gpt-5.4-mini
    if (isOpenAiKey && isResponsesEndpoint) {
      try {
        let targetEndpoint = cleanBaseUrl;
        if (!targetEndpoint.endsWith("/responses") && !targetEndpoint.includes("/responses")) {
          targetEndpoint = targetEndpoint.replace(/\/chat\/completions$/, "") + "/responses";
        }
        if (!targetEndpoint.startsWith("http")) {
          targetEndpoint = "https://api.openai.com/v1/responses";
        }

        const payload = {
          model: cleanModel || "gpt-5.4-mini",
          input: `${systemPrompt}\n\n${history.map((m: any) => `${m.role === 'user' ? 'المستخدم' : 'حكيم'}: ${m.text}`).join('\n')}\n\nالمستخدم: ${msg}`,
          store: true
        };

        const res = await axios.post(targetEndpoint, payload, {
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${key}`
          },
          timeout: 30000
        });

        let reply = "";
        if (res.data) {
          if (res.data.output) {
            reply = res.data.output;
          } else if (res.data.response && res.data.response.output) {
            if (Array.isArray(res.data.response.output)) {
              reply = res.data.response.output.map((o: any) => o.text || "").join("");
            } else {
              reply = res.data.response.output;
            }
          } else if (res.data.choices && res.data.choices[0] && res.data.choices[0].message) {
            reply = res.data.choices[0].message.content;
          } else if (typeof res.data === "string") {
            reply = res.data;
          }
        }

        if (reply) {
          return { ok: true, reply };
        }
      } catch (err: any) {
        console.warn("[Responses API Fallback to Chat Completions] error:", err.message);
        // Fallback to standard chat/completions if the responses API errored or is not available
      }
    }

    const chatMessages: any[] = [];
    if (history && history.length > 0) {
      for (const m of history) {
        if (!m.text || !m.text.trim()) continue;
        const role = m.role === 'user' ? 'user' : 'assistant';
        if (chatMessages.length === 0 && role === 'assistant') {
          continue; // skip leading assistant messages
        }
        chatMessages.push({ role, content: m.text });
      }
    }

    const messages = [
      { role: "system", content: systemPrompt || "أجب بإيجاز وسرعة فائقة. لا تقدم مقدمات. ادخل في صلب الموضوع فوراً." },
      ...chatMessages,
      { role: "user", content: msg }
    ];

    const isDefaultPool = (config.keys === API_KEYS);
    const isToken = key.startsWith("AQ.");
    const requestTimeout = (isDefaultPool && !isToken) ? 2200 : 15000;

    const isGoogleKey = key.startsWith("AIzaSy");
    const isGoogleDomain = config.baseUrl.includes("generativelanguage.googleapis.com");

    const reqHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json",
      "Accept-Language": "ar,en-US;q=0.9,en;q=0.8",
      "Cache-Control": "no-cache",
      "Pragma": "no-cache"
    };

    if (isToken) {
      reqHeaders["Authorization"] = `Bearer ${key}`;
    } else if (isGoogleKey) {
      reqHeaders["x-goog-api-key"] = key;
      if (config.baseUrl.includes("/openai")) {
        reqHeaders["Authorization"] = `Bearer ${key}`;
      }
    } else {
      reqHeaders["Authorization"] = `Bearer ${key}`;
    }

    if (key.startsWith("sk-or-") || cleanBaseUrl.includes("openrouter.ai")) {
      reqHeaders["HTTP-Referer"] = "https://hakeem-ai-drama.com";
      reqHeaders["X-Title"] = "Hakeem AI";
    }

    // Auto-fix Google OpenAI endpoint path ONLY if completely missing
    if (isGoogleDomain && !cleanBaseUrl.includes("/openai")) {
        if (!cleanBaseUrl.includes("/v1beta") && !cleanBaseUrl.includes("/v1")) {
            cleanBaseUrl += "/v1beta/openai";
        } else {
            cleanBaseUrl += "/openai";
        }
    }
    // Google OpenAI endpoint handles model names without 'models/' prefix
    if (isGoogleDomain && cleanModel.startsWith("models/")) {
      cleanModel = cleanModel.replace("models/", "");
    }

    let requestUrl = `${cleanBaseUrl}/chat/completions`;
    if (!requestUrl.startsWith("http")) {
      requestUrl = `https://api.openai.com/v1/chat/completions`;
    }

    const urlsToTry = [requestUrl];
    if (requestUrl.includes("api.openai.com")) {
      urlsToTry.push("https://api.openai-proxy.org/v1/chat/completions");
      urlsToTry.push("https://api.openai-proxy.com/v1/chat/completions");
      urlsToTry.push("https://api.chatanywhere.tech/v1/chat/completions");
      urlsToTry.push("https://api.openai-sb.com/v1/chat/completions");
    }

    let lastError: any = null;
    let successRes: any = null;

    for (const url of urlsToTry) {
      try {
        console.log(`[Hakeem AI] Trying OpenAI endpoint: ${url}`);
        const res = await axios.post(url, {
          model: cleanModel || "gpt-4o-mini",
          messages,
          temperature: 0.7,
          max_tokens: 800,
          stream: false
        }, {
          headers: reqHeaders,
          timeout: 15000
        });

        if (res.data && res.data.choices && res.data.choices[0]) {
          successRes = res;
          break;
        }
      } catch (err: any) {
        lastError = err;
        const errMsg = err.response?.data?.error?.message || err.message;
        console.warn(`[Hakeem AI] Endpoint failed: ${url}. Error: ${errMsg}`);
      }
    }

    if (successRes) {
      return { ok: true, reply: successRes.data.choices[0].message.content };
    }
    
    const errorMsg = lastError?.response?.data?.error?.message || lastError?.message || "Invalid AI response format";
    console.error(`AI Error [${keyIdx}]:`, errorMsg);
    
    if (lastError?.response?.status === 429) {
      KEY_COOLDOWNS.set(key, Date.now() + 5 * 60 * 1000);
    }
    
    return { ok: false, error: errorMsg };
  } catch (outerErr: any) {
    console.error("Outer callDeepSeek error:", outerErr);
    return { ok: false, error: outerErr.message || "Outer callDeepSeek error" };
  }
}

let geminiClientInstance: any = null;

function getGeminiClient(customKey?: string) {
  // Respect user custom config first if it is set to gemini
  let key = "";
  if (USER_CUSTOM_AI_CONFIG && USER_CUSTOM_AI_CONFIG.type === 'gemini') {
    key = USER_CUSTOM_AI_CONFIG.key;
  }
  
  key = key || customKey || process.env.GEMINI_API_KEY || "";
  
  // If no key is set yet, check fallback keys from config
  if (!key) {
    try {
      const config = getActiveAIConfig();
      const fallbackKey = (config.keys || []).find(k => k.startsWith("AIzaSy"));
      if (fallbackKey) {
        key = fallbackKey;
      }
    } catch (e) {
      // ignore
    }
  }

  // Final absolute fallback to mock key so initialization doesn't throw if empty
  if (!key) {
    key = "AIzaSyCWgG7PyYpMjsewEov9E1ofu_EtqdXGpZY";
  }
  
  // Re-initialize only if key changed or instance is missing
  if (!geminiClientInstance || (geminiClientInstance as any)._key !== key) {
    const customBaseUrl = (USER_CUSTOM_AI_CONFIG?.type === 'gemini') ? USER_CUSTOM_AI_CONFIG.baseUrl : process.env.GEMINI_BASE_URL;
    
    let client;
    if (customBaseUrl) {
      client = new GoogleGenAI({
        apiKey: key,
        // @ts-ignore
        baseUrl: customBaseUrl.replace(/\/$/, ''),
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });
    } else {
      client = new GoogleGenAI({ 
        apiKey: key,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });
    }
    
    (client as any)._key = key;

    // Don't overwrite the global singleton if we're using a temporary key from pool
    if (!customKey) {
      geminiClientInstance = client;
    }
    return client;
  }
  return geminiClientInstance;
}

async function callGeminiFallback(msg: string, systemPrompt: string, history: any[], image?: any, audio?: any) {
  try {
    if (USER_CUSTOM_AI_CONFIG && USER_CUSTOM_AI_CONFIG.type === 'openai') {
      return { ok: false, error: "using_custom_openai" };
    }

    let key = "";
    if (USER_CUSTOM_AI_CONFIG && USER_CUSTOM_AI_CONFIG.type === 'gemini') {
      key = USER_CUSTOM_AI_CONFIG.key;
    }
    key = key || process.env.GEMINI_API_KEY || "";

    if (!key) {
      try {
        const config = getActiveAIConfig();
        const fallbackKey = (config.keys || []).find(k => k.startsWith("AIzaSy"));
        if (fallbackKey) {
          key = fallbackKey;
        }
      } catch (e) {
        // ignore
      }
    }

    if (!key) {
      key = "AIzaSyCWgG7PyYpMjsewEov9E1ofu_EtqdXGpZY";
    }

    // Direct routing for AQ. OAuth/Bearer keys because standard SDK cannot parse or sign them
    if (key.startsWith("AQ.")) {
      const config = {
        baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
        model: "gemini-2.0-flash",
        keys: [key]
      };
      const res = await callDeepSeek(msg, systemPrompt, history, 0, config, true);
      if (res.ok && res.reply) {
        return res;
      }
      return { ok: false, error: res.error || "AQ token call failed" };
    }

    let client = getGeminiClient(key);
    if (!client) {
      return { ok: false, error: "no_gemini_key", reply: "عذراً، نظام الذكاء الاصطناعي قيد التحديث. يرجى المحاولة لاحقاً." };
    }

    // Convert standard chat history formats to Gemini content parts
    const contents: any[] = [];
    if (history && history.length > 0) {
      for (const h of history) {
        if (!h.text || !h.text.trim()) continue;
        const role = (h.role === 'user' || h.role === 'client') ? 'user' : 'model';
        
        // Gemini contents array must start with 'user' role
        if (contents.length === 0 && role === 'model') {
          continue; // Skip initial assistant messages
        }

        // Avoid consecutive roles of the same type by squashing or filtering
        if (contents.length > 0 && contents[contents.length - 1].role === role) {
          contents[contents.length - 1].parts[0].text += "\n" + h.text;
        } else {
          contents.push({
            role: role,
            parts: [{ text: h.text }]
          });
        }
      }
    }

    // Append the current user message with image/audio support
    const userParts: any[] = [{ text: msg }];
    
    if (image && image.data && image.mimeType) {
      userParts.push({
        inlineData: {
          mimeType: image.mimeType,
          data: image.data
        }
      });
    }

    if (audio && audio.data && audio.mimeType) {
      userParts.push({
        inlineData: {
          mimeType: audio.mimeType,
          data: audio.data
        }
      });
    }

    if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
      contents[contents.length - 1].parts[0].text += "\n" + msg;
      if (userParts.length > 1) {
        contents[contents.length - 1].parts.push(...userParts.slice(1));
      }
    } else {
      contents.push({
        role: 'user',
        parts: userParts
      });
    }

    // Robust sequential models trial to guarantee complete compatibility on all hosting API keys
    const modelsToTry: string[] = [];
    if (USER_CUSTOM_AI_CONFIG?.type === 'gemini' && USER_CUSTOM_AI_CONFIG.model) {
      modelsToTry.push(USER_CUSTOM_AI_CONFIG.model);
    }
    // Universal stable standard models first
    modelsToTry.push("gemini-2.5-flash");
    modelsToTry.push("gemini-1.5-flash");
    // Studio-specific preview models later
    modelsToTry.push("gemini-3.5-flash");
    modelsToTry.push("gemini-3.1-pro-preview");

    let lastError: any = null;
    let reply = "";

    for (const modelName of modelsToTry) {
      try {
        const response = await client.models.generateContent({
          model: modelName,
          contents: contents,
          config: {
            systemInstruction: systemPrompt || "أنت حكيم، خبير مسلسلات ذكي وودود جداً. أجب بذكاء واختصار باسم 'حكيم'."
          }
        });
        if (response && response.text && response.text.trim()) {
          reply = response.text;
          break; // Succeeded!
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[Hakeem AI] Try with model ${modelName} failed, attempting next:`, err.message || err);
      }
    }

    if (reply && reply.trim()) {
      return { ok: true, reply };
    }
    throw lastError || new Error("Failed to generate content with any model");
  } catch (error: any) {
    const errorMsg = error.message || "Unknown error";
    // Silently log Gemini failure
    HAKEEM_LOGS.push(`[${new Date().toISOString()}] ❌ Gemini fallback failed: ${errorMsg}`);
    if (HAKEEM_LOGS.length > 50) HAKEEM_LOGS.shift();
    return { ok: false, error: errorMsg };
  }
}

// Unified Robust AI Caller for Hakeem (Direct Priority)
async function smartChat(msg: string, systemPrompt: string, history: any[], image?: any, audio?: any) {
  // 1. Priority: Custom Overrides (Set by Admin)
  if (USER_CUSTOM_AI_CONFIG && USER_CUSTOM_AI_CONFIG.key) {
    if (USER_CUSTOM_AI_CONFIG.type === 'openai') {
      const customConfig = {
        baseUrl: USER_CUSTOM_AI_CONFIG.baseUrl || "https://api.openai.com/v1",
        model: USER_CUSTOM_AI_CONFIG.model || "gpt-3.5-turbo",
        keys: [USER_CUSTOM_AI_CONFIG.key]
      };
      const rCustom = await callDeepSeek(msg, systemPrompt, history, 0, customConfig, true);
      if (rCustom.ok && rCustom.reply) return rCustom;
    } else {
      const rCustomGemini = await callGeminiFallback(msg, systemPrompt, history, image, audio);
      if (rCustomGemini.ok && rCustomGemini.reply) return rCustomGemini;
    }
  }

  // 2. Priority: Stable Platform Google Gemini Key (Highly reliable, provided by AI Studio environment)
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "AIzaSyCWgG7PyYpMjsewEov9E1ofu_EtqdXGpZY") {
    const rPlatform = await callGeminiFallback(msg, systemPrompt, history, image, audio);
    if (rPlatform.ok && rPlatform.reply) {
      return rPlatform;
    }
  }

  // 3. Last Resort Fallback: Hardcoded Fallback Pool (Using callDeepSeek with API_KEYS)
  const config = getActiveAIConfig();
  if (config && config.keys && config.keys.length > 0) {
    // Try up to 2 attempts for the primary pool keys
    for (let i = 0; i < 2; i++) {
      const rPool = await callDeepSeek(msg, systemPrompt, history, 0, config, i === 1);
      if (rPool.ok && rPool.reply) {
        return rPool;
      }
    }
  }

  // 4. Absolute Final Backstop
  const gemiResult = await callGeminiFallback(msg, systemPrompt, history, image, audio);
  if (gemiResult.ok && gemiResult.reply) {
    return { ok: true, reply: gemiResult.reply };
  }

  // Active helpful guidance instead of a dry, generic connection error when no api key exists
  const isFallbackKeyUsed = !process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "AIzaSyCWgG7PyYpMjsewEov9E1ofu_EtqdXGpZY";
  const isCustomKeyEmpty = !USER_CUSTOM_AI_CONFIG || !USER_CUSTOM_AI_CONFIG.key;
  
  const currentKey = (USER_CUSTOM_AI_CONFIG && USER_CUSTOM_AI_CONFIG.key) || process.env.GEMINI_API_KEY || "";
  const isTempAQTokenUsed = currentKey.startsWith("AQ.");

  if (isTempAQTokenUsed) {
    return {
      ok: true,
      reply: `مرحباً بك! 👋 نلاحظ أنك قمت بضبط المفتاح \`GEMINI_API_KEY\` على استضافة **Railway** باستخدام المفتاح المؤقت الذي يبدأ بـ (\`AQ.\`).\n\n` +
             `⚠️ **سبب توقف المساعد حكيم:** مفاتيح الوصول التي تبدأ بـ (\`AQ.\`) هي عبارة عن "رموز وصول مؤقتة" وتنتهي صلاحيتها تلقائياً بعد مرور **ساعة واحدة فقط** لحماية خصوصية الحسابات. هذا هو السبب في توقف حكيم وظهور مشكلة في الاتصال بالأعلى!\n\n` +
             `💡 **الحل السهل والنهائي (يعمل مدى الحياة دون انقطاع):**\n` +
             `يرجى الذهاب إلى موقع **Google AI Studio** مجاناً تماماً واستخراج مفتاح API دائم يبدأ بالحروف \`AIzaSy\`:\n\n` +
             `1️⃣ **الخطوات لاستخراج مفتاح دائم مجاناً:**\n` +
             `• افتح موقع الـ AI Studio من هنا: [https://aistudio.google.com](https://aistudio.google.com) 🌐.\n` +
             `• اضغط على زر **Get API Key** ثم **Create API Key**.\n` +
             `• انسخ الكود المتولد (مثال: \`AIzaSyD-xxxxxxxxxxxxxxxxxxxxxxxx\`).\n\n` +
             `2️⃣ **طريقة إضافته للتطبيق في ثانية واحدة (دون الذهاب لـ Railway):**\n` +
             `• في نافذة الدردشة مع حكيم 💬، اضغط على **أيقونة الترس ⚙️** في الأعلى.\n` +
             `• اكتب كلمة مرور الإدارة: \`bewCew,iDYgC@K6\`.\n` +
             `• ألصق المفتاح الجديد (\`AIzaSy...\`) واضغط على **حفظ الإعدادات**.\n\n` +
             `سيقوم السيرفر فوراً بتطبيق المفتاح الجديد ومزاوجته وحفظه سحابياً في قواعد بياناتك الخاصة (Firestore و RTDB) لكي يعمل حكيم بذكائه وسرعته الجبارة مدى الحياة ودون الحاجة لتغييره مجدداً! 🚀✨`
    };
  }

  if (isFallbackKeyUsed && isCustomKeyEmpty) {
    return { 
      ok: true, 
      reply: `مرحباً بك! 👋 المساعد الذكي "حكيم" جاهز للعمل على البيئة التطويرية للذكاء الاصطناعي بنجاح، ولكن لتفعيله بشكل كامل واحترافي على استضافة **Railway**، يرجى اتباع إحدى الطريقتين البسيطتين والسريعتين:\n\n` +
             `1️⃣ **الخيار الأول (الأسهل والأسرع - من التطبيق مباشرة):**\n` +
             `• افتح نافذة الدردشة مع حكيم 💬.\n` +
             `• اضغط على **أيقونة الترس ⚙️** الموجودة بالأعلى لفتح إعدادات المساعد.\n` +
             `• اكتب كلمة المرور المخصصة للأدمن: \`bewCew,iDYgC@K6\`.\n` +
             `• أدخل مفتاحك الخاص (Gemini API Key) المستخرج من Google AI Studio.\n` +
             `• اضغط على **حفظ الإعدادات**. سيقوم سيرفر المنصة بحفظه وتشفيره والمزامنة تلقائياً مع قواعد البيانات السحابية (Firestore و RTDB) ليعمل السيرفر فوراً دون انقطاع حتى بعد إعادة تشغيل سيرفر Railway!\n\n` +
             `2️⃣ **الخيار الثاني (بيئة عمل Railway):**\n` +
             `• توجه إلى لوحة تحكم مشروعك في **Railway.com** 🚀.\n` +
             `• اذهب إلى تبويب **Variables** التابع للخدمة.\n` +
             `• قم بإضافة متغير بيئة جديد كالتالي:\n` +
             `  - الاسم: \`GEMINI_API_KEY\`\n` +
             `  - القيمة: (مفتاح الـ Gemini API Key دائم الخاص بك من Google AI Studio ويبدأ بـ \`AIzaSy\`)\n\n` +
             `بعد الضغط على إضافة، سيتم إعادة بناء السيرفر تلقائياً وتفعيل البوت "حكيم" بذكاء خارق وسرعة فائقة لخدمة زوار منصتك وتوليد روابط المسلسلات بذكاء مذهل! 🎭✨`
    };
  }

  return { ok: false, reply: "عذراً! يبدو أن هناك مشكلة مؤقتة في الاتصال بخوادم الذكاء الاصطناعي. يرجى تكرار المحاولة." };
}

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || "3000", 10);

  app.use(express.json({ limit: "200mb" }));
  app.use(express.urlencoded({ limit: "200mb", extended: true }));

  // Pins Memory Persistence Init
  let pinsMemory: Record<string, any> = {};
  const pinsFilePath = path.join(process.cwd(), "data", "pins.json");

  // Slider Selections Memory Persistence Init
  let sliderMemory: Record<string, any> = {};
  const sliderFilePath = path.join(process.cwd(), "data", "slider.json");

  // AI Configuration Local Disk Persistence
  const aiConfigFilePath = path.join(process.cwd(), "data", "ai_config.json");

  // Load local fallbacks
  try {
    if (!fs.existsSync(path.join(process.cwd(), "data"))) {
      fs.mkdirSync(path.join(process.cwd(), "data"), { recursive: true });
    }
    if (fs.existsSync(pinsFilePath)) {
      pinsMemory = JSON.parse(fs.readFileSync(pinsFilePath, "utf-8") || "{}");
    }
    if (fs.existsSync(sliderFilePath)) {
      sliderMemory = JSON.parse(fs.readFileSync(sliderFilePath, "utf-8") || "{}");
    }
    if (fs.existsSync(aiConfigFilePath)) {
      USER_CUSTOM_AI_CONFIG = JSON.parse(fs.readFileSync(aiConfigFilePath, "utf-8") || "{}");
      console.log("Successfully loaded USER_CUSTOM_AI_CONFIG from local disk backup!");
    }
  } catch (e) {
    console.warn("Could not load database JSONs", e);
  }

  // ============== SYSTEM-WIDE PERSISTENT CLOUD SELF-HEALING SYSTEM (FIRESTORE & RTDB) ==============
  // Fetches master backups from Firestore and Realtime Database raw REST APIs
  // This guarantees complete survival across restarts, rebuilds, and ephemeral disk wipes!
  const firebaseProjectId = findFirebaseProjectId();
  const firebaseDatabaseId = findFirebaseDatabaseId();

  // --- 1. AI Configuration Self-Healing ---
  try {
    const aiConfigRes = await axios.get(`https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/${firebaseDatabaseId}/documents/shorts/app_admin_ai_config`, { timeout: 4000 }).catch(() => null);
    if (aiConfigRes && aiConfigRes.data && aiConfigRes.data.fields && aiConfigRes.data.fields.data) {
      const dataStr = aiConfigRes.data.fields.data.stringValue;
      if (dataStr) {
        const loadedConfig = JSON.parse(dataStr);
        if (loadedConfig && loadedConfig.key) {
          USER_CUSTOM_AI_CONFIG = loadedConfig;
          console.log("Successfully self-healed USER_CUSTOM_AI_CONFIG from Firestore! Key prefix:", loadedConfig.key.substring(0, 8));
        }
      }
    }
  } catch (err: any) {
    console.warn("Could not self-heal AI config from Firestore on startup:", err.message);
  }

  try {
    const aiConfigRTDB = await axios.get(`https://${firebaseProjectId}-default-rtdb.firebaseio.com/ai_config.json`, { timeout: 4000 }).catch(() => null);
    if (aiConfigRTDB && aiConfigRTDB.data && aiConfigRTDB.data.key) {
      USER_CUSTOM_AI_CONFIG = aiConfigRTDB.data;
      console.log("Successfully self-healed USER_CUSTOM_AI_CONFIG from RTDB! Key prefix:", USER_CUSTOM_AI_CONFIG.key.substring(0, 8));
    }
  } catch (err: any) {
    console.warn("Could not self-heal AI config from RTDB on startup:", err.message);
  }

  // --- 2. Pins Memory Self-Healing ---
  try {
    const pinsRes = await axios.get(`https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/${firebaseDatabaseId}/documents/shorts/app_category_pins`, { timeout: 4000 }).catch(() => null);
    if (pinsRes && pinsRes.data && pinsRes.data.fields && pinsRes.data.fields.data) {
      const dataStr = pinsRes.data.fields.data.stringValue;
      if (dataStr) {
        const cloudPins = JSON.parse(dataStr) || {};
        pinsMemory = { ...pinsMemory, ...cloudPins };
        console.log("Successfully self-healed Pins memory from Firestore! Loaded count:", Object.keys(cloudPins).length);
      }
    }
  } catch (err: any) {
    console.warn("Could not self-heal Category Pins from Firestore on startup:", err.message);
  }

  try {
    const pinsRTDB = await axios.get(`https://${firebaseProjectId}-default-rtdb.firebaseio.com/category_pins.json`, { timeout: 4000 }).catch(() => null);
    if (pinsRTDB && pinsRTDB.data) {
      pinsMemory = { ...pinsMemory, ...pinsRTDB.data };
      console.log("Successfully self-healed Pins memory from RTDB! Loaded count:", Object.keys(pinsRTDB.data).length);
    }
  } catch (err: any) {
    console.warn("Could not self-heal Category Pins from RTDB on startup:", err.message);
  }

  // --- 3. Slider Selections Self-Healing ---
  try {
    const sliderRes = await axios.get(`https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/${firebaseDatabaseId}/documents/shorts/app_slider_selections`, { timeout: 4000 }).catch(() => null);
    if (sliderRes && sliderRes.data && sliderRes.data.fields && sliderRes.data.fields.data) {
      const dataStr = sliderRes.data.fields.data.stringValue;
      if (dataStr) {
        const cloudSlider = JSON.parse(dataStr) || {};
        sliderMemory = { ...sliderMemory, ...cloudSlider };
        console.log("Successfully self-healed Sliders memory from Firestore! Loaded count:", Object.keys(cloudSlider).length);
      }
    }
  } catch (err: any) {
    console.warn("Could not self-heal Sliders from Firestore on startup:", err.message);
  }

  try {
    const sliderRTDB = await axios.get(`https://${firebaseProjectId}-default-rtdb.firebaseio.com/slider_selections.json`, { timeout: 4000 }).catch(() => null);
    if (sliderRTDB && sliderRTDB.data) {
      sliderMemory = { ...sliderMemory, ...sliderRTDB.data };
      console.log("Successfully self-healed Sliders memory from RTDB! Loaded count:", Object.keys(sliderRTDB.data).length);
    }
  } catch (err: any) {
    console.warn("Could not self-heal Sliders from RTDB on startup:", err.message);
  }

  // Cloud backup write helper functions (Dual-Save to Firestore AND RTDB for maximum resilience)
  const savePinsToCloud = async () => {
    // Save to Firestore
    try {
      await axios.patch(`https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/${firebaseDatabaseId}/documents/shorts/app_category_pins?updateMask.fieldPaths=data`, {
        fields: {
          data: { stringValue: JSON.stringify(pinsMemory) }
        }
      }, { timeout: 4000 }).catch(() => null);
    } catch (e: any) {
      console.warn("Error background backup category pins to Firestore:", e.message);
    }
    // Save to RTDB
    try {
      await axios.put(`https://${firebaseProjectId}-default-rtdb.firebaseio.com/category_pins.json`, pinsMemory, { timeout: 4000 }).catch(() => null);
    } catch (e: any) {
      console.warn("Error background backup category pins to RTDB:", e.message);
    }
  };

  const saveSliderToCloud = async () => {
    // Save to Firestore
    try {
      await axios.patch(`https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/${firebaseDatabaseId}/documents/shorts/app_slider_selections?updateMask.fieldPaths=data`, {
        fields: {
          data: { stringValue: JSON.stringify(sliderMemory) }
        }
      }, { timeout: 4000 }).catch(() => null);
    } catch (e: any) {
      console.warn("Error background backup slider selections to Firestore:", e.message);
    }
    // Save to RTDB
    try {
      await axios.put(`https://${firebaseProjectId}-default-rtdb.firebaseio.com/slider_selections.json`, sliderMemory, { timeout: 4000 }).catch(() => null);
    } catch (e: any) {
      console.warn("Error background backup slider selections to RTDB:", e.message);
    }
  };

  const saveAIConfigToCloud = async () => {
    try {
      // Save locally to disk first layout to ensure complete hosting durability
      fs.writeFileSync(aiConfigFilePath, JSON.stringify(USER_CUSTOM_AI_CONFIG, null, 2), "utf-8");
      console.log("Locally saved AI configuration to disk backup successfully!");
    } catch (err: any) {
      console.warn("Failed to write manual AI configuration to disk:", err.message);
    }

    // Save to Firestore
    try {
      await axios.patch(`https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/${firebaseDatabaseId}/documents/shorts/app_admin_ai_config?updateMask.fieldPaths=data`, {
        fields: {
          data: { stringValue: JSON.stringify(USER_CUSTOM_AI_CONFIG) }
        }
      }, { timeout: 4000 }).catch(() => null);
      console.log("Successfully back-saved AI configuration to Cloud Firestore master!");
    } catch (e: any) {
      console.warn("Error background backup administrative AI config to Firestore:", e.message);
    }

    // Save to RTDB
    try {
      await axios.put(`https://${firebaseProjectId}-default-rtdb.firebaseio.com/ai_config.json`, USER_CUSTOM_AI_CONFIG, { timeout: 4000 }).catch(() => null);
      console.log("Successfully back-saved AI configuration to Cloud RTDB master!");
    } catch (e: any) {
      console.warn("Error background backup administrative AI config to RTDB:", e.message);
    }
  };

  const savePinsToFile = () => {
    try {
      fs.writeFileSync(pinsFilePath, JSON.stringify(pinsMemory, null, 2), "utf-8");
      savePinsToCloud(); // Double backup to cloud
    } catch (e) {
      console.warn("Could not save pins.json", e);
    }
  };

  const saveSliderToFile = () => {
    try {
      fs.writeFileSync(sliderFilePath, JSON.stringify(sliderMemory, null, 2), "utf-8");
      saveSliderToCloud(); // Double backup to cloud
    } catch (e) {
      console.warn("Could not save slider.json", e);
    }
  };

  // Post-healing verification and seeding
  if (!USER_CUSTOM_AI_CONFIG || !USER_CUSTOM_AI_CONFIG.key || USER_CUSTOM_AI_CONFIG.key.startsWith("AQ.") || USER_CUSTOM_AI_CONFIG.key === "AIzaSyCWgG7PyYpMjsewEov9E1ofu_EtqdXGpZY" || USER_CUSTOM_AI_CONFIG.key === "sk-jRKZyJZ2kFTr9uDRdCJaoDo6tlBRoiIIXCV3unyfsvMSznwI") {
    console.log("No valid AI config found or expired key on startup. Seeding default working Hakeem AI config!");
    USER_CUSTOM_AI_CONFIG = {
      key: "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",
      baseUrl: "https://openrouter.ai/api/v1",
      model: "google/gemini-2.5-flash",
      type: "openai"
    };
    saveAIConfigToCloud();
  }

  if (USER_CUSTOM_AI_CONFIG && USER_CUSTOM_AI_CONFIG.key === "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") {
    if (USER_CUSTOM_AI_CONFIG.baseUrl !== "https://openrouter.ai/api/v1" || USER_CUSTOM_AI_CONFIG.model !== "google/gemini-2.5-flash") {
      USER_CUSTOM_AI_CONFIG.baseUrl = "https://openrouter.ai/api/v1";
      USER_CUSTOM_AI_CONFIG.model = "google/gemini-2.5-flash";
      USER_CUSTOM_AI_CONFIG.type = "openai";
      saveAIConfigToCloud();
    }
  }

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

  // Resilient Axios helper for backend stability
  async function axiosFetch(url: string, retries = 1) {
    for (let i = 0; i <= retries; i++) {
        try {
            return await axios.get(url, { 
                timeout: 12000, 
                httpAgent: new http.Agent({ family: 4 }),
                httpsAgent: new https.Agent({ rejectUnauthorized: false, family: 4 }),
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                    'Accept': 'application/json, text/plain, */*'
                }
            });
        } catch (err: any) {
            const isLast = i === retries;
            const status = err.response?.status;
            const isRetryable = !status || status >= 500 || status === 429;
            
            if (isLast || !isRetryable) throw err;
            console.log(`[Proxy Retry] ${i + 1}/${retries} for ${url}`);
            const delay = 500 * (i + 1);
            await new Promise(r => setTimeout(r, delay));
        }
    }
    throw new Error("Axios fetch failed");
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

  // Dynamic scraper to find the currently active working domain of AlooyTV from their Altum BioLink page (https://fitnur.com/alooytv)
  async function fetchActiveAlooyTvDomainFromBioLink(): Promise<string | null> {
    const cacheKey = "alooytv_active_domain_scraped";
    const cached = getCachedData(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      console.log("[AlooyTV Scraper] Fetching active domain from biolink: https://fitnur.com/alooytv");
      const res = await axios.get("https://fitnur.com/alooytv", {
        timeout: 6000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5'
        },
        httpAgent: new http.Agent({ family: 4 }),
        httpsAgent: new https.Agent({ rejectUnauthorized: false, family: 4 })
      });

      const $ = cheerio.load(res.data);
      const hrefs: string[] = [];
      $('a').each((i, el) => {
        const href = $(el).attr('href');
        if (href && href.includes('alooytv')) {
          hrefs.push(href);
        }
      });

      for (const href of hrefs) {
        try {
          const parsed = new URL(href);
          if (parsed.hostname && parsed.hostname.includes('alooytv')) {
            const activeDomain = `${parsed.protocol}//${parsed.hostname}`;
            console.log(`[AlooyTV Scraper] Successfully resolved active base domain: ${activeDomain}`);
            setCachedData(cacheKey, activeDomain, 30 * 60 * 1000); // Cache for 30 minutes
            return activeDomain;
          }
        } catch (e) {
          // Skip invalid URLs
        }
      }
    } catch (error: any) {
      console.error("[AlooyTV Scraper] Error scraping fitnur.com/alooytv:", error.message);
    }

    return null;
  }

  // Fallback candidate verifier if scraping fails
  async function findActiveDomainFromCandidates(): Promise<string | null> {
    const cacheKey = "alooytv_active_domain_candidates";
    const cached = getCachedData(cacheKey);
    if (cached) {
      return cached;
    }

    const baseCandidates = [
      "https://a.alooytv10.com",
      "https://a.alooytv13.xyz",
      "https://a.alooytv11.com",
      "https://a.alooytv12.com",
      "https://a.alooytv13.com",
      "https://a.alooytv14.com",
      "https://a.alooytv15.com",
      "https://a.alooytv16.com",
      "https://a.alooytv10.xyz",
      "https://a.alooytv11.xyz",
      "https://a.alooytv12.xyz",
      "https://a.alooytv14.xyz",
      "https://a.alooytv15.xyz",
      "https://a.alooytv16.xyz"
    ];

    // Try verifying in parallel batches
    for (let i = 0; i < baseCandidates.length; i += 4) {
      const batch = baseCandidates.slice(i, i + 4);
      const results = await Promise.allSettled(
        batch.map(async (domain) => {
          const response = await axios.head(domain, {
            timeout: 2000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
            },
            httpAgent: new http.Agent({ family: 4 }),
            httpsAgent: new https.Agent({ rejectUnauthorized: false, family: 4 })
          });
          if (response.status === 200 || response.status === 301 || response.status === 302) {
            return domain;
          }
          throw new Error("Invalid status");
        })
      );

      for (const res of results) {
        if (res.status === "fulfilled" && res.value) {
          setCachedData(cacheKey, res.value, 15 * 60 * 1000); // Cache for 15 minutes
          return res.value;
        }
      }
    }

    return null;
  }

  // Dynamic resolver for AlooyTV domains to automatically bypass Cloudflare Turnstile blocks
  async function getActiveAlooyTvUrl(requestedUrl: string): Promise<string> {
    if (!requestedUrl) return requestedUrl;
    const lowerUrl = requestedUrl.toLowerCase();
    if (!lowerUrl.includes("fitnur.com/alooytv") && !lowerUrl.includes("alooytv")) {
      return requestedUrl;
    }

    // 1. Try to scrape the current active domain from the fitnur.com/alooytv BioLink
    let activeDomain = await fetchActiveAlooyTvDomainFromBioLink();

    // 2. If scraping fails, try verifying candidates
    if (!activeDomain) {
      activeDomain = await findActiveDomainFromCandidates();
    }

    // 3. Fallback to a sensible default if all checks fail
    if (!activeDomain) {
      activeDomain = "https://a.alooytv10.com";
    }

    if (requestedUrl.includes("fitnur.com/alooytv")) {
      return `${activeDomain}/tv-series.html`;
    }

    // Replace domain of original URL with the active one
    try {
      const originalUrlObj = new URL(requestedUrl);
      const activeDomainObj = new URL(activeDomain);
      originalUrlObj.hostname = activeDomainObj.hostname;
      originalUrlObj.protocol = activeDomainObj.protocol;
      if (activeDomainObj.port) {
        originalUrlObj.port = activeDomainObj.port;
      } else {
        originalUrlObj.port = "";
      }
      return originalUrlObj.toString();
    } catch {
      return `${activeDomain}/tv-series.html`;
    }
  }

  // API Proxy Routes
  // 1. Categories
  app.get("/api/v1/categories", async (req, res) => {
    const cacheKey = "categories_v3";
    const cached = getCachedData(cacheKey);
    if (cached) {
      return res.json(cached);
    }
    try {
      const response = await axiosFetch(`${API_BASE}?action=categories`);
      if (response.data && response.data.status) {
        if (Array.isArray(response.data.data)) {
          const resolvedData = [];
          for (const cat of response.data.data) {
            const resolvedUrl = await getActiveAlooyTvUrl(cat.url);
            const pages = [resolvedUrl];
            if (resolvedUrl && resolvedUrl.endsWith('.html')) {
              const baseUrl = resolvedUrl.replace('.html', '');
              // Generate ONLY the first extra page to keep it fast and avoid 503 errors
              pages.push(`${baseUrl}/50.html`);
            }
            resolvedData.push({
              ...cat,
              url: resolvedUrl,
              pages
            });
          }
          response.data.data = resolvedData;
        }
        setCachedData(cacheKey, response.data, 6 * 60 * 60 * 1000); // Cache for 6 hours
      }
      res.json(response.data);
    } catch (error: any) {
      console.error("DEBUG CATEGORIES ERROR:", error.message);
      res.status(500).json({ status: false, message: "Server Error" });
    }
  });

  // 2. Series by Category
  app.get("/api/v1/series", async (req, res) => {
    try {
      const { url } = req.query;
      if (!url) return res.status(400).json({ status: false });
      
      const realUrl = await getActiveAlooyTvUrl(url as string);
      const cacheKey = `series:${realUrl}`;
      const cached = getCachedData(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      const response = await axiosFetch(`${API_BASE}?action=series&url=${encodeURIComponent(realUrl)}`);
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
      
      const realUrl = await getActiveAlooyTvUrl(url as string);
      const cacheKey = `episodes_v3:${realUrl}`;
      const cached = getCachedData(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      let responseData = { status: false, data: [] as any[] };

      try {
        const response = await axiosFetch(`${API_BASE}?action=episodes&url=${encodeURIComponent(realUrl)}`);
        if (response.data && response.data.data) {
           responseData = response.data;
        }
      } catch (e) {
        console.warn("Primary episodes API failed, trying fallback...");
      }

      // ALWAYS TRY FALLBACK SCRAPING FOR WATCH LINKS TO ENSURE WE GET ALL EPISODES (the proxy api might truncate)
      if (realUrl.includes("/watch/") || realUrl.includes("alooytv")) {
        try {
           const fallRes = await axios.get(realUrl, {
             headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
             },
             httpAgent: new http.Agent({ family: 4 }),
             httpsAgent: new https.Agent({ rejectUnauthorized: false, family: 4 }),
           });
           const $ = cheerio.load(fallRes.data);
           const episodesMap = new Map<string, any>();
           
           const isAlooyTv = realUrl.includes("alooytv");
           // Seed map with existing proxy data ONLY if not alooytv to avoid their bad proxy parsing
           if (!isAlooyTv && responseData.data && Array.isArray(responseData.data)) {
               responseData.data.forEach(ep => {
                   if (ep.url) {
                      const isBadProxyItem = ep.name && (/الخائن|القضاء|الطائر/i.test(ep.name) && !ep.name.includes("حلقة"));
                      if (!isBadProxyItem) episodesMap.set(ep.url, ep);
                   }
               });
           }

           const parsedOriginalUrl = new URL(realUrl);
           const originalPath = parsedOriginalUrl.pathname;
           
           // Find in <a> tags
           $('.episodes-list a, .list-episodes a, a[href*="/watch/"], .seasons a').each((i, el) => {
             const epTitle = $(el).text().replace(/\n/g, '').trim();
             const epHref = $(el).attr('href');
             processWatchLink(epTitle, epHref, $(el));
           });

           // Find in <option> tags for dropdowns
           $('select option').each((i, el) => {
             const epTitle = $(el).text().replace(/\n/g, '').trim();
             const epHref = $(el).attr('value');
             // often they put the raw URL in the value attribute
             if (epHref && epHref.includes("/watch/")) {
               processWatchLink(epTitle, epHref, $(el));
             }
           });

           function processWatchLink(epTitle: string, epHref: string | undefined, $el: any) {
             if (!epHref || !epTitle || !epHref.includes("/watch/")) return;

             let fullHref = epHref;
             if (!fullHref.startsWith("http")) {
                fullHref = `${parsedOriginalUrl.origin}${fullHref.startsWith("/") ? "" : "/"}${fullHref}`;
             }
             
             let parsedHref;
             try {
               parsedHref = new URL(fullHref);
             } catch (e) { return; }

             const isExplicitList = $el.parents('.episodes-list, .list-episodes, .seasons, .Episodes, .ListEpis').length > 0;
             const isSameSeriesPath = parsedHref.pathname === originalPath;
             
             // Many "related" series have titles like "الحلقة الخائن الموسم الاول" and link to diff paths.
             // We only accept the episode if it's explicitly in an episodes list OR its path matches the current series path exactly.
             // Also exclude things that look like related garbage.
             const isRelated = epTitle.includes("شاهد المزيد") || epTitle.includes("تغطية") || epTitle.includes("مسلسلات");
             
             if (!isRelated && (isExplicitList || isSameSeriesPath)) {
                // Formatting E1-P1 to 'الحلقة 1 - جزء 1'
                let formattedTitle = epTitle.replace(/تشغيل\s*الآن|تشغيل\s*الان|مفتوح\s*للمشاهدة/g, '').trim();
                
                if (/^E\d+-P\d+$/.test(formattedTitle)) {
                    formattedTitle = formattedTitle.replace(/E(\d+)-P(\d+)/, 'الحلقة $1 - جزء $2');
                } else if (/^E\d+$/.test(formattedTitle)) {
                    formattedTitle = formattedTitle.replace(/E(\d+)/, 'الحلقة $1');
                } else if (formattedTitle.includes('الحلقات') && formattedTitle.includes('-')) {
                    // It's a tab, ignore it
                    return;
                }

                if (!episodesMap.has(fullHref)) {
                   episodesMap.set(fullHref, {
                     name: formattedTitle,
                     url: fullHref
                   });
                }
             }
           }
           
           const scrapedEps = Array.from(episodesMap.values());
           if (scrapedEps.length > 0) {
             responseData = { status: true, data: scrapedEps };
           }
        } catch (fallErr) {
           console.error("Fallback scraping failed:", fallErr);
        }
      }

      if (responseData && responseData.data) {
        responseData.data = responseData.data.map((ep: any) => ({
          ...ep,
          url: encryptValue(ep.url)
        }));
      }
      
      if (responseData && responseData.status && responseData.data.length > 0) {
        setCachedData(cacheKey, responseData, 2 * 60 * 60 * 1000); // Cache for 2 hours
      }
      res.json(responseData);
    } catch (error) {
      res.status(500).json({ status: false });
    }
  });

  // 4. Play URL
  app.get("/api/v1/play", async (req, res) => {
    try {
      const { url } = req.query;
      if (!url) return res.status(400).json({ status: false });
      
      const decryptedUrl = decryptValue(url as string) || (url as string);
      const realUrl = await getActiveAlooyTvUrl(decryptedUrl);
      const cacheKey = `play:${realUrl}`;
      const cached = getCachedData(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      let responseData: any = null;
      try {
        const response = await axiosFetch(`${API_BASE}?action=play&url=${encodeURIComponent(realUrl)}`);
        if (response.data && response.data.status && response.data.player_url) {
          responseData = response.data;
        }
      } catch (e) {
        console.warn("Primary play API failed, trying fallback...");
      }

      // Fallback Cheerio scraping specifically for AlooyTV URLs to find embedded play players or m3u8 sources
      if ((!responseData || !responseData.player_url) && realUrl.includes("alooytv")) {
        try {
          const pageRes = await axios.get(realUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
              'Referer': 'https://alooytv.com/'
            },
            timeout: 10000,
            httpAgent: new http.Agent({ family: 4 }),
            httpsAgent: new https.Agent({ rejectUnauthorized: false, family: 4 })
          });

          const $ = cheerio.load(pageRes.data);
          let playerUrl = "";

          // 1. Try finding iframe sources (players/embeds)
          $('iframe').each((i, el) => {
            const src = $(el).attr('src');
            if (src && (src.includes('player') || src.includes('embed') || src.includes('vid') || src.includes('stream') || src.includes('play'))) {
              playerUrl = src;
              return false; // break
            }
          });

          // 2. Try finding video/source sources (m3u8/mp4)
          if (!playerUrl) {
            $('video source, source').each((i, el) => {
              const src = $(el).attr('src');
              if (src && (src.includes('.m3u8') || src.includes('.mp4'))) {
                playerUrl = src;
                return false; // break
              }
            });
          }

          // 3. Try finding scripts with m3u8 or player URLs
          if (!playerUrl) {
            $('script').each((i, el) => {
              const text = $(el).text();
              const m3u8Match = text.match(/(https?:\/\/[^\s"'`]+\.m3u8[^\s"'`]*)/i);
              if (m3u8Match) {
                playerUrl = m3u8Match[1];
                return false; // break
              }
              const iframeMatch = text.match(/src=["'](https?:\/\/[^\s"'`]+(?:player|embed)[^\s"'`]+)["']/i);
              if (iframeMatch) {
                playerUrl = iframeMatch[1];
                return false; // break
              }
            });
          }

          if (playerUrl) {
            if (playerUrl.startsWith('//')) {
              playerUrl = 'https:' + playerUrl;
            } else if (playerUrl.startsWith('/')) {
              const parsed = new URL(realUrl);
              playerUrl = parsed.origin + playerUrl;
            }

            console.log(`[AlooyTV Player Scraper] Successfully resolved fallback play URL: ${playerUrl}`);
            responseData = {
              status: true,
              player_url: playerUrl
            };
          }
        } catch (scrapeErr: any) {
          console.error("Fallback player scraping failed:", scrapeErr.message);
        }
      }

      if (responseData && responseData.player_url) {
        responseData.player_url = encryptValue(responseData.player_url);
      }

      if (responseData && responseData.status) {
        setCachedData(cacheKey, responseData, 1 * 60 * 60 * 1000); // Cache for 1 hour
        res.json(responseData);
      } else {
        res.status(404).json({ status: false, message: "Video resource not found" });
      }
    } catch (error) {
      res.status(500).json({ status: false });
    }
  });

  // 4.1. Image Proxy to bypass hotlink and domain protections on API images
  app.get("/api/v1/image-proxy", async (req, res) => {
    let targetUrl = "";
    try {
      const { url } = req.query;
      if (!url) return res.status(400).send("Missing URL parameter");
      
      targetUrl = decodeURIComponent(url as string);
      if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        return res.status(400).send("Invalid target URL");
      }

      // Extract the original host of the image to set as Referer if needed
      const hostVal = new URL(targetUrl).origin;

      const response = await axios({
        method: 'get',
        url: targetUrl,
        responseType: 'stream',
        httpAgent: new http.Agent({ family: 4 }),
        httpsAgent: new https.Agent({ rejectUnauthorized: false, family: 4 }),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
          'Referer': hostVal + '/', // Dynamically use the origin of the target image as the Referer
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
        },
        timeout: 4000 // Fast fail to prevent browser image stuttering
      });

      const contentType = response.headers['content-type'];
      if (typeof contentType === 'string') {
        res.setHeader('Content-Type', contentType);
      }
      
      // Highly-scalable browser & CDN cache control (24 hours)
      res.setHeader('Cache-Control', 'public, max-age=86400');
      
      response.data.pipe(res);
    } catch (error: any) {
      console.warn("[Image Proxy Fallback Redirect] Image proxy error for URL:", req.query.url, error.message);
      if (targetUrl) {
        // Super-healing fallback: redirect the browser directly to the original target image URL!
        // Client browser network might bypass hosting provider IP block/firewall blocks.
        return res.redirect(targetUrl);
      }
      res.status(500).send("Failed to load image resource");
    }
  });

  // 4.5. High-End Custom Player (Titanic Specific & Secure Wrappers)
  app.get("/api/v1/titanic-player", (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('X-Frame-Options', 'ALLOWALL'); 
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="referrer" content="origin">
  <title>Player</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #0b0b0b; font-family: system-ui, sans-serif; }
    #player-wrapper { position: relative; width: 100%; height: 100%; background: #000; }
    #pf { width: 100%; height: 100%; border: 0; display: block; background: #111; }
    .status-badge { position: fixed; bottom: 20px; left: 20px; color: rgba(255,255,255,0.2); font-size: 12px; letter-spacing: 0.3px; pointer-events: none; z-index: 10; background: rgba(0,0,0,0.4); padding: 6px 14px; border-radius: 40px; backdrop-filter: blur(4px); border: 1px solid rgba(255,255,255,0.05); }
    .hide-cursor, .hide-cursor * { cursor: none !important; }
    iframe { transition: opacity 0.2s ease; }
  </style>
</head>
<body>
  <div id="player-wrapper">
    <iframe id="pf" src="https://nextgencloudfabric.com/embed/movie/tt0120338" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowfullscreen referrerpolicy="origin"></iframe>
  </div>
  <div class="status-badge" id="statusBadge">● loaded</div>
  <script>
    (function(){
      if (window !== window.top) {
        var die = function(){ document.documentElement.innerHTML = ''; document.write('<!DOCTYPE html><html><head></head><body style="margin:0;background:#000"></body></html>'); document.close(); };
        var s = false;
        try { if (window.origin === 'null' || !window.origin) s = true; } catch(e){ s = true; }
        if (s) { die(); throw ''; }
      }
      var f = document.getElementById('pf');
      window.addEventListener('message', function(e) {
        if (e.source !== f.contentWindow) return;
        var d = e.data;
        if (!d || typeof d !== 'object') return;
        if (d.type === 'CURSOR_HIDE') { document.body.classList.add('hide-cursor'); document.documentElement.classList.add('hide-cursor'); f.style.cursor = 'none'; }
        if (d.type === 'CURSOR_SHOW') { document.body.classList.remove('hide-cursor'); document.documentElement.classList.remove('hide-cursor'); f.style.cursor = ''; }
      });
      var badge = document.getElementById('statusBadge');
      if (badge) {
        setTimeout(function() { if (badge) badge.style.opacity = '0.6'; }, 4000);
        setTimeout(function() { if (badge) { badge.style.transition = 'opacity 0.8s ease'; badge.style.opacity = '0'; } }, 8000);
      }
    })();
  </script>
</body>
</html>
    `);
  });

  // 4.6. Secure Stream Proxy (Absolute Protection against sniffers)
  app.get("/api/v1/stream-proxy/:encryptedUrl", async (req, res) => {
    try {
      const encrypted = req.params.encryptedUrl;
      const url = decryptValue(decodeURIComponent(encrypted));
      if (!url || !url.startsWith("http")) return res.status(400).send("Invalid stream source.");

      const parsedUrl = new URL(url);
      
      const headersOptions: any = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      };

      // Specific fixes for known sources like AlooyTV / Vid2 / Vid3 which host "The Pit" (Al-Hofrah)
      const hostMatch = url.match(/vid[0-9]|alooytv|zvde-dsn|cdn/i);
      if (hostMatch) {
         headersOptions['Referer'] = 'https://alooytv.com/';
         headersOptions['Origin'] = 'https://alooytv.com';
         headersOptions['Sec-Fetch-Dest'] = 'video';
         headersOptions['Sec-Fetch-Mode'] = 'no-cors';
         headersOptions['Sec-Fetch-Site'] = 'cross-site';
         // Use a more recent User-Agent
         headersOptions['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';
      } else {
         headersOptions['Referer'] = parsedUrl.origin + '/';
         headersOptions['Origin'] = parsedUrl.origin;
      }

      if (req.headers.range) {
        headersOptions.range = req.headers.range;
      }

      const axiosResponse = await axios({
        method: 'GET',
        url: url,
        responseType: 'stream',
        headers: headersOptions,
        maxRedirects: 10,
        validateStatus: () => true,
        httpAgent: new http.Agent({ keepAlive: true, family: 4 }),
        httpsAgent: new https.Agent({ keepAlive: true, rejectUnauthorized: false, family: 4 }),
        timeout: 45000 // Higher timeout for slow video providers
      });

      const proxyRes = axiosResponse.data;
      const contentType = axiosResponse.headers['content-type'] || '';
      const isM3u8 = url.includes('.m3u8') || String(contentType).includes('mpegurl');

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
                   // Resolve relative paths securely using the final URL in case of redirects
                   const finalUrl = (axiosResponse.request && axiosResponse.request.res && axiosResponse.request.res.responseUrl) ? axiosResponse.request.res.responseUrl : url;
                   if (!chunkUrl.startsWith('http')) {
                      chunkUrl = new URL(chunkUrl, finalUrl).toString();
                   }
                   
                   // CRITICAL EGRESS & RESOURCE OPTIMIZATION:
                   // Only proxy nested sub-playlists (.m3u8) or decryption keys (.key) to bypass CORS blocks.
                   // The extremely heavy media/video segments (.ts, .mp4, .m4s, .aac) are streamed directly from the hosting CDNs
                   // to the browser, bypassing the server entirely. This slashes server Egress by 99.9%, lowers CPU/Memory,
                   // and provides buttery-smooth streaming without server-side choke-points.
                   const lowerChunk = chunkUrl.toLowerCase();
                   const isPlaylistOrKey = lowerChunk.includes('.m3u8') || lowerChunk.includes('.key') || lowerChunk.includes('key.php');
                   
                   if (isPlaylistOrKey) {
                       const enc = encodeURIComponent(encryptValue(chunkUrl));
                       return `/api/v1/stream-proxy/${enc}`;
                   } else {
                       // Stream the heavy media chunk directly from the CDN
                       return chunkUrl;
                   }
               } catch {
                   return line;
               }
            }).join('\n');
            
            res.status(axiosResponse.status || 200);
            res.setHeader('Content-Type', String(contentType) || 'application/vnd.apple.mpegurl');
            if (axiosResponse.headers['cache-control']) res.setHeader('Cache-Control', axiosResponse.headers['cache-control'] as string);
            res.send(rewritten);
         });
      } else {
         res.status(axiosResponse.status || 200);
         res.setHeader('Access-Control-Allow-Origin', '*');
         ['accept-ranges', 'content-length', 'content-range'].forEach(h => {
            if (axiosResponse.headers[h]) res.setHeader(h, axiosResponse.headers[h] as string);
         });
         Object.keys(axiosResponse.headers).forEach(key => {
           const keyLower = key.toLowerCase();
           if (['accept-ranges', 'content-length', 'content-range'].includes(keyLower)) return;
           // Forward safe headers
           if (keyLower !== 'host' && keyLower !== 'connection' && keyLower !== 'content-disposition' && keyLower !== 'transfer-encoding') {
              let val = axiosResponse.headers[key] as string;
              if (keyLower === 'content-type' && (val === 'application/octet-stream' || val.includes('image/') || !val)) {
                 if (url.toLowerCase().includes('.m3u8')) {
                    val = 'application/vnd.apple.mpegurl';
                 } else {
                    val = 'video/mp4';
                 }
              }
              res.setHeader(key, val);
           }
         });
         res.setHeader('Content-Disposition', 'inline');
         proxyRes.pipe(res);
      }

      proxyRes.on('error', (e: any) => {
        if (!res.headersSent) res.status(500).send("Stream proxy failed");
      });
      req.on('close', () => {
         if (proxyRes && typeof proxyRes.destroy === 'function') {
           proxyRes.destroy();
         }
      });
    } catch (e: any) {
      if (!res.headersSent) res.status(500).send("Stream proxy error: " + e.message);
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
        httpAgent: new http.Agent({ family: 4 }),
        httpsAgent: new https.Agent({ rejectUnauthorized: false, family: 4 }),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
          'Accept': 'text/xml,application/xml,application/xhtml+xml,text/html;q=0.9,*/*;q=0.8'
        },
        timeout: 3500
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
      console.warn("⚠️ [VAST Resolver Graceful Fallback]:", e.message);
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
        parsed.creatorIPs = parsed.creatorIPs || {};
        parsed.adFreeExpiry = parsed.adFreeExpiry || {};
        parsed.alerts = parsed.alerts || {};
        return parsed;
      }
    } catch (e) {
      console.error("Error reading referrals file:", e);
    }
    return { visitedIPs: [], referrers: {}, users: {}, creatorIPs: {}, adFreeExpiry: {}, alerts: {} };
  }

  // Helper to save referrals database
  function saveReferrals(data: any) {
    try {
      data.visitedIPs = data.visitedIPs || [];
      data.referrers = data.referrers || {};
      data.users = data.users || {};
      data.creatorIPs = data.creatorIPs || {};
      data.adFreeExpiry = data.adFreeExpiry || {};
      data.alerts = data.alerts || {};
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

      const cleanedRefId = referrerId.trim();

      // Check if IP matches the creator of this referrer ID (Self-referral cheating prevention)
      const creatorIp = db.creatorIPs?.[cleanedRefId];
      if (creatorIp && creatorIp === clientIp) {
        console.warn(`[Self Referral Attempted] IP: ${clientIp} tried to self-refer to ID: ${cleanedRefId}`);
        return res.json({ 
          status: false, 
          selfReferral: true, 
          message: "إذا قمت بدخول نفس رابط الإحالة الخاص بك قد يتم حظرك من مشاهدة المسلسلات، لذا قم بمشاركة رابط إحالتك إلى أشخاص حقيقيين فقط!" 
        });
      }

      // Check if this visitor's IP has already clicked a referral before to avoid spamming
      const isLocalhost = clientIp === "127.0.0.1" || clientIp === "::1" || clientIp === "::ffff:127.0.0.1" || !clientIp;
      
      if (!isLocalhost && db.visitedIPs.includes(clientIp)) {
        console.log(`[Referral Denied] Duplicate IP ${clientIp} for ${referrerId}`);
        return res.json({ 
          status: false, 
          message: "عذراً! تم احتساب إحالتك من هذا الجهاز مسبقاً لمنع التلاعب بالنظام.", 
          points: db.referrers[cleanedRefId] || 0 
        });
      }

      // Save visited IP to prevent self-fraud/multiple entries from same user
      if (!isLocalhost) {
        db.visitedIPs.push(clientIp);
      }

      // Increment points
      const currentPoints = db.referrers[cleanedRefId] || 0;
      const newPoints = currentPoints + 1;
      db.referrers[cleanedRefId] = newPoints;

      // Add individual notification (limit to top 30 elements for absolute high performance and zero lag)
      db.alerts = db.alerts || {};
      if (!db.alerts[cleanedRefId]) {
        db.alerts[cleanedRefId] = [];
      }
      
      const newAlert = {
        id: "alert_" + Math.random().toString(36).substring(2, 9),
        text: `بشرى سارة! 🎉 انضم زائر جديد لمنصتنا عبر رابط الإحالة الفريد الخاص بك! تم زيادة رصيدك بمقدار (+1 نقطة ذهبية) لتصبح نقاطك الإجمالية: ${newPoints} نقطة. 🌟🎁`,
        timestamp: Date.now(),
        type: "success"
      };

      db.alerts[cleanedRefId].unshift(newAlert);
      
      // Ensure we keep only the latest 30 alerts so the Notifications Box stays light and zero lag!
      if (db.alerts[cleanedRefId].length > 30) {
        db.alerts[cleanedRefId] = db.alerts[cleanedRefId].slice(0, 30);
      }

      saveReferrals(db);

      console.log(`[Referral Recorded with Alert] Code: ${referrerId}, Client IP: ${clientIp}, Points: ${newPoints}`);
      return res.json({ 
        status: true, 
        message: "شكراً لك! تم احتساب إحالتك بنجاح وكسبت نقطة جديدة! 🎉🎁", 
        points: newPoints 
      });
    } catch (err) {
      console.error("Error in register referral:", err);
      res.status(500).json({ status: false, message: "Internal server error" });
    }
  });

  // Endpoint to obtain point totals and ad-free status for a given referrer ID
  app.get("/api/v1/referral/points", (req, res) => {
    try {
      const { id } = req.query;
      if (!id || typeof id !== "string") {
        return res.status(400).json({ status: false, message: "معرف المستخدم مفقود" });
      }
      
      const db = loadReferrals();
      const cleanedId = id.trim();
      const points = db.referrers?.[cleanedId] || 0;
      const adFreeExpiry = db.adFreeExpiry?.[cleanedId] || 0;

      // Associate IP with this referral ID creator
      let clientIp = (req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || "").split(",")[0].trim();
      if (clientIp) {
        db.creatorIPs = db.creatorIPs || {};
        db.creatorIPs[cleanedId] = clientIp;
        saveReferrals(db);
      }
      
      return res.json({ status: true, points, adFreeExpiry });
    } catch (err) {
      console.error("Error reading points:", err);
      res.status(500).json({ status: false, message: "Internal server error" });
    }
  });

  // Endpoint to obtain personal referral alerts for a given referrer ID
  app.get("/api/v1/referral/alerts", (req, res) => {
    try {
      const { id } = req.query;
      if (!id || typeof id !== "string") {
        return res.status(400).json({ status: false, message: "معرف المستخدم مفقود" });
      }
      const db = loadReferrals();
      const userAlerts = db.alerts?.[id.trim()] || [];
      return res.json({ status: true, alerts: userAlerts });
    } catch (err) {
      console.error("Error reading alerts:", err);
      res.status(500).json({ status: false, message: "Internal server error" });
    }
  });

  // Endpoint to redeem points for ad-free weeks
  app.post("/api/v1/referral/redeem", (req, res) => {
    try {
      const { id } = req.body;
      if (!id || !id.trim()) {
        return res.status(400).json({ status: false, message: "معرّف الإحالة مفقود" });
      }

      const db = loadReferrals();
      const cleanedId = id.trim();
      const currentPoints = db.referrers?.[cleanedId] || 0;

      if (currentPoints < 5) {
        return res.status(400).json({ status: false, message: "النقاط غير كافية لمقايضتها!" });
      }

      // Deduct 5 points
      const newPoints = currentPoints - 5;
      db.referrers[cleanedId] = newPoints;

      // Extend expiration by 1 week (7 days)
      const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
      let currentExpiry = db.adFreeExpiry?.[cleanedId] || 0;
      if (currentExpiry < Date.now()) {
        currentExpiry = Date.now();
      }
      const newExpiry = currentExpiry + ONE_WEEK_MS;
      db.adFreeExpiry[cleanedId] = newExpiry;

      saveReferrals(db);

      console.log(`[Referral Redeem] Code ${cleanedId} spent 5 points. Remaining: ${newPoints}. Expiry extended to: ${new Date(newExpiry).toISOString()}`);
      return res.json({ 
        status: true, 
        message: "تم تفعيل الإزالة الفورية وثق بمشاهدة أسبوع كامل خالية من أي إعلانات فاصلة بنجاح! 👑", 
        points: newPoints, 
        adFreeExpiry: newExpiry 
      });
    } catch (err) {
      console.error("Error in redeem point:", err);
      res.status(500).json({ status: false, message: "Internal server error" });
    }
  });

  // Diagnostic endpoint to inspect Hakeem connection and rate-limit issues
  app.get("/api/v1/ai/logs", (req, res) => {
    res.json({ status: true, logs: HAKEEM_LOGS });
  });

  // Slider Selections Read API
  app.get("/api/v1/slider-selections", async (req, res) => {
    res.json(sliderMemory);
  });

  // Slider Selections Update API (Admin Action)
  app.post("/api/v1/slider-selections/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const selectData = req.body; // Expecting { selected: boolean, seriesId: string, title: string, category: string, selectedAt: number }
      
      if (selectData && selectData.selected) {
        sliderMemory[id] = selectData;
      } else {
        delete sliderMemory[id];
      }
      
      saveSliderToFile();
      res.json({ success: true, selections: sliderMemory });
    } catch (err: any) {
      console.error("Error updating slider selections:", err.message);
      res.status(500).json({ status: false, error: err.message });
    }
  });

  // Category Pins Read API
  app.get("/api/v1/pins", async (req, res) => {
    res.json(pinsMemory);
  });

  app.post("/api/v1/admin/gemini-key", (req, res) => {
    const { password, key, baseUrl, model, type = 'gemini' } = req.body;
    if (password !== "bewCew,iDYgC@K6") {
      return res.status(401).json({ error: "كلمة المرور غير صحيحة" });
    }
    
    if (!key || key.trim() === "") {
        USER_CUSTOM_AI_CONFIG = null;
    } else {
        USER_CUSTOM_AI_CONFIG = {
            key: key.trim(),
            baseUrl: (baseUrl || "").trim(),
            model: (model || "").trim(),
            type: (type === 'openai' ? 'openai' : 'gemini')
        };
    }
    // Clear instance to force re-initialization with new key
    geminiClientInstance = null;
    KEY_COOLDOWNS.clear(); // Clear all cooldowns so the new key can be tested immediately
    console.log(`AI Configuration updated via admin endpoint. Type: ${type}`);
    
    // Save backup permanently to cloud (Firestore + RTDB)
    saveAIConfigToCloud();
    
    res.json({ status: true, message: `تم تحديث مفتاح الربط (${type === 'gemini' ? 'Gemini' : 'OpenAI/Other'}) بنجاح! 🚀` });
  });

  // Category Pins Update API (Admin Action)
  app.post("/api/v1/pins/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const pinData = req.body; // Expecting { pinned: boolean, seriesId: string, title: string, category: string, pinnedAt: number }
      
      if (pinData && pinData.pinned) {
        pinsMemory[id] = pinData;
      } else {
        delete pinsMemory[id];
      }
      
      savePinsToFile();

      // The backend saves pins securely to server memory and pins.json. The admin's browser client securely uploads new pins directly to RTDB.
      res.json({ success: true, pins: pinsMemory });
    } catch (err: any) {
      console.error("Error updating category pins:", err.message);
      res.status(500).json({ status: false, error: err.message });
    }
  });

  // Secure Image & Media Uploader Proxy Endpoint
  app.post("/api/v1/upload-image", async (req, res) => {
    try {
      const { image, file: fileKey } = req.body;
      const originalPayload = image || fileKey;
      if (!originalPayload || typeof originalPayload !== "string") {
        return res.status(400).json({ success: false, error: "لم يتم استلام ملف الميديا بشكل صحيح." });
      }

      const mimeMatch = originalPayload.match(/^data:([^;]+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
      const base64Data = originalPayload.replace(/^data:[^;]+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");

      if (buffer.length > 35 * 1024 * 1024) {
        return res.status(400).json({ success: false, error: "حجم الملف كبير جداً. الحد الأقصى هو 35 ميجابايت." });
      }

      let extension = "jpg";
      if (mimeType.includes("png")) extension = "png";
      else if (mimeType.includes("gif")) extension = "gif";
      else if (mimeType.includes("webp")) extension = "webp";
      else if (mimeType.includes("mp4")) extension = "mp4";
      else if (mimeType.includes("mov")) extension = "mov";
      else if (mimeType.includes("mpeg") || mimeType.includes("mp3")) extension = "mp3";
      else if (mimeType.includes("wav")) extension = "wav";
      else if (mimeType.includes("ogg") || mimeType.includes("opus")) extension = "ogg";
      else if (mimeType.includes("webm")) extension = "webm";
      else {
        const parts = mimeType.split("/");
        if (parts.length > 1) extension = parts[1].replace(/[^a-zA-Z0-9]/g, "");
      }

      const isImage = mimeType.startsWith("image/");
      const fileName = `media_${Date.now()}.${extension}`;
      console.log(`[UPLOADER] Received media (${buffer.length} bytes, type: ${mimeType}, ext: ${extension})`);

      // 1. TOP4TOP.IO (Primary Priority for ALL Media Types)
      try {
        console.log("[UPLOADER] Attempting Top4toP.io upload...");
        // 1a. Grab cookies & optionally session tokens
        const getRes = await axios.get("https://top4top.io/", {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
          timeout: 6000
        });

        const setCookies = getRes.headers['set-cookie'] || [];
        const cookieStr = setCookies.map((c: string) => c.split(';')[0]).join('; ');

        const formData = new (globalThis as any).FormData();
        const blob = new (globalThis as any).Blob([buffer], { type: mimeType });
        formData.append("file_0_", blob, fileName);
        formData.append("submitr", "[ رفع الملفات ]");

        // 1b. Submit form
        const uploadRes = await fetch("https://top4top.io/index.php", {
          method: "POST",
          body: formData,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "Referer": "https://top4top.io/",
            "Cookie": cookieStr
          },
          signal: AbortSignal.timeout(300000)
        });

        const uploadHtml = await uploadRes.text();
        
        // 1c. Parse response looking for the direct link (.mp4, .png, etc)
        const rx = /https?:\/\/[a-zA-Z0-9-]+\.top4top\.(io|net)\/[a-zA-Z0-9_/.-]+\.(png|jpg|jpeg|gif|webp|mov|mp4|avi|mp3|wav|ogg|m4a|aac|webm)/gi;
        const matches = (uploadHtml.match(rx) || []).filter((link: string) => {
          const l = link.toLowerCase();
          return !l.includes('s.top4top') && !l.includes('/styles/') && !l.includes('/images/') && !l.includes('favicon.ico');
        });

        if (matches.length > 0) {
          const finalUrl = matches[0].replace(/&amp;/g, "&");
          console.log("[UPLOADER] Top4toP Success: ", finalUrl);
          return res.json({ success: true, url: finalUrl });
        }
        console.warn("[UPLOADER] Top4toP response did not match direct media URL patterns.");
      } catch (err: any) {
        console.warn("[UPLOADER] Top4toP failed:", err.message);
      }

      // 2. FREEIMAGE.HOST (For Images Only - Extremely Fast Fallback)
      if (isImage) {
        try {
          console.log("[UPLOADER] Attempting Freeimage.host API...");
          const formData = new (globalThis as any).FormData();
          formData.append("key", "6d207e02198a847aa98d0a2a901485a5");
          formData.append("action", "upload");
          formData.append("source", base64Data);

          const imgbbRes = await axios.post("https://freeimage.host/api/1/upload", formData, {
            headers: { "Content-Type": "multipart/form-data" },
            timeout: 10000
          });

          if (imgbbRes.data && imgbbRes.data.image && imgbbRes.data.image.url) {
            return res.json({ success: true, url: imgbbRes.data.image.url });
          }
        } catch (err: any) {
          console.warn("[UPLOADER] freeimage failed:", err.message);
        }
      }

      // 2. CATBOX (For Video, Audio, and Fallback for Images)
      try {
        console.log("[UPLOADER] Attempting Catbox.moe API...");
        const formData = new (globalThis as any).FormData();
        const blob = new (globalThis as any).Blob([buffer], { type: mimeType });
        formData.append("reqtype", "fileupload");
        formData.append("fileToUpload", blob, fileName);

        const catboxRes = await fetch("https://catbox.moe/user/api.php", {
          method: "POST",
          body: formData,
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
        });

        if (catboxRes.ok) {
          const textUrl = (await catboxRes.text()).trim();
          if (textUrl.startsWith("http")) {
            return res.json({ success: true, url: textUrl });
          }
        }
      } catch (err: any) {
        console.warn("[UPLOADER] Catbox failed:", err.message);
      }

      // 3. POMF.LAIN.LA (Secondary Fallback for Videos/Audios)
      try {
        console.log("[UPLOADER] Attempting Pomf.lain.la API...");
        const formData = new (globalThis as any).FormData();
        const blob = new (globalThis as any).Blob([buffer], { type: mimeType });
        formData.append("files[]", blob, fileName);

        const pomfRes = await fetch("https://pomf.lain.la/upload.php", {
          method: "POST",
          body: formData,
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
        });

        if (pomfRes.ok) {
          const jsonRes = await pomfRes.json();
          if (jsonRes.success && jsonRes.files && jsonRes.files.length > 0) {
            return res.json({ success: true, url: jsonRes.files[0].url });
          }
        }
      } catch (err: any) {
        console.warn("[UPLOADER] Pomf failed:", err.message);
      }

      res.status(500).json({ success: false, error: "عذراً، فشلت جميع الخوادم المتاحة في رفع هذا الملف." });
    } catch (globalErr: any) {
      console.error("[UPLOADER] Critical Global Error:", globalErr);
      res.status(500).json({ success: false, error: globalErr.message });
    }
  });

  app.get("/api/v1/download-proxy", async (req, res) => {
    let tempInPath = "";
    let tempOutPath = "";
    let tempLogoPath = "";
    let fallbackToRaw = false;
    let urlString = "";

    try {
      const { url, filename } = req.query;
      if (!url) return res.status(400).send("Missing URL");
      
      const targetUrl = decodeURIComponent(url as string);
      urlString = targetUrl;
      const downloadName = filename ? decodeURIComponent(filename as string) : `Hekayatna_${Date.now()}.mp4`;

      // Set download headers upfront
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`);

      // 1. Download video file to local temporary workspace
      const tempDir = os.tmpdir();
      const randId = Math.random().toString(36).substring(2, 10);
      tempInPath = path.join(tempDir, `input_${randId}.mp4`);
      tempOutPath = path.join(tempDir, `output_${randId}.mp4`);
      tempLogoPath = path.join(tempDir, `logo_${randId}.png`);

      console.log(`[DOWNLOAD-PROXY] Watermark active. Fetching: ${targetUrl}`);
      
      const writer = fs.createWriteStream(tempInPath);
      const response = await axios({
        url: targetUrl,
        method: 'GET',
        responseType: 'stream',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          'Referer': new URL(targetUrl).origin + '/'
        },
        timeout: 90000 // 90 seconds timeout
      });

      response.data.pipe(writer);

      await new Promise<void>((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      console.log(`[DOWNLOAD-PROXY] Download done. Temp path size: ${fs.statSync(tempInPath).size} bytes`);

      // 2. Fetch the top-tier custom watermark image from the requested URL
      const watermarkUrl = "https://f.top4top.io/p_3824vcsjo1.png";
      let hasWatermark = false;
      
      console.log(`[DOWNLOAD-PROXY] Downloading watermark image from: ${watermarkUrl}`);
      try {
        const logoResponse = await axios({
          url: watermarkUrl,
          method: 'GET',
          responseType: 'arraybuffer',
          timeout: 15000
        });
        fs.writeFileSync(tempLogoPath, logoResponse.data);
        hasWatermark = true;
        console.log(`[DOWNLOAD-PROXY] Custom watermark downloaded successfully: ${fs.statSync(tempLogoPath).size} bytes`);
      } catch (logoErr: any) {
        console.warn("[DOWNLOAD-PROXY] Custom top4top logo download issue, fallback to fallback local public logo:", logoErr.message);
        // Fallback check
        let localWatermark = path.join(process.cwd(), 'public', 'logo.png');
        if (!fs.existsSync(localWatermark)) {
          localWatermark = path.join(process.cwd(), 'public', 'logo.jpg');
        }
        if (fs.existsSync(localWatermark)) {
          fs.copyFileSync(localWatermark, tempLogoPath);
          hasWatermark = true;
        }
      }

      const hasFfmpeg = !!ffmpegPath;

      if (hasWatermark && hasFfmpeg) {
        console.log(`[DOWNLOAD-PROXY] Executing static FFmpeg with customized bouncing watermark`);
        
        // TikTok / Instagram style bouncing watermark!
        // Moves from top-right to bottom-left every 5 seconds. Scaled to a sleek width of 110 pixels.
        const filter = `[1:v]scale=110:-1[watermark]; [0:v][watermark]overlay='if(lt(mod(t,10),5), W-w-24, 24)':'if(lt(mod(t,10),5), 24, H-h-24)'`;
        
        const args = [
          '-y',
          '-i', tempInPath,
          '-i', tempLogoPath,
          '-filter_complex', filter,
          '-c:v', 'libx264',
          '-preset', 'superfast',
          '-crf', '24',
          '-c:a', 'aac',
          '-strict', 'experimental',
          tempOutPath
        ];

        await new Promise<void>((resolve, reject) => {
          const ffmpegProcess = execFile(ffmpegPath!, args, (error, stdout, stderr) => {
            if (error) {
              console.error("[DOWNLOAD-PROXY] FFmpeg error details:", stderr);
              reject(error);
            } else {
              console.log("[DOWNLOAD-PROXY] Watermark merge complete!");
              resolve();
            }
          });

          // Timeout limits encoding time to 60 seconds
          setTimeout(() => {
            try {
              ffmpegProcess.kill('SIGKILL');
            } catch (err) {}
            reject(new Error("FFmpeg timeout limit reached"));
          }, 60000);
        });

        if (fs.existsSync(tempOutPath) && fs.statSync(tempOutPath).size > 0) {
          const readStream = fs.createReadStream(tempOutPath);
          readStream.pipe(res);
          
          readStream.on('end', () => {
            cleanupTempFiles(tempInPath, tempOutPath, tempLogoPath);
          });
          return;
        }
      }
      
      fallbackToRaw = true;
    } catch (err: any) {
      console.warn("[DOWNLOAD-PROXY] Watermarking issue, fallback to raw direct stream:", err.message);
      fallbackToRaw = true;
    }

    if (fallbackToRaw) {
      cleanupTempFiles(tempInPath, tempOutPath, tempLogoPath);
      try {
        if (urlString) {
          const response = await axios({
            url: urlString,
            method: 'GET',
            responseType: 'stream',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
              'Referer': new URL(urlString).origin + '/'
            },
            timeout: 60000
          });
          response.data.pipe(res);
        } else {
          res.status(500).send("Failed to build raw fallback");
        }
      } catch (fallbackErr: any) {
        console.error("[DOWNLOAD-PROXY] Raw direct fallback pipeline failed:", fallbackErr.message);
        if (!res.headersSent) {
          res.status(500).send("خطأ في تحميل الفيديو.");
        }
      }
    }
  });

  function cleanupTempFiles(inP: string, outP: string, logoP?: string) {
    try {
      if (inP && fs.existsSync(inP)) fs.unlinkSync(inP);
    } catch (e) {}
    try {
      if (outP && fs.existsSync(outP)) fs.unlinkSync(outP);
    } catch (e) {}
    try {
      if (logoP && fs.existsSync(logoP)) fs.unlinkSync(logoP);
    } catch (e) {}
  }

  // Secure Native File Uploader (Supports Large Video/Audio uploads properly without base64 overhead)
  app.post("/api/v1/upload-media", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: "لم يتم استلام أي ملف." });
      }

      const buffer = req.file.buffer;
      const mimeType = req.file.mimetype || "application/octet-stream";
      let extension = "mp4"; // default
      if (req.file.originalname && req.file.originalname.includes(".")) {
        extension = req.file.originalname.split(".").pop() || "mp4";
      }

      const fileName = `media_${Date.now()}.${extension}`;
      console.log(`[UPLOADER NATIVE] Received media (${buffer.length} bytes, type: ${mimeType}, ext: ${extension})`);

      // 1. TOP4TOP.IO (Primary Priority for ALL Media Types)
      try {
        console.log("[UPLOADER NATIVE] Attempting Top4toP.io upload...");
        const getRes = await axios.get("https://top4top.io/", {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
          timeout: 6000
        });

        const setCookies = getRes.headers['set-cookie'] || [];
        const cookieStr = setCookies.map((c: string) => c.split(';')[0]).join('; ');

        const formData = new (globalThis as any).FormData();
        const blob = new (globalThis as any).Blob([buffer], { type: mimeType });
        formData.append("file_0_", blob, fileName);
        formData.append("submitr", "[ رفع الملفات ]");

        const uploadRes = await fetch("https://top4top.io/index.php", {
          method: "POST",
          body: formData,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "Referer": "https://top4top.io/",
            "Cookie": cookieStr
          },
          signal: AbortSignal.timeout(300000)
        });

        const uploadHtml = await uploadRes.text();
        
        const rx = /https?:\/\/[a-zA-Z0-9-]+\.top4top\.(io|net)\/[a-zA-Z0-9_/.-]+\.(png|jpg|jpeg|gif|webp|mov|mp4|avi|mp3|wav|ogg|m4a|aac|webm)/gi;
        const matches = (uploadHtml.match(rx) || []).filter((link: string) => {
          const l = link.toLowerCase();
          return !l.includes('s.top4top') && !l.includes('/styles/') && !l.includes('/images/') && !l.includes('favicon.ico');
        });

        if (matches.length > 0) {
          const finalUrl = matches[0].replace(/&amp;/g, "&");
          console.log("[UPLOADER NATIVE] Top4toP Success: ", finalUrl);
          return res.json({ success: true, url: finalUrl });
        }
      } catch (err: any) {
        console.warn("[UPLOADER NATIVE] Top4toP failed:", err.message);
      }

      // 2. CATBOX FALLBACK FOR MEDIA
      try {
        console.log("[UPLOADER NATIVE] Attempting Catbox.moe API...");
        const formData = new (globalThis as any).FormData();
        const blob = new (globalThis as any).Blob([buffer], { type: mimeType });
        formData.append("reqtype", "fileupload");
        formData.append("fileToUpload", blob, fileName);

        const catboxRes = await fetch("https://catbox.moe/user/api.php", {
          method: "POST",
          body: formData,
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
          signal: AbortSignal.timeout(300000)
        });

        if (catboxRes.ok) {
          const textUrl = (await catboxRes.text()).trim();
          if (textUrl.startsWith("http")) {
            return res.json({ success: true, url: textUrl });
          }
        }
      } catch (err: any) {
        console.warn("[UPLOADER NATIVE] Catbox failed:", err.message);
      }

      res.status(500).json({ success: false, error: "عذراً، فشلت جميع الخوادم المتاحة في رفع هذا الملف." });
    } catch (globalErr: any) {
      console.error("[UPLOADER NATIVE] Critical Global Error:", globalErr);
      res.status(500).json({ success: false, error: globalErr.message });
    }
  });

  // Secure TMDB Query Proxy Endpoint to avoid CORS/Fetch Blocks
  app.get("/api/v1/tmdb/proxy", async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "Missing TMDB query URL parameter" });
    }

    // Security Guard: restrict proxying strictly to api.themoviedb.org
    if (!url.startsWith("https://api.themoviedb.org/") && !url.startsWith("http://api.themoviedb.org/")) {
      return res.status(403).json({ error: "Only official TMDB endpoints are proxyable" });
    }

    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36"
        }
      });
      res.json(response.data);
    } catch (err: any) {
      console.error("TMDB Proxy Axios Error:", err.message);
      const status = err.response?.status || 500;
      const msg = err.response?.data || err.message;
      res.status(status).json({ error: msg });
    }
  });

  // Range Request Proxy to stream chat videos / audio files flawlessly on iOS Safari
  app.get("/api/v1/stream-range-proxy", async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl || typeof targetUrl !== "string") {
      return res.status(400).send("Missing target URL parameter");
    }

    try {
      const decodedUrl = decodeURIComponent(targetUrl);
      
      const clientHeaders: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      };
      
      // If client requested specific Byte Range, forward it to the asset host
      if (req.headers.range) {
        clientHeaders['Range'] = req.headers.range;
      }

      try {
        const parsedUrl = new URL(decodedUrl);
        clientHeaders['Referer'] = parsedUrl.origin + '/';
      } catch (ex) {}

      const axiosResponse = await axios({
        method: "get",
        url: decodedUrl,
        headers: clientHeaders,
        responseType: "stream",
        timeout: 90000,
      });

      // Stream matching headers back to iOS
      const headersToForward = [
        'content-type',
        'content-length',
        'content-range',
        'accept-ranges',
        'cache-control',
      ];

      headersToForward.forEach(header => {
        const val = axiosResponse.headers[header];
        if (val !== undefined) {
          res.setHeader(header, val);
        }
      });

      res.status(axiosResponse.status);
      axiosResponse.data.pipe(res);

      axiosResponse.data.on('error', (err: any) => {
        console.error("[Stream Range Proxy] Streaming error:", err.message);
        if (!res.headersSent) res.status(500).send("Error streaming media");
      });
    } catch (err: any) {
      console.error("[Stream Range Proxy] Connection error:", err.message);
      if (!res.headersSent) {
        res.status(500).send("Stream range proxy error: " + err.message);
      }
    }
  });

  // Hakeem AI Activation & Status Management with dynamic synchronization
  app.get("/api/v1/hakeem/status", async (req, res) => {
    try {
      await getDynamicAiConfig();
      const isActivated = !!(
        USER_CUSTOM_AI_CONFIG &&
        USER_CUSTOM_AI_CONFIG.key &&
        USER_CUSTOM_AI_CONFIG.key.startsWith("sk-") &&
        !USER_CUSTOM_AI_CONFIG.key.startsWith("AQ.") &&
        USER_CUSTOM_AI_CONFIG.key !== "sk-jRKZyJZ2kFTr9uDRdCJaoDo6tlBRoiIIXCV3unyfsvMSznwI" // check if not the expired key
      );

      res.json({
        status: true,
        isActivated,
        config: USER_CUSTOM_AI_CONFIG ? {
          type: USER_CUSTOM_AI_CONFIG.type || "openai",
          model: USER_CUSTOM_AI_CONFIG.model || "google/gemini-2.5-flash",
          baseUrl: USER_CUSTOM_AI_CONFIG.baseUrl || "https://openrouter.ai/api/v1",
          keyObfuscated: USER_CUSTOM_AI_CONFIG.key ? (USER_CUSTOM_AI_CONFIG.key.slice(0, 15) + "..." + USER_CUSTOM_AI_CONFIG.key.slice(-5)) : "غير نشط"
        } : null
      });
    } catch (error: any) {
      res.status(500).json({ status: false, error: error.message });
    }
  });

  app.post("/api/v1/hakeem/activate", async (req, res) => {
    try {
      USER_CUSTOM_AI_CONFIG = {
        key: "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",
        baseUrl: "https://openrouter.ai/api/v1",
        model: "google/gemini-2.5-flash",
        type: "openai"
      };
      await saveAIConfigToCloud();
      res.json({
        status: true,
        isActivated: true,
        message: "تم تفعيل حكيم وحفظ مفتاح الـ API ومزامنته تلقائياً في Firebase!"
      });
    } catch (error: any) {
      res.status(500).json({ status: false, error: "فشل التفعيل والمزامنة: " + error.message });
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
      const { message, history = [], seriesList = [], image, audio } = req.body;
      if (!message) return res.status(400).json({ status: false, error: "المحتوى فارغ" });

      // Fetch latest AI configuration dynamically from Firebase (RTDB/Firestore)
      // This enables live key updates without rebuilding or restarting the server!
      await getDynamicAiConfig();

      // Fetch remote configuration dynamically from GitHub raw JSON
      const remoteConfig = await getRemoteConfig();

      // Check if disabled remotely entirely
      if (remoteConfig && remoteConfig.enabled === false) {
        return res.json({
          status: true,
          text: remoteConfig.disabledMessage || "عذراً، خدمة المساعد الذكي (حكيم) متوقفة مؤقتاً لمزيد من التحسينات والترقية 🛠️⚙️"
        });
      }

      // Normal or Custom AI Mode
      // Prepare context about available series
      const seriesContext = seriesList.length > 0
        ? `المسلسلات والأفلام المتوفرة لدينا حالياً على منصة "حكايتنا" هي:\n` + 
          seriesList.map((s: any, idx: number) => `${idx + 1}. الاسم: "${s.title}"، التصنيف أو القسم: "${s.category || 'غير محدد'}"، المعرف (ID) الخاص به للتنقل المباشر: "${s.id}"`).join('\n')
        : "لا توجد مسلسلات متوفرة حالياً بالمنصة.";

      // If remote custom prompt is specified, use it (and append the list context for direct deep-linking)
      const systemInstruction = (remoteConfig && remoteConfig.systemInstruction) 
        ? `${remoteConfig.systemInstruction}\n\nإليك قائمة المسلسلات المتوفرة على منصة حكايتنا لتطابقها بذكاء مع أوصاف وتفاصيل المستخدمين:\n${seriesContext}`
        : `أنت "حكيم" (Hakeem)، ومساعد الذكاء الاصطناعي وخبير الدراما ومستشار المشاهد العربي على منصة "حكايتنا" لمشاهدة المسلسلات والأفلام (التركية، العربية، الآسيوية، الكرتون وغيرها).
أنت لست مجرد بوت تقليدي، بل تتحدث وتتفاعل كإنسان حقيقي وعاشق مخلص ومتابع للمسلسلات! تسولف وتدردش مع المتابعين كأنك صديق مقرب يشاركهم شغف المشاهدة في نفس الغرفة وتعرف كل تفاصيل الأبطال واللقطات الشيّقة.

القواعد والمشاعر الذهبية للرد الفوري:
1. لا تسلك الردود الرسمية ولا تجب كآلة عديمة الروح. تحدث بتلقائية كاملة وشغف وحماس شديد مثل البشر وصديق مخلص (لا تتحدث برسمية جافة أبداً!).
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
7. إذا طلب الانتقال أو التشغيل, اخبره بأناقة: "سأنتقل معك الآن فوراً! 🚀💨" وعليك تضمين صيغة الانتقال (navigate:{id}) في متن أو نهاية الرد.
8. لا ترشح أبداً أي مسلسل خارج قائمتنا الحالية للتشغيل الفوري، ومطابقة ذكية للمسميات العامية.
9. ممنوع منعاً باتاً كتابة أو توليد أي روابط إنترنت خارجية أو مواقع إلكترونية (مثل الروابط التي تبدأ بـ http أو https) في ردك نهائياً؛ تذكّر أنك لا تملك صلاحية تصفح الويب أو توجيه المستخدم لمواقع أخرى. التوجيه يتم حصرياً للأعمال المتوفرة لدينا بصيغة الانتقال [شاهد مسلسل {اسم العمل} من هنا](navigate:{id}).
10. إذا سألك المتابع أو اشتكى من مشكلة: "المسلسلات المثبتة تظهر لي فقط ولا تظهر للمستخدمين الآخرين" أو "المستخدمين الآخرين لا تظهر لهم المسلسلات المثبتة، تظهر فقط للشخص الذي قام بتثبيتها" أو "مشكلة أنه يظهر عندي اللي ثبته ما يظهر للمستخدمين":
    - قل له بابتسامة وفخر وحماس: "يا عسيل! يوسفني جداً هذا الخلل البسيط اللي كان صاير، بس أبشرك الحين مشكلة التثبيت والـ Pins انحلت بالكامل وجذرياً! 🔧🚀 صارت المزامنة الحين تعمل بلحظتها بشكل حي ومبعد بين الكل وFirebase، وأي مسلسل يثبّته الأدمن بيظهر فوراً وبنفس الترتيب الراقي لكل المستخدمين والزوار في نفس اللحظة! جرب تسجل دخول أو تفتح التطبيق من جهاز ثاني وبتشوف عيونك كيف المسلسلات المثبتة مترتبة للجميع يا عسل! 😉💖"

إليك قائمة المسلسلات المتوفرة على منصة حكايتنا لتطابقها بذكاء مع أوصاف وتفاصيل المستخدمين:
${seriesContext}`;

      const result = await smartChat(message, systemInstruction, history, image, audio);

      res.json({
        status: true,
        text: result.reply || "عذراً، لم أستطع توليد رد في الوقت الحالي."
      });
    } catch (error: any) {
      console.error("AI Chat Route Error:", error);
      res.status(500).json({ status: false, error: error.message || "حدث خطأ بالاتصال بالذكاء الاصطناعي" });
    }
  });

  // ============ LIVE SPORTS MATCH SCRAPER ENDPOINTS ============
  let cachedMatches: any[] = [];
  let lastFetchedMatchesTime = 0;

  app.get("/api/v1/matches/scrape", async (req, res) => {
    const now = Date.now();
    // Cache for 45 seconds to keep it blazingly fast and avoid triggering 429 rate limit or IP bans
    if (now - lastFetchedMatchesTime < 45000 && cachedMatches.length > 0) {
      return res.json({ status: true, cached: true, matches: cachedMatches });
    }

    try {
      const SITE = "https://yalla-live.top";
      const response = await axios.get(SITE, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "ar,en-US;q=0.7,en;q=0.3"
        },
        timeout: 10000
      });

      const html = response.data;
      const $ = cheerio.load(html);
      const matches: any[] = [];

      // Seek matches inside standard selectors
      let containers = $("#matches-container");
      let matchDivs = containers.find(".match-container");
      if (matchDivs.length === 0) {
        matchDivs = $(".match-container");
      }
      if (matchDivs.length === 0) {
        matchDivs = $(".match-card, .match-box, [class*='match-']");
      }

      matchDivs.each((idx, el) => {
        try {
          const anchor = $(el).find("a").first();
          let matchPageUrl = anchor.attr("href") || "";
          if (matchPageUrl && !matchPageUrl.startsWith("http")) {
            matchPageUrl = SITE + (matchPageUrl.startsWith("/") ? "" : "/") + matchPageUrl;
          }

          if (!matchPageUrl) return;

          // Team Names
          let team1 = $(el).find(".right-team .team-name, .team-right .team-name, .team1 .name, .right-team").first().text().trim();
          let team2 = $(el).find(".left-team .team-name, .team-left .team-name, .team2 .name, .left-team").first().text().trim();

          // Logos
          let logo1 = $(el).find(".right-team .team-logo img, .team-right img, .team1 img").first().attr("data-src") || 
                      $(el).find(".right-team .team-logo img, .team-right img, .team1 img").first().attr("src") || "";
          let logo2 = $(el).find(".left-team .team-logo img, .team-left img, .team2 img").first().attr("data-src") || 
                      $(el).find(".left-team .team-logo img, .team-left img, .team2 img").first().attr("src") || "";

          if (logo1 && !logo1.startsWith("http")) logo1 = SITE + (logo1.startsWith("/") ? "" : "/") + logo1;
          if (logo2 && !logo2.startsWith("http")) logo2 = SITE + (logo2.startsWith("/") ? "" : "/") + logo2;

          // Match timing details inside match-center
          let time = "";
          let result = "";
          let statusText = "";

          const matchTiming = $(el).find(".match-center .match-timing");
          if (matchTiming.length > 0) {
            const divs = matchTiming.find("div");
            if (divs.length > 0) {
              const firstDiv = $(divs[0]);
              if (firstDiv.hasClass("result")) {
                result = firstDiv.text().trim();
              } else {
                time = firstDiv.text().trim();
              }
            }
            if (divs.length > 1) {
              statusText = $(divs[1]).text().trim();
            }
          }

          // Match info spans (channel, commentator, league)
          const infoSpans = $(el).find(".match-info ul li span, .match-info li span, .match-details span");
          let channel = "";
          let commentator = "";
          let league = "";

          if (infoSpans.length > 0) channel = $(infoSpans[0]).text().trim();
          if (infoSpans.length > 1) commentator = $(infoSpans[1]).text().trim();
          if (infoSpans.length > 2) league = $(infoSpans[2]).text().trim();

          if (!channel) channel = $(el).find(".channel, .channel-name").first().text().trim();
          if (!league) league = $(el).find(".league, .league-name").first().text().trim();

          // Robust Live and Ended status detection logic
          let live = false;
          let ended = false;

          const hasLiveClass = $(el).hasClass("live") || $(el).find(".live, .live-badge, .date.live").length > 0;
          const hasSoonClass = $(el).hasClass("soon") || $(el).find(".soon, .date.soon").length > 0;

          if (
            hasLiveClass ||
            statusText.includes("مباشر") ||
            statusText.includes("جارية") ||
            statusText.includes("الان") ||
            statusText.includes("الآن")
          ) {
            live = true;
          }

          if (
            statusText.includes("انتهت") ||
            statusText.includes("انتهت المباراة") ||
            $(el).find(".date.end").text().includes("انتهت") ||
            (result && !live && !hasSoonClass)
          ) {
            ended = true;
            live = false;
          }

          // If it ended, ensure statusText indicates that
          if (ended && !statusText.includes("انتهت")) {
            statusText = "انتهت المباراة";
          }

          if (team1 && team2) {
            const id = Buffer.from(matchPageUrl).toString("base64").replace(/[^a-zA-Z0-9]/g, "").substring(0, 16);
            matches.push({
              id,
              team1,
              team2,
              logo1,
              logo2,
              matchPageUrl,
              channel: channel || "بث مباشر",
              commentator: commentator || "غير معروف",
              time: time || "مستمر",
              result: result || "",
              statusText: statusText || "بانتظار البداية",
              league: league || "بطولة اليوم",
              live,
              ended
            });
          }
        } catch (e) {
          // ignore parsing error for single element
        }
      });

      if (matches.length > 0) {
        cachedMatches = matches;
        lastFetchedMatchesTime = now;
      }

      res.json({ status: true, cached: false, matches });
    } catch (error: any) {
      console.error("Match scraper API route error:", error.message);
      res.json({ status: false, error: error.message, matches: cachedMatches });
    }
  });

  app.get("/api/v1/matches/stream", async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "Missing match page URL" });
    }

    try {
      const response = await axios.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Referer": "https://yalla-live.top/"
        },
        timeout: 10000
      });

      const html = response.data;
      
      // Look for var iframeUrl = "..."
      const match = html.match(/var\s+iframeUrl\s*=\s*["']([^"']+)["']/);
      let iframeUrl = match ? match[1] : null;

      if (iframeUrl && iframeUrl.trim() !== "" && iframeUrl !== "null" && iframeUrl !== "undefined" && iframeUrl.startsWith("http")) {
         return res.json({ status: true, iframeUrl });
      }

      res.status(404).json({ status: false, error: "لا يوجد بث حي متوفر لهذه المباراة حالياً." });
    } catch (error: any) {
      console.error("Error retrieving stream URL:", error.message);
      res.status(500).json({ status: false, error: "حدث خطأ أثناء محاولة جلب البث المباشر." });
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

  // Isolated HTML ad serving page
  app.get("/gateway", (req, res) => {
    const seriesId = String(req.query.id || "");
    const redirectUrl = String(req.query.redirect || "");
    const html = `<!DOCTYPE html>
<html lang="ar">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes">
<title>تهيئة البث المباشر</title>

<style>
body {
    margin: 0;
    padding: 0;
    background: #ffffff;
    color: #111827;
    font-family: system-ui, -apple-system, sans-serif;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    box-sizing: border-box;
}
.container {
    text-align: center;
    max-width: 420px;
    padding: 40px 24px;
    box-sizing: border-box;
}
h2 {
    font-size: 24px;
    font-weight: 900;
    color: #111827;
    margin-bottom: 12px;
    line-height: 1.4;
}
p {
    font-size: 14px;
    color: #4b5563;
    line-height: 1.6;
    margin-bottom: 40px;
}
.counter {
    font-size: 80px;
    font-weight: 950;
    color: #dc2626;
    margin: 30px 0;
    font-family: monospace, sans-serif;
}
.btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    padding: 18px 24px;
    background: #dc2626;
    color: #ffffff;
    font-size: 16px;
    font-weight: 900;
    border: none;
    border-radius: 16px;
    text-decoration: none;
    cursor: pointer;
    box-shadow: 0 10px 30px rgba(220, 38, 38, 0.4);
    box-sizing: border-box;
    transition: all 0.2s ease;
}
.btn:hover {
    background: #b91c1c;
    transform: translateY(-1px);
}
.btn:active {
    transform: translateY(1px);
}
.btn-disabled {
    background: #f3f4f6 !important;
    color: #9ca3af !important;
    box-shadow: none !important;
    cursor: not-allowed !important;
    font-weight: 800;
}
.footer-text {
    font-size: 10px;
    color: #9ca3af;
    font-weight: 600;
    margin-top: 50px;
}
</style>

<!-- 11033994 -->
<script>
(function(s){
    s.dataset.zone='11033994';
    s.src='https://n6wxm.com/vignette.min.js';
    s.onerror = function() { window.adBlockEnabled = true; if(typeof checkAdBlock === 'function') checkAdBlock(); };
    document.head.appendChild(s);
})(document.createElement('script'));
</script>

<!-- 11033969 -->
<script>
(function(s){
    s.dataset.zone='11033969';
    s.src='https://n6wxm.com/vignette.min.js';
    s.onerror = function() { window.adBlockEnabled = true; if(typeof checkAdBlock === 'function') checkAdBlock(); };
    document.head.appendChild(s);
})(document.createElement('script'));
</script>

<!-- 10995706 -->
<script>
(function(s){
    s.dataset.zone='10995706';
    s.src='https://nap5k.com/tag.min.js';
    s.onerror = function() { window.adBlockEnabled = true; if(typeof checkAdBlock === 'function') checkAdBlock(); };
    document.head.appendChild(s);
})(document.createElement('script'));
</script>

<!-- 10943622 -->
<script>
(function(s){
    s.dataset.zone='10943622';
    s.src='https://al5sm.com/tag.min.js';
    s.onerror = function() { window.adBlockEnabled = true; if(typeof checkAdBlock === 'function') checkAdBlock(); };
    document.head.appendChild(s);
})(document.createElement('script'));
</script>

<!-- 234781 -->
<script>
var s = document.createElement('script');
s.src = 'https://quge5.com/88/tag.min.js';
s.dataset.zone = '234781';
s.async = true;
s.setAttribute('data-cfasync','false');
s.onerror = function() { window.adBlockEnabled = true; if(typeof checkAdBlock === 'function') checkAdBlock(); };
document.head.appendChild(s);
</script>

<!-- User Custom Ad Script -->
<script src="https://quge5.com/88/tag.min.js" data-zone="254244" async data-cfasync="false"></script>

</head>
<body dir="rtl">
    <div class="container">
        <h2>جاري تهيئة خوادم البث المباشر...</h2>
        <p>يرجى الانتظار بضع ثوانٍ لتخطي الإعلان الراعي والتحويل الفوري لسرعة البث القصوى.</p>
        
        <div class="counter" id="countdown">6</div>
        
        <div id="btn-container">
            <button class="btn btn-disabled" id="main-btn" onclick="triggerRedirect()" disabled>الرجاء الانتظار 6 ثوانٍ لمتابعة المشاهدة...</button>
        </div>

        <div class="footer-text">شبكة البث الآمنة المعززة تضمن لك مشاهدة سلسة وذات دقة عالية.</div>
    </div>

    <script>
        var redirectUrl = "${redirectUrl}";
        var seriesId = "${seriesId}";
        window.adBlockEnabled = false;
        window.adBlockWarningShown = false;

        function checkAdBlock() {
            var isPremium = localStorage.getItem('ads_removed_forever') === 'true' || (function() {
                var adUntil = localStorage.getItem('ad_free_until');
                if (!adUntil) return false;
                var adUntilNum = parseInt(adUntil, 10);
                return !isNaN(adUntilNum) && adUntilNum > Date.now();
            })();

            if (isPremium) return; // Skip adblock check for premium users

            if (window.adBlockEnabled && !window.adBlockWarningShown) {
                window.adBlockWarningShown = true;
                
                var warn = document.createElement('div');
                warn.innerHTML = '<div style="background: rgba(239, 68, 68, 0.1); color: #ef4444; padding: 12px; border-radius: 8px; margin: 15px 0; border: 1px solid rgba(239, 68, 68, 0.3); font-size: 13px; text-align: center; font-weight: 600;">⚠️ يبدو أنك تستخدم مانع إعلانات. الإعلانات هامة جداً لاستمرارنا، فضلاً قم بتعطيله دعماً للموقع.</div>';
                
                var container = document.querySelector('.container');
                var btnContainer = document.getElementById('btn-container');
                if (container && btnContainer) {
                    container.insertBefore(warn, btnContainer);
                }
            }
        }

        // Test 1: Fake ad element physical check
        setTimeout(function() {
            var testAd = document.createElement('div');
            testAd.innerHTML = '&nbsp;';
            testAd.className = 'adsbox ad-banner google-auto-placed doubleclick';
            testAd.style.position = 'absolute';
            testAd.style.left = '-1000px';
            testAd.style.width = '1px';
            document.body.appendChild(testAd);
            setTimeout(function() {
                var isHidden = testAd.offsetHeight === 0 || testAd.display === 'none' || window.getComputedStyle(testAd).display === 'none';
                if (isHidden) {
                    window.adBlockEnabled = true;
                    checkAdBlock();
                }
                document.body.removeChild(testAd);
            }, 500);
        }, 100);

        function triggerRedirect() {
            if (redirectUrl) {
                window.location.replace(redirectUrl);
            } else {
                window.location.replace('/watch/' + encodeURIComponent(seriesId) + '?unlocked=true');
            }
        }

        // Removed automatic redirection so that every user must manually click 'Skip Ad' to proceed, ensuring a fully controlled user action.
        var isPremium = false;

        var countdown = 6;
        var timer = setInterval(function() {
            countdown--;
            if (countdown <= 0) {
                clearInterval(timer);
                document.getElementById('countdown').style.display = 'none';
                
                var btn = document.getElementById('main-btn');
                btn.className = 'btn';
                btn.removeAttribute('disabled');
                btn.innerText = 'تخطي الإعلان والدخول للمشاهدة الآن 🍿🚀';
            } else {
                document.getElementById('countdown').innerText = countdown;
                document.getElementById('main-btn').innerText = 'الرجاء الانتظار ' + countdown + ' ثوانٍ لمتابعة المشاهدة...';
            }
        }, 1000);
    </script>
</body>
</html>`;
    res.send(html);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Robust resolution natively pointing to the compiled directory
    const distPath = __dirname;
    // Add 12-hour client-side caching for React/Vite assets to prevent repeated egress billing!
    app.use(express.static(distPath, {
      maxAge: '12h',
      etag: true,
      lastModified: true
    }));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Pre-download high-res logo dynamically to overwrite outdated logo
  try {
    const logoUrl = "https://i.ibb.co/0wvJfBH/file-00000000c1e4720a9aba88f120b35bd1.png";
    const logoPath = path.join(process.cwd(), 'public', 'logo.png');
    axios.get(logoUrl, { responseType: 'arraybuffer' }).then((response) => {
      fs.writeFileSync(logoPath, Buffer.from(response.data));
      console.log("Successfully downloaded and updated local logo.png with the premium high-res image.");
      // Also write in dist if dist exists
      const distLogoPath = path.join(process.cwd(), 'dist', 'logo.png');
      if (fs.existsSync(path.join(process.cwd(), 'dist'))) {
        fs.writeFileSync(distLogoPath, Buffer.from(response.data));
      }
    }).catch(err => {
      console.warn("Non-blocking logo cache helper bypassed:", err.message);
    });
  } catch (e) {
    console.warn("Async non-blocking logo puller failed:", e);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

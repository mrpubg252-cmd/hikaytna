import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import * as cheerio from "cheerio";

const app = express();
const PORT = 3000;

const SOURCE_URL = "https://3iskk.xyz";

const axiosInstance = axios.create({
  timeout: 15000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Referer': SOURCE_URL,
    'Origin': SOURCE_URL,
    'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
    'Sec-Fetch-Dest': 'iframe',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'same-origin',
    'Upgrade-Insecure-Requests': '1',
    'Connection': 'keep-alive'
  }
});

// Helper to clean slugs
const cleanSlug = (link: string, type: 'episodes' | 'tvshows') => {
  if (!link) return "";
  const parts = link.split(`/${type}/`);
  return parts.length > 1 ? parts[1].replace(/\/$/, "") : "";
};

// Helper to clean branding
const cleanBranding = (text: string) => {
  if (!text) return "";
  return text
    .replace(/قصة عشق/g, "حكايتنا")
    .replace(/موقع قصة عشق/g, "موقع حكايتنا")
    .replace(/Qissat Ishq/g, "Hikaytna")
    .replace(/3isk/g, "حكايتنا")
    .replace(/موقع قصة عشق الاصلي/g, "موقع حكايتنا الأصلي");
};

app.use(express.json());

// API Routes
app.get("/api/latest-episodes", async (req, res) => {
  try {
    const { data } = await axiosInstance.get(SOURCE_URL);
    const $ = cheerio.load(data);
    const episodes: any[] = [];

    $(".items-latest-eps .type_item_box, .items-latest-updated .type_item_box, .home-items-container .type_item_box, .latest-episodes .type_item_box").each((_, el) => {
      const title = cleanBranding($(el).find(".item_title").text().trim());
      const link = $(el).find("a").attr("href") || "";
      const img = $(el).find(".item_img").attr("data-image") || $(el).find(".item_img").attr("src") || "";
      const episodeNum = $(el).find(".item_overlap span").text().trim() || 
                        $(el).find(".item_overlap").text().trim().replace("حلقة", "").trim() ||
                        title.match(/الحلقة (\d+)/)?.[1] || "";
      const slug = cleanSlug(link, 'episodes');

      if (slug && !episodes.find(e => e.slug === slug)) {
        episodes.push({ title, slug, img, episodeNum });
      }
    });

    res.json(episodes);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch episodes" });
  }
});

app.get("/api/featured", async (req, res) => {
  try {
    const { data } = await axiosInstance.get(SOURCE_URL);
    const $ = cheerio.load(data);
    const featured: any[] = [];

    $(".items-featured-genres .type_item_wide_box").each((_, el) => {
      const title = cleanBranding($(el).find(".item_title").text().trim());
      const link = $(el).find("a").attr("href") || "";
      const img = $(el).find(".item_img").attr("data-image") || $(el).find(".item_img").attr("src") || "";
      const slug = cleanSlug(link, 'tvshows');

      if (slug) featured.push({ title, slug, img });
    });

    res.json(featured);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch featured" });
  }
});

app.get("/api/series/:slug", async (req, res) => {
  const { slug } = req.params;
  try {
    const { data } = await axiosInstance.get(`${SOURCE_URL}/watch/tvshows/${slug}/`);
    const $ = cheerio.load(data);

    const title = cleanBranding($(".title").first().text().trim());
    const description = cleanBranding($(".description").first().text().trim());
    const img = $(".poster img").attr("src") || "";
    const backdropStyle = $(".backdrop_big").attr("style") || "";
    const backdropMatch = backdropStyle.match(/url\(['"]?([^'"]+)['"]?\)/);
    const backdrop = backdropMatch ? backdropMatch[1] : "";

    const seasons: any[] = [];
    $(".seasons-selection ul li").each((_, el) => {
      seasons.push({
        num: $(el).attr("data-value"),
        title: cleanBranding($(el).find("b").text().trim())
      });
    });

    // Improved season/episode scraping
    const episodes: any[] = [];
    
    // Try multiple selectors as the site structure might vary
    const epSelectors = [
      ".season-eps a.ep-num",
      ".episodes-list a.ep-num",
      ".items_list.season-eps a"
    ];

    let epElements: any = null;
    for (const selector of epSelectors) {
      const found = $(selector);
      if (found.length > 0) {
        epElements = found;
        break;
      }
    }

    if (epElements) {
      epElements.each((_, el) => {
        const epLink = $(el).attr("href") || "";
        const epNumStr = $(el).find("b").text().trim() || $(el).attr("data-ep-num") || "";
        const epTitle = cleanBranding($(el).attr("title") || "");
        const epSlug = cleanSlug(epLink, 'episodes');
        if (epSlug) {
          episodes.push({ 
            epNum: parseInt(epNumStr) || 0, 
            epSlug, 
            title: epTitle.replace("مسلسل ", "").split(" الحلقة")[0] || epTitle 
          });
        }
      });
    }

    // Sort episodes ascending (1, 2, 3...)
    episodes.sort((a, b) => a.epNum - b.epNum);

    res.json({ title, description, img, backdrop, seasons, episodes });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch series details" });
  }
});

app.get("/api/episode/:slug", async (req, res) => {
  const { slug } = req.params;
  try {
    // 1. Fetch main landing page
    const landingUrl = `${SOURCE_URL}/watch/episodes/${slug}/`;
    const landingRes = await axiosInstance.get(landingUrl);
    const $landing = cheerio.load(landingRes.data);

    const title = cleanBranding($landing(".title").first().text().trim() || $landing("title").text().trim());

    const seriesLink = $landing(".single-serie-btn").attr("href") || $landing(".breadcrumb a").last().attr("href") || $landing(".series-title a").attr("href");
    let seriesSlug = seriesLink ? cleanSlug(seriesLink, 'tvshows') : "";

    // Fallback: extract series slug from episode slug (e.g., 'series-name-episode-1' -> 'series-name')
    if (!seriesSlug && slug.includes("-الحلقة-")) {
      seriesSlug = slug.split("-الحلقة-")[0];
    } else if (!seriesSlug && slug.includes("-episode-")) {
      seriesSlug = slug.split("-episode-")[0];
    }

    const servers: any[] = [];
    let iframeSrc = "";

    // 2. Try the two-post flow to get the player page
    try {
      const form = $landing("div.single_buttons form").first();
      const actionUrl1 = form.attr('action');
      const newsValue1 = form.find("input[name='news']").val();
      const uValue1 = form.find("input[name='u']").val();

      if (actionUrl1 && newsValue1) {
        const params1 = new URLSearchParams();
        params1.append('news', String(newsValue1));
        params1.append('u', String(uValue1 || ''));
        params1.append('submit', 'submit');

        const res1 = await axiosInstance.post(actionUrl1, params1, {
          headers: {
            'Referer': landingUrl,
            'Origin': SOURCE_URL,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Upgrade-Insecure-Requests': '1',
          }
        });

        const $res1 = cheerio.load(res1.data);

        let myUrl = null;
        let myInputValue = null;

        $res1("script").each((_, el) => {
          const text = $res1(el).html() || "";
          if (text.includes("myUrl") && text.includes("myInput.value")) {
            const urlMatch = text.match(/myUrl\s*=\s*"([^"]+)"/);
            if (urlMatch) myUrl = urlMatch[1];

            const valMatch = text.match(/myInput\.value\s*=\s*"([^"]+)"/);
            if (valMatch) myInputValue = valMatch[1];
          }
        });

        if (myUrl && myInputValue) {
          const params2 = new URLSearchParams();
          params2.append('news', myInputValue);
          params2.append('u', '');
          params2.append('submit', 'submit');

          const res2 = await axiosInstance.post(myUrl, params2, {
            headers: {
              'Referer': actionUrl1,
              'Origin': SOURCE_URL,
              'Content-Type': 'application/x-www-form-urlencoded',
              'Upgrade-Insecure-Requests': '1',
            }
          });

          const $res2 = cheerio.load(res2.data);

          $res2("#player_servers li").each((_, el) => {
            const name = $res2(el).find(".server_name").text().trim();
            const type = $res2(el).attr("data-type");
            const post = $res2(el).attr("data-post");
            const nume = $res2(el).attr("data-nume");

            servers.push({
              name,
              url: `/api/proxy-embed?nume=${nume}&post=${post}&type=${type}`
            });
          });

          const defaultIframe = $res2("iframe").first().attr("src");
          if (defaultIframe) {
            iframeSrc = defaultIframe;
          }
        }
      }
    } catch (postFlowError) {
      console.error("Two-post flow failed, falling back to direct landing page scraping:", postFlowError);
    }

    // Fallback: if two-post flow returned no servers, try to scrape directly from landing page (just in case they change it back)
    if (servers.length === 0) {
      $landing("#player_servers li").each((_, el) => {
        const name = $landing(el).find(".server_name").text().trim();
        const type = $landing(el).attr("data-type");
        const post = $landing(el).attr("data-post");
        const nume = $landing(el).attr("data-nume");

        servers.push({
          name,
          url: `/api/proxy-embed?nume=${nume}&post=${post}&type=${type}`
        });
      });
    }

    if (!iframeSrc && servers.length > 0) {
      iframeSrc = servers[0].url;
    }

    res.json({ title, iframeSrc, servers, seriesSlug });
  } catch (error) {
    console.error("Failed to fetch episode details:", error);
    res.status(500).json({ error: "Failed to fetch episode details" });
  }
});

// Proxy for Embeds to handle Referer/CORS and spoof origin
app.get("/api/proxy-embed", async (req, res) => {
  const { nume, post, type } = req.query;
  const mappedType = type === "tv" ? "2" : "1";
  const targetUrl = `${SOURCE_URL}/embed/${nume}/${post}/${mappedType}/`;
  
  try {
    const response = await axiosInstance.get(targetUrl);
    let html = response.data;
    
    const $ = cheerio.load(html);
    const myHost = `${req.protocol}://${req.get('host')}`;
    
    // Find all iframes inside the embed and proxy them recursively
    $("iframe").each((_, el) => {
      const src = $(el).attr("src");
      if (src) {
        let resolvedSrc = src;
        if (src.startsWith("/")) {
          resolvedSrc = `${SOURCE_URL}${src}`;
        } else if (!src.startsWith("http")) {
          resolvedSrc = `${SOURCE_URL}/${src}`;
        }
        $(el).attr("src", `${myHost}/api/proxy-player?url=${encodeURIComponent(resolvedSrc)}`);
      }
    });

    html = $.html();
    
    html = html.replace(/<\/head>/, `
      <style>
        body { background: black !important; color: white; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; overflow: hidden; }
        iframe { border: none; width: 100%; height: 100%; }
        .loading-proxy { position: fixed; inset: 0; background: black; display: flex; align-items: center; justify-content: center; z-index: 9999; font-family: sans-serif; }
      </style>
      <base href="${SOURCE_URL}/">
      <meta name="referrer" content="no-referrer">
      </head>
    `);

    // Inject script to handle potential clicks/popups and ensure player fills screen
    html = html.replace(/<\/body>/, `
      <script>
        // Try to fix some common player issues
        window.addEventListener('load', () => {
          const iframes = document.getElementsByTagName('iframe');
          for(let i=0; i<iframes.length; i++) {
            iframes[i].style.width = '100%';
            iframes[i].style.height = '100%';
          }
        });
      </script>
      </body>
    `);
    
    res.send(html);
  } catch (error) {
    console.error("Proxy error:", error);
    res.status(500).send("Player proxy error");
  }
});

// New Proxy endpoint for actual player iframes (like miravd.com)
app.get("/api/proxy-player", async (req, res) => {
  const { url } = req.query;
  if (!url || typeof url !== "string") {
    return res.status(400).send("Missing player URL");
  }

  try {
    const response = await axiosInstance.get(url, {
      headers: {
        'Referer': SOURCE_URL,
        'Origin': SOURCE_URL,
      }
    });
    let html = response.data;
    const parsedUrl = new URL(url);
    const origin = parsedUrl.origin;

    const $ = cheerio.load(html);
    const myHost = `${req.protocol}://${req.get('host')}`;

    // Rewrite any nested iframes recursively
    $("iframe").each((_, el) => {
      const src = $(el).attr("src");
      if (src) {
        let resolvedSrc = src;
        if (src.startsWith("/")) {
          resolvedSrc = `${origin}${src}`;
        } else if (!src.startsWith("http")) {
          resolvedSrc = `${origin}/${src}`;
        }
        $(el).attr("src", `${myHost}/api/proxy-player?url=${encodeURIComponent(resolvedSrc)}`);
      }
    });

    // Make sure we have a base tag so relative files like JS/CSS load from their origin
    if ($("head").length > 0) {
      $("head").prepend(`<base href="${origin}/">`);
      $("head").prepend(`<meta name="referrer" content="no-referrer">`);
    } else {
      $("html").prepend(`<head><base href="${origin}/"><meta name="referrer" content="no-referrer"></head>`);
    }

    res.send($.html());
  } catch (error) {
    console.error("Player proxy error:", error);
    res.status(500).send("Failed to proxy player");
  }
});

// Dean Edwards unpacker
function deobfuscateDeanEdwards(packedCode: string): string {
  const match = packedCode.match(/eval\s*\(\s*function\s*\(\s*p\s*,\s*a\s*,\s*c\s*,\s*k\s*,\s*e\s*,\s*d\s*\)\s*\{.*?\}\s*\(\s*'(.*?)'\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*'(.*?)'[\s\S]*?\.split\s*\(\s*'\|'\s*\)\s*\)\s*\)/);
  if (!match) return "";

  let [_, p, aStr, cStr, kStr] = match;
  let a = parseInt(aStr, 10);
  let c = parseInt(cStr, 10);
  let k = kStr.split('|');

  const baseConverter = (num: number, radix: number): string => {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (num < radix) {
      return chars[num];
    }
    return baseConverter(Math.floor(num / radix), radix) + chars[num % radix];
  };

  const dict: Record<string, string> = {};
  for (let i = 0; i < k.length; i++) {
    if (k[i]) {
      const key = baseConverter(i, a);
      dict[key] = k[i];
    }
  }

  return p.replace(/\b[a-zA-Z0-9_]+\b/g, (token) => {
    return dict[token] || token;
  });
}

async function resolveDirectVideo(nume: string, post: string, type: string): Promise<{ videoUrl: string | null; type: string; playerIframeSrc?: string } | null> {
  const mappedType = type === "tv" ? "2" : "1";
  const targetUrl = `${SOURCE_URL}/embed/${nume}/${post}/${mappedType}/`;
  try {
    // 1. Fetch the 3iskk embed wrapper page
    const embedRes = await axiosInstance.get(targetUrl);
    const $embed = cheerio.load(embedRes.data);
    
    // Find the actual player iframe source
    const playerIframeSrc = $embed("iframe").first().attr("src");
    if (!playerIframeSrc) return null;

    let absolutePlayerIframeSrc = playerIframeSrc;
    if (playerIframeSrc.startsWith("//")) {
      absolutePlayerIframeSrc = `https:${playerIframeSrc}`;
    } else if (playerIframeSrc.startsWith("/")) {
      absolutePlayerIframeSrc = `${SOURCE_URL}${playerIframeSrc}`;
    } else if (!playerIframeSrc.startsWith("http")) {
      absolutePlayerIframeSrc = `${SOURCE_URL}/${playerIframeSrc}`;
    }

    // 2. Fetch the player page with correct Referer/Origin spoofing
    const playerRes = await axiosInstance.get(absolutePlayerIframeSrc, {
      headers: {
        'Referer': SOURCE_URL,
        'Origin': SOURCE_URL
      }
    });
    
    const playerHtml = playerRes.data;
    const $player = cheerio.load(playerHtml);
    
    // Try to find a direct video tag or source tag first
    let directVideoSrc = $player("video source").first().attr("src") || $player("video").first().attr("src");
    if (directVideoSrc) {
      const playerParsed = new URL(absolutePlayerIframeSrc);
      if (directVideoSrc.startsWith("//")) {
        directVideoSrc = `${playerParsed.protocol}${directVideoSrc}`;
      } else if (directVideoSrc.startsWith("/")) {
        directVideoSrc = `${playerParsed.origin}${directVideoSrc}`;
      } else if (!directVideoSrc.startsWith("http")) {
        const parent = absolutePlayerIframeSrc.substring(0, absolutePlayerIframeSrc.lastIndexOf("/") + 1);
        directVideoSrc = `${parent}${directVideoSrc}`;
      }
      return {
        videoUrl: directVideoSrc,
        type: directVideoSrc.includes(".m3u8") ? "application/x-mpegURL" : "video/mp4",
        playerIframeSrc: absolutePlayerIframeSrc
      };
    }

    // Look through all script tags or the entire HTML content for video URLs
    let matchedUrl: string | null = null;
    
    const searchInText = (text: string) => {
      // 1. Quoted string match
      const quotedRegex = /(["'])([^"'\s]+?\.(?:m3u8|mp4|webm)(?:\?[^"']*)?)\1/gi;
      let match;
      while ((match = quotedRegex.exec(text)) !== null) {
        let u = match[2];
        u = u.replace(/\\/g, "");
        if (u.includes(".m3u8") || u.includes(".mp4") || u.includes(".webm")) {
          return u;
        }
      }
      
      // 2. Fallback to unquoted absolute url regex
      const absMatch = text.match(/(https?:\/\/[^"'\s]+?\.(?:m3u8|mp4|webm)[^"'\s]*)/i);
      if (absMatch) {
        return absMatch[1].replace(/\\/g, "");
      }
      return null;
    };

    $player("script").each((_, el) => {
      if (matchedUrl) return;
      const text = $player(el).html() || "";
      
      // If packed, deobfuscate first
      if (text.includes("eval(function(p,a,c,k,e,d)")) {
        const unpacked = deobfuscateDeanEdwards(text);
        if (unpacked) {
          const found = searchInText(unpacked);
          if (found) matchedUrl = found;
        }
      } else {
        const found = searchInText(text);
        if (found) matchedUrl = found;
      }
    });

    if (!matchedUrl) {
      matchedUrl = searchInText(playerHtml);
    }

    if (matchedUrl) {
      // Clean up potential escaping in the matched URL (e.g. \/ to /)
      matchedUrl = matchedUrl.replace(/\\/g, '');
      const playerParsed = new URL(absolutePlayerIframeSrc);
      if (matchedUrl.startsWith("//")) {
        matchedUrl = `${playerParsed.protocol}${matchedUrl}`;
      } else if (matchedUrl.startsWith("/")) {
        matchedUrl = `${playerParsed.origin}${matchedUrl}`;
      } else if (!matchedUrl.startsWith("http")) {
        const parent = absolutePlayerIframeSrc.substring(0, absolutePlayerIframeSrc.lastIndexOf("/") + 1);
        matchedUrl = `${parent}${matchedUrl}`;
      }

      return {
        videoUrl: matchedUrl,
        type: matchedUrl.includes(".m3u8") ? "application/x-mpegURL" : "video/mp4",
        playerIframeSrc: absolutePlayerIframeSrc
      };
    }
    
    return null;
  } catch (error) {
    console.error("Error in resolveDirectVideo:", error);
    return null;
  }
}

app.get("/api/resolve-video", async (req, res) => {
  const { url } = req.query;
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "Missing parameters" });
  }

  try {
    // URL looks like: /api/proxy-embed?nume=1&post=247570&type=2
    // We can parse the parameters
    const parsed = new URL(url, "http://localhost");
    const nume = parsed.searchParams.get("nume");
    const post = parsed.searchParams.get("post");
    const type = parsed.searchParams.get("type");

    if (nume && post && type) {
      const resolved = await resolveDirectVideo(nume, post, type);
      if (resolved && resolved.videoUrl) {
        // Point to our proxy-hls endpoint!
        const proxiedUrl = `/api/proxy-hls?url=${encodeURIComponent(resolved.videoUrl)}` +
          (resolved.playerIframeSrc ? `&referer=${encodeURIComponent(resolved.playerIframeSrc)}` : '');
        return res.json({
          videoUrl: proxiedUrl,
          type: resolved.type
        });
      }
    }
    
    return res.json({ videoUrl: null });
  } catch (error) {
    console.error("Resolve video error:", error);
    res.status(500).json({ error: "Failed to resolve video" });
  }
});

// Advanced HLS proxy that rewrites .m3u8 playlists and proxies .ts segments with custom headers
app.get("/api/proxy-hls", async (req, res) => {
  const { url, referer } = req.query;
  if (!url || typeof url !== "string") {
    return res.status(400).send("Missing HLS URL");
  }

  try {
    const parsedUrl = new URL(url);
    const parentUrl = url.substring(0, url.lastIndexOf("/") + 1);

    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
    };

    if (referer && typeof referer === 'string') {
      headers['Referer'] = referer;
      try {
        headers['Origin'] = new URL(referer).origin;
      } catch {
        headers['Origin'] = SOURCE_URL;
      }
    } else {
      headers['Referer'] = SOURCE_URL;
      headers['Origin'] = SOURCE_URL;
    }

    const response = await axiosInstance.get(url, {
      responseType: 'arraybuffer',
      headers,
    });

    const contentTypeRaw = response.headers['content-type'];
    const contentType = typeof contentTypeRaw === 'string' ? contentTypeRaw : '';
    const isM3U8 = url.endsWith('.m3u8') || 
                   contentType.includes('mpegURL') || 
                   contentType.includes('application/x-mpegurl') || 
                   contentType.includes('vnd.apple.mpegurl');

    if (isM3U8) {
      const text = response.data.toString('utf-8');
      const lines = text.split('\n');
      
      const refererParam = referer ? String(referer) : '';
      const rewrittenLines = lines.map((line) => {
        const trimmed = line.trim();
        if (!trimmed) return line;

        // Skip comments unless they are tags with URI attributes (e.g. key decryption)
        if (trimmed.startsWith('#')) {
          return trimmed.replace(/(URI\s*=\s*")([^"]+)(")/gi, (match, p1, p2, p3) => {
            let resolvedUrl = p2;
            if (!p2.startsWith('http')) {
              if (p2.startsWith('/')) {
                resolvedUrl = `${parsedUrl.origin}${p2}`;
              } else {
                resolvedUrl = `${parentUrl}${p2}`;
              }
            }
            const proxyUrl = `/api/proxy-hls?url=${encodeURIComponent(resolvedUrl)}${refererParam ? `&referer=${encodeURIComponent(refererParam)}` : ''}`;
            return `${p1}${proxyUrl}${p3}`;
          });
        }

        // URI line (either absolute or relative path to segment/sub-playlist)
        let resolvedUrl = trimmed;
        if (!trimmed.startsWith('http')) {
          if (trimmed.startsWith('/')) {
            resolvedUrl = `${parsedUrl.origin}${trimmed}`;
          } else {
            resolvedUrl = `${parentUrl}${trimmed}`;
          }
        }

        return `/api/proxy-hls?url=${encodeURIComponent(resolvedUrl)}${refererParam ? `&referer=${encodeURIComponent(refererParam)}` : ''}`;
      });

      res.setHeader('Content-Type', 'application/x-mpegURL');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.send(rewrittenLines.join('\n'));
    } else {
      // It's a .ts segment or binary file
      res.setHeader('Content-Type', contentType || 'video/MP2T');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(response.data);
    }
  } catch (error) {
    console.error("HLS proxy error:", error);
    res.status(500).send("Failed to proxy HLS");
  }
});


app.get("/api/search", async (req, res) => {
  const { s } = req.query;
  try {
    const { data } = await axiosInstance.get(`${SOURCE_URL}/?s=${s}`);
    const $ = cheerio.load(data);
    const results: any[] = [];

    $(".type_item_box").each((_, el) => {
      const title = cleanBranding($(el).find(".item_title").text().trim());
      const link = $(el).find("a").attr("href") || "";
      const img = $(el).find(".item_img").attr("data-image") || $(el).find(".item_img").attr("src") || "";
      
      let slug = "";
      let type = "episode";
      
      if (link.includes("/tvshows/")) {
        slug = cleanSlug(link, 'tvshows');
        type = "series";
      } else if (link.includes("/episodes/")) {
        slug = cleanSlug(link, 'episodes');
        type = "episode";
      }

      if (slug) results.push({ title, slug, img, type });
    });

    res.json(results);
  } catch (error) {
    res.status(500).json({ error: "Search failed" });
  }
});

// Vite middleware
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

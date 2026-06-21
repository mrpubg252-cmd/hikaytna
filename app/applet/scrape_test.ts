import axios from "axios";
import * as cheerio from "cheerio";
import https from "https";
import http from "http";

async function run() {
  const { data } = await axios.get("https://t.alooytv8.xyz/watch/cqc7rwwjoibp.html?key=9e5dac6e0584", {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      httpAgent: new http.Agent({ family: 4 }),
      httpsAgent: new https.Agent({ rejectUnauthorized: false, family: 4 }),
  });
  
  const $ = cheerio.load(data);
  const parsedOriginalUrl = new URL("https://t.alooytv8.xyz/watch/cqc7rwwjoibp.html?key=9e5dac6e0584");
  const originalPath = parsedOriginalUrl.pathname;
  
  const episodesMap = new Map();
  $('.episodes-list a, .list-episodes a, a[href*="/watch/"], .seasons a').each((i, el) => {
    const epTitle = $(el).text().replace(/\n/g, '').trim();
    const epHref = $(el).attr('href');
    if (!epHref || !epTitle || !epHref.includes("/watch/")) return;
    let fullHref = epHref;
    if (!fullHref.startsWith("http")) fullHref = `${parsedOriginalUrl.origin}${fullHref.startsWith("/") ? "" : "/"}${fullHref}`;
    let parsedHref;
    try { parsedHref = new URL(fullHref); } catch (e) { return; }
    const isExplicitList = $(el).parents('.episodes-list, .list-episodes, .seasons, .Episodes, .ListEpis').length > 0;
    const isSameSeriesPath = parsedHref.pathname === originalPath;
    if (isExplicitList || isSameSeriesPath) {
       if (!episodesMap.has(fullHref)) {
          episodesMap.set(fullHref, { name: epTitle, url: fullHref });
       }
    }
  });

  const scraped = Array.from(episodesMap.values());
  console.log("Filtered count: ", scraped.length);
}
run();
